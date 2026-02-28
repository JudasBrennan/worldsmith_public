import { loadThreeCore } from "./threeBridge2d.js";
import { renderCelestialRecipeSnapshot, renderStarSnapshot } from "./celestialVisualPreview.js";
import { computeRockyVisualProfile } from "./rockyPlanetStyles.js";

const RUNTIME = new WeakMap();
const PENDING = new WeakMap();
const SNAP_CACHE = new Map();
const TEXT_TEXTURES = new Map();
let warned = false;
let _drawGen = 0;

/* ── star snapshot fill fraction (matches system poster) ────── */
const STAR_FILL = 0.22;

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
      const rt = { THREE, renderer, scene, camera, group };
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

/* ── Snapshot canvas helpers (mirror systemPosterNativeThree.js) ── */

function snapKey(obj) {
  if (obj.type === "moon") {
    const mc = obj.entry.moonCalc;
    return `moon:${mc?.display?.displayClass || ""}:${mc?.display?.surfaceClass || ""}`;
  }
  const b = obj.entry;
  if (
    String(b.classLabel || "")
      .toLowerCase()
      .includes("gas")
  ) {
    return `gas:${b._styleId || "jupiter"}`;
  }
  const vp = b._derived
    ? JSON.stringify(computeRockyVisualProfile(b._derived, b._planetInputs || {}))
    : "";
  return `rocky:${b.id || ""}:${vp}`;
}

async function ensureBodySnap(obj) {
  const key = snapKey(obj);
  if (SNAP_CACHE.has(key)) return SNAP_CACHE.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const b = obj.entry;
  let model;
  if (obj.type === "moon") {
    model = { bodyType: "moon", moonCalc: b.moonCalc };
  } else if (
    String(b.classLabel || "")
      .toLowerCase()
      .includes("gas")
  ) {
    model = { bodyType: "gasGiant", styleId: b._styleId || "jupiter" };
  } else {
    model = {
      bodyType: "rocky",
      visualProfile: computeRockyVisualProfile(b._derived || {}, b._planetInputs || {}),
    };
  }
  await renderCelestialRecipeSnapshot(canvas, model);
  SNAP_CACHE.set(key, canvas);
  return canvas;
}

function ensureStarSnap(starColourHex, starData) {
  const key = `star:${starColourHex || ""}:${Math.round(Number(starData?.starTempK) || 5778)}`;
  if (SNAP_CACHE.has(key)) return SNAP_CACHE.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 384;
  renderStarSnapshot(
    canvas,
    {
      starColourHex,
      starTempK: starData?.starTempK,
      starMassMsol: starData?.starMassMsol,
      starAgeGyr: starData?.starAgeGyr,
    },
    STAR_FILL,
  );
  SNAP_CACHE.set(key, canvas);
  return canvas;
}

/* ── Three.js sprite helpers ─────────────────────────────────── */

function addGlow(runtime, x, y, radius, z = 1, color = "#ffffff", opacity = 0.45) {
  const glowSize = 64;
  const c = document.createElement("canvas");
  c.width = glowSize;
  c.height = glowSize;
  const ctx = c.getContext("2d");
  const cx = glowSize / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, color);
  grad.addColorStop(0.12, color);
  grad.addColorStop(0.4, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, glowSize, glowSize);
  const t = new runtime.THREE.CanvasTexture(c);
  t.minFilter = runtime.THREE.LinearFilter;
  t.magFilter = runtime.THREE.LinearFilter;
  t.generateMipmaps = false;
  const mat = new runtime.THREE.SpriteMaterial({
    map: t,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: runtime.THREE.AdditiveBlending,
  });
  const s = new runtime.THREE.Sprite(mat);
  s.position.set(x, y, z);
  const spread = Math.max(6, radius * 3);
  s.scale.set(spread, spread, 1);
  runtime.group.add(s);
  return s;
}

