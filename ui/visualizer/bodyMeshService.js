import { clamp } from "../../engine/utils.js";
import { normalizeAxialTiltDeg } from "./projectionMath.js";
import {
  previewPbrMaterial,
  createCanvasTexture,
  generateCelestialTextureCanvasesLocal,
  buildDescriptorSignature,
  getCachedTextures,
  cacheTextures,
  makeFlatMapCanvas,
  hasLayer,
  shouldFlattenStyleMaps,
  loadFromIDBToCache,
} from "../celestialVisualPreview.js";
import {
  requestCelestialTextureBundle,
  canvasFromMapPayload,
  supportsCelestialTextureWorker,
} from "../celestialTextureWorkerClient.js";
import { composeCelestialDescriptor } from "../celestialComposer.js";

export const BODY_MESH_MIN_PX = 4;

export function vizBodyCacheKey(type, body) {
  const id = body?.id || "";
  if (type === "rocky") return `rocky:${id}`;
  if (type === "gas") return `gas:${id}`;
  if (type === "moon") return `moon:${id}`;
  return id;
}

export function collectBodyMeshWarmItems(snapshot, options = {}) {
  const { hasKey = () => false } = options;
  const needed = [];

  for (const planet of snapshot.planetNodes || []) {
    if (!planet.visualProfile) continue;
    const key = vizBodyCacheKey("rocky", planet);
    if (hasKey(key)) continue;
    needed.push({
      key,
      model: {
        bodyType: "rocky",
        visualProfile: planet.visualProfile,
        axialTiltDeg: normalizeAxialTiltDeg(planet.axialTiltDeg),
      },
    });
  }

  for (const gasGiant of snapshot.gasGiants || []) {
    const key = vizBodyCacheKey("gas", gasGiant);
    if (hasKey(key)) continue;
    needed.push({
      key,
      model: {
        bodyType: "gasGiant",
        styleId: gasGiant.style || "jupiter",
        showRings: !!gasGiant.rings,
        gasCalc: gasGiant.gasCalc,
        axialTiltDeg: normalizeAxialTiltDeg(gasGiant.axialTiltDeg ?? 0),
      },
    });
  }

  for (const parent of [...(snapshot.planetNodes || []), ...(snapshot.gasGiants || [])]) {
    for (const moon of parent.moons || []) {
      if (!moon.moonCalc) continue;
      const key = vizBodyCacheKey("moon", moon);
      if (hasKey(key)) continue;
      needed.push({
        key,
        model: {
          bodyType: "moon",
          moonCalc: moon.moonCalc,
          axialTiltDeg: normalizeAxialTiltDeg(moon.axialTiltDeg),
        },
      });
    }
  }

  return needed;
}

function createOrthoAtmosphereMaterial(THREE) {
  if (typeof THREE.ShaderMaterial !== "function") {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.12,
      color: 0x9cc2ff,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x9cc2ff) },
      uOpacity: { value: 0.12 },
      uPower: { value: 2.15 },
      uFalloff: { value: 0.66 },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      uniform float uFalloff;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float ndv = clamp(dot(normalize(vNormalWorld), normalize(vViewDir)), 0.0, 1.0);
        float rim = pow(max(0.0, 1.0 - ndv), uPower);
        float alpha = clamp(rim * uOpacity, 0.0, 1.0);
        if (alpha < 0.001) discard;
        vec3 color = uColor * mix(uFalloff, 1.0, rim);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

