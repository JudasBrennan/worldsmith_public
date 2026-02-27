import { loadThreeCore } from "./threeBridge2d.js";
import { computeMoonVisualProfile } from "./moonStyles.js";
import { computeRockyVisualProfile } from "./rockyPlanetStyles.js";
import { gasAssetPath, moonAssetPath, rockyAssetPath } from "./threeRenderAssetMap.js";

const RUNTIME = new WeakMap();
const PENDING = new WeakMap();
const TEXTURES = new Map();
const TEXT_TEXTURES = new Map();
let warned = false;

function clampDpr(dpr) {
  const n = Number(dpr);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(3, n));
}

function hexToNumber(hex) {
  const h = String(hex || "")
    .replace("#", "")
    .trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0xffffff;
  return Number.parseInt(h, 16);
}

async function ensureRuntime(canvas) {
  const existing = RUNTIME.get(canvas);
  if (existing) return existing;
  const pending = PENDING.get(canvas);
  if (pending) return pending;
  const promise = loadThreeCore()
    .then((THREE) => {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 100, 100, 0, -2000, 2000);
      camera.position.set(0, 0, 40);
      camera.lookAt(0, 0, 0);
      const group = new THREE.Group();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const key = new THREE.DirectionalLight(0xffffff, 0.75);
      key.position.set(-3, 1.8, 2.5);
      scene.add(key);
      const rt = { THREE, renderer, scene, camera, group, loader: new THREE.TextureLoader() };
      renderer.render(scene, camera);
      RUNTIME.set(canvas, rt);
      PENDING.delete(canvas);
      return rt;
    })
    .catch((err) => {
      PENDING.delete(canvas);
      if (!warned) {
        warned = true;
        console.warn("[WorldSmith] Native apparent-sky renderer unavailable.", err);
      }
      return null;
    });
  PENDING.set(canvas, promise);
  return promise;
}

function clearGroup(group) {
  while (group.children.length) {
    const c = group.children.pop();
    try {
      group.remove(c);
    } catch {}
    try {
      c.geometry?.dispose?.();
    } catch {}
    try {
      c.material?.dispose?.();
    } catch {}
  }
}

function tex(runtime, path) {
  if (!path) return null;
  const key = String(path);
  if (TEXTURES.has(key)) return TEXTURES.get(key);
  const t = runtime.loader.load(key);
  t.minFilter = runtime.THREE.LinearFilter;
  t.magFilter = runtime.THREE.LinearFilter;
  t.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) t.colorSpace = runtime.THREE.SRGBColorSpace;
  TEXTURES.set(key, t);
  return t;
}

function getTextTexture(runtime, text, opts = {}) {
  const value = String(text ?? "");
  if (!value) return null;
  const font = String(opts.font || "11px system-ui, sans-serif");
  const color = String(opts.color || "rgba(232,236,248,0.9)");
  const key = `${font}|${color}|${value}`;
  if (TEXT_TEXTURES.has(key)) return TEXT_TEXTURES.get(key);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  const fontMatch = /([0-9]+(?:\.[0-9]+)?)px/.exec(font);
  const fontPx = fontMatch ? Number(fontMatch[1]) : 12;
  const w = Math.max(1, Math.ceil(ctx.measureText(value).width + 8));
  const h = Math.max(1, Math.ceil(fontPx + 8));
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillText(value, w / 2, h / 2 + 0.5);
  const tex = new runtime.THREE.CanvasTexture(c);
  tex.minFilter = runtime.THREE.LinearFilter;
  tex.magFilter = runtime.THREE.LinearFilter;
  tex.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) tex.colorSpace = runtime.THREE.SRGBColorSpace;
  TEXT_TEXTURES.set(key, tex);
  return tex;
}

