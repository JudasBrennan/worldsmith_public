// ─── Rocky planet visual rendering ─────────────────────────────────
//
// Physics-driven visual system for rocky planets. No user-selectable
// style presets — the engine-computed physical properties (composition
// class, water regime, temperature, tectonics, atmosphere) determine
// the planet's appearance from space.
//
// Architecture mirrors gasGiantStyles.js:
//   computeRockyVisualProfile()  → visual profile from engine data
//   drawRockyPlanetPreview()     → 180×180 px detailed preview
//   drawRockyPlanetViz()         → 8–20 px system poster scale

// ── Constants ─────────────────────────────────────────────────────

const SURFACE_PALETTES = {
  "Earth-like": { c1: "#c4a882", c2: "#8b6e4e", c3: "#4a3726" },
  "Mars-like": { c1: "#c77b4a", c2: "#9b4e2e", c3: "#5c2a18" },
  "Mercury-like": { c1: "#b0b0b0", c2: "#808080", c3: "#4a4a4a" },
  "Iron world": { c1: "#6e7080", c2: "#45475a", c3: "#1e1f2e" },
  Coreless: { c1: "#d4c4a8", c2: "#b09878", c3: "#6e5a40" },
  "Ice world": { c1: "#d8e4f0", c2: "#a0b8cc", c3: "#4a6478" },
  "Ocean world": { c1: "#4a8cb0", c2: "#2a5c80", c3: "#1a3450" },
};

const OCEAN_COVERAGE = {
  Dry: 0,
  "Shallow oceans": 0.3,
  "Extensive oceans": 0.65,
  "Global ocean": 0.95,
  "Deep ocean": 1.0,
  "Ice world": 0,
};

const OCEAN_COLOURS = {
  "Earth-like": "#1a4a7a",
  "Mars-like": "#2a4a5a",
  Coreless: "#2a5a6a",
  "Ocean world": "#1a3a6a",
  "Ice world": "#3a6a8a",
};
const DEFAULT_OCEAN_COLOUR = "#1a4a7a";

// ── Helpers ───────────────────────────────────────────────────────

function seededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(h, 1597334677) + 1013904223) | 0;
    return ((h >>> 0) / 4294967296 + 0.5) % 1;
  };
}

