// ─── Moon visual rendering ──────────────────────────────────────────
//
// Physics-driven visual system for moons. Engine-computed properties
// (composition class, tidal heating, density, albedo, tidal lock)
// determine the moon's appearance from space.
//
// Architecture mirrors rockyPlanetStyles.js:
//   computeMoonVisualProfile()  → visual profile from engine data
//   drawMoonPreview()           → 180×180 px detailed preview
//   drawMoonViz()               → 8–20 px system/visualiser scale

import { seededRng, hexToRgba, tintPalette } from "./renderUtils.js";

// ── Constants ─────────────────────────────────────────────────────

const MOON_PALETTES = {
  "Very icy": { c1: "#e8eef5", c2: "#c0d0e0", c3: "#7090a8" },
  Icy: { c1: "#d0dce8", c2: "#a0b8cc", c3: "#5a7a90" },
  "Subsurface ocean": { c1: "#c8d8e8", c2: "#90b0c8", c3: "#4a7090" },
  "Mixed rock/ice": { c1: "#c8c0b4", c2: "#989088", c3: "#5a5450" },
  "Dark icy": { c1: "#8a9098", c2: "#606870", c3: "#383e48" },
  Rocky: { c1: "#b8b0a8", c2: "#888078", c3: "#4a4540" },
  "Partially molten": { c1: "#b0a898", c2: "#807060", c3: "#504030" },
  "Iron-rich": { c1: "#8a8890", c2: "#585660", c3: "#2a2830" },
};

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Profile computation ──────────────────────────────────────────

/**
 * Compute a visual profile for a moon from engine-computed data.
 *
 * @param {object} moonCalc - Result of calcMoonExact()
 * @returns {object} MoonVisualProfile
 */