function makePhaseShadow(phaseDeg) {
  const sz = 128;
  const c = document.createElement("canvas");
  c.width = sz;
  c.height = sz;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const r = sz / 2;
  const phase = ((phaseDeg % 360) + 360) % 360;
  const frac = phase / 180;
  const illum = phase <= 180 ? 1 - frac : frac - 1;
  const tScale = Math.abs(illum) * 2 - 1;
  const litOnRight = phase <= 180;
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.beginPath();
  if (litOnRight) {
    ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2, false);
    ctx.ellipse(r, r, Math.abs(tScale) * r, r, 0, -Math.PI / 2, Math.PI / 2, tScale > 0);
  } else {
    ctx.arc(r, r, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(r, r, Math.abs(tScale) * r, r, 0, Math.PI / 2, -Math.PI / 2, tScale > 0);
  }
  ctx.closePath();
  ctx.fill();
  return c;
}

function addCanvasSprite(runtime, srcCanvas, x, y, size, z = 0, opacity = 1) {
  if (!srcCanvas) return null;
  const t = new runtime.THREE.CanvasTexture(srcCanvas);
  t.minFilter = runtime.THREE.LinearFilter;
  t.magFilter = runtime.THREE.LinearFilter;
  t.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) t.colorSpace = runtime.THREE.SRGBColorSpace;
  const mat = new runtime.THREE.SpriteMaterial({
    map: t,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const s = new runtime.THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  runtime.group.add(s);
  return s;
}

function getTextTexture(runtime, text, opts = {}) {
  const value = String(text ?? "");
  if (!value) return null;
  const font = String(opts.font || "11px system-ui, sans-serif");
  const color = String(opts.color || "#c8cbe8");
  const shadow = String(opts.shadow || "rgba(0,0,0,0.6)");
  const key = `${font}|${color}|${shadow}|${value}`;
  if (TEXT_TEXTURES.has(key)) return TEXT_TEXTURES.get(key);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  const fontMatch = /([0-9]+(?:\.[0-9]+)?)px/.exec(font);
  const fontPx = fontMatch ? Number(fontMatch[1]) : 12;
  const pad = 10;
  const w = Math.max(1, Math.ceil(ctx.measureText(value).width + pad));
  const h = Math.max(1, Math.ceil(fontPx + pad));
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText(value, w / 2, h / 2 + 0.5);
  const tex = new runtime.THREE.CanvasTexture(c);
  tex.minFilter = runtime.THREE.LinearFilter;
  tex.magFilter = runtime.THREE.LinearFilter;
  tex.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) tex.colorSpace = runtime.THREE.SRGBColorSpace;
  TEXT_TEXTURES.set(key, tex);
  return tex;
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

/* ── Dotted reference ring (mimics old Canvas2D style) ──────── */

function addDottedRing(runtime, x, y, r, label, isNight, onBright = false, labelDy = 0) {
  // Draw dotted circle as a thin torus of small segments
  const segments = 80;
  const dashRatio = 0.5;
  const inner = Math.max(1, r - 0.6);
  const outer = r + 0.6;
  for (let i = 0; i < segments; i++) {
    if (i % 2 !== 0) continue; // skip every other = dashes
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + dashRatio) / segments) * Math.PI * 2;
    const geo = new runtime.THREE.RingGeometry(inner, outer, 4, 1, a0, a1 - a0);
    let ringColor, ringOpacity;
    if (onBright) {
      ringColor = 0x000000;
      ringOpacity = 0.45;
    } else {
      ringColor = isNight ? 0xa0b4dc : 0x283c64;
      ringOpacity = 0.4;
    }
    const mat = new runtime.THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: ringOpacity,
      side: runtime.THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new runtime.THREE.Mesh(geo, mat);
    mesh.position.set(x, y, -1.5);
    runtime.group.add(mesh);
  }
  // Italic label below the ring
  const lx = x + r + 4;
  const ly = y - r - 8 + labelDy;
  const labelColor = isNight ? "rgba(180,195,230,0.7)" : "rgba(255,255,255,0.85)";
  const shadow = "rgba(0,0,0,0.7)";
  addText(runtime, label, lx, ly, 5.2, {
    font: "italic 9px system-ui, sans-serif",
    color: labelColor,
    shadow,
  });
}

/* ── Log-scale sizing for small objects ──────────────────────── */

const _MIN_PX = 2;
const _BOOST_THRESH = 10;

