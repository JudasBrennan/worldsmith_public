import {
  calcApparentModel,
  convertGasGiantRadiusRjToKm,
  convertPlanetRadiusEarthToKm,
  bondToGeometricAlbedo,
  classifyBodyType,
  SOL_REFERENCES,
} from "../engine/apparent.js";
import { calcMoonExact } from "../engine/moon.js";
import { calcPlanetExact } from "../engine/planet.js";
import { calcStar } from "../engine/star.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { drawGasGiantViz } from "./gasGiantStyles.js";
import { computeMoonVisualProfile, drawMoonViz } from "./moonStyles.js";
import { computeRockyVisualProfile, drawRockyPlanetViz } from "./rockyPlanetStyles.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import {
  getSelectedPlanet,
  getStarOverrides,
  listMoons,
  listPlanets,
  listSystemGasGiants,
  loadWorld,
} from "./store.js";

const TIP_LABEL = {
  "Home world": "Reference world used for apparent brightness and apparent size outputs.",
  "Moon phase":
    "Phase angle applied to all moons uniformly. 0\u00b0 = full (opposition), " +
    "180\u00b0 = new (conjunction, invisible).\n\n" +
    "Individual moon phases depend on orbital geometry; this slider " +
    "lets you explore the full range.",
  "Star apparent table":
    "Star apparent magnitude/brightness/size as seen from each body orbit in the current system.",
  "Body apparent table":
    "Planetary object visibility from the selected home world. Phase functions vary by body " +
    "type (WS8 types 1-4). Planet Bond albedo is auto-converted to geometric albedo via an " +
    "approximate phase integral. Star luminosity scales planet brightness via a " +
    "-2.5 log10(L) correction. Phase angles above 160\u00b0 are flagged as too " +
    "extreme to observe (WS8 convention). You can override current distance per object.",
  "Body type":
    "Phase function classification from WS8. " +
    "Type 1 (Rocky, airless): Bowell HG system, G=0.28. " +
    "Type 2 (Rocky w/ atmosphere): empirical polynomial. " +
    "Type 3 (Gas giant, R \u2265 1.5 R\u2295): piecewise polynomial with opposition surge. " +
    "Type 4 (Tiny body, R < 0.1 R\u2295): Bowell HG, G=0.15.",
  "Moon apparent table":
    "Moon apparent outputs from the selected home world. " +
    "All moons assigned to the home world are shown automatically.",
  "Moon absolute magnitude":
    "Deviation from WorldSmith 8 spreadsheet: WS8 has no moon apparent-magnitude page, so " +
    "this calculation is web-only. The host star's luminosity is included via a -2.5\u00b7log10(L) " +
    "correction (implemented as dividing by \u221aL inside the log argument). This scales the moon's " +
    "absolute magnitude for the brightness of the host star \u2014 brighter stars illuminate moons " +
    "more strongly, making them appear brighter from the home world.",
  "Angular diameter":
    "Apparent angular size of the object as seen from the home world. " +
    "Shown in degrees (\u00b0) for very large objects, arcminutes (\u2032) for medium, " +
    "or arcseconds (\u2033) for small.\n\n" +
    "Reference: Sun from Earth \u2248 31.6\u2032, Full Moon \u2248 31.1\u2032.",
  "Sol references":
    "Familiar Solar System objects for magnitude and angular size comparison. " +
    "All values are as seen from Earth.",
  "Sky canvas":
    "Visual comparison of angular sizes as seen from the home world. " +
    "Objects are drawn as disks at their true relative angular sizes. " +
    "Dotted outlines show familiar Solar System objects for reference.\n\n" +
    "When the star is much larger than other objects, a split scale is used: " +
    "the star appears at reduced scale (labelled) on the left, with moons " +
    "and planets at full scale on the right.",
};

