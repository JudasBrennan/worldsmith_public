import { loadThreeCore } from "./threeBridge2d.js";
import { renderCelestialRecipeSnapshot, renderStarSnapshot } from "./celestialVisualPreview.js";

/* Pre-warm Three.js CDN import so it's ready before the first draw call */
loadThreeCore().catch(() => {});

const RUNTIME = new WeakMap();
const TEXT_TEXTURES = new Map();
const PENDING = new WeakMap();
const POSTER_CACHE = new Map();
const POSTER_TEXTURES = new Set();
let warned = false;
let _drawGeneration = 0;

const STAR_FILL = 0.22;

function clampDpr(dpr) {
  const n = Number(dpr);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(3, n));
}

function seededRand(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function arcAngles(r, centerY, canvasH, padding = 0.15) {
  // Orthographic runtime uses world-Y up:
  // bottom edge is y=0, top edge is y=canvasH.
  // Padding (radians) extends arcs past canvas edges so the viewport clips
  // them naturally instead of creating a hard visual cutoff.
  const aBottom = r > centerY ? -Math.asin(centerY / r) : -Math.PI / 2;
  const aTop = r > canvasH - centerY ? Math.asin((canvasH - centerY) / r) : Math.PI / 2;
  return [aBottom - padding, aTop + padding];
}

function getTextTexture(runtime, text, opts = {}) {
  const label = String(text ?? "");
  if (!label) return null;
  const font = String(opts.font || "11px system-ui, sans-serif");
  const color = String(opts.color || "rgba(220,225,240,0.9)");
  const key = `${font}|${color}|${label}`;
  if (TEXT_TEXTURES.has(key)) return TEXT_TEXTURES.get(key);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  const fontMatch = /([0-9]+(?:\.[0-9]+)?)px/.exec(font);
  const fontPx = fontMatch ? Number(fontMatch[1]) : 12;
  const metrics = ctx.measureText(label);
  const w = Math.max(1, Math.ceil(metrics.width + 8));
  const h = Math.max(1, Math.ceil(fontPx + 8));
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 3;
  ctx.fillText(label, w / 2, h / 2 + 0.5);

  const tex = new runtime.THREE.CanvasTexture(canvas);
  tex.minFilter = runtime.THREE.LinearFilter;
  tex.magFilter = runtime.THREE.LinearFilter;
  tex.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) tex.colorSpace = runtime.THREE.SRGBColorSpace;
  TEXT_TEXTURES.set(key, tex);
  return tex;
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
      const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, -2000, 2000);
      camera.position.set(0, 0, 40);
      camera.lookAt(0, 0, 0);
      const group = new THREE.Group();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0x9fb4d8, 0.36));
      const key = new THREE.DirectionalLight(0xffffff, 0.75);
      key.position.set(-2.5, 1.6, 2.2);
      scene.add(key);
      const runtime = { THREE, renderer, scene, camera, group };
      renderer.render(scene, camera);
      RUNTIME.set(canvas, runtime);
      PENDING.delete(canvas);
      return runtime;
    })
    .catch((err) => {
      PENDING.delete(canvas);
      if (!warned) {
        warned = true;
        console.warn("[WorldSmith] Native system-poster renderer unavailable.", err);
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

function cleanupPosterTextures() {
  for (const tex of POSTER_TEXTURES) {
    try {
      tex.dispose();
    } catch {}
  }
  POSTER_TEXTURES.clear();
}

function addCanvasSprite(runtime, srcCanvas, x, y, size, z = 0, opacity = 1) {
  if (!srcCanvas) return null;
  const tex = new runtime.THREE.CanvasTexture(srcCanvas);
  tex.minFilter = runtime.THREE.LinearFilter;
  tex.magFilter = runtime.THREE.LinearFilter;
  tex.generateMipmaps = false;
  if (runtime.THREE.SRGBColorSpace) tex.colorSpace = runtime.THREE.SRGBColorSpace;
  POSTER_TEXTURES.add(tex);
  const mat = new runtime.THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const sprite = new runtime.THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  runtime.group.add(sprite);
  return sprite;
}

function addTextSprite(runtime, text, x, y, z = 5, opts = {}) {
  const tex = getTextTexture(runtime, text, opts);
  if (!tex) return null;
  const img = tex.image;
  const mat = new runtime.THREE.SpriteMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    opacity: Number.isFinite(opts.opacity) ? opts.opacity : 1,
    depthWrite: false,
  });
  const sprite = new runtime.THREE.Sprite(mat);
  const w = Math.max(1, Number(img?.width) || 32);
  const h = Math.max(1, Number(img?.height) || 16);
  sprite.position.set(x, y, z);
  sprite.scale.set(w, h, 1);
  runtime.group.add(sprite);
  return sprite;
}

function addLine(runtime, x1, y1, x2, y2, color, opacity = 1, z = 0) {
  const g = new runtime.THREE.BufferGeometry().setFromPoints([
    new runtime.THREE.Vector3(x1, y1, z),
    new runtime.THREE.Vector3(x2, y2, z),
  ]);
  const m = new runtime.THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  runtime.group.add(new runtime.THREE.Line(g, m));
}

function addArcBand(
  runtime,
  cx,
  cy,
  innerR,
  outerR,
  aStart,
  aEnd,
  color,
  opacity = 1,
  z = 0,
  segments = 180,
) {
  if (!(Number.isFinite(innerR) && Number.isFinite(outerR) && outerR > innerR)) return;
  const vCount = (segments + 1) * 2;
  const positions = new Float32Array(vCount * 3);
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const a = aStart + (aEnd - aStart) * t;
    const ox = cx + Math.cos(a) * outerR;
    const oy = cy + Math.sin(a) * outerR;
    const ix = cx + Math.cos(a) * innerR;
    const iy = cy + Math.sin(a) * innerR;
    const base = i * 2;
    positions[(base + 0) * 3 + 0] = ox;
    positions[(base + 0) * 3 + 1] = oy;
    positions[(base + 0) * 3 + 2] = z;
    positions[(base + 1) * 3 + 0] = ix;
    positions[(base + 1) * 3 + 1] = iy;
    positions[(base + 1) * 3 + 2] = z;
    if (i < segments) {
      const next = base + 2;
      indices.push(base, base + 1, next);
      indices.push(base + 1, next + 1, next);
    }
  }
  const g = new runtime.THREE.BufferGeometry();
  g.setAttribute("position", new runtime.THREE.BufferAttribute(positions, 3));
  g.setIndex(indices);
  const m = new runtime.THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: runtime.THREE.DoubleSide,
    depthWrite: false,
  });
  runtime.group.add(new runtime.THREE.Mesh(g, m));
}

