// SPDX-License-Identifier: MPL-2.0
import { loadThreeCore } from "./threeBridge2d.js";
import { gasAssetPath, moonAssetPath, rockyAssetPath } from "./threeRenderAssetMap.js";

const RUNTIMES = new Map();
const TEXTURES = new Map();
const TEXTURE_TASKS = new Map();
const PENDING = new Map();

function disposeRuntime(runtime) {
  if (!runtime) return;
  try {
    runtime.body?.geometry?.dispose?.();
  } catch {}
  try {
    runtime.body?.material?.dispose?.();
  } catch {}
  try {
    runtime.ring?.geometry?.dispose?.();
  } catch {}
  try {
    runtime.ring?.material?.dispose?.();
  } catch {}
  try {
    runtime.renderer?.forceContextLoss?.();
  } catch {}
  try {
    runtime.renderer?.dispose?.();
  } catch {}
}

function cleanupDetachedRuntimes() {
  for (const [canvas, runtime] of RUNTIMES.entries()) {
    if (canvas?.isConnected) continue;
    disposeRuntime(runtime);
    RUNTIMES.delete(canvas);
  }
  for (const [canvas] of PENDING.entries()) {
    if (canvas?.isConnected) continue;
    PENDING.delete(canvas);
  }
}

function clampDpr(dpr) {
  const n = Number(dpr);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(3, n));
}

function shaderMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {
      mapTex: { value: null },
      lightDir: { value: new THREE.Vector3(-0.6, 0.45, 0.7).normalize() },
      ambient: { value: 0.3 },
      diffuse: { value: 0.75 },
      rim: { value: 0.2 },
      alpha: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D mapTex;
      uniform vec3 lightDir;
      uniform float ambient;
      uniform float diffuse;
      uniform float rim;
      uniform float alpha;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vec4 tex = texture2D(mapTex, vUv);
        if (tex.a < 0.01) discard;
        vec3 n = normalize(vNormal);
        float ndl = max(dot(n, normalize(lightDir)), 0.0);
        float rimAmt = pow(1.0 - max(n.z, 0.0), 2.2);
        float shade = ambient + ndl * diffuse + rimAmt * rim;
        vec3 col = tex.rgb * shade;
        gl_FragColor = vec4(col, tex.a * alpha);
      }
    `,
    transparent: true,
    depthWrite: true,
  });
}

async function initRuntime(canvas) {
  const THREE = await loadThreeCore();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(1);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const bodyGeom = new THREE.SphereGeometry(1, 64, 48);
  const bodyMat = shaderMaterial(THREE);
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  scene.add(body);

  const ringGeom = new THREE.RingGeometry(1.35, 2.1, 120);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd8c7a8,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.renderOrder = 1;
  ring.rotation.x = THREE.MathUtils.degToRad(100);
  ring.visible = false;
  scene.add(ring);

  const fill = new THREE.HemisphereLight(0xffffff, 0x0a1120, 0.7);
  scene.add(fill);

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-3, 2, 3);
  scene.add(key);

  renderer.render(scene, camera);

  return { THREE, renderer, scene, camera, body, ring, ringMat };
}

async function getRuntime(canvas) {
  cleanupDetachedRuntimes();
  const existing = RUNTIMES.get(canvas);
  if (existing) {
    if (!canvas?.isConnected) {
      disposeRuntime(existing);
      RUNTIMES.delete(canvas);
      return null;
    }
    return existing;
  }
  const task = PENDING.get(canvas);
  if (task) return task;

  const promise = initRuntime(canvas)
    .then((runtime) => {
      if (!canvas.isConnected) {
        disposeRuntime(runtime);
        return null;
      }
      RUNTIMES.set(canvas, runtime);
      PENDING.delete(canvas);
      return runtime;
    })
    .catch(() => {
      PENDING.delete(canvas);
      return null;
    });

  PENDING.set(canvas, promise);
  return promise;
}

async function getTextureAsync(THREE, path) {
  const key = String(path || "");
  if (!key) return null;

  const existing = TEXTURES.get(key);
  if (existing?.image) return existing;

  const pending = TEXTURE_TASKS.get(key);
  if (pending) return pending;

  const loader = new THREE.TextureLoader();
  const task = new Promise((resolve, reject) => {
    const texture = loader.load(
      key,
      () => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        TEXTURES.set(key, texture);
        TEXTURE_TASKS.delete(key);
        resolve(texture);
      },
      undefined,
      (err) => {
        TEXTURE_TASKS.delete(key);
        reject(err);
      },
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  });
  TEXTURE_TASKS.set(key, task);
  return task;
}

function sizeCanvas(runtime, canvas, opts = {}) {
  const dpr = clampDpr(window.devicePixelRatio || 1);
  const w = Number(opts.width) || Number(canvas.clientWidth) || Number(canvas.width) || 180;
  const h = Number(opts.height) || Number(canvas.clientHeight) || Number(canvas.height) || w;
  const pxW = Math.max(1, Math.round(w * dpr));
  const pxH = Math.max(1, Math.round(h * dpr));

  runtime.renderer.setSize(pxW, pxH, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  runtime.renderer.setPixelRatio(1);
  runtime.camera.aspect = w / Math.max(1, h);
  runtime.camera.updateProjectionMatrix();
}

function render(runtime, texture, opts = {}) {
  if (!texture) return false;
  runtime.body.material.uniforms.mapTex.value = texture;
  runtime.body.rotation.y = Number(opts.spinRad) || 0;
  runtime.body.rotation.z = runtime.THREE.MathUtils.degToRad(Number(opts.tiltDeg) || 0);
  runtime.ring.visible = !!opts.showRings;
  runtime.ring.rotation.z = runtime.THREE.MathUtils.degToRad(Number(opts.ringYawDeg) || 0);
  runtime.ringMat.opacity = Number.isFinite(opts.ringOpacity)
    ? Math.max(0.05, Math.min(0.9, Number(opts.ringOpacity)))
    : 0.45;
  runtime.renderer.render(runtime.scene, runtime.camera);
  return true;
}

async function renderAssetPreview(canvas, assetPath, opts = {}) {
  if (!canvas) return false;
  const runtime = await getRuntime(canvas);
  if (!runtime || !canvas.isConnected) return false;
  sizeCanvas(runtime, canvas, opts);
  try {
    const texture = await getTextureAsync(runtime.THREE, assetPath);
    return render(runtime, texture, opts);
  } catch {
    return false;
  }
}

export function renderRockyPreviewNative(canvas, profile, opts = {}) {
  const path = rockyAssetPath(profile);
  return renderAssetPreview(canvas, path, opts);
}

export function renderRockyRecipePreviewNative(canvas, recipe, opts = {}) {
  const id = String(recipe?.id || "default");
  const path = `./assets/three-renders/rocky/${encodeURIComponent(id)}.svg`;
  return renderAssetPreview(canvas, path, opts);
}

export function renderGasPreviewNative(canvas, styleId, opts = {}) {
  const path = gasAssetPath(styleId);
  return renderAssetPreview(canvas, path, opts);
}

export function renderGasRecipePreviewNative(canvas, recipe, opts = {}) {
  const styleId = recipe?.preview?.styleId || "jupiter";
  return renderGasPreviewNative(canvas, styleId, { ...opts, showRings: !!recipe?.preview?.rings });
}

export function renderMoonPreviewNative(canvas, profile, opts = {}) {
  const path = moonAssetPath(profile);
  return renderAssetPreview(canvas, path, opts);
}

export function renderMoonRecipePreviewNative(canvas, recipe, opts = {}) {
  const id = String(recipe?.id || "default");
  const path = `./assets/three-renders/moons/${encodeURIComponent(id)}.svg`;
  return renderAssetPreview(canvas, path, opts);
}