function gasGiantAlbedo(style) {
  switch (String(style || "").toLowerCase()) {
    case "jupiter":
      return 0.538;
    case "saturn":
      return 0.499;
    case "ice":
      return 0.45;
    case "hot":
      return 0.4;
    case "exotic":
      return 0.35;
    default:
      return 0.45;
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moonRadiusFromInputs(inputs) {
  const massMoon = Number(inputs?.massMoon);
  const density = Number(inputs?.densityGcm3);
  if (!Number.isFinite(massMoon) || !Number.isFinite(density) || massMoon <= 0 || density <= 0) {
    return 1;
  }
  return Math.pow(massMoon / (density / 3.34), 1 / 3);
}

/* ── Sky canvas ──────────────────────────────────────────────── */

function hexToRgba(hex, a = 1) {
  if (!hex) return `rgba(160,200,255,${a})`;
  const h = hex.replace("#", "").trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic pseudo-random for starfield dots. */
function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

/** Format arcsec value to a short label. */
function angLabel(arcsec) {
  if (!Number.isFinite(arcsec) || arcsec <= 0) return "";
  if (arcsec >= 3600) return `${(arcsec / 3600).toFixed(1)}\u00b0`;
  if (arcsec >= 60) return `${(arcsec / 60).toFixed(1)}\u2032`;
  return `${arcsec.toFixed(1)}\u2033`;
}

/**
 * Draw the angular-size comparison canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} model - return value of calcApparentModel
 * @param {string} starColourHex - e.g. "#FFD2A1"
 * @param {string} skyMode - "night" | "day"
 * @param {number} moonPhaseDeg - 0–180
 * @param {object} skyColours - { dayHex, dayEdgeHex, horizonHex } from planet engine
 */
function drawSkyCanvas(canvas, model, starColourHex, skyMode, moonPhaseDeg, skyColours) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  const dpr = window.devicePixelRatio || 1;
  const W = Math.floor(rect.width);
  const H = Math.floor(rect.height);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const isNight = skyMode !== "day";

  // ── Background ────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (isNight) {
    bgGrad.addColorStop(0, "#050816");
    bgGrad.addColorStop(1, "#0c1228");
  } else {
    // Use planet-engine sky colours when available, else Earth-like default
    const zenith = skyColours?.dayHex || "#4A90D9";
    const horizon = skyColours?.horizonHex || "#87CEEB";
    bgGrad.addColorStop(0, zenith);
    bgGrad.addColorStop(1, horizon);
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Star-field dots (night only)
  if (isNight) {
    const rand = seededRand(42);
    for (let i = 0; i < 50; i++) {
      const sx = rand() * W;
      const sy = rand() * H;
      const sa = 0.15 + rand() * 0.45;
      ctx.fillStyle = `rgba(255,255,255,${sa})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // ── Collect objects ───────────────────────────────────────
  const homeStar = model.starByOrbit[0];
  const starArcsec = homeStar?.angularDiameterArcsec || 0;

  const moons = model.moons.filter(
    (m) => Number.isFinite(m.angularDiameterArcsec) && m.angularDiameterArcsec > 0,
  );
  const bodies = model.bodiesFromHome.filter(
    (b) => Number.isFinite(b.angularDiameterArcsec) && b.angularDiameterArcsec > 0,
  );

  const maxMoonArcsec = moons.reduce((m, o) => Math.max(m, o.angularDiameterArcsec), 0);
  const maxBodyArcsec = bodies.reduce((m, o) => Math.max(m, o.angularDiameterArcsec), 0);
  const maxNonStar = Math.max(maxMoonArcsec, maxBodyArcsec);

  // Sol reference sizes in arcsec for overlay outlines
  const solSun = 1896; // 31.6 arcmin
  const solMoon = 1866; // 31.1 arcmin
  const solVenus = 64;
  const solJupiter = 50;
  const solMars = 25;

  // ── Layout: split vs unified ──────────────────────────────
  const useSplit = starArcsec > 0 && maxNonStar > 0 && starArcsec > 10 * maxNonStar;
  const sizeY = H - 4; // size value baseline (bottom-aligned)
  const labelY = sizeY - 13; // object name sits above size value
  const diskCy = H * 0.38;
  const maxDiskR = H * 0.28;

  let starScale, rightScale;
  let starCx, rightStartX;

  if (useSplit) {
    // Star on left third, moons+planets on right two-thirds
    const starRegionW = W * 0.3;
    const rightRegionW = W * 0.65;
    starCx = starRegionW / 2;
    rightStartX = W * 0.35;

    // Scale star to fit its region
    starScale = Math.min(maxDiskR / (starArcsec / 2), (starRegionW * 0.8) / starArcsec);
    // Scale right region to the largest non-star object, also considering sol references
    const refMax = Math.max(maxNonStar, solSun, solMoon);
    rightScale = maxDiskR / (refMax / 2);
    // But also constrain so sol reference outlines fit in the region width
    const rightSlots = moons.length + bodies.length + 1; // +1 padding
    const minSpacing = refMax * rightScale + 20;
    if (rightSlots > 0 && minSpacing * rightSlots > rightRegionW) {
      rightScale = (rightRegionW / rightSlots - 20) / refMax;
    }
  } else if (starArcsec > 0) {
    // Unified: everything uses one scale
    const allMax = Math.max(starArcsec, maxNonStar, solSun, solMoon);
    const totalSlots = 1 + moons.length + bodies.length;
    const spacing = W / (totalSlots + 1);
    const scaleByHeight = maxDiskR / (allMax / 2);
    const scaleByWidth = (spacing * 0.8) / allMax;
    starScale = Math.min(scaleByHeight, scaleByWidth);
    rightScale = starScale;
    starCx = spacing;
    rightStartX = spacing * 2;
  } else {
    // No star data — just show moons and planets
    starScale = 0;
    const refMax = Math.max(maxNonStar, solSun, solMoon) || 1;
    rightScale = maxDiskR / (refMax / 2);
    rightStartX = W * 0.08;
    starCx = 0;
  }

  // Minimum pixel sizes
  const MIN_DOT = 2;

  // Label colours — white on night, dark on day, with shadow for contrast
  const labelCol = isNight ? "#c8cbe8" : "#ffffff";
  const subCol = isNight ? "#8088aa" : "rgba(255,255,255,0.7)";
  const shadowCol = isNight ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.7)";

  function setLabelShadow() {
    ctx.shadowColor = shadowCol;
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
  }
  function clearShadow() {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // ── Helper: draw a labelled disk ──────────────────────────
  function drawDisk(cx, cy, radiusPx, fillStyle, label, sizeText) {
    const r = Math.max(MIN_DOT, radiusPx);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();

    // Label
    setLabelShadow();
    ctx.fillStyle = labelCol;
    ctx.font = `11px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, cx, labelY);
    if (sizeText) {
      ctx.fillStyle = subCol;
      ctx.font = `10px ui-monospace, SFMono-Regular, monospace`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(sizeText, cx, sizeY);
    }
    clearShadow();
  }

  // ── Helper: dotted reference circle ───────────────────────
  function drawRefOutline(cx, cy, arcsec, scale, label, labelOffsetY, onBright) {
    const r = Math.max(MIN_DOT, (arcsec / 2) * scale);
    ctx.save();
    ctx.setLineDash([4, 4]);
    if (onBright) {
      // Dark contrasting outline visible against bright star surface
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Light inner edge for definition
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = isNight ? "rgba(160,180,220,0.4)" : "rgba(40,60,100,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Label at top-right of circle, offset to avoid overlapping objects
    const lx = cx + r + 4;
    const ly = (labelOffsetY ?? 0) + cy - r;
    setLabelShadow();
    ctx.fillStyle = isNight ? "rgba(180,195,230,0.7)" : "rgba(255,255,255,0.85)";
    ctx.font = `italic 9px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx, ly);
    clearShadow();
    ctx.restore();
  }

  // ── Draw star ─────────────────────────────────────────────
  if (starArcsec > 0 && starScale > 0) {
    const starR = Math.max(MIN_DOT, (starArcsec / 2) * starScale);

    // Glow
    const glowR = starR * 1.6;
    const glowGrad = ctx.createRadialGradient(starCx, diskCy, starR * 0.6, starCx, diskCy, glowR);
    glowGrad.addColorStop(0, hexToRgba(starColourHex, 0.25));
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(starCx, diskCy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Disk with radial gradient
    const diskGrad = ctx.createRadialGradient(
      starCx - starR * 0.2,
      diskCy - starR * 0.2,
      0,
      starCx,
      diskCy,
      starR,
    );
    diskGrad.addColorStop(0, "#ffffff");
    diskGrad.addColorStop(0.3, starColourHex);
    diskGrad.addColorStop(1, hexToRgba(starColourHex, 0.85));

    // Label
    const scaleNote = useSplit ? ` (\u00d7${(rightScale / starScale).toFixed(0)} inset)` : "";
    drawDisk(starCx, diskCy, starR, diskGrad, "Star" + scaleNote, angLabel(starArcsec));

    // Draw a sol-Sun reference outline at star scale for context
    const solR = (solSun / 2) * starScale;
    if (solSun * starScale >= MIN_DOT) {
      drawRefOutline(starCx, diskCy, solSun, starScale, "Sol", undefined, solR < starR);
    }
  }

  // ── Arrange right-side objects ────────────────────────────
  const rightObjs = [];
  moons.forEach((m) => rightObjs.push({ type: "moon", data: m, arcsec: m.angularDiameterArcsec }));
  bodies.forEach((b) => rightObjs.push({ type: "body", data: b, arcsec: b.angularDiameterArcsec }));

  if (rightObjs.length > 0 && rightScale > 0) {
    const rightW = W - rightStartX - 10;
    const spacing = rightW / (rightObjs.length + 1);

    rightObjs.forEach((obj, i) => {
      const cx = rightStartX + spacing * (i + 1);
      const arcsecR = (obj.arcsec / 2) * rightScale;

      if (obj.type === "moon") {
        const m = obj.data;
        const albedo = m.geometricAlbedo || 0.12;
        const lightness = Math.min(90, 25 + albedo * 250);
        const moonR = Math.max(MIN_DOT, arcsecR);

        // Draw illuminated disk — physics-driven when large enough
        ctx.save();
        if (m.moonCalc && moonR > 6) {
          const moonProfile = computeMoonVisualProfile(m.moonCalc);
          drawMoonViz(ctx, cx, diskCy, moonR, moonProfile, { lightDx: -0.3, lightDy: -0.2 });
        } else {
          ctx.beginPath();
          ctx.arc(cx, diskCy, moonR, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(40, 5%, ${lightness}%)`;
          ctx.fill();
        }

        // Phase shadow: crescent path from limb arc + terminator ellipse.
        // Phase 0°=full (no shadow), 180°=new (all shadow).
        if (moonPhaseDeg > 2 && moonR > 3) {
          const phase = (moonPhaseDeg / 180) * Math.PI;
          const tRx = Math.abs(Math.cos(phase) * moonR) || 0.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, diskCy, moonR, 0, Math.PI * 2);
          ctx.clip();

          ctx.beginPath();
          // Right limb arc: top to bottom clockwise (right semicircle)
          ctx.arc(cx, diskCy, moonR, -Math.PI / 2, Math.PI / 2, false);
          // Terminator ellipse: bottom back to top.
          // < 90°: counterclockwise traces right side → thin crescent
          // > 90°: clockwise traces left side → wide shadow past center
          ctx.ellipse(cx, diskCy, tRx, moonR, 0, Math.PI / 2, -Math.PI / 2, moonPhaseDeg <= 90);
          ctx.closePath();
          ctx.fillStyle = isNight ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)";
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();

        // Label
        setLabelShadow();
        ctx.fillStyle = labelCol;
        ctx.font = `11px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(m.name, cx, labelY);
        ctx.fillStyle = subCol;
        ctx.font = `10px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillText(angLabel(obj.arcsec), cx, sizeY);
        clearShadow();
      } else {
        // Planet/gas giant
        const b = obj.data;
        const bodyR = Math.max(MIN_DOT, arcsecR);
        const isGas = b.classLabel === "Gas giant" || (b.bodyTypeLabel || "").includes("Gas");
        let drawn = false;

        // Physics-driven rendering when large enough on canvas
        if (bodyR > 6) {
          if (isGas && b._styleId) {
            drawGasGiantViz(ctx, cx, diskCy, bodyR, b._styleId, {
              lightDx: -0.3,
              lightDy: -0.2,
            });
            drawn = true;
          } else if (!isGas && b._derived) {
            const profile = computeRockyVisualProfile(b._derived, b._planetInputs);
            drawRockyPlanetViz(ctx, cx, diskCy, bodyR, profile, {
              lightDx: -0.3,
              lightDy: -0.2,
            });
            drawn = true;
          }
        }

        if (!drawn) {
          // Point source with glow fallback
          const mag = Number.isFinite(b.apparentMagnitude) ? b.apparentMagnitude : 6;
          const glowR = Math.max(4, 6 + Math.max(0, 2 - mag) * 3);
          const dotColor = isGas ? "#e8d8b0" : "#d0d8e8";

          const gGrad = ctx.createRadialGradient(cx, diskCy, 0, cx, diskCy, glowR);
          gGrad.addColorStop(0, hexToRgba(dotColor, 0.6));
          gGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gGrad;
          ctx.beginPath();
          ctx.arc(cx, diskCy, glowR, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, diskCy, bodyR, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
        }

        // Label
        setLabelShadow();
        ctx.fillStyle = labelCol;
        ctx.font = `11px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(b.name, cx, labelY);
        ctx.fillStyle = subCol;
        ctx.font = `10px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillText(angLabel(obj.arcsec), cx, sizeY);
        clearShadow();
      }
    });

    // ── Sol reference outlines in right region ──────────────
    // Center the reference outlines on the first moon slot (or center of region)
    const refCx =
      rightObjs.length > 0
        ? rightStartX + (W - rightStartX - 10) / (rightObjs.length + 1)
        : W * 0.6;

    if (solSun * rightScale >= MIN_DOT * 2) {
      drawRefOutline(refCx, diskCy, solSun, rightScale, "Sol", 0);
    }
    if (solMoon * rightScale >= MIN_DOT * 2) {
      drawRefOutline(refCx, diskCy, solMoon, rightScale, "Luna", 12);
    }

    // Small planet references at the last body slot
    const planetRefCx =
      rightObjs.length > 1
        ? rightStartX + ((W - rightStartX - 10) / (rightObjs.length + 1)) * rightObjs.length
        : W * 0.75;

    [
      { arcsec: solVenus, label: "Venus", dy: 0 },
      { arcsec: solJupiter, label: "Jupiter", dy: 11 },
      { arcsec: solMars, label: "Mars", dy: 22 },
    ].forEach((ref) => {
      if (ref.arcsec * rightScale >= MIN_DOT) {
        drawRefOutline(planetRefCx, diskCy, ref.arcsec, rightScale, ref.label, ref.dy);
      }
    });
  }

  // ── "No data" fallback ────────────────────────────────────
  if (starArcsec <= 0 && rightObjs.length === 0) {
    setLabelShadow();
    ctx.fillStyle = subCol;
    ctx.font = `13px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No objects to display", W / 2, H / 2);
    clearShadow();
  }
}

function buildApparentSamples(world, homePlanetId, state) {
  const starMassMsol = Number(world?.star?.massMsol) || 1;
  const starAgeGyr = Number(world?.star?.ageGyr) || 4.6;
  const sov = getStarOverrides(world?.star);

  const planets = listPlanets(world)
    .map((planet) => {
      const model = calcPlanetExact({
        starMassMsol,
        starAgeGyr,
        starRadiusRsolOverride: sov.r,
        starLuminosityLsolOverride: sov.l,
        starTempKOverride: sov.t,
        starEvolutionMode: sov.ev,
        planet: planet.inputs || {},
      });

      const radiusKm = Number(model?.derived?.radiusKm) || convertPlanetRadiusEarthToKm(1);
      const hasAtmosphere = Number(planet.inputs?.pressureAtm) > 0.01;
      const bodyType = classifyBodyType(radiusKm, hasAtmosphere);
      const bondAlbedo = Number(planet.inputs?.albedoBond) || 0.3;

      return {
        id: `planet:${planet.id}`,
        kind: "planet",
        name: planet.name || planet.inputs?.name || planet.id,
        classLabel: "Planet",
        orbitAu: Number(planet.inputs?.semiMajorAxisAu) || 1,
        radiusKm,
        geometricAlbedo: bondToGeometricAlbedo(bondAlbedo, bodyType),
        hasAtmosphere,
        skyDayHex: model?.derived?.skyColourDayHex || null,
        skyDayEdgeHex: model?.derived?.skyColourDayEdgeHex || null,
        skyHorizonHex: model?.derived?.skyColourHorizonHex || null,
        _derived: model?.derived || null,
        _planetInputs: planet.inputs || null,
      };
    })
    .filter((item) => Number.isFinite(item.orbitAu) && item.orbitAu > 0);

  const gasGiants = listSystemGasGiants(world)
    .map((giant) => ({
      id: `gas:${giant.id}`,
      kind: "gas",
      name: giant.name || giant.id,
      classLabel: "Gas giant",
      orbitAu: Number(giant.au),
      radiusKm: convertGasGiantRadiusRjToKm(giant.radiusRj),
      geometricAlbedo: gasGiantAlbedo(giant.style),
      hasAtmosphere: true,
      _styleId: giant.style || "jupiter",
    }))
    .filter((item) => Number.isFinite(item.orbitAu) && item.orbitAu > 0);

  const allBodies = [...planets, ...gasGiants].sort((a, b) => a.orbitAu - b.orbitAu);

  const selectedHomePlanet = planets.find((body) => body.id === `planet:${homePlanetId}`) || null;
  const homeOrbitAu = selectedHomePlanet?.orbitAu || 1;

  const orbitSamples = allBodies.map((body) => ({
    id: body.id,
    name: body.name,
    orbitAu: body.orbitAu,
  }));

  const bodySamples = allBodies
    .filter((body) => body.id !== selectedHomePlanet?.id)
    .map((body) => {
      const key = body.id;
      const currentDistanceAu = Number(state.distanceByBodyId[key]);
      return {
        ...body,
        currentDistanceAu: Number.isFinite(currentDistanceAu) ? currentDistanceAu : undefined,
      };
    });

  return {
    starMassMsol,
    homeOrbitAu,
    selectedHomePlanet,
    planets,
    allBodies,
    orbitSamples,
    bodySamples,
    homeSkyDayHex: selectedHomePlanet?.skyDayHex || null,
    homeSkyDayEdgeHex: selectedHomePlanet?.skyDayEdgeHex || null,
    homeSkyHorizonHex: selectedHomePlanet?.skyHorizonHex || null,
  };
}

function numWithSlider(id, label, unit, min, max, step, tip) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  return `
    <div class="form-row">
      <div>
        <div class="label">${label}${unitHtml} ${tipIcon(tip || "")}</div>
      </div>
      <div class="input-pair">
        <input id="${id}" type="number" step="${step}" aria-label="${label}" />
        <input id="${id}_slider" type="range" aria-label="${label} slider" />
        <div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div>
      </div>
    </div>
  `;
}

export function initApparentPage(mountEl) {
  const world = loadWorld();
  const selectedPlanet = getSelectedPlanet(world);

  const state = {
    homePlanetId: selectedPlanet?.id || listPlanets(world)[0]?.id || "",
    moonPhaseDeg: 0,
    distanceByBodyId: {},
    skyMode: "night",
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--apparent" aria-hidden="true"></span><span>Apparent Size & Brightness</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Estimate star, planetary-object, and moon apparent brightness/size from a selected home world.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div class="form-row">
            <div>
              <div class="label">Home world ${tipIcon(TIP_LABEL["Home world"])}</div>
            </div>
            <select id="apparentHomePlanet"></select>
          </div>

          ${numWithSlider("apparentMoonPhase", "Moon phase angle", "deg", 0, 180, 1, TIP_LABEL["Moon phase"])}
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="apparentKpis"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Angular Size Comparison ${tipIcon(TIP_LABEL["Sky canvas"])}</h2></div>
      <div class="panel__body">
        <div class="pill-toggle-wrap" style="margin-bottom:12px">
          <div class="physics-duo-toggle">
            <input type="radio" name="skyBg" id="skyNight" value="night" checked />
            <label for="skyNight">Night</label>
            <input type="radio" name="skyBg" id="skyDay" value="day" />
            <label for="skyDay">Day</label>
            <span></span>
          </div>
        </div>
        <div class="sky-canvas-wrap" id="skyCanvasWrap">
          <canvas id="skyCanvas" width="800" height="320"></canvas>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Star Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Star apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:360px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Orbit (AU)</th>
                <th>Star Magnitude</th>
                <th>Brightness (Earth-sun = 1)</th>
                <th>Apparent Size (Earth-sun = 1)</th>
                <th>Angular Diameter ${tipIcon(TIP_LABEL["Angular diameter"])}</th>
              </tr>
            </thead>
            <tbody id="apparentStarRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Body Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Body apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:430px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Type ${tipIcon(TIP_LABEL["Body type"])}</th>
                <th>Distance (AU)</th>
                <th>Phase (deg)</th>
                <th>Magnitude</th>
                <th>Angular Diameter</th>
                <th>Observable</th>
                <th>Visibility</th>
              </tr>
            </thead>
            <tbody id="apparentBodyRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Moon Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Moon apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:320px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Moon</th>
                <th>Abs Mag ${tipIcon(TIP_LABEL["Moon absolute magnitude"])}</th>
                <th>App Mag</th>
                <th>Angular Diameter</th>
                <th>Brightness (full moon = 1)</th>
                <th>Size (moon = 1)</th>
                <th>Eclipses</th>
              </tr>
            </thead>
            <tbody id="apparentMoonRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Sol System References ${tipIcon(TIP_LABEL["Sol references"])}</h2></div>
      <div class="panel__body">
        <div class="hint">Familiar Solar System objects for comparison.</div>
        <div class="cluster-table-wrap" style="max-height:260px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Apparent Magnitude</th>
                <th>Angular Size</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody id="apparentSolRefRows"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const homeSelectEl = wrap.querySelector("#apparentHomePlanet");
  const moonPhaseEl = wrap.querySelector("#apparentMoonPhase");

  const kpisEl = wrap.querySelector("#apparentKpis");
  const starRowsEl = wrap.querySelector("#apparentStarRows");
  const bodyRowsEl = wrap.querySelector("#apparentBodyRows");
  const moonRowsEl = wrap.querySelector("#apparentMoonRows");
  const solRefRowsEl = wrap.querySelector("#apparentSolRefRows");

  const skyCanvasEl = wrap.querySelector("#skyCanvas");
  const skyWrapEl = wrap.querySelector("#skyCanvasWrap");

  const moonPhaseSliderEl = wrap.querySelector("#apparentMoonPhase_slider");
  bindPair("apparentMoonPhase", moonPhaseEl, 0, 180, 1, "auto");

  function bindPair(id, numberEl, min, max, step, mode) {
    const sliderEl = wrap.querySelector(`#${id}_slider`);
    const minEl = wrap.querySelector(`#${id}_min`);
    const maxEl = wrap.querySelector(`#${id}_max`);
    minEl.textContent = String(min);
    maxEl.textContent = String(max);
    bindNumberAndSlider({ numberEl, sliderEl, min, max, step, mode });
  }

  function refreshSelectors() {
    const latest = loadWorld();
    const planets = listPlanets(latest);

    if (!planets.length) {
      homeSelectEl.innerHTML = `<option value="">No planets</option>`;
      state.homePlanetId = "";
    } else {
      if (!planets.some((planet) => planet.id === state.homePlanetId)) {
        state.homePlanetId = planets[0].id;
      }
      homeSelectEl.innerHTML = planets
        .map((planet) => {
          const selected = planet.id === state.homePlanetId ? " selected" : "";
          return `<option value="${escapeHtml(planet.id)}"${selected}>${escapeHtml(planet.name || planet.inputs?.name || planet.id)}</option>`;
        })
        .join("");
    }
  }

  function render() {
    const latest = loadWorld();
    const sample = buildApparentSamples(latest, state.homePlanetId, state);

    const allMoons = listMoons(latest);
    const homeMoons = allMoons.filter((m) => m.planetId === state.homePlanetId);

    // Moon store field is Bond albedo; apparent engine needs geometric albedo.
    // Phase integral q ≈ 0.9 for regolith-covered rocky bodies (opposition surge).
    const MOON_Q = 0.9;
    const sov = getStarOverrides(latest?.star);
    const starAgeGyr = Number(latest?.star?.ageGyr) || 4.6;
    const homePlanetInputs = latest?.planets?.byId?.[state.homePlanetId]?.inputs;
    const moonSamples = homeMoons.map((moon) => {
      let moonCalc = null;
      if (homePlanetInputs) {
        try {
          moonCalc = calcMoonExact({
            starMassMsol: sample.starMassMsol,
            starAgeGyr,
            starRadiusRsolOverride: sov.r,
            starLuminosityLsolOverride: sov.l,
            starTempKOverride: sov.t,
            starEvolutionMode: sov.ev,
            planet: homePlanetInputs,
            moon: { ...moon.inputs },
          });
        } catch {
          moonCalc = null;
        }
      }
      return {
        name: moon.name || moon.inputs?.name || moon.id,
        semiMajorAxisKm: Number(moon.inputs?.semiMajorAxisKm) || 384748,
        radiusMoon: moonRadiusFromInputs(moon.inputs),
        geometricAlbedo: (Number(moon.inputs?.albedo) || 0.11) / MOON_Q,
        phaseDeg: state.moonPhaseDeg,
        moonCalc,
      };
    });

    const model = calcApparentModel({
      starMassMsol: sample.starMassMsol,
      homeOrbitAu: sample.homeOrbitAu,
      orbitSamples: sample.orbitSamples.filter((row) => row.id !== `planet:${state.homePlanetId}`),
      bodySamples: sample.bodySamples,
      moonSamples,
    });

    // Re-attach moonCalc from original samples (stripped by engine normalizer)
    model.moons.forEach((m, i) => {
      if (moonSamples[i]?.moonCalc) m.moonCalc = moonSamples[i].moonCalc;
    });

    const brightestBody = [...model.bodiesFromHome]
      .filter((body) => Number.isFinite(body.apparentMagnitude))
      .sort((a, b) => a.apparentMagnitude - b.apparentMagnitude)[0];

    const brightestMoon = [...model.moons]
      .filter((m) => Number.isFinite(m.apparentMagnitude))
      .sort((a, b) => a.apparentMagnitude - b.apparentMagnitude)[0];

    kpisEl.innerHTML = [
      {
        label: "Star absolute magnitude",
        value: fmt(model.star.absoluteMagnitude, 3),
        meta: "M",
      },
      {
        label: "Home orbit",
        value: fmt(sample.homeOrbitAu, 3),
        meta: "AU",
      },
      {
        label: "Home star magnitude",
        value: fmt(model.starByOrbit[0]?.magnitude, 3),
        meta: "at home",
      },
      {
        label: "Brightest object",
        value: brightestBody ? escapeHtml(brightestBody.name) : "-",
        meta: brightestBody ? `${fmt(brightestBody.apparentMagnitude, 2)} mag` : "-",
      },
      {
        label: "Brightest moon",
        value: brightestMoon ? escapeHtml(brightestMoon.name) : "-",
        meta: brightestMoon
          ? `${fmt(brightestMoon.apparentMagnitude, 2)} mag`
          : model.moons.length
            ? "All invisible at this phase"
            : "No moons",
      },
      {
        label: "Moon count",
        value: String(model.moons.length),
        meta: "assigned to home world",
      },
    ]
      .map(
        (item) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${item.label}</div>
          <div class="kpi__value">${item.value}</div>
          <div class="kpi__meta">${item.meta}</div>
        </div>
      </div>
    `,
      )
      .join("");

    starRowsEl.innerHTML = model.starByOrbit
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${fmt(row.orbitAu, 4)}</td>
        <td>${fmt(row.magnitude, 4)}</td>
        <td>${fmt(row.brightnessRelativeToEarthSun, 6)}</td>
        <td>${fmt(row.apparentSizeRelativeToEarthSun, 6)}</td>
        <td>${row.angularDiameterLabel}</td>
      </tr>
    `,
      )
      .join("");

    bodyRowsEl.innerHTML = model.bodiesFromHome
      .map((row) => {
        state.distanceByBodyId[row.id] = row.currentDistanceAu;

        return `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.bodyTypeLabel || row.classLabel)}</td>
            <td>
              <input
                type="number"
                min="${row.minDistanceAu}"
                max="${row.maxDistanceAu}"
                step="0.001"
                value="${row.currentDistanceAu}"
                data-distance-id="${escapeHtml(row.id)}"
                class="cluster-name-input"
                title="min ${fmt(row.minDistanceAu, 3)} AU, max ${fmt(row.maxDistanceAu, 3)} AU"
              />
            </td>
            <td>${fmt(row.phaseAngleDeg, 2)}</td>
            <td>${Number.isFinite(row.apparentMagnitude) ? fmt(row.apparentMagnitude, 2) : "NA"}</td>
            <td>${row.angularDiameterLabel}</td>
            <td>${escapeHtml(row.observable)}</td>
            <td>${escapeHtml(row.visibility)}</td>
          </tr>
        `;
      })
      .join("");

    moonRowsEl.innerHTML = model.moons.length
      ? model.moons
          .map(
            (m) => `
        <tr>
          <td>${escapeHtml(m.name)}</td>
          <td>${fmt(m.absoluteMagnitude, 4)}</td>
          <td>${Number.isFinite(m.apparentMagnitude) ? fmt(m.apparentMagnitude, 2) : "Invisible"}</td>
          <td>${m.angularDiameterLabel}</td>
          <td>${Number.isFinite(m.brightnessRelativeToFullMoon) ? fmt(m.brightnessRelativeToFullMoon, 4) : "NA"}</td>
          <td>${fmt(m.apparentSizeRelativeToReference, 4)}</td>
          <td>${escapeHtml(m.eclipseType)}</td>
        </tr>
      `,
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center;color:var(--muted)">No moons assigned to home world</td></tr>`;

    solRefRowsEl.innerHTML = SOL_REFERENCES.map((ref) => {
      const angFmt =
        ref.angDiamArcmin != null
          ? `${ref.angDiamArcmin.toFixed(1)}\u2032`
          : ref.angDiamArcsec != null
            ? `${ref.angDiamArcsec}\u2033`
            : "\u2014";
      return `
        <tr>
          <td>${escapeHtml(ref.name)}</td>
          <td>${fmt(ref.appMag, 2)}</td>
          <td>${angFmt}</td>
          <td>${escapeHtml(ref.note)}</td>
        </tr>
      `;
    }).join("");

    // Sky canvas
    const starModel = calcStar({ massMsol: sample.starMassMsol, ageGyr: 4.6 });
    drawSkyCanvas(skyCanvasEl, model, starModel.starColourHex, state.skyMode, state.moonPhaseDeg, {
      dayHex: sample.homeSkyDayHex,
      dayEdgeHex: sample.homeSkyDayEdgeHex,
      horizonHex: sample.homeSkyHorizonHex,
    });
  }

  homeSelectEl?.addEventListener("change", () => {
    state.homePlanetId = String(homeSelectEl.value || "");
    refreshSelectors();
    render();
  });

  bodyRowsEl?.addEventListener("change", (event) => {
    const input = event.target?.closest?.("input[data-distance-id]");
    if (!input) return;
    const id = String(input.dataset.distanceId || "");
    const next = Number(input.value);
    if (!id || !Number.isFinite(next)) return;
    state.distanceByBodyId[id] = next;
    render();
  });

  // Slider input: syncFromSlider sets moonPhaseEl.value but doesn't fire DOM
  // events, so listen on the slider directly for real-time updates.
  moonPhaseSliderEl?.addEventListener("input", () => {
    state.moonPhaseDeg = Number(moonPhaseEl.value) || 0;
    render();
  });

  // Number input: change fires on blur/Enter
  moonPhaseEl?.addEventListener("change", () => {
    state.moonPhaseDeg = Number(moonPhaseEl.value) || 0;
    render();
  });

  wrap.addEventListener("change", (e) => {
    if (e.target.name === "skyBg") {
      state.skyMode = e.target.value;
      render();
    }
  });

  if (skyWrapEl) {
    new ResizeObserver(() => render()).observe(skyWrapEl);
  }

  refreshSelectors();
  moonPhaseEl.value = String(state.moonPhaseDeg);
  moonPhaseEl.dispatchEvent(new Event("input", { bubbles: true }));
  render();
}