function addArcStroke(
  runtime,
  cx,
  cy,
  radius,
  aStart,
  aEnd,
  color,
  opacity = 1,
  z = 0,
  dashed = false,
  dashSteps = 5,
  gapSteps = 5,
  segments = 260,
) {
  if (!(Number.isFinite(radius) && radius > 0)) return;
  const THREE = runtime.THREE;
  if (!dashed) {
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const a = aStart + (aEnd - aStart) * t;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, z));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
    runtime.group.add(new THREE.Line(g, m));
    return;
  }
  const pts = [];
  const cycle = Math.max(1, dashSteps + gapSteps);
  for (let i = 0; i < segments; i += 1) {
    if (i % cycle >= dashSteps) continue;
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const a0 = aStart + (aEnd - aStart) * t0;
    const a1 = aStart + (aEnd - aStart) * t1;
    pts.push(
      new THREE.Vector3(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, z),
      new THREE.Vector3(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, z),
    );
  }
  if (!pts.length) return;
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  runtime.group.add(new THREE.LineSegments(g, m));
}

function addStarfield(runtime, W, H, count = 70, z = -40) {
  if (count <= 0) return;
  const rand = seededRand(42);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand() * W;
    pos[i * 3 + 1] = rand() * H;
    pos[i * 3 + 2] = z;
  }
  const geom = new runtime.THREE.BufferGeometry();
  geom.setAttribute("position", new runtime.THREE.BufferAttribute(pos, 3));
  const mat = new runtime.THREE.PointsMaterial({
    color: 0xc8d2ef,
    size: 1.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  runtime.group.add(new runtime.THREE.Points(geom, mat));
}

function bodyPxR(radiusKm) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return 6;
  return Math.max(4, Math.min(26, 8 * Math.pow(radiusKm / 6371, 0.42)));
}