export function createBodyMeshService(options = {}) {
  const {
    documentRef = globalThis.document,
    getCameraState = () => ({ pitch: 0, yaw: 0 }),
    getNativeThree,
    hashUnit,
    isDisposed = () => false,
  } = options;

  if (typeof getNativeThree !== "function") {
    throw new Error("createBodyMeshService requires getNativeThree");
  }
  if (typeof hashUnit !== "function") {
    throw new Error("createBodyMeshService requires hashUnit");
  }

  let sharedGeo = null;
  let bodyMeshWarmGen = 0;
  const bodyMeshCache = new Map();
  const posHelpers = {
    axisQuat: null,
    axisVec: null,
    pitchQ: null,
    yawQ: null,
    yUp: null,
  };

  function getRuntime() {
    return getNativeThree() || null;
  }

  function ensureSharedGeo() {
    const nativeThree = getRuntime();
    if (sharedGeo || !nativeThree) return;
    const THREE = nativeThree.THREE;
    sharedGeo = {
      bodyLow: new THREE.SphereGeometry(1, 32, 24),
      bodyHigh: new THREE.SphereGeometry(1, 112, 84),
      cloudLow: new THREE.SphereGeometry(1.03, 24, 16),
      cloudHigh: new THREE.SphereGeometry(1.03, 90, 64),
      hazeLow: new THREE.SphereGeometry(1.08, 24, 16),
      hazeHigh: new THREE.SphereGeometry(1.08, 90, 64),
    };
  }

  function disposeSharedGeo() {
    if (!sharedGeo) return;
    for (const geometry of Object.values(sharedGeo)) {
      try {
        geometry?.dispose?.();
      } catch {}
    }
    sharedGeo = null;
  }

  function resetPositionHelpers() {
    posHelpers.yUp = null;
    posHelpers.axisVec = null;
    posHelpers.axisQuat = null;
    posHelpers.yawQ = null;
    posHelpers.pitchQ = null;
  }

  function ensurePosHelpers(THREE) {
    if (posHelpers.yUp) return;
    posHelpers.yUp = new THREE.Vector3(0, 1, 0);
    posHelpers.axisVec = new THREE.Vector3();
    posHelpers.axisQuat = new THREE.Quaternion();
    posHelpers.yawQ = new THREE.Quaternion();
    posHelpers.pitchQ = new THREE.Quaternion();
  }

  function swapBodyLod(entry, lod) {
    if (!sharedGeo || entry.lod === lod) return;
    entry.lod = lod;
    entry.body.geometry = lod === "high" ? sharedGeo.bodyHigh : sharedGeo.bodyLow;
    entry.clouds.geometry = lod === "high" ? sharedGeo.cloudHigh : sharedGeo.cloudLow;
    entry.haze.geometry = lod === "high" ? sharedGeo.hazeHigh : sharedGeo.hazeLow;
  }

  function applyMapsToEntry(THREE, entry, maps, descriptor) {
    const nativeThree = getRuntime();
    if (!nativeThree || isDisposed()) return;
    const textureSize = maps.surface?.width || descriptor.textureSize || 128;
    const normalCanvas =
      maps.normal || makeFlatMapCanvas(textureSize, textureSize, [128, 128, 255, 255]);
    const roughnessCanvas =
      maps.roughness || makeFlatMapCanvas(textureSize, textureSize, [180, 180, 180, 255]);
    const emissiveCanvas =
      maps.emissive || makeFlatMapCanvas(textureSize, textureSize, [0, 0, 0, 255]);
    const maxAniso = nativeThree.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
    const aniso = clamp(Math.round(maxAniso), 1, 8);

    if (entry._textures) {
      for (const texture of entry._textures) {
        try {
          texture?.dispose?.();
        } catch {}
      }
    }

    const surfTex = createCanvasTexture(THREE, maps.surface, { srgb: true });
    const cloudTex = createCanvasTexture(THREE, maps.cloud, { srgb: true });
    const normTex = createCanvasTexture(THREE, normalCanvas);
    const roughTex = createCanvasTexture(THREE, roughnessCanvas);
    const emisTex = createCanvasTexture(THREE, emissiveCanvas, { srgb: true });
    for (const texture of [surfTex, cloudTex, normTex, roughTex, emisTex]) {
      texture.anisotropy = aniso;
      texture.premultiplyAlpha = false;
    }

    entry._textures = [surfTex, cloudTex, normTex, roughTex, emisTex];

    const mat = entry.bodyMat;
    mat.color.set(0xffffff);
    mat.map = surfTex;
    mat.normalMap = normTex;
    mat.roughnessMap = roughTex;
    mat.emissiveMap = emisTex;
    mat.emissive?.set?.("#ffffff");
    mat.needsUpdate = true;

    const hasOcean = hasLayer(
      descriptor,
      "ocean-fill",
      (layer) => !layer?.params?.frozen && Number(layer?.params?.coverage || 0) > 0.12,
    );
    const warmEmissive =
      hasLayer(descriptor, "molten-fissures") ||
      hasLayer(descriptor, "volcanic-system") ||
      descriptor.profileId === "lava-world" ||
      descriptor.profileId === "molten-companion" ||
      descriptor.profileId === "io";
    const coolEmissive =
      hasLayer(descriptor, "fractures") ||
      hasLayer(descriptor, "plume-haze") ||
      descriptor.profileId === "europa" ||
      descriptor.profileId === "enceladus" ||
      descriptor.profileId === "triton";

    if (descriptor.bodyType === "gasGiant") {
      mat.roughness = 0.82;
      mat.metalness = 0.03;
      if (mat.normalScale?.set) mat.normalScale.set(0.4, 0.4);
      if ("clearcoat" in mat) mat.clearcoat = 0.02;
      if ("clearcoatRoughness" in mat) mat.clearcoatRoughness = 0.36;
    } else if (descriptor.bodyType === "moon") {
      mat.roughness = 0.82;
      mat.metalness = 0.01;
      if (mat.normalScale?.set) mat.normalScale.set(0.9, 0.9);
      if ("clearcoat" in mat) mat.clearcoat = 0.03;
      if ("clearcoatRoughness" in mat) mat.clearcoatRoughness = 0.58;
    } else {
      mat.roughness = hasOcean ? 0.88 : 0.82;
      mat.metalness = 0.02;
      if (mat.normalScale?.set) {
        const ts = hasOcean ? 0.62 : 0.78;
        mat.normalScale.set(ts, ts);
      }
      if ("clearcoat" in mat) mat.clearcoat = 0.02;
      if ("clearcoatRoughness" in mat) mat.clearcoatRoughness = hasOcean ? 0.3 : 0.48;
    }
    mat.emissiveIntensity = warmEmissive ? 0.72 : coolEmissive ? 0.48 : 0.08;

    entry.cloudMat.map = cloudTex;
    entry.cloudMat.alphaMap = cloudTex;
    entry.cloudMat.needsUpdate = true;
    entry.texturesReady = true;
  }

  async function generateBodyTextures(entry) {
    const nativeThree = getRuntime();
    if (!nativeThree || isDisposed()) return;
    const THREE = nativeThree.THREE;
    const descriptor = entry.descriptor;
    const textureSize = descriptor.textureSize || 128;
    const signature = buildDescriptorSignature(descriptor, textureSize);

    let maps = getCachedTextures(signature);
    if (maps) {
      applyMapsToEntry(THREE, entry, maps, descriptor);
      return;
    }

    if (await loadFromIDBToCache(signature)) {
      if (!getRuntime() || isDisposed()) return;
      maps = getCachedTextures(signature);
      if (maps) {
        applyMapsToEntry(THREE, entry, maps, descriptor);
        return;
      }
    }

    const tinyDesc = composeCelestialDescriptor(entry.model, { lod: "tiny" });
    const tinySig = buildDescriptorSignature(tinyDesc, tinyDesc.textureSize || 64);
    let tinyMaps = getCachedTextures(tinySig);
    if (!tinyMaps) {
      tinyMaps = generateCelestialTextureCanvasesLocal(tinyDesc, tinyDesc.textureSize || 64);
      cacheTextures(tinySig, tinyMaps);
    }
    if (!getRuntime() || isDisposed()) return;
    applyMapsToEntry(THREE, entry, tinyMaps, descriptor);

    if (supportsCelestialTextureWorker()) {
      try {
        const result = await requestCelestialTextureBundle({
          signature,
          descriptor,
          textureSize,
        });
        if (!getRuntime() || isDisposed()) return;
        const workerMaps = {
          surface: canvasFromMapPayload(result?.maps?.surface),
          cloud: canvasFromMapPayload(result?.maps?.cloud),
          normal: canvasFromMapPayload(result?.maps?.normal),
          roughness: canvasFromMapPayload(result?.maps?.roughness),
          emissive: canvasFromMapPayload(result?.maps?.emissive),
        };
        if (workerMaps.surface && workerMaps.cloud && workerMaps.normal) {
          cacheTextures(signature, workerMaps);
          applyMapsToEntry(THREE, entry, workerMaps, descriptor);
          return;
        }
      } catch {
        // Fall through to local generation.
      }
    }

    if (!getRuntime() || isDisposed()) return;
    maps = generateCelestialTextureCanvasesLocal(descriptor, textureSize);
    cacheTextures(signature, maps);
    applyMapsToEntry(THREE, entry, maps, descriptor);
  }

  function createBodyMeshEntry(model, key) {
    const nativeThree = getRuntime();
    if (!nativeThree || !sharedGeo) return null;
    const THREE = nativeThree.THREE;
    const descriptor = composeCelestialDescriptor(model, { lod: "low" });
    const group = new THREE.Group();
    group.visible = false;

    const bodyMat = previewPbrMaterial(THREE);
    const baseGrad = (descriptor?.layers || []).find((layer) => layer?.id === "base-gradient");
    if (baseGrad?.params?.c1) bodyMat.color.set(baseGrad.params.c1);
    const body = new THREE.Mesh(sharedGeo.bodyLow, bodyMat);
    body.renderOrder = 0;
    group.add(body);

    const flattenMaps = shouldFlattenStyleMaps(descriptor);
    const showCloudShell =
      !flattenMaps && descriptor.bodyType !== "gasGiant" && !!descriptor.clouds?.enabled;
    const cloudMat = new THREE.MeshStandardMaterial({
      map: null,
      alphaMap: null,
      transparent: true,
      opacity: showCloudShell ? clamp(Number(descriptor.clouds?.opacity) || 0.2, 0.04, 0.9) : 0,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(sharedGeo.cloudLow, cloudMat);
    clouds.renderOrder = 2;
    clouds.visible = showCloudShell;
    clouds.scale.setScalar(showCloudShell ? Number(descriptor.clouds?.scale) || 1.03 : 1.03);
    group.add(clouds);

    const showHaze = !!descriptor.atmosphere?.enabled;
    const hazeMat = createOrthoAtmosphereMaterial(THREE);
    const haze = new THREE.Mesh(sharedGeo.hazeLow, hazeMat);
    haze.renderOrder = 3;
    haze.visible = showHaze;
    haze.scale.setScalar(showHaze ? Number(descriptor.atmosphere?.scale) || 1.06 : 1.06);
    const hazeColour = descriptor.atmosphere?.colour || "#90b4ec";
    const hazeOpacity = showHaze
      ? clamp(Number(descriptor.atmosphere?.opacity) || 0.12, 0.03, 0.4)
      : 0;
    const hazeScale = clamp(Number(descriptor.atmosphere?.scale) || 1.06, 1, 1.6);
    if (hazeMat.uniforms?.uColor) {
      hazeMat.uniforms.uColor.value.set(hazeColour);
      hazeMat.uniforms.uOpacity.value = hazeOpacity;
      const powerBase =
        descriptor.bodyType === "gasGiant" ? 1.85 : descriptor.bodyType === "moon" ? 2.45 : 2.15;
      hazeMat.uniforms.uPower.value = clamp(powerBase - (hazeScale - 1) * 1.05, 1.35, 2.8);
      hazeMat.uniforms.uFalloff.value =
        descriptor.bodyType === "gasGiant" ? 0.72 : descriptor.bodyType === "moon" ? 0.62 : 0.66;
    } else {
      hazeMat.color?.set?.(hazeColour);
      hazeMat.opacity = hazeOpacity;
    }
    group.add(haze);

    let ring = null;
    let ringMat = null;
    if (descriptor.ring?.enabled) {
      const inner = clamp(Number(descriptor.ring.inner) || 1.22, 1.1, 2.5);
      const outer = clamp(Number(descriptor.ring.outer) || 1.95, inner + 0.05, 3.2);
      const ringGeom = new THREE.RingGeometry(inner, outer, 128);
      const alphaCanvas = documentRef?.createElement?.("canvas");
      if (alphaCanvas) {
        alphaCanvas.width = 1;
        alphaCanvas.height = 64;
        const rCtx = alphaCanvas.getContext("2d");
        const rImg = rCtx?.createImageData?.(1, 64);
        if (rCtx && rImg) {
          for (let index = 0; index < 64; index += 1) {
            const t = index / 63;
            const fadeIn = Math.min(1, t / 0.18);
            const fadeOut = Math.min(1, (1 - t) / 0.18);
            const value = Math.round(Math.min(fadeIn, fadeOut) * 255);
            rImg.data[index * 4] = value;
            rImg.data[index * 4 + 1] = value;
            rImg.data[index * 4 + 2] = value;
            rImg.data[index * 4 + 3] = 255;
          }
          rCtx.putImageData(rImg, 0, 0);
        }
      }
      const ringAlpha = alphaCanvas ? new THREE.CanvasTexture(alphaCanvas) : null;
      if (ringAlpha) {
        ringAlpha.minFilter = THREE.LinearFilter;
        ringAlpha.magFilter = THREE.LinearFilter;
        ringAlpha.generateMipmaps = false;
        ringAlpha.premultiplyAlpha = false;
      }

      ringMat = new THREE.MeshBasicMaterial({
        color: descriptor.ring.colour || "#d8c7a8",
        transparent: true,
        opacity: clamp(Number(descriptor.ring.opacity) || 0.35, 0.05, 0.8),
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        alphaMap: ringAlpha,
        toneMapped: false,
      });
      ring = new THREE.Mesh(ringGeom, ringMat);
      ring.renderOrder = 1;
      ring.rotation.x = THREE.MathUtils.degToRad(Number(descriptor.ring.tiltDeg) || 100);
      ring.rotation.z = THREE.MathUtils.degToRad(Number(descriptor.ring.yawDeg) || 20);
      group.add(ring);
    }

    nativeThree.bodyGroup.add(group);
    const entry = {
      group,
      body,
      clouds,
      haze,
      ring,
      ringMat,
      bodyMat,
      cloudMat,
      hazeMat,
      descriptor,
      model,
      texturesReady: false,
      lod: "low",
    };
    bodyMeshCache.set(key, entry);
    void generateBodyTextures(entry);
    return entry;
  }

  async function warmBodyMeshes(snapshot) {
    if (!getRuntime() || isDisposed()) return;
    ensureSharedGeo();
    const gen = ++bodyMeshWarmGen;
    const needed = collectBodyMeshWarmItems(snapshot, {
      hasKey(key) {
        return bodyMeshCache.has(key);
      },
    });
    for (const item of needed) {
      if (gen !== bodyMeshWarmGen || isDisposed()) return;
      createBodyMeshEntry(item.model, item.key);
    }
  }

  function disposeBodyMeshCache() {
    for (const [, entry] of bodyMeshCache) {
      if (entry._textures) {
        for (const texture of entry._textures) {
          try {
            texture?.dispose?.();
          } catch {}
        }
      }
      for (const mat of [entry.bodyMat, entry.cloudMat, entry.hazeMat, entry.ringMat]) {
        try {
          mat?.dispose?.();
        } catch {}
      }
      if (entry.ring) {
        try {
          entry.ring.geometry?.dispose?.();
        } catch {}
      }
      try {
        entry.group?.parent?.remove?.(entry.group);
      } catch {}
    }
    bodyMeshCache.clear();
  }

  function positionBodyMesh(options) {
    const { axialTiltDeg, bodyId, bodyZ, key, model, pos, pr, spinAngle, touched } = options;
    if (!sharedGeo || pr < BODY_MESH_MIN_PX) return null;
    const nativeThree = getRuntime();
    if (!nativeThree) return null;

    let entry = bodyMeshCache.get(key);
    if (!entry) entry = createBodyMeshEntry(model, key);
    if (!entry) return null;

    const THREE = nativeThree.THREE;
    ensurePosHelpers(THREE);

    const targetLod = pr >= 12 ? "high" : "low";
    if (entry.lod !== targetLod) swapBodyLod(entry, targetLod);

    entry.group.scale.setScalar(pr);
    entry.group.position.set(pos.x, pos.y, bodyZ);

    const { pitch = 0, yaw = 0 } = getCameraState() || {};
    const tilt = normalizeAxialTiltDeg(axialTiltDeg);
    const retrograde = tilt > 90;
    const obliquityRad = ((retrograde ? 180 - tilt : tilt) * Math.PI) / 180;
    const azimuth = hashUnit(`${bodyId}:axis`) * Math.PI * 2;
    const h = Math.sin(obliquityRad);
    posHelpers.axisVec
      .set(
        h * Math.cos(azimuth),
        Math.cos(obliquityRad) * (retrograde ? -1 : 1),
        h * Math.sin(azimuth),
      )
      .normalize();
    posHelpers.axisQuat.setFromUnitVectors(posHelpers.yUp, posHelpers.axisVec);
    posHelpers.yawQ.setFromAxisAngle(posHelpers.yUp, yaw);
    posHelpers.pitchQ.setFromAxisAngle(posHelpers.axisVec.set(1, 0, 0), pitch);
    posHelpers.pitchQ.multiply(posHelpers.yawQ);
    entry.group.quaternion.multiplyQuaternions(posHelpers.pitchQ, posHelpers.axisQuat);

    entry.body.rotation.set(0, spinAngle, 0);
    if (entry.clouds.visible) entry.clouds.rotation.set(0, spinAngle * 1.25, 0);
    if (entry.haze.visible) entry.haze.rotation.set(0, spinAngle * 0.35, 0);

    entry.group.visible = true;
    touched?.add?.(key);
    return entry;
  }

  function hideUntouched(touched) {
    for (const [key, entry] of bodyMeshCache) {
      if (!touched.has(key)) entry.group.visible = false;
    }
  }

  return {
    disposeBodyMeshCache,
    disposeSharedGeo,
    hideUntouched,
    positionBodyMesh,
    resetPositionHelpers,
    warmBodyMeshes,
  };
}