function logScaleSize(arcsec, scale, maxArcsec) {
  const trueSize = arcsec * scale;
  if (trueSize >= _BOOST_THRESH) return trueSize;
  if (trueSize >= _MIN_PX) {
    const t = (trueSize - _MIN_PX) / (_BOOST_THRESH - _MIN_PX);
    const boosted =
      _MIN_PX + ((_BOOST_THRESH - _MIN_PX) * Math.log1p(trueSize)) / Math.log1p(_BOOST_THRESH);
    return boosted + t * (trueSize - boosted);
  }
  const ma = Math.max(maxArcsec, 1);
  return _MIN_PX + ((_BOOST_THRESH - _MIN_PX) * Math.log1p(arcsec)) / Math.log1p(ma);
}

/* ── Main draw ───────────────────────────────────────────────── */

export function disposeSkyCanvasNative(canvas) {
  const rt = RUNTIME.get(canvas);
  if (!rt) return;
  clearGroup(rt.group);
  rt.renderer.dispose();
  RUNTIME.delete(canvas);
}

export async function drawSkyCanvasNative(
  canvas,
  model,
  starColourHex,
  skyMode,
  moonPhaseDeg,
  skyColours,
  starData = {},
  onReady = null,
) {
  const gen = ++_drawGen;
  const runtime = await ensureRuntime(canvas);
  if (!runtime) return false;
  if (gen !== _drawGen) return false;

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
  runtime.camera.left = 0;
  runtime.camera.right = W;
  runtime.camera.top = H;
  runtime.camera.bottom = 0;
  runtime.camera.updateProjectionMatrix();
  clearGroup(runtime.group);

  const isNight = skyMode !== "day";
  runtime.renderer.setClearColor(0x000000, 1);

  // Sky gradient background (zenith at top → horizon at bottom)
  {
    const topHex = isNight ? 0x050816 : hexToNumber(skyColours?.dayHex || "#4a90d9");
    const botHex = isNight ? 0x0c1228 : hexToNumber(skyColours?.horizonHex || "#87ceeb");
    const geo = new runtime.THREE.PlaneGeometry(W, H, 1, 1);
    const topColor = new runtime.THREE.Color(topHex);
    const botColor = new runtime.THREE.Color(botHex);
    const colors = new Float32Array([
      // PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right
      topColor.r,
      topColor.g,
      topColor.b,
      topColor.r,
      topColor.g,
      topColor.b,
      botColor.r,
      botColor.g,
      botColor.b,
      botColor.r,
      botColor.g,
      botColor.b,
    ]);
    geo.setAttribute("color", new runtime.THREE.BufferAttribute(colors, 3));
    const mat = new runtime.THREE.MeshBasicMaterial({
      vertexColors: true,
      depthWrite: false,
    });
    const mesh = new runtime.THREE.Mesh(geo, mat);
    mesh.position.set(W / 2, H / 2, -100);
    runtime.group.add(mesh);
  }

  // Star-field dots (night only)
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
  const solJupiter = 50;
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
    const slotSpacing = W / (slots + 1);
    starScale = Math.min(maxDiskR / (maxAll / 2), (slotSpacing * 0.8) / maxAll);
    rightScale = starScale;
    starX = slotSpacing;
    rightStart = slotSpacing * 2;
  } else {
    const ref = Math.max(1, maxNonStar);
    rightScale = maxDiskR / (ref / 2);
    rightStart = W * 0.12;
  }

  // Layout: disks in upper half, labels at bottom
  const diskCy = H * 0.55;
  const labelY = 17; // object name (y=0 is bottom in ortho camera)
  const sizeY = 4; // arcsec value

  // Label colours: match old style
  const labelCol = isNight ? "#c8cbe8" : "#ffffff";
  const subCol = isNight ? "#8088aa" : "rgba(255,255,255,0.7)";
  const shadowCol = isNight ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.7)";

  /* ── Star ────────────────────────────────────────────────── */
  if (starArcsec > 0 && starScale > 0) {
    const r = Math.max(2, (starArcsec / 2) * starScale);
    const starCanvas = ensureStarSnap(starColourHex, starData);
    addCanvasSprite(runtime, starCanvas, starX, diskCy, r / STAR_FILL, -2);
    const scaleNote = split
      ? ` (\u00d7${Math.max(1, Math.round(rightScale / Math.max(0.001, starScale)))} inset)`
      : "";
    addText(runtime, `Star${scaleNote}`, starX, labelY, 6.5, {
      font: "11px system-ui, sans-serif",
      color: labelCol,
      shadow: shadowCol,
    });
    addText(
      runtime,
      starArcsec >= 60 ? `${(starArcsec / 60).toFixed(1)}\u2032` : `${starArcsec.toFixed(1)}\u2033`,
      starX,
      sizeY,
      6.5,
      {
        font: "10px monospace",
        color: subCol,
        shadow: shadowCol,
      },
    );
    const solR = (solSun / 2) * starScale;
    if (solR >= 2) addDottedRing(runtime, starX, diskCy, solR, "Sol", isNight, solR < r);
  }

  /* ── Bodies & Moons ──────────────────────────────────────── */
  const objects = [
    ...moons.map((m) => ({ type: "moon", entry: m, a: m.angularDiameterArcsec })),
    ...bodies.map((b) => ({ type: "body", entry: b, a: b.angularDiameterArcsec })),
  ];
  const rightW = W - rightStart - 10;
  const spacing = rightW / Math.max(1, objects.length + 1);
  const maxA = Math.max(...objects.map((o) => o.a), 1);

  for (let i = 0; i < objects.length; i++) {
    if (gen !== _drawGen) return false;
    const obj = objects[i];
    const cx = rightStart + spacing * (i + 1);
    const size = logScaleSize(obj.a, rightScale, maxA);

    const bodyCanvas = await ensureBodySnap(obj);
    if (gen !== _drawGen) return false;
    addCanvasSprite(runtime, bodyCanvas, cx, diskCy, size, 2, 0.98);

    // Moon phase shadow
    if (obj.type === "moon" && moonPhaseDeg != null) {
      const phaseCanvas = makePhaseShadow(moonPhaseDeg);
      addCanvasSprite(runtime, phaseCanvas, cx, diskCy, size, 3, 1);
    }

    // Point-source glow for small objects (magnitude-driven, gas/rocky colors)
    if (size < 16) {
      const b = obj.entry;
      const isGas =
        obj.type === "body" &&
        String(b.classLabel || "")
          .toLowerCase()
          .includes("gas");
      const dotColor = isGas ? "rgba(232,216,176,0.6)" : "rgba(208,216,232,0.6)";
      addGlow(runtime, cx, diskCy, size, 1, dotColor, 0.4);
    }

    const label = obj.type === "moon" ? obj.entry.name || "Moon" : obj.entry.name || "Body";
    addText(runtime, label, cx, labelY, 7, {
      font: "11px system-ui, sans-serif",
      color: labelCol,
      shadow: shadowCol,
    });
    addText(
      runtime,
      obj.a >= 60 ? `${(obj.a / 60).toFixed(1)}\u2032` : `${obj.a.toFixed(1)}\u2033`,
      cx,
      sizeY,
      7,
      {
        font: "10px monospace",
        color: subCol,
        shadow: shadowCol,
      },
    );
  }

  /* ── Reference rings (dotted outlines) ─────────────────── */
  if (objects.length > 0 && rightScale > 0) {
    const refCx = rightStart + spacing;
    // Sol + Luna rings on first object
    const solR = logScaleSize(solSun / 2, rightScale, maxA / 2);
    const moonR = logScaleSize(solMoon / 2, rightScale, maxA / 2);
    const firstSize = logScaleSize(objects[0].a, rightScale, maxA);
    if (solR >= 2)
      addDottedRing(runtime, refCx, diskCy, solR, "Sol", isNight, firstSize / 2 > solR, 0);
    if (moonR >= 2)
      addDottedRing(runtime, refCx, diskCy, moonR, "Luna", isNight, firstSize / 2 > moonR, 12);

    // Jupiter ring on last object
    const lastCx = rightStart + spacing * objects.length;
    const jupR = logScaleSize(solJupiter / 2, rightScale, maxA / 2);
    if (jupR >= 2) {
      const lastSize = logScaleSize(objects[objects.length - 1].a, rightScale, maxA);
      addDottedRing(runtime, lastCx, diskCy, jupR, "Jupiter", isNight, lastSize / 2 > jupR);
    }
  }

  if (starArcsec <= 0 && objects.length === 0) {
    addText(runtime, "No objects to display", W * 0.5, H * 0.5, 8, {
      font: "13px system-ui, sans-serif",
      color: subCol,
      shadow: shadowCol,
    });
  }

  runtime.renderer.render(runtime.scene, runtime.camera);
  try {
    onReady?.();
  } catch {}
  return true;
}