export function computeMoonVisualProfile(moonCalc) {
  if (!moonCalc) return fallbackProfile("unknown");

  const tides = moonCalc.tides || {};
  const inputs = moonCalc.inputs || {};
  const physical = moonCalc.physical || {};

  const compClass = tides.compositionOverride || tides.compositionClass || "Rocky";
  const density = Number(inputs.densityGcm3) || 3.34;
  const albedo = Number(inputs.albedo) || 0.11;
  const radiusMoon = Number(physical.radiusMoon) || 1;
  const heatingEarth = Number(tides.tidalHeatingEarth) || 0;
  const locked = tides.moonLockedToPlanet === "Yes";
  const name = moonCalc.inputs?.name || moonCalc.id || "moon";

  // 1. Visual class — multi-signal decision tree.
  //    Uses albedo, density, radius, and tidal heating to disambiguate
  //    captured asteroids, dark icy bodies, and bright icy moons.
  let visualClass;
  if (tides.compositionOverride) {
    // User-set override — honour directly
    visualClass = compClass;
  } else if (albedo >= 0.5 && density < 3.5) {
    // Step 1: Bright surface — reflective ice confirmed
    visualClass = compClass;
  } else if (heatingEarth > 5) {
    // Step 2: High tidal heating — volcanic dominates
    visualClass = compClass;
  } else if (radiusMoon < 0.01 && albedo < 0.15) {
    // Step 3: Captured asteroid (tiny + dark)
    visualClass = "Rocky";
  } else if (density < 2.5 && albedo < 0.25 && radiusMoon >= 0.01) {
    // Step 4: Dark icy body (large + dark + low density)
    visualClass = "Dark icy";
  } else {
    // Step 5: Default — engine composition class
    visualClass = compClass;
  }

  // Fall back to Rocky if visual class has no palette
  if (!MOON_PALETTES[visualClass]) visualClass = "Rocky";
  const palette = tintPalette(MOON_PALETTES[visualClass], albedo);

  // 2. Terrain type and crater density
  const isCaptured = visualClass === "Rocky" && radiusMoon < 0.01;
  const isDarkIcy = visualClass === "Dark icy";

  let terrainType, craterDensity;
  if (heatingEarth > 10) {
    terrainType = "volcanic";
    craterDensity = 0.02;
  } else if (heatingEarth > 1) {
    terrainType = "active";
    craterDensity = 0.1;
  } else if (isCaptured) {
    terrainType = "worn";
    craterDensity = 0.5;
  } else if (isDarkIcy) {
    terrainType = "worn";
    craterDensity = 0.35;
  } else if (density < 2.0) {
    terrainType = "icy-smooth";
    craterDensity = 0.15;
  } else if (density < 3.2) {
    terrainType = "worn";
    craterDensity = 0.4;
  } else {
    terrainType = "cratered";
    craterDensity = 0.7;
  }

  // 3. Ice coverage
  let iceCoverage = 0;
  if (isCaptured) {
    iceCoverage = 0;
  } else if (isDarkIcy) {
    iceCoverage = 0.2;
  } else if (compClass === "Very icy" || compClass === "Icy") {
    iceCoverage = 0.9 + (compClass === "Very icy" ? 0.1 : 0);
  } else if (compClass === "Subsurface ocean") {
    iceCoverage = 0.95;
  } else if (compClass === "Mixed rock/ice") {
    iceCoverage = 0.4;
  }

  // 4. Tidal heating visual
  const tidalActive = heatingEarth > 0.5;
  const tidalIntensity = clamp(heatingEarth / 40, 0, 1);

  // 5. Atmosphere (most moons have none; only very large icy/mixed bodies)
  let atmThickness = 0;
  let atmColour = "#e0a840";
  if (
    radiusMoon > 1.0 &&
    density >= 1.5 &&
    density <= 2.5 &&
    (compClass === "Icy" || compClass === "Subsurface ocean" || compClass === "Mixed rock/ice")
  ) {
    atmThickness = 0.06;
  }

  // 6. Special effects
  let special = null;
  if (heatingEarth > 10) {
    special = "volcanic";
  } else if (compClass === "Subsurface ocean") {
    special = "subsurface-ocean";
  } else if (compClass === "Partially molten") {
    special = "molten";
  } else if (density < 1.0 && albedo > 0.6) {
    special = "frozen";
  }

  return {
    bodyType: "moon",
    displayClass: visualClass,
    palette,
    terrain: { type: terrainType, craterDensity },
    iceCoverage,
    iceColour: "#e8f0ff",
    tidalHeating: { active: tidalActive, intensity: tidalIntensity },
    atmosphere: { thickness: atmThickness, colour: atmColour },
    special,
    tidallyLocked: locked,
    seed: String(name),
  };
}

/** Minimal safe profile when no engine data is available. */
function fallbackProfile(seed) {
  return {
    bodyType: "moon",
    displayClass: "Rocky",
    palette: MOON_PALETTES.Rocky,
    terrain: { type: "cratered", craterDensity: 0.5 },
    iceCoverage: 0,
    iceColour: "#e8f0ff",
    tidalHeating: { active: false, intensity: 0 },
    atmosphere: { thickness: 0, colour: "#e0a840" },
    special: null,
    tidallyLocked: true,
    seed: String(seed),
  };
}

// ── 180×180 px detailed preview ──────────────────────────────────

/**
 * Draw a detailed moon preview onto a <canvas> element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} profile - MoonVisualProfile from computeMoonVisualProfile()
 * @param {object} [opts]
 */