function hexToRgba(hex, a) {
  const n = parseInt((hex || "#888888").replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Profile computation ──────────────────────────────────────────

function iceCapsFromTemp(tempK, axialTiltDeg) {
  let base;
  if (tempK < 200) base = 0.8;
  else if (tempK < 250) base = 0.3 + (0.5 * (250 - tempK)) / 50;
  else if (tempK < 280) base = 0.1 + (0.2 * (280 - tempK)) / 30;
  else if (tempK < 310) base = 0.02 + (0.08 * (310 - tempK)) / 30;
  else if (tempK < 350) base = Math.max(0, (0.02 * (350 - tempK)) / 40);
  else base = 0;

  const tiltFactor = clamp(axialTiltDeg || 0, 0, 90) / 90;
  const asymmetry = base * 0.4 * tiltFactor;
  return {
    north: clamp(base + asymmetry * 0.5, 0, 1),
    south: clamp(base - asymmetry * 0.5, 0, 1),
    colour: "#e8f0ff",
  };
}

export function computeRockyVisualProfile(derived, inputs) {
  const d = derived || {};
  const inp = inputs || {};

  // Palette
  const palette = SURFACE_PALETTES[d.compositionClass] || SURFACE_PALETTES["Earth-like"];

  // Ocean
  const oceanCoverage = OCEAN_COVERAGE[d.waterRegime] ?? 0;
  const oceanColour = OCEAN_COLOURS[d.compositionClass] || DEFAULT_OCEAN_COLOUR;
  const tempK = d.surfaceTempK || 288;
  const frozen = tempK < 273 && oceanCoverage > 0;

  // Ice caps
  let iceCaps;
  if (d.waterRegime === "Ice world") {
    iceCaps = { north: 1, south: 1, colour: "#e8f0ff" };
  } else {
    iceCaps = iceCapsFromTemp(tempK, Number(inp.axialTiltDeg) || 0);
  }

  // Clouds
  const pressure = Number(inp.pressureAtm) || 0;
  const h2o = Number(inp.h2oPct) || 0;
  const co2 = Number(inp.co2Pct) || 0;
  let cloudCoverage = pressure > 0 ? clamp(((pressure * h2o) / 100) * 2, 0, 0.95) : 0;
  let cloudColour = "#ffffff";
  if (pressure > 10 && co2 > 80) {
    cloudCoverage = 0.95;
    cloudColour = "#e0d0a0";
  }

  // Atmosphere rim
  let atmThickness = 0;
  let atmColour = d.skyColourDayHex || "#6688bb";
  if (pressure > 0) {
    atmThickness = clamp(Math.log10(pressure + 0.01) * 0.05 + 0.04, 0, 0.15);
  }

  // Terrain
  const tec = d.tectonicRegime || "stagnant";
  let terrainType, craterDensity;
  if (tec === "stagnant" && pressure <= 0.01) {
    terrainType = "cratered";
    craterDensity = 0.8;
  } else if (tec === "stagnant") {
    terrainType = "worn";
    craterDensity = 0.3;
  } else if (tec === "mobile") {
    terrainType = "continental";
    craterDensity = 0.05;
  } else if (tec === "episodic") {
    terrainType = "volcanic";
    craterDensity = 0.1;
  } else {
    terrainType = "smooth";
    craterDensity = 0.02;
  }

  // Vegetation
  let vegCoverage = 0;
  let vegColour = null;
  if (d.vegetationPaleHex && tempK >= 200 && tempK <= 400 && oceanCoverage < 0.95) {
    vegCoverage = clamp(0.35 * (1 - oceanCoverage), 0, 0.4);
    vegColour = d.vegetationDeepHex || d.vegetationPaleHex;
  }

  // Special effects
  let special = null;
  if (tempK > 1200) special = "lava";
  else if (tempK < 100 && pressure <= 0.01) special = "frozen";

  // Land palette — for Ocean worlds, exposed land is rocky/earthy, not ocean-blue
  const landPalette =
    d.compositionClass === "Ocean world" ? SURFACE_PALETTES["Earth-like"] : palette;

  return {
    palette,
    landPalette,
    ocean: { coverage: oceanCoverage, colour: oceanColour, frozen },
    iceCaps,
    clouds: { coverage: cloudCoverage, colour: cloudColour },
    atmosphere: { thickness: atmThickness, colour: atmColour },
    terrain: { type: terrainType, craterDensity },
    vegetation: { coverage: vegCoverage, colour: vegColour },
    special,
    tidallyLocked: !!d.tidallyLockedToStar,
    seed: inp.name || "planet",
  };
}

// ── 180×180 px preview renderer ──────────────────────────────────

export function drawRockyPlanetPreview(canvas, profile, _opts = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = 180;
  const h = 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = 68;
  const rng = seededRng(profile.seed);
  const pal = profile.palette;

  // ── Clip to sphere ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // ── Layer 1: Base surface gradient ──
  const baseGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.1, cx, cy, r);
  baseGrad.addColorStop(0, hexToRgba(pal.c1, 0.98));
  baseGrad.addColorStop(0.55, hexToRgba(pal.c2, 0.95));
  baseGrad.addColorStop(1, hexToRgba(pal.c3, 0.95));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 2: Ocean / land patches ──
  if (profile.ocean.coverage > 0.5) {
    // Ocean-dominant: fill with ocean, draw land on top
    ctx.fillStyle = hexToRgba(profile.ocean.colour, profile.ocean.frozen ? 0.35 : 0.7);
    ctx.fillRect(0, 0, w, h);
    const landFraction = 1 - profile.ocean.coverage;
    if (landFraction > 0.02) {
      const landPatches = 5 + Math.floor(rng() * 5);
      for (let i = 0; i < landPatches; i++) {
        const px = cx + (rng() - 0.5) * r * 1.3;
        const py = cy + (rng() - 0.5) * r * 1.1;
        const rx = r * (0.12 + rng() * 0.22) * Math.sqrt(landFraction);
        const ry = rx * (0.4 + rng() * 0.6);
        const angle = rng() * Math.PI;
        const lp = profile.landPalette || pal;
        ctx.fillStyle = hexToRgba(lp.c2, 0.88);
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, angle, 0, Math.PI * 2);
        ctx.fill();
        // Secondary lobe for irregular coastlines
        if (rng() > 0.25) {
          const lx = px + (rng() - 0.5) * rx * 1.8;
          const ly = py + (rng() - 0.5) * ry * 1.8;
          const lrx = rx * (0.4 + rng() * 0.5);
          const lry = ry * (0.5 + rng() * 0.5);
          ctx.fillStyle = hexToRgba(lp.c1, 0.75);
          ctx.beginPath();
          ctx.ellipse(lx, ly, lrx, lry, angle + rng() * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (profile.ocean.coverage > 0) {
    // Land-dominant: draw ocean patches
    const oceanPatches = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < oceanPatches; i++) {
      const px = cx + (rng() - 0.5) * r * 1.2;
      const py = cy + (rng() - 0.5) * r * 1.0;
      const rx = r * (0.1 + rng() * 0.25) * Math.sqrt(profile.ocean.coverage);
      const ry = rx * (0.4 + rng() * 0.6);
      const angle = rng() * Math.PI;
      ctx.fillStyle = hexToRgba(profile.ocean.colour, profile.ocean.frozen ? 0.35 : 0.6);
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();
      // Secondary bay/inlet for irregular coastlines
      if (rng() > 0.35) {
        const bx = px + (rng() - 0.5) * rx * 1.5;
        const by = py + (rng() - 0.5) * ry * 1.5;
        ctx.fillStyle = hexToRgba(profile.ocean.colour, profile.ocean.frozen ? 0.3 : 0.5);
        ctx.beginPath();
        ctx.ellipse(bx, by, rx * 0.5, ry * 0.6, angle + rng(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Layer 3: Craters ──
  if (profile.terrain.craterDensity > 0.15) {
    const craterCount = Math.floor(profile.terrain.craterDensity * 15);
    for (let i = 0; i < craterCount; i++) {
      const cx2 = cx + (rng() - 0.5) * r * 1.4;
      const cy2 = cy + (rng() - 0.5) * r * 1.4;
      const cr = r * (0.02 + rng() * 0.06);
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(cx2 + cr * 0.15, cy2 + cr * 0.15, cr, 0, Math.PI * 2);
      ctx.fill();
      // Crater floor
      ctx.fillStyle = hexToRgba(pal.c3, 0.6);
      ctx.beginPath();
      ctx.arc(cx2, cy2, cr * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Rim highlight
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx2 - cr * 0.1, cy2 - cr * 0.1, cr, -Math.PI * 0.6, Math.PI * 0.3);
      ctx.stroke();
    }
  }

  // ── Layer 3b: Volcanic patches ──
  if (profile.terrain.type === "volcanic") {
    for (let i = 0; i < 3; i++) {
      const vx = cx + (rng() - 0.5) * r * 1.0;
      const vy = cy + (rng() - 0.5) * r * 0.8;
      const vr = r * (0.06 + rng() * 0.08);
      const vGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
      vGrad.addColorStop(0, "rgba(80,40,20,0.5)");
      vGrad.addColorStop(1, "transparent");
      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layer 4: Ice caps ──
  if (profile.iceCaps.north > 0.01) {
    const capH = r * 2 * profile.iceCaps.north * 0.5;
    const capGrad = ctx.createLinearGradient(0, cy - r, 0, cy - r + capH);
    capGrad.addColorStop(0, hexToRgba(profile.iceCaps.colour, 0.85));
    capGrad.addColorStop(1, "transparent");
    ctx.fillStyle = capGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, capH);
  }
  if (profile.iceCaps.south > 0.01) {
    const capH = r * 2 * profile.iceCaps.south * 0.5;
    const capGrad = ctx.createLinearGradient(0, cy + r, 0, cy + r - capH);
    capGrad.addColorStop(0, hexToRgba(profile.iceCaps.colour, 0.85));
    capGrad.addColorStop(1, "transparent");
    ctx.fillStyle = capGrad;
    ctx.fillRect(cx - r, cy + r - capH, r * 2, capH);
  }

  // ── Layer 5: Vegetation patches ──
  if (profile.vegetation.coverage > 0 && profile.vegetation.colour) {
    const vegPatches = Math.floor(profile.vegetation.coverage * 14) + 2;
    for (let i = 0; i < vegPatches; i++) {
      const vx = cx + (rng() - 0.5) * r * 1.2;
      const vy = cy + (rng() - 0.3) * r * 0.9;
      const vr = r * (0.08 + rng() * 0.14);
      const vrY = vr * (0.4 + rng() * 0.6);
      const vAngle = rng() * Math.PI;
      ctx.fillStyle = hexToRgba(profile.vegetation.colour, 0.45);
      ctx.beginPath();
      ctx.ellipse(vx, vy, vr, vrY, vAngle, 0, Math.PI * 2);
      ctx.fill();
      // Secondary sub-patch for organic shape
      if (rng() > 0.3) {
        const ox = vx + (rng() - 0.5) * vr * 1.2;
        const oy = vy + (rng() - 0.5) * vrY * 1.2;
        ctx.fillStyle = hexToRgba(profile.vegetation.colour, 0.35);
        ctx.beginPath();
        ctx.ellipse(ox, oy, vr * 0.6, vrY * 0.7, vAngle + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Layer 6: Cloud wisps ──
  if (profile.clouds.coverage > 0) {
    const cloudCount = Math.max(1, Math.floor(profile.clouds.coverage * 10));
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < cloudCount; i++) {
      const clx = cx + (rng() - 0.5) * r * 1.6;
      const cly = cy + (rng() - 0.5) * r * 1.2;
      const clrx = r * (0.15 + rng() * 0.2);
      const clry = clrx * (0.2 + rng() * 0.3);
      const clGrad = ctx.createRadialGradient(clx, cly, 0, clx, cly, clrx);
      clGrad.addColorStop(0, hexToRgba(profile.clouds.colour, 0.25 * profile.clouds.coverage));
      clGrad.addColorStop(1, "transparent");
      ctx.fillStyle = clGrad;
      ctx.beginPath();
      ctx.ellipse(clx, cly, clrx, clry, rng() * Math.PI * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Layer 7: Lava cracks ──
  if (profile.special === "lava") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(255,100,20,0.55)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255,60,10,0.8)";
    ctx.shadowBlur = 4;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let px = cx - r * 0.5 + rng() * r;
      let py = cy - r * 0.5 + rng() * r;
      ctx.moveTo(px, py);
      for (let j = 0; j < 4; j++) {
        px += (rng() - 0.5) * r * 0.35;
        py += (rng() - 0.5) * r * 0.35;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Layer 8: Tidal lock terminator ──
  if (profile.tidallyLocked) {
    const tlGrad = ctx.createLinearGradient(cx + r * 0.1, 0, cx + r * 0.7, 0);
    tlGrad.addColorStop(0, "transparent");
    tlGrad.addColorStop(0.5, "rgba(0,0,0,0.3)");
    tlGrad.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = tlGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Layer 9: Limb darkening ──
  const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  limbGrad.addColorStop(0, "transparent");
  limbGrad.addColorStop(0.7, "transparent");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = limbGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 10: Specular highlight ──
  const hlGrad = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.3,
    0,
    cx - r * 0.3,
    cy - r * 0.3,
    r * 0.35,
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.25)");
  hlGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
  hlGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hlGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 11: Frozen crystalline highlight ──
  if (profile.special === "frozen") {
    const frGrad = ctx.createRadialGradient(
      cx - r * 0.2,
      cy - r * 0.25,
      0,
      cx - r * 0.2,
      cy - r * 0.25,
      r * 0.5,
    );
    frGrad.addColorStop(0, "rgba(255,255,255,0.4)");
    frGrad.addColorStop(0.3, "rgba(200,220,255,0.15)");
    frGrad.addColorStop(1, "transparent");
    ctx.fillStyle = frGrad;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore(); // un-clip

  // ── Layer 12: Atmosphere rim glow ──
  if (profile.atmosphere.thickness > 0) {
    const rimW = r * profile.atmosphere.thickness;
    const rimGrad = ctx.createRadialGradient(cx, cy, r - rimW * 0.5, cx, cy, r + rimW);
    rimGrad.addColorStop(0, "transparent");
    rimGrad.addColorStop(0.4, hexToRgba(profile.atmosphere.colour, 0.2));
    rimGrad.addColorStop(0.7, hexToRgba(profile.atmosphere.colour, 0.12));
    rimGrad.addColorStop(1, "transparent");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r + rimW, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── System poster renderer (8–20 px) ─────────────────────────────

export function drawRockyPlanetViz(ctx, x, y, r, profile, opts = {}) {
  const rng = seededRng(profile.seed);
  const lx = opts.lightDx || 0;
  const ly = opts.lightDy || 0;
  const hlOffX = lx * r * 0.4;
  const hlOffY = ly * r * 0.4;

  // ── Clip to sphere ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // ── Base surface gradient ──
  const baseGrad = ctx.createRadialGradient(x + hlOffX, y + hlOffY, r * 0.1, x, y, r);
  baseGrad.addColorStop(0, hexToRgba(profile.palette.c1, 0.98));
  baseGrad.addColorStop(0.55, hexToRgba(profile.palette.c2, 0.95));
  baseGrad.addColorStop(1, hexToRgba(profile.palette.c3, 0.95));
  ctx.fillStyle = baseGrad;
  ctx.fill();

  // ── Ocean / land patches (r >= 6) ──
  if (r >= 6 && profile.ocean.coverage > 0.1) {
    if (profile.ocean.coverage > 0.5) {
      ctx.fillStyle = hexToRgba(profile.ocean.colour, profile.ocean.frozen ? 0.3 : 0.5);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      const count = profile.ocean.coverage > 0.9 ? 1 : 3;
      const lp = profile.landPalette || profile.palette;
      for (let i = 0; i < count; i++) {
        const px = x + (rng() - 0.5) * r * 1.0;
        const py = y + (rng() - 0.5) * r * 0.8;
        const pr2 = r * (0.15 + rng() * 0.18);
        ctx.fillStyle = hexToRgba(lp.c2, 0.75);
        ctx.beginPath();
        ctx.ellipse(px, py, pr2, pr2 * (0.5 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        // Secondary lobe for irregular shape
        if (rng() > 0.3) {
          const lx2 = px + (rng() - 0.5) * pr2;
          const ly2 = py + (rng() - 0.5) * pr2;
          ctx.fillStyle = hexToRgba(lp.c1, 0.6);
          ctx.beginPath();
          ctx.ellipse(lx2, ly2, pr2 * 0.5, pr2 * 0.4, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const oCount = r >= 20 ? 3 : 2;
      for (let i = 0; i < oCount; i++) {
        const px = x + (rng() - 0.5) * r * 0.9;
        const py = y + (rng() - 0.5) * r * 0.7;
        const pr2 = r * profile.ocean.coverage * 0.4;
        ctx.fillStyle = hexToRgba(profile.ocean.colour, profile.ocean.frozen ? 0.3 : 0.5);
        ctx.beginPath();
        ctx.ellipse(px, py, pr2, pr2 * (0.4 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Vegetation patches (r >= 12) ──
  if (r >= 12 && profile.vegetation.coverage > 0 && profile.vegetation.colour) {
    const vCount = Math.max(1, Math.floor(profile.vegetation.coverage * 6));
    for (let i = 0; i < vCount; i++) {
      const vx2 = x + (rng() - 0.5) * r * 0.9;
      const vy2 = y + (rng() - 0.3) * r * 0.7;
      const vr2 = r * (0.08 + rng() * 0.1);
      ctx.fillStyle = hexToRgba(profile.vegetation.colour, 0.5);
      ctx.beginPath();
      ctx.ellipse(vx2, vy2, vr2, vr2 * 0.6, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Ice cap arcs (r >= 6) ──
  if (r >= 6) {
    if (profile.iceCaps.north > 0.05) {
      const capH = r * 2 * profile.iceCaps.north * 0.5;
      const capGrad = ctx.createLinearGradient(0, y - r, 0, y - r + capH);
      capGrad.addColorStop(0, hexToRgba(profile.iceCaps.colour, 0.7));
      capGrad.addColorStop(1, "transparent");
      ctx.fillStyle = capGrad;
      ctx.fillRect(x - r, y - r, r * 2, capH);
    }
    if (profile.iceCaps.south > 0.05) {
      const capH = r * 2 * profile.iceCaps.south * 0.5;
      const capGrad = ctx.createLinearGradient(0, y + r, 0, y + r - capH);
      capGrad.addColorStop(0, hexToRgba(profile.iceCaps.colour, 0.7));
      capGrad.addColorStop(1, "transparent");
      ctx.fillStyle = capGrad;
      ctx.fillRect(x - r, y + r - capH, r * 2, capH);
    }
  }

  // ── Cloud wisps (r >= 8) ──
  if (r >= 8 && profile.clouds.coverage > 0.1) {
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 2; i++) {
      const clx = x + (rng() - 0.5) * r;
      const cly = y + (rng() - 0.5) * r * 0.8;
      const clr = r * 0.3;
      const clG = ctx.createRadialGradient(clx, cly, 0, clx, cly, clr);
      clG.addColorStop(0, hexToRgba(profile.clouds.colour, 0.2));
      clG.addColorStop(1, "transparent");
      ctx.fillStyle = clG;
      ctx.beginPath();
      ctx.ellipse(clx, cly, clr, clr * 0.3, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Lava cracks (r >= 6) ──
  if (r >= 6 && profile.special === "lava") {
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(255,100,20,0.5)";
    ctx.lineWidth = Math.max(0.5, r * 0.08);
    ctx.shadowColor = "rgba(255,60,10,0.6)";
    ctx.shadowBlur = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let px = x - r * 0.4 + rng() * r * 0.8;
      let py = y - r * 0.4 + rng() * r * 0.8;
      ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) {
        px += (rng() - 0.5) * r * 0.5;
        py += (rng() - 0.5) * r * 0.5;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Limb darkening ──
  const limbGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
  limbGrad.addColorStop(0, "transparent");
  limbGrad.addColorStop(0.75, "transparent");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // ── Specular highlight (r >= 4) ──
  if (r >= 4) {
    const hx = x + hlOffX * 0.6;
    const hy = y + hlOffY * 0.6;
    const hlG = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.4);
    hlG.addColorStop(0, "rgba(255,255,255,0.2)");
    hlG.addColorStop(0.5, "rgba(255,255,255,0.04)");
    hlG.addColorStop(1, "transparent");
    ctx.fillStyle = hlG;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // un-clip

  // ── Atmosphere rim (r >= 4) ──
  if (r >= 4 && profile.atmosphere.thickness > 0) {
    const rimW = r * profile.atmosphere.thickness;
    const rimGrad = ctx.createRadialGradient(x, y, r * 0.95, x, y, r + rimW);
    rimGrad.addColorStop(0, "transparent");
    rimGrad.addColorStop(0.5, hexToRgba(profile.atmosphere.colour, 0.15));
    rimGrad.addColorStop(1, "transparent");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + rimW, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Subtle outline ──
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Rocky planet recipe presets ──────────────────────────────────
//
// Each recipe defines: preview data (hardcoded derived + inputs for the
// picker thumbnail) and apply data (planet input overrides). Clicking a
// recipe sets the planet's surface/atmosphere inputs. Extreme-temperature
// recipes also set semiMajorAxisAu so the engine produces the correct
// visual effects (lava cracks, frozen surfaces, etc.).

const ROCKY_RECIPES = [
  // ── Terrestrial ───────────────────────────────────────────────
  {
    id: "blue-marble",
    label: "Blue Marble",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 288,
        tectonicRegime: "mobile",
        skyColourDayHex: "#93B6FF",
        vegetationPaleHex: "#4a7c32",
        vegetationDeepHex: "#1a3d0c",
        tidallyLockedToStar: false,
        radiusEarth: 1.0,
        radiusKm: 6371,
      },
      inputs: {
        pressureAtm: 1,
        h2oPct: 1,
        axialTiltDeg: 23.5,
        co2Pct: 0.04,
        albedoBond: 0.3,
        name: "Blue Marble",
      },
    },
    apply: {
      massEarth: 1,
      cmfPct: 33,
      wmfPct: 0.5,
      pressureAtm: 1,
      o2Pct: 21,
      co2Pct: 0.04,
      h2oPct: 1,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 23.5,
      albedoBond: 0.3,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "tropical-jungle",
    label: "Tropical Jungle",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 310,
        tectonicRegime: "episodic",
        skyColourDayHex: "#7DA8E8",
        vegetationPaleHex: "#4a8a3a",
        vegetationDeepHex: "#2a5a1a",
        tidallyLockedToStar: false,
        radiusEarth: 1.2,
        radiusKm: 7645,
      },
      inputs: {
        pressureAtm: 1.8,
        h2oPct: 3,
        axialTiltDeg: 10,
        co2Pct: 0.08,
        albedoBond: 0.25,
        name: "Tropical Jungle",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 30,
      wmfPct: 0.5,
      pressureAtm: 1.8,
      o2Pct: 22,
      co2Pct: 0.08,
      h2oPct: 3,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 10,
      albedoBond: 0.25,
      tectonicRegime: "episodic",
      greenhouseEffect: 1.2,
      vegOverride: true,
      vegPaleHexOverride: "#4a8a3a",
      vegDeepHexOverride: "#2a5a1a",
    },
  },
  {
    id: "arid-steppe",
    label: "Arid Steppe",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Mars-like",
        waterRegime: "Shallow oceans",
        surfaceTempK: 305,
        tectonicRegime: "mobile",
        skyColourDayHex: "#B8A87A",
        vegetationPaleHex: "#7a8a4a",
        vegetationDeepHex: "#4a5a2a",
        tidallyLockedToStar: false,
        radiusEarth: 0.85,
        radiusKm: 5415,
      },
      inputs: {
        pressureAtm: 0.6,
        h2oPct: 0.3,
        axialTiltDeg: 30,
        co2Pct: 2,
        albedoBond: 0.22,
        name: "Arid Steppe",
      },
    },
    apply: {
      massEarth: 0.7,
      cmfPct: 18,
      wmfPct: 0.0005,
      pressureAtm: 0.6,
      o2Pct: 15,
      co2Pct: 2,
      h2oPct: 0.3,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 30,
      albedoBond: 0.22,
      tectonicRegime: "mobile",
      greenhouseEffect: 0.8,
      vegOverride: true,
      vegPaleHexOverride: "#7a8a4a",
      vegDeepHexOverride: "#4a5a2a",
    },
  },
  {
    id: "tidally-locked",
    label: "Tidally Locked",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 300,
        tectonicRegime: "mobile",
        skyColourDayHex: "#8ABAFF",
        vegetationPaleHex: "#3a7a3a",
        vegetationDeepHex: "#1a4a1a",
        tidallyLockedToStar: true,
        radiusEarth: 0.9,
        radiusKm: 5734,
      },
      inputs: {
        pressureAtm: 1.2,
        h2oPct: 1.5,
        axialTiltDeg: 0,
        co2Pct: 0.1,
        albedoBond: 0.32,
        name: "Tidally Locked",
      },
    },
    apply: {
      massEarth: 0.8,
      cmfPct: 32,
      wmfPct: 0.5,
      pressureAtm: 1.2,
      o2Pct: 20,
      co2Pct: 0.1,
      h2oPct: 1.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.32,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: true,
      vegPaleHexOverride: "#3a7a3a",
      vegDeepHexOverride: "#1a4a1a",
    },
  },

  // ── Barren ────────────────────────────────────────────────────
  {
    id: "red-desert",
    label: "Red Desert",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Mars-like",
        waterRegime: "Dry",
        surfaceTempK: 220,
        tectonicRegime: "stagnant",
        skyColourDayHex: "#C4A87A",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.53,
        radiusKm: 3390,
      },
      inputs: {
        pressureAtm: 0.006,
        h2oPct: 0,
        axialTiltDeg: 25,
        co2Pct: 95,
        albedoBond: 0.25,
        name: "Red Desert",
      },
    },
    apply: {
      massEarth: 0.1,
      cmfPct: 18,
      wmfPct: 0,
      pressureAtm: 0.006,
      o2Pct: 0,
      co2Pct: 95,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 25,
      albedoBond: 0.25,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0.05,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "cratered-husk",
    label: "Cratered Husk",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Mercury-like",
        waterRegime: "Dry",
        surfaceTempK: 440,
        tectonicRegime: "stagnant",
        skyColourDayHex: null,
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.38,
        radiusKm: 2440,
      },
      inputs: {
        pressureAtm: 0,
        h2oPct: 0,
        axialTiltDeg: 0,
        co2Pct: 0,
        albedoBond: 0.12,
        name: "Cratered Husk",
      },
    },
    apply: {
      massEarth: 0.055,
      cmfPct: 55,
      wmfPct: 0,
      pressureAtm: 0,
      o2Pct: 0,
      co2Pct: 0,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.12,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "iron-fortress",
    label: "Iron Fortress",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Iron world",
        waterRegime: "Dry",
        surfaceTempK: 350,
        tectonicRegime: "mobile",
        skyColourDayHex: "#6070A0",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.8,
        radiusKm: 5097,
      },
      inputs: {
        pressureAtm: 0.3,
        h2oPct: 0,
        axialTiltDeg: 5,
        co2Pct: 5,
        albedoBond: 0.1,
        name: "Iron Fortress",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 70,
      wmfPct: 0,
      pressureAtm: 0.3,
      o2Pct: 2,
      co2Pct: 5,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.1,
      tectonicRegime: "mobile",
      greenhouseEffect: 0.3,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "pale-mantle",
    label: "Pale Mantle",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Coreless",
        waterRegime: "Shallow oceans",
        surfaceTempK: 310,
        tectonicRegime: "episodic",
        skyColourDayHex: "#A0B8C8",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 0.7,
        h2oPct: 0.5,
        axialTiltDeg: 15,
        co2Pct: 1,
        albedoBond: 0.35,
        name: "Pale Mantle",
      },
    },
    apply: {
      massEarth: 0.9,
      cmfPct: 5,
      wmfPct: 0.0005,
      pressureAtm: 0.7,
      o2Pct: 8,
      co2Pct: 1,
      h2oPct: 0.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0.1,
      nh3Pct: 0,
      axialTiltDeg: 15,
      albedoBond: 0.35,
      tectonicRegime: "episodic",
      greenhouseEffect: 0.5,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },

  // ── Extreme ───────────────────────────────────────────────────
  {
    id: "lava-world",
    label: "Lava World",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Dry",
        surfaceTempK: 1500,
        tectonicRegime: "episodic",
        skyColourDayHex: "#FF6820",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 0.1,
        h2oPct: 0,
        axialTiltDeg: 0,
        co2Pct: 20,
        albedoBond: 0.08,
        name: "Lava World",
      },
    },
    apply: {
      semiMajorAxisAu: 0.04,
      massEarth: 1.2,
      cmfPct: 33,
      wmfPct: 0,
      pressureAtm: 0.1,
      o2Pct: 0,
      co2Pct: 20,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 5,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.08,
      tectonicRegime: "episodic",
      greenhouseEffect: 8,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "venus-shroud",
    label: "Venus Shroud",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Dry",
        surfaceTempK: 735,
        tectonicRegime: "episodic",
        skyColourDayHex: "#E0B050",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.95,
        radiusKm: 6052,
      },
      inputs: {
        pressureAtm: 92,
        h2oPct: 0.002,
        axialTiltDeg: 3,
        co2Pct: 96,
        albedoBond: 0.76,
        name: "Venus Shroud",
      },
    },
    apply: {
      semiMajorAxisAu: 0.72,
      massEarth: 0.82,
      cmfPct: 32,
      wmfPct: 0,
      pressureAtm: 92,
      o2Pct: 0,
      co2Pct: 96,
      h2oPct: 0.002,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0.015,
      nh3Pct: 0,
      axialTiltDeg: 3,
      albedoBond: 0.76,
      tectonicRegime: "episodic",
      greenhouseEffect: 200,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "frozen-wasteland",
    label: "Frozen Wasteland",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Ice world",
        waterRegime: "Ice world",
        surfaceTempK: 60,
        tectonicRegime: "stagnant",
        skyColourDayHex: null,
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.7,
        radiusKm: 4460,
      },
      inputs: {
        pressureAtm: 0,
        h2oPct: 0,
        axialTiltDeg: 5,
        co2Pct: 0,
        albedoBond: 0.7,
        name: "Frozen Wasteland",
      },
    },
    apply: {
      semiMajorAxisAu: 15,
      massEarth: 0.3,
      cmfPct: 15,
      wmfPct: 40,
      pressureAtm: 0,
      o2Pct: 0,
      co2Pct: 0,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.7,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "snowball",
    label: "Snowball",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Global ocean",
        surfaceTempK: 230,
        tectonicRegime: "stagnant",
        skyColourDayHex: "#A0C0E0",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.0,
        radiusKm: 6371,
      },
      inputs: {
        pressureAtm: 0.5,
        h2oPct: 0.8,
        axialTiltDeg: 40,
        co2Pct: 2,
        albedoBond: 0.65,
        name: "Snowball",
      },
    },
    apply: {
      semiMajorAxisAu: 1.5,
      massEarth: 1.0,
      cmfPct: 33,
      wmfPct: 5,
      pressureAtm: 0.5,
      o2Pct: 10,
      co2Pct: 2,
      h2oPct: 0.8,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 40,
      albedoBond: 0.65,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0.2,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },

  // ── Ocean ─────────────────────────────────────────────────────
  {
    id: "water-world",
    label: "Water World",
    category: "Ocean",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Global ocean",
        surfaceTempK: 280,
        tectonicRegime: "mobile",
        skyColourDayHex: "#88BBEE",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.3,
        radiusKm: 8282,
      },
      inputs: {
        pressureAtm: 1.5,
        h2oPct: 2.5,
        axialTiltDeg: 5,
        co2Pct: 0.5,
        albedoBond: 0.35,
        name: "Water World",
      },
    },
    apply: {
      massEarth: 2.0,
      cmfPct: 25,
      wmfPct: 5,
      pressureAtm: 1.5,
      o2Pct: 18,
      co2Pct: 0.5,
      h2oPct: 2.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.35,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "archipelago",
    label: "Archipelago",
    category: "Ocean",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 295,
        tectonicRegime: "episodic",
        skyColourDayHex: "#80B0E0",
        vegetationPaleHex: "#2a7a4a",
        vegetationDeepHex: "#0a4a2a",
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 1.3,
        h2oPct: 2,
        axialTiltDeg: 20,
        co2Pct: 0.3,
        albedoBond: 0.3,
        name: "Archipelago",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 25,
      wmfPct: 0.8,
      pressureAtm: 1.3,
      o2Pct: 20,
      co2Pct: 0.3,
      h2oPct: 2,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 20,
      albedoBond: 0.3,
      tectonicRegime: "episodic",
      greenhouseEffect: 1,
      vegOverride: true,
      vegPaleHexOverride: "#2a7a4a",
      vegDeepHexOverride: "#0a4a2a",
    },
  },
];

// ── Recipe preview renderer ─────────────────────────────────────

export function drawRecipePreview(canvas, recipe) {
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  canvas.width = 90 * dpr;
  canvas.height = 90 * dpr;
  canvas.style.width = "90px";
  canvas.style.height = "90px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const profile = computeRockyVisualProfile(recipe.preview.derived, recipe.preview.inputs);
  drawRockyPlanetViz(ctx, 45, 45, 38, profile, { lightDx: -0.7, lightDy: -0.5 });
}

export { ROCKY_RECIPES };