function addSprite(runtime, path, x, y, size, z = 0, tint = 0xffffff, opacity = 1) {
  const mat = new runtime.THREE.SpriteMaterial({
    map: tex(runtime, path) || null,
    color: tint,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const s = new runtime.THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  runtime.group.add(s);
}

function addText(runtime, text, x, y, z = 6, opts = {}) {
  const tex = getTextTexture(runtime, text, opts);
  if (!tex) return;
  const img = tex.image;
  const mat = new runtime.THREE.SpriteMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    opacity: Number.isFinite(opts.opacity) ? opts.opacity : 1,
    depthWrite: false,
  });
  const s = new runtime.THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(Math.max(1, Number(img?.width) || 16), Math.max(1, Number(img?.height) || 10), 1);
  runtime.group.add(s);
}

function addReferenceRing(runtime, x, y, r, label, isNight) {
  const ring = new runtime.THREE.RingGeometry(Math.max(1.2, r - 0.5), r + 0.5, 80);
  const mat = new runtime.THREE.MeshBasicMaterial({
    color: isNight ? 0xa4badf : 0x3f567f,
    transparent: true,
    opacity: 0.33,
    side: runtime.THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new runtime.THREE.Mesh(ring, mat);
  mesh.position.set(x, y, -1.5);
  runtime.group.add(mesh);
  addText(runtime, label, x + r + 16, y - r + 3, 5.2, {
    font: "9px system-ui, sans-serif",
    color: isNight ? "rgba(190,202,232,0.74)" : "rgba(240,240,245,0.86)",
  });
}

function addStar(runtime, x, y, coreRadius, tint = 0xfff4dc, z = -2) {
  const THREE = runtime.THREE;
  const addLayer = (radius, opacity, dz, blending = THREE.NormalBlending, color = tint) => {
    const g = new THREE.CircleGeometry(Math.max(1, radius), 96);
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      blending,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z + dz);
    runtime.group.add(mesh);
  };
  addLayer(coreRadius * 2.5, 0.08, -0.3, THREE.AdditiveBlending);
  addLayer(coreRadius * 1.8, 0.14, -0.18, THREE.AdditiveBlending);
  addLayer(coreRadius * 1.2, 0.24, -0.1, THREE.AdditiveBlending);
  addLayer(coreRadius, 0.98, 0, THREE.NormalBlending, tint);
  addLayer(coreRadius * 0.5, 0.6, 0.04, THREE.AdditiveBlending, 0xffffff);
}

export async function drawSkyCanvasNative(
  canvas,
  model,
  starColourHex,
  skyMode,
  moonPhaseDeg,
  skyColours,
  onReady = null,
) {
  const runtime = await ensureRuntime(canvas);
  if (!runtime) return false;

  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect?.();
  if (!rect || rect.width < 10 || rect.height < 10) return false;
  const dpr = clampDpr(window.devicePixelRatio || 1);
  const W = rect.width;
  const H = rect.height;
  runtime.renderer.setSize(
    Math.max(1, Math.round(W * dpr)),
    Math.max(1, Math.round(H * dpr)),
    false,
  );
  runtime.renderer.setPixelRatio(1);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  runtime.camera.left = 0;
  runtime.camera.right = W;
  runtime.camera.top = H;
  runtime.camera.bottom = 0;
  runtime.camera.updateProjectionMatrix();
  clearGroup(runtime.group);

  const isNight = skyMode !== "day";
  const dayColor = hexToNumber(skyColours?.dayHex || "#5da2df");
  runtime.renderer.setClearColor(isNight ? 0x060b1b : dayColor, 1);
  if (isNight) {
    const count = 52;
    const pos = new Float32Array(count * 3);
    let s = 42;
    for (let i = 0; i < count; i++) {
      s = (s * 1664525 + 1013904223) | 0;
      const rx = ((s >>> 0) % 10000) / 10000;
      s = (s * 1664525 + 1013904223) | 0;
      const ry = ((s >>> 0) % 10000) / 10000;
      pos[i * 3] = rx * W;
      pos[i * 3 + 1] = ry * H;
      pos[i * 3 + 2] = -12;
    }
    const geom = new runtime.THREE.BufferGeometry();
    geom.setAttribute("position", new runtime.THREE.BufferAttribute(pos, 3));
    const mat = new runtime.THREE.PointsMaterial({
      color: 0xd9e4ff,
      size: 1.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    runtime.group.add(new runtime.THREE.Points(geom, mat));
  }

  const homeStar = model.starByOrbit[0];
  const starArcsec = homeStar?.angularDiameterArcsec || 0;
  const moons = model.moons.filter(
    (m) => Number.isFinite(m.angularDiameterArcsec) && m.angularDiameterArcsec > 0,
  );
  const bodies = model.bodiesFromHome.filter(
    (b) => Number.isFinite(b.angularDiameterArcsec) && b.angularDiameterArcsec > 0,
  );
  const solSun = 1896;
  const solMoon = 1866;
  const solVenus = 64;
  const solJupiter = 50;
  const solMars = 25;
  const maxMoon = moons.reduce((m, o) => Math.max(m, o.angularDiameterArcsec), 0);
  const maxBody = bodies.reduce((m, o) => Math.max(m, o.angularDiameterArcsec), 0);
  const maxNonStar = Math.max(maxMoon, maxBody);
  const split = starArcsec > 0 && maxNonStar > 0 && starArcsec > 10 * maxNonStar;
  const maxDiskR = H * 0.26;
  let starScale = 0;
  let rightScale = 0;
  let starX = W * 0.16;
  let rightStart = W * 0.35;
  if (split) {
    const starRegion = W * 0.3;
    starScale = Math.min(maxDiskR / (starArcsec / 2), (starRegion * 0.8) / starArcsec);
    const ref = Math.max(maxNonStar, solSun, solMoon);
    rightScale = maxDiskR / (ref / 2);
  } else if (starArcsec > 0) {
    const maxAll = Math.max(starArcsec, maxNonStar, solSun, solMoon);
    const slots = Math.max(2, 1 + moons.length + bodies.length);
    const spacing = W / (slots + 1);
    starScale = Math.min(maxDiskR / (maxAll / 2), (spacing * 0.8) / maxAll);
    rightScale = starScale;
    starX = spacing;
    rightStart = spacing * 2;
  } else {
    const ref = Math.max(1, maxNonStar);
    rightScale = maxDiskR / (ref / 2);
    rightStart = W * 0.12;
  }
  const y = H * 0.4;

  if (starArcsec > 0 && starScale > 0) {
    const r = Math.max(2, (starArcsec / 2) * starScale);
    addStar(runtime, starX, y, r, hexToNumber(starColourHex), -2);
    const scaleNote = split
      ? ` (x${Math.max(1, Math.round(rightScale / Math.max(0.001, starScale)))})`
      : "";
    addText(runtime, `Star${scaleNote}`, starX, H - 14, 6.5, {
      font: "11px system-ui, sans-serif",
      color: isNight ? "rgba(232,236,248,0.9)" : "rgba(255,255,255,0.95)",
    });
    addText(
      runtime,
      starArcsec >= 60 ? `${(starArcsec / 60).toFixed(1)}′` : `${starArcsec.toFixed(1)}″`,
      starX,
      H - 2,
      6.5,
      {
        font: "10px monospace",
        color: isNight ? "rgba(170,184,214,0.82)" : "rgba(255,255,255,0.85)",
      },
    );
    const solR = (solSun / 2) * starScale;
    if (solR >= 2) addReferenceRing(runtime, starX, y, solR, "Sol", isNight);
  }

  const objects = [
    ...moons.map((m) => ({ type: "moon", entry: m, a: m.angularDiameterArcsec })),
    ...bodies.map((b) => ({ type: "body", entry: b, a: b.angularDiameterArcsec })),
  ];
  const rightW = W - rightStart - 10;
  const spacing = rightW / Math.max(1, objects.length + 1);
  objects.forEach((obj, i) => {
    const cx = rightStart + spacing * (i + 1);
    const size = Math.max(2, obj.a * rightScale);
    if (obj.type === "moon") {
      const p = moonAssetPath(computeMoonVisualProfile(obj.entry.moonCalc || {}));
      addSprite(runtime, p, cx, y, size, 2, 0xffffff, 0.96);
      const phase = Math.max(0, Math.min(1, Number(moonPhaseDeg) / 180));
      if (phase > 0.02 && size > 5) {
        const shadowGeom = new runtime.THREE.CircleGeometry(size * 0.5, 48);
        const shadowMat = new runtime.THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: (isNight ? 0.7 : 0.55) * phase,
          depthWrite: false,
        });
        const shadow = new runtime.THREE.Mesh(shadowGeom, shadowMat);
        shadow.position.set(cx + size * (0.25 + phase * 0.25), y, 2.4);
        runtime.group.add(shadow);
      }
      addText(runtime, obj.entry.name || "Moon", cx, H - 14, 7, {
        font: "11px system-ui, sans-serif",
        color: isNight ? "rgba(232,236,248,0.9)" : "rgba(255,255,255,0.95)",
      });
      addText(
        runtime,
        obj.a >= 60 ? `${(obj.a / 60).toFixed(1)}′` : `${obj.a.toFixed(1)}″`,
        cx,
        H - 2,
        7,
        {
          font: "10px monospace",
          color: isNight ? "rgba(170,184,214,0.82)" : "rgba(255,255,255,0.85)",
        },
      );
      return;
    }
    const b = obj.entry;
    if (
      String(b.classLabel || "")
        .toLowerCase()
        .includes("gas")
    ) {
      addSprite(runtime, gasAssetPath(b._styleId || "jupiter"), cx, y, size, 2, 0xffffff, 0.98);
    } else {
      const rp = rockyAssetPath(computeRockyVisualProfile(b._derived || {}, b._planetInputs || {}));
      addSprite(runtime, rp, cx, y, size, 2, 0xffffff, 0.98);
    }
    addText(runtime, b.name || "Body", cx, H - 14, 7, {
      font: "11px system-ui, sans-serif",
      color: isNight ? "rgba(232,236,248,0.9)" : "rgba(255,255,255,0.95)",
    });
    addText(
      runtime,
      obj.a >= 60 ? `${(obj.a / 60).toFixed(1)}′` : `${obj.a.toFixed(1)}″`,
      cx,
      H - 2,
      7,
      {
        font: "10px monospace",
        color: isNight ? "rgba(170,184,214,0.82)" : "rgba(255,255,255,0.85)",
      },
    );
  });

  if (objects.length > 0 && rightScale > 0) {
    const refCx = rightStart + spacing;
    const moonR = (solMoon / 2) * rightScale;
    const sunR = (solSun / 2) * rightScale;
    if (sunR >= 2) addReferenceRing(runtime, refCx, y, sunR, "Sol", isNight);
    if (moonR >= 2) addReferenceRing(runtime, refCx, y, moonR, "Luna", isNight);
    const planetCx = rightStart + spacing * objects.length;
    const refs = [
      { a: solVenus, l: "Venus" },
      { a: solJupiter, l: "Jupiter" },
      { a: solMars, l: "Mars" },
    ];
    for (const ref of refs) {
      const rr = (ref.a / 2) * rightScale;
      if (rr >= 1.5) addReferenceRing(runtime, planetCx, y, rr, ref.l, isNight);
    }
  }

  if (starArcsec <= 0 && objects.length === 0) {
    addText(runtime, "No objects to display", W * 0.5, H * 0.5, 8, {
      font: "13px system-ui, sans-serif",
      color: isNight ? "rgba(180,195,230,0.70)" : "rgba(110,120,145,0.70)",
    });
  }

  runtime.renderer.render(runtime.scene, runtime.camera);
  try {
    onReady?.();
  } catch {}
  return true;
}

export function disposeSkyCanvasNative(canvas) {
  if (!canvas) return;
  const runtime = RUNTIME.get(canvas);
  if (!runtime) return;
  try {
    clearGroup(runtime.group);
  } catch {}
  try {
    runtime.renderer?.dispose?.();
  } catch {}
  RUNTIME.delete(canvas);
  PENDING.delete(canvas);
}