export function drawMoonPreview(canvas, profile, _opts = {}) {
  if (!canvas || !profile) return;

  const dpr = window.devicePixelRatio || 1;
  const W = 180;
  canvas.width = W * dpr;
  canvas.height = W * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = W + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, W);

  const cx = 90;
  const cy = 90;
  const r = 68;

  const {
    palette,
    terrain,
    iceCoverage,
    iceColour,
    tidalHeating,
    atmosphere,
    special,
    tidallyLocked,
    seed,
  } = profile;
  const rng = seededRng(seed);

  // ── Layer 1: Base surface gradient ────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const baseGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, 0, cx, cy, r);
  baseGrad.addColorStop(0, palette.c1);
  baseGrad.addColorStop(0.55, palette.c2);
  baseGrad.addColorStop(1, palette.c3);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, W);

  // ── Layer 2: Ice coverage overlay ─────────────────────────────
  if (iceCoverage > 0) {
    const iceAlpha = iceCoverage * 0.55;
    const iceGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.15, 0, cx, cy, r);
    iceGrad.addColorStop(0, hexToRgba(iceColour, iceAlpha * 0.8));
    iceGrad.addColorStop(0.6, hexToRgba(iceColour, iceAlpha));
    iceGrad.addColorStop(1, hexToRgba(iceColour, iceAlpha * 0.4));
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, W, W);

    // Irregular ice patches for partial coverage
    if (iceCoverage < 0.85) {
      const patchCount = Math.round(6 + iceCoverage * 8);
      for (let i = 0; i < patchCount; i++) {
        const px = cx + (rng() - 0.5) * r * 1.4;
        const py = cy + (rng() - 0.5) * r * 1.4;
        const pr = r * (0.15 + rng() * 0.2) * iceCoverage;
        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pGrad.addColorStop(0, hexToRgba(iceColour, 0.4));
        pGrad.addColorStop(1, hexToRgba(iceColour, 0));
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.ellipse(px, py, pr, pr * (0.6 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Layer 3: Craters ──────────────────────────────────────────
  if (terrain.craterDensity > 0) {
    const craterCount = Math.round(terrain.craterDensity * 20);
    for (let i = 0; i < craterCount; i++) {
      const cxp = cx + (rng() - 0.5) * r * 1.6;
      const cyp = cy + (rng() - 0.5) * r * 1.6;
      const cr = 2 + rng() * (6 + terrain.craterDensity * 6);

      // Shadow side
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.arc(cxp + 0.8, cyp + 0.8, cr, 0, Math.PI * 2);
      ctx.fill();

      // Crater floor
      ctx.fillStyle = hexToRgba(palette.c3, 0.25);
      ctx.beginPath();
      ctx.arc(cxp, cyp, cr, 0, Math.PI * 2);
      ctx.fill();

      // Rim highlight
      ctx.strokeStyle = hexToRgba(palette.c1, 0.2);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cxp, cyp, cr, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
    }
  }

  // ── Layer 4: Volcanic patches ─────────────────────────────────
  if (terrain.type === "volcanic") {
    for (let i = 0; i < 5; i++) {
      const vx = cx + (rng() - 0.5) * r * 1.2;
      const vy = cy + (rng() - 0.5) * r * 1.2;
      const vr = 6 + rng() * 12;
      const vGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
      vGrad.addColorStop(0, "rgba(60,30,10,0.5)");
      vGrad.addColorStop(0.5, "rgba(40,20,8,0.3)");
      vGrad.addColorStop(1, "rgba(30,15,5,0)");
      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Layer 5: Tidal heating lava cracks ────────────────────────
  if (tidalHeating.active && tidalHeating.intensity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const intensity = tidalHeating.intensity;
    const crackCount = Math.round(3 + intensity * 5);
    for (let i = 0; i < crackCount; i++) {
      const sx = cx + (rng() - 0.5) * r * 1.2;
      const sy = cy + (rng() - 0.5) * r * 1.2;
      ctx.strokeStyle = `rgba(255,${Math.round(120 + intensity * 80)},40,${0.3 + intensity * 0.4})`;
      ctx.lineWidth = 0.8 + intensity * 1.2;
      ctx.shadowColor = `rgba(255,${Math.round(80 + intensity * 60)},20,${intensity * 0.6})`;
      ctx.shadowBlur = 3 + intensity * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let s = 0; s < 4; s++) {
        ctx.bezierCurveTo(
          sx + (rng() - 0.5) * r * 0.6,
          sy + (rng() - 0.5) * r * 0.6,
          sx + (rng() - 0.5) * r * 0.8,
          sy + (rng() - 0.5) * r * 0.8,
          sx + (rng() - 0.5) * r * 1.0,
          sy + (rng() - 0.5) * r * 1.0,
        );
      }
      ctx.stroke();
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Layer 6: Subsurface ocean fractures ───────────────────────
  if (special === "subsurface-ocean") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 6; i++) {
      const fx = cx + (rng() - 0.5) * r * 1.4;
      const fy = cy + (rng() - 0.5) * r * 1.4;
      ctx.strokeStyle = "rgba(100,180,255,0.25)";
      ctx.lineWidth = 0.6;
      ctx.shadowColor = "rgba(80,160,240,0.4)";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      for (let s = 0; s < 3; s++) {
        ctx.lineTo(fx + (rng() - 0.5) * r * 0.8, fy + (rng() - 0.5) * r * 0.8);
      }
      ctx.stroke();
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Layer 7: Frozen crystalline highlight ─────────────────────
  if (special === "frozen") {
    const fGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r * 0.9);
    fGrad.addColorStop(0, "rgba(220,240,255,0.35)");
    fGrad.addColorStop(0.4, "rgba(200,225,255,0.15)");
    fGrad.addColorStop(1, "rgba(180,210,240,0)");
    ctx.fillStyle = fGrad;
    ctx.fillRect(0, 0, W, W);
  }

  // ── Layer 7b: Molten glow ─────────────────────────────────────
  if (special === "molten") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const mGrad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    mGrad.addColorStop(0, "rgba(180,80,20,0.2)");
    mGrad.addColorStop(0.6, "rgba(120,40,10,0.1)");
    mGrad.addColorStop(1, "rgba(80,20,5,0)");
    ctx.fillStyle = mGrad;
    ctx.fillRect(0, 0, W, W);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Layer 8: Tidal lock terminator ────────────────────────────
  if (tidallyLocked) {
    const termGrad = ctx.createLinearGradient(cx + r * 0.2, 0, cx + r, 0);
    termGrad.addColorStop(0, "rgba(0,0,0,0)");
    termGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = termGrad;
    ctx.fillRect(0, 0, W, W);
  }

  // ── Layer 9: Limb darkening ───────────────────────────────────
  const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  limbGrad.addColorStop(0, "rgba(0,0,0,0)");
  limbGrad.addColorStop(0.75, "rgba(0,0,0,0)");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = limbGrad;
  ctx.fillRect(0, 0, W, W);

  // ── Layer 10: Specular highlight ──────────────────────────────
  const hlGrad = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.3,
    0,
    cx - r * 0.3,
    cy - r * 0.3,
    r * 0.6,
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.25)");
  hlGrad.addColorStop(0.3, "rgba(255,255,255,0.06)");
  hlGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hlGrad;
  ctx.fillRect(0, 0, W, W);

  ctx.restore(); // un-clip

  // ── Layer 11: Atmosphere haze rim ─────────────────────────────
  if (atmosphere.thickness > 0) {
    const atmR = r + r * atmosphere.thickness * 2;
    const atmGrad = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, atmR);
    atmGrad.addColorStop(0, "rgba(0,0,0,0)");
    atmGrad.addColorStop(0.5, hexToRgba(atmosphere.colour, atmosphere.thickness * 3));
    atmGrad.addColorStop(1, hexToRgba(atmosphere.colour, 0));
    ctx.fillStyle = atmGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, atmR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Layer 12: Subtle outline ──────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// ── 8–20 px system/visualiser scale ─────────────────────────────

/**
 * Draw a moon at system visualiser scale.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Centre x
 * @param {number} y - Centre y
 * @param {number} r - Pixel radius
 * @param {object} profile - MoonVisualProfile
 * @param {object} [opts] - { lightDx, lightDy }
 */
export function drawMoonViz(ctx, x, y, r, profile, opts = {}) {
  if (!profile || r < 0.5) return;

  const lx = opts.lightDx || -0.7;
  const ly = opts.lightDy || -0.3;
  const { palette, terrain, iceCoverage, iceColour, tidalHeating, atmosphere, special, seed } =
    profile;
  const rng = seededRng(seed);

  // Highlight offset toward light source
  const hlOffX = lx * r * 0.4;
  const hlOffY = ly * r * 0.4;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // ── Base gradient ─────────────────────────────────────────────
  const baseGrad = ctx.createRadialGradient(x + hlOffX, y + hlOffY, 0, x, y, r);
  baseGrad.addColorStop(0, palette.c1);
  baseGrad.addColorStop(0.55, palette.c2);
  baseGrad.addColorStop(1, palette.c3);
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // ── Ice overlay (r ≥ 6) ───────────────────────────────────────
  if (r >= 6 && iceCoverage > 0) {
    const iceAlpha = iceCoverage * 0.4;
    const iceGrad = ctx.createRadialGradient(x + hlOffX, y + hlOffY, 0, x, y, r);
    iceGrad.addColorStop(0, hexToRgba(iceColour, iceAlpha * 0.6));
    iceGrad.addColorStop(0.6, hexToRgba(iceColour, iceAlpha));
    iceGrad.addColorStop(1, hexToRgba(iceColour, iceAlpha * 0.3));
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Craters (r ≥ 6) ──────────────────────────────────────────
  if (r >= 6 && terrain.craterDensity > 0) {
    const count = Math.min(Math.round(terrain.craterDensity * 8), 6);
    for (let i = 0; i < count; i++) {
      const cpx = x + (rng() - 0.5) * r * 1.4;
      const cpy = y + (rng() - 0.5) * r * 1.4;
      const cr = 0.8 + rng() * (r * 0.15);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.arc(cpx, cpy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Lava cracks (r ≥ 6) ──────────────────────────────────────
  if (r >= 6 && tidalHeating.active && tidalHeating.intensity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const intensity = tidalHeating.intensity;
    const crackCount = Math.min(Math.round(2 + intensity * 3), 4);
    for (let i = 0; i < crackCount; i++) {
      const sx = x + (rng() - 0.5) * r * 1.0;
      const sy = y + (rng() - 0.5) * r * 1.0;
      ctx.strokeStyle = `rgba(255,${Math.round(120 + intensity * 80)},40,${0.2 + intensity * 0.3})`;
      ctx.lineWidth = 0.5 + intensity * 0.8;
      ctx.shadowColor = `rgba(255,${Math.round(80 + intensity * 60)},20,${intensity * 0.4})`;
      ctx.shadowBlur = 2 + intensity * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(
        sx + (rng() - 0.5) * r * 0.5,
        sy + (rng() - 0.5) * r * 0.5,
        sx + (rng() - 0.5) * r * 0.7,
        sy + (rng() - 0.5) * r * 0.7,
        sx + (rng() - 0.5) * r * 0.9,
        sy + (rng() - 0.5) * r * 0.9,
      );
      ctx.stroke();
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Subsurface ocean fractures (r ≥ 6) ────────────────────────
  if (r >= 6 && special === "subsurface-ocean") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      const fx = x + (rng() - 0.5) * r * 1.2;
      const fy = y + (rng() - 0.5) * r * 1.2;
      ctx.strokeStyle = "rgba(100,180,255,0.2)";
      ctx.lineWidth = 0.4;
      ctx.shadowColor = "rgba(80,160,240,0.3)";
      ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (rng() - 0.5) * r * 0.6, fy + (rng() - 0.5) * r * 0.6);
      ctx.stroke();
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // ── Frozen crystalline highlight (r ≥ 12) ─────────────────────
  if (r >= 12 && special === "frozen") {
    const fGrad = ctx.createRadialGradient(x + hlOffX, y + hlOffY, 0, x, y, r * 0.8);
    fGrad.addColorStop(0, "rgba(220,240,255,0.25)");
    fGrad.addColorStop(0.5, "rgba(200,225,255,0.1)");
    fGrad.addColorStop(1, "rgba(180,210,240,0)");
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Limb darkening ────────────────────────────────────────────
  const limbGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
  limbGrad.addColorStop(0, "rgba(0,0,0,0)");
  limbGrad.addColorStop(0.75, "rgba(0,0,0,0)");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // ── Specular highlight (r ≥ 4) ────────────────────────────────
  if (r >= 4) {
    const shx = x + hlOffX * 0.8;
    const shy = y + hlOffY * 0.8;
    const hlGrad = ctx.createRadialGradient(shx, shy, 0, shx, shy, r * 0.5);
    hlGrad.addColorStop(0, "rgba(255,255,255,0.2)");
    hlGrad.addColorStop(0.4, "rgba(255,255,255,0.04)");
    hlGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // un-clip

  // ── Atmosphere rim (r ≥ 8) ────────────────────────────────────
  if (r >= 8 && atmosphere.thickness > 0) {
    const atmR = r + r * atmosphere.thickness * 2;
    const atmGrad = ctx.createRadialGradient(x, y, r * 0.92, x, y, atmR);
    atmGrad.addColorStop(0, "rgba(0,0,0,0)");
    atmGrad.addColorStop(0.5, hexToRgba(atmosphere.colour, atmosphere.thickness * 2.5));
    atmGrad.addColorStop(1, hexToRgba(atmosphere.colour, 0));
    ctx.fillStyle = atmGrad;
    ctx.beginPath();
    ctx.arc(x, y, atmR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Outline (r ≥ 4) ──────────────────────────────────────────
  if (r >= 4) {
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ── Moon Recipes ─────────────────────────────────────────────────── */

export const MOON_RECIPES = [
  // ── Major Rocky ───────────────────────────────────────────────────
  {
    id: "luna",
    label: "Luna",
    category: "Major Rocky",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 3.34, albedo: 0.11, name: "Luna" },
      physical: { radiusMoon: 1.0 },
    },
    apply: {
      massMoon: 1.0,
      densityGcm3: 3.34,
      albedo: 0.11,
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.145,
      compositionOverride: null,
    },
  },
  {
    id: "callisto",
    label: "Callisto",
    category: "Major Rocky",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.834, albedo: 0.17, name: "Callisto" },
      physical: { radiusMoon: 1.39 },
    },
    apply: {
      massMoon: 1.466,
      densityGcm3: 1.834,
      albedo: 0.17,
      semiMajorAxisKm: 1882700,
      eccentricity: 0.0074,
      inclinationDeg: 0.192,
      compositionOverride: null,
    },
  },
  {
    id: "ganymede",
    label: "Ganymede",
    category: "Major Rocky",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0.1,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.942, albedo: 0.43, name: "Ganymede" },
      physical: { radiusMoon: 1.52 },
    },
    apply: {
      massMoon: 2.017,
      densityGcm3: 1.942,
      albedo: 0.43,
      semiMajorAxisKm: 1070400,
      eccentricity: 0.0011,
      inclinationDeg: 0.177,
      compositionOverride: null,
    },
  },

  // ── Icy & Ocean ───────────────────────────────────────────────────
  {
    id: "europa",
    label: "Europa",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Subsurface ocean",
        tidalHeatingEarth: 1.5,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 3.013, albedo: 0.67, name: "Europa" },
      physical: { radiusMoon: 0.9 },
    },
    apply: {
      massMoon: 0.654,
      densityGcm3: 3.013,
      albedo: 0.67,
      semiMajorAxisKm: 671100,
      eccentricity: 0.0094,
      inclinationDeg: 0.466,
      compositionOverride: "Subsurface ocean",
    },
  },
  {
    id: "enceladus",
    label: "Enceladus",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Subsurface ocean",
        tidalHeatingEarth: 3.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.61, albedo: 0.81, name: "Enceladus" },
      physical: { radiusMoon: 0.145 },
    },
    apply: {
      massMoon: 0.001471,
      densityGcm3: 1.61,
      albedo: 0.81,
      semiMajorAxisKm: 238400,
      eccentricity: 0.0047,
      inclinationDeg: 0.009,
      compositionOverride: "Subsurface ocean",
    },
  },
  {
    id: "titan",
    label: "Titan",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0.02,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.882, albedo: 0.21, name: "Titan" },
      physical: { radiusMoon: 1.48 },
    },
    apply: {
      massMoon: 1.8324,
      densityGcm3: 1.882,
      albedo: 0.21,
      semiMajorAxisKm: 1221870,
      eccentricity: 0.0288,
      inclinationDeg: 0.306,
      compositionOverride: null,
    },
  },
  {
    id: "triton",
    label: "Triton",
    category: "Icy & Ocean",
    preview: {
      tides: { compositionClass: "Icy", tidalHeatingEarth: 0.3, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 2.065, albedo: 0.7, name: "Triton" },
      physical: { radiusMoon: 0.78 },
    },
    apply: {
      massMoon: 0.2913,
      densityGcm3: 2.065,
      albedo: 0.7,
      semiMajorAxisKm: 354800,
      eccentricity: 0.000016,
      inclinationDeg: 157.345,
      compositionOverride: null,
    },
  },

  // ── Volcanic ──────────────────────────────────────────────────────
  {
    id: "io",
    label: "Io",
    category: "Volcanic",
    preview: {
      tides: {
        compositionClass: "Partially molten",
        tidalHeatingEarth: 20.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 3.528, albedo: 0.63, name: "Io" },
      physical: { radiusMoon: 1.05 },
    },
    apply: {
      massMoon: 1.215,
      densityGcm3: 3.528,
      albedo: 0.63,
      semiMajorAxisKm: 421800,
      eccentricity: 0.0041,
      inclinationDeg: 0.036,
      compositionOverride: "Partially molten",
    },
  },
  {
    id: "molten-companion",
    label: "Molten Companion",
    category: "Volcanic",
    preview: {
      tides: {
        compositionClass: "Partially molten",
        tidalHeatingEarth: 35.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 4.0, albedo: 0.15, name: "Molten" },
      physical: { radiusMoon: 0.6 },
    },
    apply: {
      massMoon: 0.5,
      densityGcm3: 4.0,
      albedo: 0.15,
      semiMajorAxisKm: 200000,
      eccentricity: 0.08,
      inclinationDeg: 1.0,
      compositionOverride: "Partially molten",
    },
  },

  // ── Small & Captured ──────────────────────────────────────────────
  {
    id: "phobos",
    label: "Phobos",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 1.876, albedo: 0.071, name: "Phobos" },
      physical: { radiusMoon: 0.0064 },
    },
    apply: {
      massMoon: 0.000000145,
      densityGcm3: 1.876,
      albedo: 0.071,
      semiMajorAxisKm: 9375,
      eccentricity: 0.015,
      inclinationDeg: 1.09,
      compositionOverride: null,
    },
  },
  {
    id: "deimos",
    label: "Deimos",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 1.47, albedo: 0.068, name: "Deimos" },
      physical: { radiusMoon: 0.0036 },
    },
    apply: {
      massMoon: 0.00000002,
      densityGcm3: 1.47,
      albedo: 0.068,
      semiMajorAxisKm: 23457,
      eccentricity: 0.0002,
      inclinationDeg: 0.93,
      compositionOverride: null,
    },
  },
  {
    id: "irregular-capture",
    label: "Irregular Capture",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "No" },
      inputs: { densityGcm3: 1.5, albedo: 0.05, name: "Captured" },
      physical: { radiusMoon: 0.04 },
    },
    apply: {
      massMoon: 0.0001,
      densityGcm3: 1.5,
      albedo: 0.05,
      semiMajorAxisKm: 12000000,
      eccentricity: 0.4,
      inclinationDeg: 145.0,
      compositionOverride: null,
    },
  },
];

/**
 * Draw a 90×90 px moon recipe preview for the picker modal.
 * @param {HTMLCanvasElement} canvas
 * @param {object} recipe - entry from MOON_RECIPES
 */
export function drawMoonRecipePreview(canvas, recipe) {
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  canvas.width = 90 * dpr;
  canvas.height = 90 * dpr;
  canvas.style.width = "90px";
  canvas.style.height = "90px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const profile = computeMoonVisualProfile(recipe.preview);
  drawMoonViz(ctx, 45, 45, 38, profile, { lightDx: -0.7, lightDy: -0.5 });
}

export { MOON_PALETTES };