function deCollideLabels(labels, minGap = 48, stepY = 14) {
  if (labels.length <= 1) return;
  let tier = 0;
  for (let i = 1; i < labels.length; i++) {
    const dx = labels[i].x - labels[i - 1].x;
    if (dx < minGap) {
      tier += 1;
      const dir = tier % 2 === 1 ? -1 : 1;
      const magnitude = Math.ceil(tier / 2);
      labels[i].yOffset = magnitude * stepY * dir;
    } else {
      tier = 0;
      labels[i].yOffset = 0;
    }
  }
}

/* ── Poster body pre-rendering (procedural celestial textures) ── */

function bodyKey(body) {
  if (body.type === "gas") {
    return `gas:${body.id || ""}:${body.style || "jupiter"}:${body.rings ? 1 : 0}`;
  }
  return `rocky:${JSON.stringify(body.visualProfile || {})}`;
}

function moonKey(m) {
  const mc = m.moonCalc;
  if (!mc) return "moon:default";
  return `moon:${mc.display?.displayClass || ""}:${mc.display?.surfaceClass || ""}`;
}

function starKey(star) {
  return `star:${star?.starColourHex || ""}:${Math.round(Number(star?.tempK) || 5778)}`;
}

async function ensureBodyCanvas(body) {
  const key = bodyKey(body);
  if (POSTER_CACHE.has(key)) return POSTER_CACHE.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const model =
    body.type === "gas"
      ? {
          bodyType: "gasGiant",
          styleId: body.style || "jupiter",
          showRings: !!body.rings,
          gasCalc: body.gasCalc,
        }
      : { bodyType: "rocky", visualProfile: body.visualProfile };
  await renderCelestialRecipeSnapshot(canvas, model);
  POSTER_CACHE.set(key, canvas);
  return canvas;
}

async function ensureMoonCanvas(m) {
  const key = moonKey(m);
  if (POSTER_CACHE.has(key)) return POSTER_CACHE.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  await renderCelestialRecipeSnapshot(canvas, { bodyType: "moon", moonCalc: m.moonCalc });
  POSTER_CACHE.set(key, canvas);
  return canvas;
}

function ensureStarCanvas(star) {
  const key = starKey(star);
  if (POSTER_CACHE.has(key)) return POSTER_CACHE.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 384;
  renderStarSnapshot(
    canvas,
    {
      starColourHex: star?.starColourHex,
      starTempK: star?.tempK,
      starMassMsol: star?.massMsol,
      starAgeGyr: star?.ageGyr,
    },
    STAR_FILL,
  );
  POSTER_CACHE.set(key, canvas);
  return canvas;
}

export async function drawSystemPosterNative(canvas, data, opts = {}, onReady = null) {
  if (!canvas) return false;

  /* HTML progress bar — appears instantly, before Three.js loads */
  const wrap = canvas.parentElement;
  let barEl = wrap?.querySelector(".poster-progress");
  if (!barEl && wrap) {
    wrap.style.position = "relative";
    barEl = document.createElement("div");
    barEl.className = "poster-progress";
    barEl.style.cssText =
      "position:absolute;bottom:0;left:0;width:100%;height:2px;z-index:10;pointer-events:none";
    const track = document.createElement("div");
    track.style.cssText =
      "width:0%;height:100%;background:rgba(74,122,175,0.7);transition:width 0.15s ease-out";
    barEl.appendChild(track);
    wrap.appendChild(barEl);
  }
  const barTrack = barEl?.firstChild;
  function setBar(pct) {
    if (barTrack) barTrack.style.width = `${Math.min(100, pct)}%`;
  }
  function removeBar() {
    if (barEl?.parentNode) barEl.parentNode.removeChild(barEl);
  }
  setBar(0);

  const runtime = await ensureRuntime(canvas);
  if (!runtime) {
    removeBar();
    return false;
  }
  const gen = ++_drawGeneration;

  const { star, system, planets, gasGiants, moons, debrisDisks } = data;
  const showLabels = opts.labels !== false;
  const showMoons = opts.moons !== false;
  const showHz = opts.hz !== false;
  const showFrost = opts.frost !== false;
  const showDebris = opts.debris !== false;
  const showGuides = opts.guides !== false;
  const showStarfield = opts.starfield !== false;
  const scaleMode = opts.scale || "log";

  const rect = canvas.parentElement?.getBoundingClientRect?.();
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

  cleanupPosterTextures();
  clearGroup(runtime.group);
  if (showStarfield) addStarfield(runtime, W, H, 70, -40);

  const allBodies = [
    ...planets.filter((p) => p.au > 0).map((p) => ({ ...p, type: "planet" })),
    ...gasGiants.filter((g) => g.au > 0).map((g) => ({ ...g, type: "gas" })),
  ].sort((a, b) => a.au - b.au);

  const allAu = [];
  for (const b of allBodies) allAu.push(b.au);
  if (system?.habitableZoneAu)
    allAu.push(system.habitableZoneAu.inner, system.habitableZoneAu.outer);
  if (Number.isFinite(system?.frostLineAu)) allAu.push(system.frostLineAu);
  for (const d of debrisDisks || []) allAu.push(d.innerAu, d.outerAu);
  const validAu = allAu.filter((n) => Number.isFinite(n) && n > 0);
  if (!validAu.length) {
    const starSize = Math.max(46, H * 0.55);
    const starCoreR = starSize * 0.5;
    const starCanvas = ensureStarCanvas(star);
    addCanvasSprite(runtime, starCanvas, 0, H * 0.44, starCoreR / STAR_FILL, -2);
    addTextSprite(
      runtime,
      "Assign planets to orbital slots to populate the poster",
      W * 0.5,
      H * 0.5,
      6,
      {
        font: "italic 12px system-ui, sans-serif",
        color: "rgba(160,170,200,0.5)",
      },
    );
    runtime.renderer.setClearColor(0x050818, 1);
    runtime.renderer.render(runtime.scene, runtime.camera);
    removeBar();
    try {
      onReady?.();
    } catch {}
    return true;
  }

  const orbitY = H * 0.44;
  const starSize = Math.max(46, H * 0.55);
  const starCoreR = starSize * 0.5;
  const starSpriteR = (starCoreR / STAR_FILL) * 0.5;
  const bodyLeft = Math.max(W * 0.13, starSpriteR * 0.9);
  const bodyRight = W * 0.96;
  const rangeW = bodyRight - bodyLeft;
  const starEdgeX = starCoreR + 4;
  // Shift orbit-center left of the canvas so distance bands appear as curved arcs.
  const orbitCenterX = -starCoreR * 1.3;
  const bottomLabelY = 14;
  const minAu = Math.min(...validAu);
  const maxAu = Math.max(...validAu);
  const minLog = Math.log10(minAu * 0.7);
  const maxLog = Math.log10(maxAu * 1.3);
  const logRange = maxLog - minLog || 1;
  const linMin = minAu * 0.85;
  const linMax = maxAu * 1.15;
  const linRange = linMax - linMin || 1;
  const auToX = (au) => {
    if (!(au > 0)) return bodyLeft;
    if (scaleMode === "linear") {
      const t = (au - linMin) / linRange;
      return bodyLeft + t * rangeW;
    }
    const t = (Math.log10(au) - minLog) / logRange;
    return bodyLeft + t * rangeW;
  };

  const starCanvas = ensureStarCanvas(star);

  if (showHz && system?.habitableZoneAu) {
    const x1 = auToX(system.habitableZoneAu.inner);
    const x2 = auToX(system.habitableZoneAu.outer);
    const r1 = Math.max(1, x1 - orbitCenterX);
    const r2 = Math.max(r1 + 1, x2 - orbitCenterX);
    const [a1Bottom, a1Top] = arcAngles(r1, orbitY, H);
    const [a2Bottom, a2Top] = arcAngles(r2, orbitY, H);
    const aStart = Math.max(a1Bottom, a2Bottom);
    const aEnd = Math.min(a1Top, a2Top);
    if (aEnd > aStart) {
      addArcBand(runtime, orbitCenterX, orbitY, r1, r2, aStart, aEnd, 0x32b450, 0.11, -20, 180);
      addArcStroke(runtime, orbitCenterX, orbitY, r1, aStart, aEnd, 0x64e682, 0.36, -19.8);
      addArcStroke(runtime, orbitCenterX, orbitY, r2, aStart, aEnd, 0x64e682, 0.36, -19.8);
      if (showLabels) {
        addTextSprite(runtime, "Habitable Zone", (x1 + x2) * 0.5, bottomLabelY, 6, {
          font: "italic 9px system-ui, sans-serif",
          color: "rgba(80,200,100,0.35)",
        });
      }
    }
  }
  if (showFrost && Number.isFinite(system?.frostLineAu) && system.frostLineAu > 0) {
    const fx = auToX(system.frostLineAu);
    const frostR = Math.max(1, fx - orbitCenterX);
    const [fAStart, fAEnd] = arcAngles(frostR, orbitY, H);
    if (fAEnd > fAStart) {
      addArcStroke(
        runtime,
        orbitCenterX,
        orbitY,
        frostR,
        fAStart,
        fAEnd,
        0x78aad8,
        0.34,
        -12,
        true,
        5,
        5,
        260,
      );
    }
    if (showLabels) {
      addTextSprite(runtime, "Frost line", fx + 24, bottomLabelY, 6, {
        font: "italic 9px system-ui, sans-serif",
        color: "rgba(120,170,220,0.35)",
      });
    }
  }

  if (showDebris) {
    for (const d of debrisDisks || []) {
      const x1 = auToX(d.innerAu);
      const x2 = auToX(d.outerAu);
      if (!(x2 > x1)) continue;
      const r1 = Math.max(1, x1 - orbitCenterX);
      const r2 = Math.max(r1 + 1, x2 - orbitCenterX);
      const [a1Bottom, a1Top] = arcAngles(r1, orbitY, H);
      const [a2Bottom, a2Top] = arcAngles(r2, orbitY, H);
      const aStart = Math.max(a1Bottom, a2Bottom);
      const aEnd = Math.min(a1Top, a2Top);
      if (!(aEnd > aStart)) continue;

      addArcBand(runtime, orbitCenterX, orbitY, r1, r2, aStart, aEnd, 0xa0825a, 0.1, -10, 180);

      const dRng = seededRand(Math.round(Number(d.innerAu || 0) * 1000));
      const bandW = r2 - r1;
      const astCount = Math.max(25, Math.round(bandW * 1.2));
      const bucketPositions = [[], [], []];
      const bucketColors = [[], [], []];
      for (let i = 0; i < astCount; i += 1) {
        const t = dRng();
        const t2 = 0.5 + (t - 0.5) * 0.85;
        const rAst = r1 + t2 * (r2 - r1);
        const angle = aStart + dRng() * (aEnd - aStart);
        const ax = orbitCenterX + Math.cos(angle) * rAst;
        const ay = orbitY + Math.sin(angle) * rAst;
        const size = 0.3 + dRng() * 1.8;

        let bi = 0;
        let cr = 180;
        let cg = 150;
        let cb = 110;
        if (size > 1.4) {
          bi = 2;
          cr = 150 + Math.floor(dRng() * 50);
          cg = 120 + Math.floor(dRng() * 40);
          cb = 80 + Math.floor(dRng() * 30);
        } else if (size > 0.9) {
          bi = 1;
          cr = 140 + Math.floor(dRng() * 45);
          cg = 112 + Math.floor(dRng() * 35);
          cb = 74 + Math.floor(dRng() * 26);
        }
        bucketPositions[bi].push(ax, ay, -9.2 + bi * 0.02);
        bucketColors[bi].push(cr / 255, cg / 255, cb / 255);
      }
      const sizes = [0.8, 1.4, 2.0];
      const opacities = [0.1, 0.18, 0.28];
      for (let bi = 0; bi < 3; bi += 1) {
        if (!bucketPositions[bi].length) continue;
        const geom = new runtime.THREE.BufferGeometry();
        geom.setAttribute(
          "position",
          new runtime.THREE.Float32BufferAttribute(bucketPositions[bi], 3),
        );
        geom.setAttribute("color", new runtime.THREE.Float32BufferAttribute(bucketColors[bi], 3));
        const mat = new runtime.THREE.PointsMaterial({
          size: sizes[bi],
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          opacity: opacities[bi],
          depthWrite: false,
        });
        runtime.group.add(new runtime.THREE.Points(geom, mat));
      }

      if (showLabels && d?.name) {
        addTextSprite(runtime, d.name, (x1 + x2) * 0.5, bottomLabelY, 6, {
          font: "italic 9px system-ui, sans-serif",
          color: "rgba(180,160,120,0.6)",
        });
      }
    }
  }

  addCanvasSprite(runtime, starCanvas, 0, orbitY, starCoreR / STAR_FILL, -2);

  if (showGuides) {
    for (const body of allBodies) {
      const x = auToX(body.au);
      addLine(runtime, starEdgeX, orbitY, x, orbitY, 0x8695b3, 0.11, -3);
    }
  }

  /* Compute and render labels from body data (no canvases needed) */
  if (showLabels) {
    const labelEntries = [];
    for (const body of allBodies) {
      labelEntries.push({
        x: auToX(body.au),
        name: body.name || "Body",
        auLabel: `${Number(body.au).toFixed(2)} AU`,
        yOffset: 0,
        pxR: bodyPxR(body.radiusKm),
      });
    }
    if (labelEntries.length) {
      deCollideLabels(labelEntries, 48, 14);
      for (const lbl of labelEntries) {
        const nameY = H - 18 + lbl.yOffset;
        const auY = H - 6 + lbl.yOffset;
        if (lbl.yOffset !== 0) {
          addLine(runtime, lbl.x, orbitY - lbl.pxR * 1.2, lbl.x, nameY + 8, 0x8695b3, 0.18, 4);
        }
        addTextSprite(runtime, lbl.name, lbl.x, nameY, 6, {
          font: "11px system-ui, sans-serif",
          color: "rgba(220,225,240,0.9)",
        });
        addTextSprite(runtime, lbl.auLabel, lbl.x, auY, 6, {
          font: "9px monospace",
          color: "rgba(160,170,200,0.78)",
        });
      }
    }
  }

  const totalItems =
    allBodies.length + (showMoons ? (moons || []).filter((m) => m.parentId).length : 0);
  let doneItems = 0;

  /* Initial render — structural elements visible immediately */
  runtime.renderer.setClearColor(0x050818, 1);
  runtime.renderer.render(runtime.scene, runtime.camera);

  /* Progressive body + moon rendering */
  const moonsByParent = new Map();
  for (const m of moons || []) {
    if (!m.parentId) continue;
    if (!moonsByParent.has(m.parentId)) moonsByParent.set(m.parentId, []);
    moonsByParent.get(m.parentId).push(m);
  }

  for (const body of allBodies) {
    if (gen !== _drawGeneration) return true;
    const x = auToX(body.au);
    const y = orbitY;
    const size = bodyPxR(body.radiusKm) * 2.1;
    const bodyCanvas = await ensureBodyCanvas(body);
    addCanvasSprite(runtime, bodyCanvas, x, y, size, 1, 1);
    doneItems++;
    setBar((doneItems / totalItems) * 100);
    if (showMoons) {
      const set = moonsByParent.get(body.id) || [];
      let moonY = y + size * 0.52 + 8;
      for (const m of set) {
        if (gen !== _drawGeneration) return true;
        const mSize = Math.max(4, Math.min(14, size * 0.22));
        const mCanvas = await ensureMoonCanvas(m);
        addCanvasSprite(runtime, mCanvas, x + 6, moonY, mSize, 2.5, 0.95);
        if (showLabels && m?.name) {
          addTextSprite(runtime, m.name, x + 6 + mSize * 0.5 + 12, moonY, 3.5, {
            font: "8px system-ui, sans-serif",
            color: "rgba(180,185,210,0.72)",
          });
        }
        moonY += Math.max(mSize + 6, 14);
        doneItems++;
        setBar((doneItems / totalItems) * 100);
      }
    }
    runtime.renderer.render(runtime.scene, runtime.camera);
  }

  removeBar();

  try {
    onReady?.();
  } catch {}
  return true;
}

export function disposeSystemPosterNative(canvas) {
  if (!canvas) return;
  const runtime = RUNTIME.get(canvas);
  if (!runtime) return;
  try {
    clearGroup(runtime.group);
  } catch {}
  cleanupPosterTextures();
  try {
    runtime.renderer?.dispose?.();
  } catch {}
  RUNTIME.delete(canvas);
  PENDING.delete(canvas);
}
