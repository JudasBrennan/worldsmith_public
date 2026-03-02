import {
  calcTectonics,
  listMountainTypes,
  volcanicArcDistance,
  airyRootDepth,
} from "../engine/tectonics.js";
import { calcPlanetExact } from "../engine/planet.js";
import { fmt } from "../engine/utils.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import {
  getSelectedPlanet,
  getStarOverrides,
  listPlanets,
  loadWorld,
  selectPlanet,
  updateWorld,
} from "./store.js";

const TIP_LABEL = {
  "Max Peak Height":
    "Maximum possible mountain peak height, inversely proportional to surface gravity. " +
    "Formula: H_max = C / g, where C depends on crustal composition.\n\n" +
    "Earth-like: C = 9,267 m. Iron worlds: 12,000 m. Ice worlds: 3,000 m.\n\n" +
    "Lower gravity allows taller mountains (Mars: Olympus Mons \u2248 21,900 m at 0.38 g).",
  "Mountain Type":
    "Convergent-boundary mountain range classification based on tectonic setting.\n\n" +
    "Andean: oceanic\u2013continental subduction (high volcanic arc + wide plateau). " +
    "Laramide: flat-slab subduction (broad inland deformation, e.g. Rocky Mountains). " +
    "Ural: continent\u2013continent collision (older, lower, no active volcanism). " +
    "Himalayan: active continent\u2013continent collision (highest peaks, wide plateau).",
  "Erosion Rate":
    "Rate at which inactive mountain ranges lose height over geological time.\n\n" +
    "Typical Earth value: ~5 m/Myr for exposed granite peaks. " +
    "Arid climates erode slower; wet climates erode faster.",
  "Mid-Ocean Ridge Height":
    "Elevation of newly-formed oceanic crust at the spreading centre, measured from " +
    "the abyssal plain reference.\n\n" +
    "Earth average: ~2,600 m above the deep ocean floor.",
  "Ocean Depth Curve":
    "Ocean floor depth as a function of crust age. Uses a two-regime plate model: " +
    "half-space cooling (depth \u221d \u221aage) for young crust, exponential flattening " +
    "for old crust.\n\n" +
    "Reference: Parsons & Sclater (1977, JGR 82, 803).",
  "Cross-Section":
    "Schematic cross-section showing average elevation of each tectonic zone " +
    "(arc, forearc, slope, plateau, back-arc). Individual peaks within a zone " +
    "can exceed the zone average, up to the Max Peak Height limit.\n\n" +
    "Heights are capped by the gravitational limit for the planet\u2019s surface gravity.",
  "Inactive Range":
    "A mountain range that is no longer actively forming. Height decreases linearly " +
    "with time at the specified erosion rate.\n\n" +
    "Example: the Ural Mountains formed ~300 Mya and have eroded from ~6,000 m to ~1,895 m.",
  "Slab Angle":
    "Dip angle of the subducting slab. Controls the distance from trench to volcanic arc: " +
    "d = slab_depth / tan(angle). Steeper slabs produce arcs closer to the trench.\n\n" +
    "Reference: Syracuse & Abers (2006, G\u00b3). Global mean slab depth: 105 \u00b1 19 km.",
  "Spreading Rate":
    "Rate at which new oceanic crust is created at mid-ocean ridges. " +
    "Linked to tectonic regime: mobile lid = 20\u2013200 mm/yr, stagnant lid = 0.\n\n" +
    "Reference: Dalton et al. (2022, GRL). Earth range: 10\u2013200 mm/yr.",
  Pratt:
    "Pratt isostasy: mountains are less dense than lowlands, compensated at a " +
    "uniform depth (the Moho). Higher terrain requires lower crustal density.\n\n" +
    "Contrast with Airy, where all crust has the same density but varies in thickness.\n\n" +
    "Reference: Pratt (1855, Phil. Trans. R. Soc. Lond.).",
  Isostasy:
    "Compensation of topographic loads by the mantle. Mountains have deep crustal \u201croots.\u201d\n\n" +
    "Airy model: root = h \u00d7 \u03c1_c / (\u03c1_m \u2212 \u03c1_c). " +
    "Pratt model: density decreases with elevation at constant compensation depth.\n\n" +
    "Reference: Turcotte & Schubert (2014) Geodynamics.",
  "Continental Margin":
    "Transition from continent to deep ocean: shelf (0\u2013130 m, avg 80 km wide), " +
    "slope (3\u20134\u00b0), rise (sediment apron), abyssal plain.\n\n" +
    "Shelf break depth ~130 m is tied to Pleistocene sea-level lowstands.",
  "Shield Volcano":
    "Large, gently-sloped volcanic edifice built by successive lava flows. " +
    "Height is the minimum of three limits: gravitational (1/g), flexural " +
    "(elastic lithosphere support), and basal spreading (self-weight yield). " +
    "Result is scaled by volcanic activity (radiogenic decay + tidal heating).\n\n" +
    "Stagnant-lid worlds allow ~50% taller edifices.\n\n" +
    "Reference: McGovern & Solomon (1993, 1998, JGR).",
  "Rift Valley":
    "Extensional tectonic feature where the crust is pulled apart, forming a " +
    "graben (down-dropped block) flanked by uplifted shoulders.\n\n" +
    "Example: East African Rift (50\u2013100 km wide, 1\u20132 km deep).",
  "Planet Factors":
    "How the planet\u2019s physical properties affect tectonic features.\n\n" +
    "Composition: crustal material strength sets the max peak height constant. " +
    "Ice worlds have much lower peaks than iron-rich worlds.\n\n" +
    "Volcanic Activity: radiogenic heat decays with age; tidal heating can sustain volcanism. " +
    "Scales shield volcano heights.\n\n" +
    "Erosion Rate: warmer temperatures and more atmospheric moisture accelerate erosion. " +
    "Applied to inactive mountain ranges.\n\n" +
    "Elastic Lithosphere: thicker lithosphere supports taller volcanic edifices. " +
    "Grows with age, thins with tidal heating.",
  "Convergence Rate":
    "Rate at which tectonic plates converge at a subduction zone or collision boundary (mm/yr).\n\n" +
    "Faster convergence drives taller mountains. Scaled with a sub-linear exponent " +
    "(factor = (rate/50)^0.3) because peak height is limited by gravitational and " +
    "erosional equilibrium.\n\n" +
    "Earth examples: Himalayas ~50 mm/yr, Andes ~65 mm/yr, Pacific subduction ~80 mm/yr.",
  Gravity:
    "Surface gravity in Earth g (9.81 m/s\u00b2). Controls maximum mountain " +
    "and shield volcano heights: lower gravity allows taller structures.",
  Composition:
    "Crustal material class derived from the planet\u2019s composition.\n\n" +
    "Sets the peak-height constant C: Earth-like (silicate) = 9,267 m, " +
    "Iron-rich = 12,000 m, Ice = 3,000 m.",
  "Volcanic Activity":
    "Combined index of radiogenic heating and tidal heating. " +
    "Radiogenic heat decays exponentially with age; tidal heating can " +
    "sustain volcanism indefinitely.\n\n" +
    "Scales shield volcano heights and magmatic rift fill.",
  "Climate Erosion":
    "Erosion rate adjusted for surface temperature and atmospheric moisture. " +
    "Warmer, wetter worlds erode faster than cold, dry ones.\n\n" +
    "Applied to inactive mountain range height loss over time.",
  "Elastic Lithosphere":
    "Thickness of the elastic lithosphere (km). Thicker lithosphere " +
    "supports taller volcanic edifices via flexural strength.\n\n" +
    "Grows with planet age and mass; thins with tidal heating.",
  "Arc Distance":
    "Distance from the oceanic trench to the volcanic arc (km). " +
    "Computed as slab depth / tan(slab angle).\n\n" +
    "Steeper slab angles produce arcs closer to the trench.",
  "Original Height":
    "Starting elevation of the mountain range before erosion began (m). " +
    "Height decreases linearly at the erosion rate over geological time.",
  "Range Age":
    "Time since the mountain range stopped actively forming (Myr). " +
    "Multiplied by erosion rate to compute cumulative height loss.",
  "Shield Height":
    "Peak height of this shield volcano (m). Clamped to the planet\u2019s " +
    "max shield height, which depends on gravity, lithosphere thickness, " +
    "and basal spreading limits.",
  "Shield Slope":
    "Flank slope angle (\u00b0). Steeper slopes produce a narrower base radius. " +
    "Typical Earth shield volcanoes: 2\u201312\u00b0.\n\n" +
    "Base radius = height / tan(slope).",
  "Graben Width":
    "Total width of the rift graben (km). The down-dropped block between " +
    "the bounding normal faults.\n\n" +
    "Earth example: East African Rift graben = 50\u2013100 km.",
  "Graben Depth":
    "Depth of the graben floor below the surrounding surface (m). " +
    "Controlled by fault throw and extension amount.\n\n" +
    "Earth example: East African Rift = 1,000\u20132,000 m.",
  "Fault Angle":
    "Dip angle of the bounding normal faults (\u00b0). Steeper faults " +
    "produce narrower grabens for the same depth.\n\n" +
    "Typical range: 45\u201375\u00b0. Earth average: ~60\u00b0.",
  "Volcanic Fill":
    "Thickness of volcanic lava fill on the rift floor (m). " +
    "Active rifts often have basaltic lava lakes and flows " +
    "that partially fill the graben.",
  "Shoulder Height":
    "Elevation of the uplifted rift shoulders above the surrounding " +
    "terrain (m). Caused by isostatic and flexural rebound of the " +
    "footwall blocks flanking the graben.",
  "Shelf Width":
    "Width of the continental shelf (km). The gently sloping " +
    "submerged extension of the continent.\n\n" +
    "Earth range: 10 km (active margins) to 300+ km (passive margins). " +
    "Average: ~80 km.",
  "Shelf Depth":
    "Depth at the shelf break where the continental slope begins (m). " +
    "Controlled by glacioeustatic sea-level history.\n\n" +
    "Earth: ~130 m (Pleistocene lowstand).",
  "Margin Slope":
    "Angle of the continental slope connecting the shelf break " +
    "to the continental rise (\u00b0).\n\n" +
    "Earth average: ~3.5\u00b0. Steeper at active margins, gentler at passive margins.",
  "Ridge Height":
    "Elevation of newly-formed crust at the mid-ocean ridge above " +
    "the abyssal plain (m). Starting point for the ocean depth curve.",
  "Max Ocean Depth":
    "Maximum ocean floor depth reached by old oceanic crust (m). " +
    "Determined by the plate-cooling model: crust subsides as it " +
    "ages and cools, flattening at ~80\u2013100 Myr.",
  "Cross-Section Width":
    "Total width of the mountain range cross-section from " +
    "forearc to back-arc (km). Sum of all tectonic zone widths.",
  "Highest Zone":
    "Average elevation of the tallest tectonic zone in the " +
    "cross-section (m). Individual peaks within a zone can " +
    "exceed this average, up to the max peak height.",
  "Margin Width":
    "Total width from the coast to the abyssal plain (km). " +
    "Sum of shelf, slope, and continental rise widths.",
  "Base Radius":
    "Horizontal distance from the summit to the base of the shield volcano (km). " +
    "Derived from height and slope angle: R = H / tan(\u03b8).\n\n" +
    "Shallower slopes produce much wider bases.",
  "Rift Total Width":
    "Total width of the rift valley cross-section (km), including the " +
    "graben floor, both fault scarps, volcanic fill, and uplifted shoulders.",
};

const ZONE_COLORS = [
  "var(--accent)", // zone 0
  "var(--muted)", // zone 1
  "#7eb8a0", // zone 2
  "var(--warn)", // zone 3
  "#c49a8b", // zone 4
  "#8a9ac4", // zone 5
];

/** Resolve CSS custom-property colors for use in canvas fillStyle. */
function resolveColors(el) {
  const style = getComputedStyle(el);
  return ZONE_COLORS.map((c) => {
    if (c.startsWith("var(")) {
      const name = c.slice(4, -1);
      return style.getPropertyValue(name).trim() || c;
    }
    return c;
  });
}

const MTN_TYPES = listMountainTypes();

/**
 * Extract all planet properties needed by the tectonics engine.
 * @returns {{ gravityG: number, massEarth: number, ageGyr: number,
 *             surfaceTempK: number, h2oPct: number,
 *             compositionClass: string, tidalHeatingWm2: number }}
 */
function getPlanetTectonicContext(world) {
  const fallback = {
    gravityG: 1,
    massEarth: 1,
    ageGyr: 4.6,
    surfaceTempK: 288,
    h2oPct: 0,
    compositionClass: "Earth-like",
    tidalHeatingWm2: 0,
    radioisotopeAbundance: 1,
  };
  const planet = getSelectedPlanet(world);
  if (!planet) return fallback;
  const sov = getStarOverrides(world?.star);
  const starAgeGyr = Number(world?.star?.ageGyr) || 4.6;
  const model = calcPlanetExact({
    starMassMsol: Number(world?.star?.massMsol) || 1,
    starAgeGyr,
    starRadiusRsolOverride: sov.r,
    starLuminosityLsolOverride: sov.l,
    starTempKOverride: sov.t,
    starEvolutionMode: sov.ev,
    planet: planet.inputs || {},
  });
  if (!model?.derived) return fallback;
  return {
    gravityG: model.derived.gravityG || 1,
    massEarth: model.inputs?.massEarth || 1,
    ageGyr: starAgeGyr,
    surfaceTempK: model.derived.surfaceTempK || 288,
    h2oPct: model.inputs?.h2oPct || 0,
    compositionClass: model.derived.compositionClass || "Earth-like",
    tidalHeatingWm2: model.derived.planetTidalHeatingWm2 || 0,
    radioisotopeAbundance: model.derived.radioisotopeAbundance ?? 1,
  };
}

// ── Canvas drawing helpers ───────────────────────────────

const MARGIN_COLORS = ["#5b9bd5", "#3a7cc4", "#2a5ea0", "#1e3f6f"];

function drawMountainCrossSection(canvas, profile, maxPeakM, opts = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const zoneColors = resolveColors(canvas);
  const PAD = { top: 24, bottom: 36, left: 56, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const isoActive = opts.isostasyMode === "airy" || opts.isostasyMode === "pratt";
  const subH = isoActive ? Math.round(plotH * 0.2) : 0;
  const surfH = plotH - subH;

  const totalKm = profile.totalWidthKm || 1;
  const yMax = maxPeakM * 1.15;
  const xScale = plotW / totalKm;
  const yScale = surfH / yMax;

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  const gridColor =
    getComputedStyle(canvas).getPropertyValue("--muted") || "rgba(255,255,255,0.12)";

  // Background
  ctx.clearRect(0, 0, w, h);

  // Grid lines (horizontal)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  const yStepM = niceStep(yMax, 5);
  for (let ym = 0; ym <= yMax; ym += yStepM) {
    const y = PAD.top + surfH - ym * yScale;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.textAlign = "right";
    ctx.fillText(fmt(ym, 0), PAD.left - 4, y + 3);
  }

  // X axis labels
  const xStepKm = niceStep(totalKm, 5);
  ctx.textAlign = "center";
  for (let xkm = 0; xkm <= totalKm; xkm += xStepKm) {
    const x = PAD.left + xkm * xScale;
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.fillText(fmt(xkm, 0), x, h - PAD.bottom + 16);
  }

  // Axis labels
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = "11px var(--font-mono, monospace)";
  ctx.textAlign = "center";
  ctx.fillText("Width (km)", PAD.left + plotW / 2, h - 4);
  ctx.save();
  ctx.translate(12, PAD.top + surfH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Height (m)", 0, 0);
  ctx.restore();
  ctx.restore();

  // Sea level line
  const seaY = PAD.top + surfH;
  ctx.strokeStyle = "rgba(100,180,255,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, seaY);
  ctx.lineTo(PAD.left + plotW, seaY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Max peak height dashed line
  const peakY = PAD.top + surfH - maxPeakM * yScale;
  ctx.strokeStyle = "rgba(255,100,100,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, peakY);
  ctx.lineTo(PAD.left + plotW, peakY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,100,100,0.7)";
  ctx.font = "10px var(--font-mono, monospace)";
  ctx.textAlign = "right";
  ctx.fillText("Max " + fmt(maxPeakM, 0) + " m", PAD.left + plotW - 2, peakY - 4);

  // Draw zones as filled polygons
  for (let i = 0; i < profile.zones.length; i++) {
    const z = profile.zones[i];
    const x0 = PAD.left + z.x * xScale;
    const zw = z.width * xScale;
    const zh = z.height * yScale;

    ctx.fillStyle = zoneColors[i % zoneColors.length];
    ctx.globalAlpha = 0.5;

    if (z.taper && z.taperToPeak) {
      // Ramp from base to peak (left low → right high)
      ctx.beginPath();
      ctx.moveTo(x0, seaY);
      ctx.lineTo(x0, seaY - z.minHeight * yScale);
      ctx.lineTo(x0 + zw, seaY - zh);
      ctx.lineTo(x0 + zw, seaY);
      ctx.closePath();
      ctx.fill();
    } else if (z.taper && z.taperFromPeak) {
      // Ramp from peak to base (left high → right low)
      ctx.beginPath();
      ctx.moveTo(x0, seaY);
      ctx.lineTo(x0, seaY - zh);
      ctx.lineTo(x0 + zw, seaY - z.minHeight * yScale);
      ctx.lineTo(x0 + zw, seaY);
      ctx.closePath();
      ctx.fill();
    } else if (z.taper) {
      // Generic taper: smoothly connect to adjacent zone edges
      const prev = i > 0 ? profile.zones[i - 1] : null;
      const next = i < profile.zones.length - 1 ? profile.zones[i + 1] : null;
      // Use the shared-edge height of the neighbour, not its peak
      const leftH = prev ? (prev.taperFromPeak ? prev.minHeight : prev.height) : 0;
      const rightH = next ? (next.taperToPeak ? next.minHeight : next.height) : 0;
      ctx.beginPath();
      ctx.moveTo(x0, seaY);
      ctx.lineTo(x0, seaY - leftH * yScale);
      ctx.lineTo(x0 + zw, seaY - rightH * yScale);
      ctx.lineTo(x0 + zw, seaY);
      ctx.closePath();
      ctx.fill();
    } else {
      // Flat-top zone
      ctx.fillRect(x0, seaY - zh, zw, zh);
    }

    ctx.globalAlpha = 1;

    // Zone label — place above the midpoint of the zone shape
    if (zw > 30) {
      let labelH = zh;
      if (z.taper && !z.taperToPeak && !z.taperFromPeak) {
        const prev = i > 0 ? profile.zones[i - 1] : null;
        const next = i < profile.zones.length - 1 ? profile.zones[i + 1] : null;
        const lh = prev ? (prev.taperFromPeak ? prev.minHeight : prev.height) : 0;
        const rh = next ? (next.taperToPeak ? next.minHeight : next.height) : 0;
        labelH = ((lh + rh) / 2) * yScale;
      }
      ctx.fillStyle = textColor;
      ctx.font = "9px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      ctx.fillText(z.name, x0 + zw / 2, seaY - labelH - 4);
    }
  }

  // Subsurface tint
  if (subH > 0) {
    ctx.fillStyle = "rgba(139,94,60,0.06)";
    ctx.fillRect(PAD.left, seaY, plotW, subH);
  }

  // Isostasy: draw crustal roots below sea level
  if (opts.isostasyMode === "airy") {
    for (let i = 0; i < profile.zones.length; i++) {
      const z = profile.zones[i];
      if (z.height <= 0) continue;
      const rootD = airyRootDepth(z.height);
      const rootPx = rootD * yScale;
      const x0 = PAD.left + z.x * xScale;
      const zw = z.width * xScale;

      ctx.fillStyle = "#8b5e3c";
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x0, seaY, zw, Math.min(rootPx, subH));
      ctx.globalAlpha = 1;
    }
    // Label removed — legend swatch shown below canvas
  } else if (opts.isostasyMode === "pratt") {
    // Flat Moho line + density-colored zones
    const mohoY = seaY + subH * 0.7;
    ctx.strokeStyle = "#8b5e3c";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, mohoY);
    ctx.lineTo(PAD.left + plotW, mohoY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label removed — legend swatch shown below canvas
  }

  // Volcanic arc distance marker
  if (opts.arcDistanceKm != null && opts.arcDistanceKm <= totalKm) {
    const arcX = PAD.left + opts.arcDistanceKm * xScale;
    ctx.strokeStyle = "rgba(255,80,80,0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(arcX, PAD.top);
    ctx.lineTo(arcX, seaY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,80,80,0.85)";
    ctx.font = "9px var(--font-mono, monospace)";
    ctx.textAlign = "center";
    ctx.fillText("Arc " + fmt(opts.arcDistanceKm, 0) + " km", arcX, PAD.top + 10);
  }
}

function drawOceanDepthCurve(canvas, curveData, ridgeM) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, bottom: 36, left: 56, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const maxAge = curveData[curveData.length - 1]?.ageMyr || 1000;
  const maxDepth = 7000; // slightly above 6400 for headroom
  const xScale = plotW / maxAge;
  const yScale = plotH / maxDepth;

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  const gridColor =
    getComputedStyle(canvas).getPropertyValue("--muted") || "rgba(255,255,255,0.12)";

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  const yStep = 1000;
  for (let d = 0; d <= maxDepth; d += yStep) {
    const y = PAD.top + d * yScale;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.textAlign = "right";
    ctx.fillText(fmt(d, 0), PAD.left - 4, y + 3);
  }

  const xStep = niceStep(maxAge, 5);
  ctx.textAlign = "center";
  for (let a = 0; a <= maxAge; a += xStep) {
    const x = PAD.left + a * xScale;
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.fillText(fmt(a, 0), x, h - PAD.bottom + 16);
  }

  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = "11px var(--font-mono, monospace)";
  ctx.textAlign = "center";
  ctx.fillText("Crust Age (Myr)", PAD.left + plotW / 2, h - 4);
  ctx.save();
  ctx.translate(12, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Depth (m)", 0, 0);
  ctx.restore();

  // Ridge height line
  const ridgeY = PAD.top + ridgeM * yScale;
  ctx.strokeStyle = "rgba(100,200,255,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, ridgeY);
  ctx.lineTo(PAD.left + plotW, ridgeY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(100,200,255,0.7)";
  ctx.font = "10px var(--font-mono, monospace)";
  ctx.textAlign = "left";
  ctx.fillText("Ridge " + fmt(ridgeM, 0) + " m", PAD.left + 4, ridgeY - 4);

  // Max depth line
  const maxDY = PAD.top + 6400 * yScale;
  ctx.strokeStyle = "rgba(255,150,100,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, maxDY);
  ctx.lineTo(PAD.left + plotW, maxDY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,150,100,0.7)";
  ctx.font = "10px var(--font-mono, monospace)";
  ctx.textAlign = "left";
  ctx.fillText("Max 6,400 m", PAD.left + 4, maxDY - 4);

  // Depth curve
  ctx.strokeStyle = "var(--accent, #66aaff)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < curveData.length; i++) {
    const pt = curveData[i];
    const x = PAD.left + pt.ageMyr * xScale;
    const y = PAD.top + pt.depthM * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill under curve (ocean)
  ctx.fillStyle = "rgba(30,90,160,0.15)";
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  for (const pt of curveData) {
    ctx.lineTo(PAD.left + pt.ageMyr * xScale, PAD.top + pt.depthM * yScale);
  }
  ctx.lineTo(PAD.left + plotW, PAD.top);
  ctx.closePath();
  ctx.fill();
}

function niceStep(range, targetTicks) {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice;
  if (norm <= 1.5) nice = 1;
  else if (norm <= 3.5) nice = 2;
  else if (norm <= 7.5) nice = 5;
  else nice = 10;
  return nice * mag;
}

function drawContinentalMarginProfile(canvas, marginData) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, bottom: 36, left: 56, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const maxDist = marginData.totalWidthKm || 500;
  const maxDepth = 5500;
  const xScale = plotW / maxDist;
  const yScale = plotH / maxDepth;

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  const gridColor =
    getComputedStyle(canvas).getPropertyValue("--muted") || "rgba(255,255,255,0.12)";

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  const yStep = 1000;
  for (let d = 0; d <= maxDepth; d += yStep) {
    const y = PAD.top + d * yScale;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.textAlign = "right";
    ctx.fillText(fmt(d, 0), PAD.left - 4, y + 3);
  }
  const xStep = niceStep(maxDist, 5);
  ctx.textAlign = "center";
  for (let xk = 0; xk <= maxDist; xk += xStep) {
    const x = PAD.left + xk * xScale;
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.fillText(fmt(xk, 0), x, h - PAD.bottom + 16);
  }

  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = "11px var(--font-mono, monospace)";
  ctx.textAlign = "center";
  ctx.fillText("Distance from Coast (km)", PAD.left + plotW / 2, h - 4);
  ctx.save();
  ctx.translate(12, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Depth (m)", 0, 0);
  ctx.restore();

  // Fill segments with color
  for (let s = 0; s < marginData.segments.length; s++) {
    const seg = marginData.segments[s];
    const x0 = PAD.left + seg.startKm * xScale;
    const x1 = PAD.left + seg.endKm * xScale;
    const y0 = PAD.top + seg.startM * yScale;
    const y1 = PAD.top + seg.endM * yScale;

    ctx.fillStyle = MARGIN_COLORS[s % MARGIN_COLORS.length];
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x0, PAD.top);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, PAD.top);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Segment label
    const midX = (x0 + x1) / 2;
    if (x1 - x0 > 30) {
      ctx.fillStyle = textColor;
      ctx.font = "9px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      ctx.fillText(seg.name, midX, PAD.top + 14);
    }
  }

  // Profile line
  ctx.strokeStyle = "var(--accent, #66aaff)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < marginData.points.length; i++) {
    const pt = marginData.points[i];
    const x = PAD.left + pt.distKm * xScale;
    const y = PAD.top + pt.depthM * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawShieldProfile(canvas, profile, maxShieldHeightM) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, bottom: 36, left: 56, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  // Fixed y-axis (max shield height) with 15× vertical exaggeration so
  // slope angle is visually distinct (1° → ~15° on screen, 15° → ~76°).
  // Both axes shrink together if the base overflows the canvas width.
  const VE = 15;
  const maxH = maxShieldHeightM || 10000;
  const yRef = plotH / (maxH * 1.15);
  const xRef = (yRef * 1000) / VE;
  const neededW = profile.baseRadiusKm * 2.2 * xRef;
  const shrink = neededW > plotW ? plotW / neededW : 1;
  const yScale = yRef * shrink;
  const xScale = xRef * shrink;

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  ctx.clearRect(0, 0, w, h);

  // Sea level
  const baseY = PAD.top + plotH;
  ctx.strokeStyle = "rgba(100,180,255,0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, baseY);
  ctx.lineTo(PAD.left + plotW, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw shield volcano (mirrored profile)
  const cx = PAD.left + plotW / 2;
  ctx.fillStyle = "#c49a8b";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - profile.baseRadiusKm * xScale, baseY);
  for (const pt of profile.points) {
    ctx.lineTo(cx - pt.rKm * xScale, baseY - pt.hM * yScale);
  }
  for (let i = profile.points.length - 1; i >= 0; i--) {
    const pt = profile.points[i];
    ctx.lineTo(cx + pt.rKm * xScale, baseY - pt.hM * yScale);
  }
  ctx.lineTo(cx + profile.baseRadiusKm * xScale, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Outline
  ctx.strokeStyle = "var(--accent, #66aaff)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - profile.baseRadiusKm * xScale, baseY);
  for (const pt of profile.points) {
    ctx.lineTo(cx - pt.rKm * xScale, baseY - pt.hM * yScale);
  }
  for (let i = profile.points.length - 1; i >= 0; i--) {
    const pt = profile.points[i];
    ctx.lineTo(cx + pt.rKm * xScale, baseY - pt.hM * yScale);
  }
  ctx.lineTo(cx + profile.baseRadiusKm * xScale, baseY);
  ctx.stroke();

  // Labels
  ctx.fillStyle = textColor;
  ctx.font = "11px var(--font-mono, monospace)";
  ctx.textAlign = "center";
  ctx.fillText("Radius (km)", cx, h - 4);
  const peakH = profile.points[profile.points.length - 1]?.hM || 0;
  ctx.fillText(fmt(peakH, 0) + " m", cx, baseY - peakH * yScale - 6);
}

function drawRiftProfile(canvas, riftData) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, bottom: 36, left: 56, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const totalKm = riftData.totalWidthKm || 1;
  let minH = 0;
  let maxH = 0;
  for (const z of riftData.zones) {
    if (z.height < minH) minH = z.height;
    if (z.height > maxH) maxH = z.height;
  }
  const yRange = (maxH - minH) * 1.3 || 1;
  const xScale = plotW / totalKm;
  const yScale = plotH / yRange;
  const zeroY = PAD.top + maxH * 1.15 * yScale;

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  ctx.clearRect(0, 0, w, h);

  // Baseline (surface level)
  ctx.strokeStyle = "rgba(100,180,255,0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, zeroY);
  ctx.lineTo(PAD.left + plotW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw zones
  const riftColors = ["#8b7355", "#a05a3c", "#6b3a2a", "#a05a3c", "#8b7355"];
  for (let i = 0; i < riftData.zones.length; i++) {
    const z = riftData.zones[i];
    const x0 = PAD.left + z.x * xScale;
    const zw = z.width * xScale;
    const zh = z.height * yScale;

    ctx.fillStyle = riftColors[i % riftColors.length];
    ctx.globalAlpha = 0.5;

    if (z.taper && z.taperFromPeak) {
      // Shoulder down to graben
      ctx.beginPath();
      ctx.moveTo(x0, zeroY);
      ctx.lineTo(x0, zeroY - (riftData.zones[0]?.height || 0) * yScale);
      ctx.lineTo(x0 + zw, zeroY - zh);
      ctx.lineTo(x0 + zw, zeroY);
      ctx.closePath();
      ctx.fill();
    } else if (z.taper && z.taperToPeak) {
      ctx.beginPath();
      ctx.moveTo(x0, zeroY);
      ctx.lineTo(x0, zeroY - zh);
      ctx.lineTo(x0 + zw, zeroY - (riftData.zones[4]?.height || 0) * yScale);
      ctx.lineTo(x0 + zw, zeroY);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x0, zeroY - zh, zw, zh < 0 ? -zh : zh);
    }
    ctx.globalAlpha = 1;

    // Label
    if (zw > 30) {
      ctx.fillStyle = textColor;
      ctx.font = "9px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      const labelY = zh >= 0 ? zeroY - zh - 4 : zeroY - zh + 12;
      ctx.fillText(z.name, x0 + zw / 2, labelY);
    }
  }

  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = "11px var(--font-mono, monospace)";
  ctx.textAlign = "center";
  ctx.fillText("Width (km)", PAD.left + plotW / 2, h - 4);
}

// ── Page controller ──────────────────────────────────────

export function initTectonicsPage(containerEl) {
  const world = loadWorld();
  const planets = listPlanets(world);

  if (!planets.length) {
    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header"><h1 class="panel__title">Tectonics</h1></div>
          <div class="panel__body">
            <p class="hint">Create a planet on the <a href="#/planet">Planets</a> page first.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const tec = world.tectonics || {};
  const state = {
    ridgeHeightM: Number(tec.ridgeHeightM) || 2600,
    mountainRanges: Array.isArray(tec.mountainRanges) ? [...tec.mountainRanges] : [],
    inactiveRanges: Array.isArray(tec.inactiveRanges) ? [...tec.inactiveRanges] : [],
    selectedRangeIdx: 0,
    spreadingRateFraction:
      tec.spreadingRateFraction != null ? Number(tec.spreadingRateFraction) : 0.5,
    isostasyMode: tec.isostasyMode || "off",
    margin: tec.margin || { shelfWidthKm: 80, shelfDepthM: 130, slopeAngleDeg: 3.5 },
    shieldVolcanoes: Array.isArray(tec.shieldVolcanoes) ? [...tec.shieldVolcanoes] : [],
    riftValleys: Array.isArray(tec.riftValleys) ? [...tec.riftValleys] : [],
  };

  function save() {
    updateWorld({
      tectonics: {
        ridgeHeightM: state.ridgeHeightM,
        mountainRanges: state.mountainRanges,
        inactiveRanges: state.inactiveRanges,
        spreadingRateFraction: state.spreadingRateFraction,
        isostasyMode: state.isostasyMode,
        margin: state.margin,
        shieldVolcanoes: state.shieldVolcanoes,
        riftValleys: state.riftValleys,
      },
    });
  }

  /** Generate the HTML content for the outputs panel. */
  function outputsHTML(model, activeProfile, selIdx, arcDist) {
    return `
              ${
                activeProfile
                  ? `
                <div class="subsection">
                  <h3>Mountain Cross-Section: ${escapeHtml(activeProfile.label)} ${tipIcon(TIP_LABEL["Cross-Section"])}</h3>
                  ${
                    model.tectonics.mountainProfiles.length > 1
                      ? `
                    <div class="tec-range-tabs">
                      ${model.tectonics.mountainProfiles
                        .map(
                          (p, i) =>
                            `<button class="tec-range-tab ${i === selIdx ? "is-active" : ""}" data-idx="${i}">${escapeHtml(p.label)} ${i + 1}</button>`,
                        )
                        .join("")}
                    </div>
                  `
                      : ""
                  }
                  <div class="tec-isostasy-toggle">
                    <button class="tec-iso-btn ${state.isostasyMode === "off" ? "is-active" : ""}" data-iso="off">Off</button>
                    <button class="tec-iso-btn ${state.isostasyMode === "airy" ? "is-active" : ""}" data-iso="airy">Airy ${tipIcon(TIP_LABEL["Isostasy"])}</button>
                    <button class="tec-iso-btn ${state.isostasyMode === "pratt" ? "is-active" : ""}" data-iso="pratt">Pratt ${tipIcon(TIP_LABEL["Pratt"])}</button>
                  </div>
                  <canvas id="tecMtnCanvas" class="tec-canvas ${state.isostasyMode !== "off" ? "tec-canvas--tall" : ""}"></canvas>
                  <div class="tec-zone-legend">
                    ${activeProfile.zones
                      .map(
                        (z, i) =>
                          `<span class="tec-legend-item"><span class="tec-legend-swatch" style="background:${ZONE_COLORS[i % ZONE_COLORS.length]}"></span>${escapeHtml(z.name)}</span>`,
                      )
                      .join("")}
                    ${state.isostasyMode === "airy" ? `<span class="tec-legend-item"><span class="tec-legend-swatch tec-legend-swatch--crust"></span>Crustal Roots</span>` : ""}
                    ${state.isostasyMode === "pratt" ? `<span class="tec-legend-item"><span class="tec-legend-swatch tec-legend-swatch--crust"></span>Moho</span>` : ""}
                  </div>
                  <div class="kpi-grid" style="margin-top:8px">
                    <div class="kpi-wrap"><div class="kpi">
                      <div class="kpi__label">Total Width ${tipIcon(TIP_LABEL["Cross-Section Width"])}</div>
                      <div class="kpi__value">${fmt(activeProfile.totalWidthKm, 0)} km</div>
                    </div></div>
                    <div class="kpi-wrap"><div class="kpi">
                      <div class="kpi__label">Highest Zone Avg. ${tipIcon(TIP_LABEL["Highest Zone"])}</div>
                      <div class="kpi__value">${fmt(activeProfile.peakM, 0)} m</div>
                    </div></div>
                    ${
                      arcDist != null
                        ? `
                      <div class="kpi-wrap"><div class="kpi">
                        <div class="kpi__label">Arc Distance ${tipIcon(TIP_LABEL["Arc Distance"])}</div>
                        <div class="kpi__value">${fmt(arcDist, 0)} km</div>
                      </div></div>
                    `
                        : ""
                    }
                  </div>
                </div>
              `
                  : `<p class="hint">Add a mountain range to see the cross-section.</p>`
              }

              ${
                model.tectonics.inactiveProfiles.length
                  ? `
                <div class="subsection">
                  <h3>Inactive Ranges</h3>
                  <div class="cluster-table-wrap">
                    <table class="cluster-table">
                      <thead><tr><th>Type</th><th>Original</th><th>Age</th><th>Eroded Height</th></tr></thead>
                      <tbody>
                        ${model.tectonics.inactiveProfiles
                          .map(
                            (ip) =>
                              `<tr><td>${escapeHtml(ip.label)}</td><td>${fmt(ip.originalHeightM, 0)} m</td><td>${fmt(ip.ageMyr, 0)} Myr</td><td>${fmt(ip.erodedHeightM, 0)} m</td></tr>`,
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              `
                  : ""
              }

              ${
                model.tectonics.shieldProfiles.length
                  ? `
                <div class="subsection">
                  <h3>Shield Volcano Profiles</h3>
                  ${model.tectonics.shieldProfiles
                    .map(
                      (sp, i) =>
                        `<canvas id="tecShieldCanvas${i}" class="tec-canvas" style="height:180px"></canvas>
                      <div class="kpi-grid" style="margin-top:4px;margin-bottom:12px">
                        <div class="kpi-wrap"><div class="kpi"><div class="kpi__label">Height ${tipIcon(TIP_LABEL["Shield Height"])}</div><div class="kpi__value">${fmt(sp.heightM, 0)} m</div></div></div>
                        <div class="kpi-wrap"><div class="kpi"><div class="kpi__label">Base Radius ${tipIcon(TIP_LABEL["Base Radius"])}</div><div class="kpi__value">${fmt(sp.baseRadiusKm, 0)} km</div></div></div>
                      </div>`,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }

              ${
                model.tectonics.riftProfiles.length
                  ? `
                <div class="subsection">
                  <h3>Rift Valley Profiles</h3>
                  ${model.tectonics.riftProfiles
                    .map(
                      (rp, i) =>
                        `<canvas id="tecRiftCanvas${i}" class="tec-canvas" style="height:200px"></canvas>
                      <div class="kpi-grid" style="margin-top:4px;margin-bottom:12px">
                        <div class="kpi-wrap"><div class="kpi"><div class="kpi__label">Total Width ${tipIcon(TIP_LABEL["Rift Total Width"])}</div><div class="kpi__value">${fmt(rp.totalWidthKm, 0)} km</div></div></div>
                      </div>`,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }

              <div class="subsection">
                <h3>Ocean Depth Curve ${tipIcon(TIP_LABEL["Ocean Depth Curve"])}</h3>
                <canvas id="tecOceanCanvas" class="tec-canvas"></canvas>
                <div class="kpi-grid" style="margin-top:8px">
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Ridge Height ${tipIcon(TIP_LABEL["Ridge Height"])}</div>
                    <div class="kpi__value">${model.display.ridgeHeight}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Max Ocean Depth ${tipIcon(TIP_LABEL["Max Ocean Depth"])}</div>
                    <div class="kpi__value">${model.display.maxOceanDepth}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Spreading Rate ${tipIcon(TIP_LABEL["Spreading Rate"])}</div>
                    <div class="kpi__value">${model.display.spreadingRate}</div>
                  </div></div>
                </div>
              </div>

              <div class="subsection">
                <h3>Continental Margin ${tipIcon(TIP_LABEL["Continental Margin"])}</h3>
                <canvas id="tecMarginCanvas" class="tec-canvas"></canvas>
                <div class="kpi-grid" style="margin-top:8px">
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Total Width ${tipIcon(TIP_LABEL["Margin Width"])}</div>
                    <div class="kpi__value">${fmt(model.tectonics.margin.totalWidthKm, 0)} km</div>
                  </div></div>
                </div>
              </div>`;
  }

  /** Draw all canvases inside the given root element. */
  function drawOutputCanvases(root, model, activeProfile, arcDist) {
    requestAnimationFrame(() => {
      const mtnCanvas = root.querySelector("#tecMtnCanvas");
      if (mtnCanvas && activeProfile) {
        drawMountainCrossSection(mtnCanvas, activeProfile, model.tectonics.maxPeakHeightM, {
          isostasyMode: state.isostasyMode,
          arcDistanceKm: arcDist,
        });
      }
      const oceanCanvas = root.querySelector("#tecOceanCanvas");
      if (oceanCanvas) {
        drawOceanDepthCurve(oceanCanvas, model.tectonics.ocean.subsidence, state.ridgeHeightM);
      }
      const marginCanvas = root.querySelector("#tecMarginCanvas");
      if (marginCanvas) {
        drawContinentalMarginProfile(marginCanvas, model.tectonics.margin);
      }
      model.tectonics.shieldProfiles.forEach((sp, i) => {
        const c = root.querySelector(`#tecShieldCanvas${i}`);
        if (c) drawShieldProfile(c, sp, model.tectonics.maxShieldHeightM);
      });
      model.tectonics.riftProfiles.forEach((rp, i) => {
        const c = root.querySelector(`#tecRiftCanvas${i}`);
        if (c) drawRiftProfile(c, rp);
      });
    });
  }

  /** Lightweight refresh — replaces only the outputs panel, preserving input focus. */
  function update() {
    const w = loadWorld();
    const pCtx = getPlanetTectonicContext(w);
    const regime = getSelectedPlanet(w)?.inputs?.tectonicRegime || "mobile";
    const model = calcTectonics({
      gravityG: pCtx.gravityG,
      tectonicRegime: regime,
      mountainRanges: state.mountainRanges,
      inactiveRanges: state.inactiveRanges,
      ridgeHeightM: state.ridgeHeightM,
      spreadingRateFraction: state.spreadingRateFraction,
      margin: state.margin,
      shieldVolcanoes: state.shieldVolcanoes,
      riftValleys: state.riftValleys,
      massEarth: pCtx.massEarth,
      ageGyr: pCtx.ageGyr,
      surfaceTempK: pCtx.surfaceTempK,
      h2oPct: pCtx.h2oPct,
      compositionClass: pCtx.compositionClass,
      tidalHeatingWm2: pCtx.tidalHeatingWm2,
      radioisotopeAbundance: pCtx.radioisotopeAbundance,
    });

    const selIdx = Math.min(state.selectedRangeIdx, model.tectonics.mountainProfiles.length - 1);
    const activeProfile = model.tectonics.mountainProfiles[Math.max(0, selIdx)] || null;
    const hasSubduction =
      activeProfile && (activeProfile.type === "andean" || activeProfile.type === "laramide");
    const curRange = state.mountainRanges[Math.max(0, selIdx)];
    const slabAngle = curRange?.slabAngleDeg ?? 45;
    const arcDist = hasSubduction ? volcanicArcDistance(slabAngle) : null;
    const srInfo = model.tectonics.ocean.spreadingRate;

    const el = containerEl.querySelector("#tecOutputs");
    if (!el) return;
    el.innerHTML = outputsHTML(model, activeProfile, selIdx, arcDist);
    attachTooltips(el);
    drawOutputCanvases(el, model, activeProfile, arcDist);

    // Sync input-side spreading rate display
    const srNum = containerEl.querySelector("#tecSpreadingRate");
    if (srNum) srNum.value = Math.round(srInfo.rateMmYr);
  }

  function render() {
    const w = loadWorld();
    const ctx = getPlanetTectonicContext(w);
    const gravityG = ctx.gravityG;
    const regime = getSelectedPlanet(w)?.inputs?.tectonicRegime || "mobile";
    const model = calcTectonics({
      gravityG,
      tectonicRegime: regime,
      mountainRanges: state.mountainRanges,
      inactiveRanges: state.inactiveRanges,
      ridgeHeightM: state.ridgeHeightM,
      spreadingRateFraction: state.spreadingRateFraction,
      margin: state.margin,
      shieldVolcanoes: state.shieldVolcanoes,
      riftValleys: state.riftValleys,
      massEarth: ctx.massEarth,
      ageGyr: ctx.ageGyr,
      surfaceTempK: ctx.surfaceTempK,
      h2oPct: ctx.h2oPct,
      compositionClass: ctx.compositionClass,
      tidalHeatingWm2: ctx.tidalHeatingWm2,
      radioisotopeAbundance: ctx.radioisotopeAbundance,
    });

    const selectedPlanet = getSelectedPlanet(w);
    const selIdx = Math.min(state.selectedRangeIdx, model.tectonics.mountainProfiles.length - 1);
    const activeProfile = model.tectonics.mountainProfiles[Math.max(0, selIdx)] || null;

    const hasSubduction =
      activeProfile && (activeProfile.type === "andean" || activeProfile.type === "laramide");
    const curRange = state.mountainRanges[Math.max(0, selIdx)];
    const slabAngle = curRange?.slabAngleDeg ?? 45;
    const arcDist = hasSubduction ? volcanicArcDistance(slabAngle) : null;
    const srInfo = model.tectonics.ocean.spreadingRate;

    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header">
            <h1 class="panel__title">Tectonics</h1>
            <div class="badge">Interactive tool</div>
          </div>
          <div class="panel__body">
            <div class="hint">Model mountain ranges, ocean depth, continental margins, shield volcanoes, and rift valleys.</div>
            <p style="margin-top:8px">For an interactive 3D plate simulator with climate, erosion, and more, see <a href="https://the-world-crucible.fagothey.net/" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">The World Crucible</a>.</p>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel__header"><h2>Inputs</h2></div>
            <div class="panel__body" id="tecInputs">

              <div class="form-row">
                <div><div class="label">Planet</div></div>
                <select id="tecPlanetSelect">
                  ${planets
                    .map(
                      (p) =>
                        `<option value="${escapeHtml(p.id)}" ${p.id === selectedPlanet?.id ? "selected" : ""}>${escapeHtml(p.name || p.inputs?.name || p.id)}</option>`,
                    )
                    .join("")}
                </select>
              </div>

              <div class="kpi-grid">
                <div class="kpi-wrap"><div class="kpi">
                  <div class="kpi__label">Max Peak Height ${tipIcon(TIP_LABEL["Max Peak Height"])}</div>
                  <div class="kpi__value">${model.display.maxPeakHeight}</div>
                  <div class="kpi__meta">at ${fmt(gravityG, 2)} g</div>
                </div></div>
                <div class="kpi-wrap"><div class="kpi">
                  <div class="kpi__label">Gravity ${tipIcon(TIP_LABEL["Gravity"])}</div>
                  <div class="kpi__value">${fmt(gravityG, 3)} g</div>
                </div></div>
                <div class="kpi-wrap"><div class="kpi">
                  <div class="kpi__label">Max Shield Height ${tipIcon(TIP_LABEL["Shield Volcano"])}</div>
                  <div class="kpi__value">${model.display.maxShieldHeight}</div>
                  <div class="kpi__meta">${regime === "stagnant" ? "stagnant lid (1.5\u00d7)" : regime}</div>
                </div></div>
              </div>

              <details class="subsection" style="margin-top:8px">
                <summary><h3 style="display:inline">Planet Factors ${tipIcon(TIP_LABEL["Planet Factors"])}</h3></summary>
                <div class="kpi-grid" style="margin-top:8px">
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Composition ${tipIcon(TIP_LABEL["Composition"])}</div>
                    <div class="kpi__value">${escapeHtml(ctx.compositionClass)}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Volcanic Activity ${tipIcon(TIP_LABEL["Volcanic Activity"])}</div>
                    <div class="kpi__value">${model.display.volcanicActivity}</div>
                    <div class="kpi__meta">${fmt(ctx.ageGyr, 1)} Gyr age</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Erosion Rate ${tipIcon(TIP_LABEL["Climate Erosion"])}</div>
                    <div class="kpi__value">${model.display.climateErosionRate}</div>
                    <div class="kpi__meta">${fmt(ctx.surfaceTempK, 0)} K surface</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Elastic Lithosphere ${tipIcon(TIP_LABEL["Elastic Lithosphere"])}</div>
                    <div class="kpi__value">${model.display.elasticLithosphere}</div>
                  </div></div>
                </div>
              </details>

              <div class="subsection">
                <h3>Active Mountain Ranges ${tipIcon(TIP_LABEL["Mountain Type"])}</h3>
                <div id="tecRangeCards">
                  ${state.mountainRanges
                    .map(
                      (mr, i) => `
                    <div class="tec-range-card ${i === selIdx ? "is-selected" : ""}" data-idx="${i}">
                      <div class="tec-range-card__header">
                        <select class="tec-type-select" data-idx="${i}">
                          ${MTN_TYPES.map(
                            (t) =>
                              `<option value="${t.key}" ${mr.type === t.key ? "selected" : ""}>${escapeHtml(t.label)}</option>`,
                          ).join("")}
                        </select>
                        <button class="tec-range-remove" data-idx="${i}" title="Remove range">&times;</button>
                      </div>
                      ${
                        mr.type === "andean" || mr.type === "laramide"
                          ? `
                        <div class="form-row">
                          <div><div class="label">Slab Angle ${tipIcon(TIP_LABEL["Slab Angle"])} <span class="unit">\u00b0</span></div></div>
                          <div class="input-pair">
                            <input type="number" class="tec-slab-angle" data-idx="${i}" value="${mr.slabAngleDeg || 45}" min="10" max="90" step="1" />
                            <input type="range" class="tec-slab-angle-slider" data-idx="${i}" value="${mr.slabAngleDeg || 45}" min="10" max="90" step="1" />
                          </div>
                        </div>
                        <div class="kpi" style="margin-top:4px">
                          <div class="kpi__label">Arc Distance ${tipIcon(TIP_LABEL["Arc Distance"])}</div>
                          <div class="kpi__value">${fmt(volcanicArcDistance(mr.slabAngleDeg || 45), 0)} km</div>
                        </div>
                      `
                          : ""
                      }
                      <div class="form-row">
                        <div><div class="label">Convergence Rate ${tipIcon(TIP_LABEL["Convergence Rate"])} <span class="unit">mm/yr</span></div></div>
                        <div class="input-pair">
                          <input type="number" class="tec-convergence" data-idx="${i}" value="${mr.convergenceMmYr || 50}" min="10" max="100" step="1" />
                          <input type="range" class="tec-convergence-slider" data-idx="${i}" value="${mr.convergenceMmYr || 50}" min="10" max="100" step="1" />
                        </div>
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
                <button id="tecAddRange" class="tec-add-btn">+ Add Range</button>
              </div>

              <div class="subsection">
                <h3>Inactive Ranges ${tipIcon(TIP_LABEL["Inactive Range"])}</h3>
                <div id="tecInactiveCards">
                  ${state.inactiveRanges
                    .map(
                      (ir, i) => `
                    <div class="tec-range-card">
                      <div class="tec-range-card__header">
                        <select class="tec-inactive-type" data-idx="${i}">
                          ${MTN_TYPES.map(
                            (t) =>
                              `<option value="${t.key}" ${ir.type === t.key ? "selected" : ""}>${escapeHtml(t.label)}</option>`,
                          ).join("")}
                        </select>
                        <button class="tec-inactive-remove" data-idx="${i}" title="Remove">&times;</button>
                      </div>
                      <div class="form-row">
                        <div><div class="label">Original Height <span class="unit">m</span> ${tipIcon(TIP_LABEL["Original Height"])}</div></div>
                        <input type="number" class="tec-inactive-height" data-idx="${i}" value="${ir.originalHeightM || 5000}" min="0" max="100000" step="100" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Age <span class="unit">Myr</span> ${tipIcon(TIP_LABEL["Range Age"])}</div></div>
                        <input type="number" class="tec-inactive-age" data-idx="${i}" value="${ir.ageMyr || 0}" min="0" max="10000" step="1" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Erosion Rate ${tipIcon(TIP_LABEL["Erosion Rate"])} <span class="unit">m/Myr</span></div></div>
                        <input type="number" class="tec-inactive-erosion" data-idx="${i}" value="${ir.erosionRate || 5}" min="0" max="100" step="0.5" />
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
                <button id="tecAddInactive" class="tec-add-btn">+ Add Inactive Range</button>
              </div>

              <div class="subsection">
                <h3>Shield Volcanoes ${tipIcon(TIP_LABEL["Shield Volcano"])}</h3>
                <div id="tecShieldCards">
                  ${state.shieldVolcanoes
                    .map(
                      (sv, i) => `
                    <div class="tec-range-card">
                      <div class="tec-range-card__header">
                        <span class="label">Shield ${i + 1}</span>
                        <button class="tec-shield-remove" data-idx="${i}" title="Remove">&times;</button>
                      </div>
                      <div class="form-row">
                        <div><div class="label">Height <span class="unit">m</span> ${tipIcon(TIP_LABEL["Shield Height"])}</div></div>
                        <div class="input-pair">
                          <input type="number" class="tec-shield-height" data-idx="${i}" value="${sv.heightM || 5000}" min="100" max="${Math.round(model.tectonics.maxShieldHeightM)}" step="100" />
                          <input type="range" class="tec-shield-height-slider" data-idx="${i}" value="${sv.heightM || 5000}" min="100" max="${Math.round(model.tectonics.maxShieldHeightM)}" step="100" />
                        </div>
                      </div>
                      <div class="form-row">
                        <div><div class="label">Slope <span class="unit">\u00b0</span> ${tipIcon(TIP_LABEL["Shield Slope"])}</div></div>
                        <div class="input-pair">
                          <input type="number" class="tec-shield-slope" data-idx="${i}" value="${sv.slopeAngleDeg || 5}" min="1" max="15" step="0.5" />
                          <input type="range" class="tec-shield-slope-slider" data-idx="${i}" value="${sv.slopeAngleDeg || 5}" min="1" max="15" step="0.5" />
                        </div>
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
                <button id="tecAddShield" class="tec-add-btn">+ Add Shield Volcano</button>
              </div>

              <div class="subsection">
                <h3>Rift Valleys ${tipIcon(TIP_LABEL["Rift Valley"])}</h3>
                <div id="tecRiftCards">
                  ${state.riftValleys
                    .map(
                      (rv, i) => `
                    <div class="tec-range-card">
                      <div class="tec-range-card__header">
                        <span class="label">Rift ${i + 1}</span>
                        <button class="tec-rift-remove" data-idx="${i}" title="Remove">&times;</button>
                      </div>
                      <div class="form-row">
                        <div><div class="label">Width <span class="unit">km</span> ${tipIcon(TIP_LABEL["Graben Width"])}</div></div>
                        <input type="number" class="tec-rift-width" data-idx="${i}" value="${rv.grabenWidthKm || 50}" min="5" max="300" step="5" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Depth <span class="unit">m</span> ${tipIcon(TIP_LABEL["Graben Depth"])}</div></div>
                        <input type="number" class="tec-rift-depth" data-idx="${i}" value="${rv.grabenDepthM || 1000}" min="50" max="5000" step="50" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Fault Angle <span class="unit">\u00b0</span> ${tipIcon(TIP_LABEL["Fault Angle"])}</div></div>
                        <input type="number" class="tec-rift-angle" data-idx="${i}" value="${rv.faultAngleDeg || 60}" min="20" max="80" step="1" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Volcanic Fill <span class="unit">m</span> ${tipIcon(TIP_LABEL["Volcanic Fill"])}</div></div>
                        <input type="number" class="tec-rift-fill" data-idx="${i}" value="${rv.volcanicFillM || 0}" min="0" max="5000" step="50" />
                      </div>
                      <div class="form-row">
                        <div><div class="label">Shoulder Height <span class="unit">m</span> ${tipIcon(TIP_LABEL["Shoulder Height"])}</div></div>
                        <input type="number" class="tec-rift-shoulder" data-idx="${i}" value="${rv.shoulderHeightM || 0}" min="0" max="3000" step="50" />
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
                <button id="tecAddRift" class="tec-add-btn">+ Add Rift Valley</button>
              </div>

              <div class="subsection">
                <h3>Oceans</h3>
                <div class="form-row">
                  <div><div class="label">Mid-Ocean Ridge Height ${tipIcon(TIP_LABEL["Mid-Ocean Ridge Height"])} <span class="unit">m</span></div></div>
                  <div class="input-pair">
                    <input id="tecRidgeHeight" type="number" min="1000" max="5000" step="100" value="${state.ridgeHeightM}" />
                    <input id="tecRidgeHeight_slider" type="range" min="1000" max="5000" step="100" value="${state.ridgeHeightM}" />
                  </div>
                </div>
                <div class="form-row">
                  <div><div class="label">Spreading Rate ${tipIcon(TIP_LABEL["Spreading Rate"])} <span class="unit">mm/yr</span></div></div>
                  <div class="input-pair">
                    <input id="tecSpreadingRate" type="number" min="${srInfo.min}" max="${Math.max(srInfo.max, 1)}" step="1" value="${Math.round(srInfo.rateMmYr)}" readonly />
                    <input id="tecSpreadingRate_slider" type="range" min="0" max="100" step="1" value="${Math.round(state.spreadingRateFraction * 100)}" ${srInfo.min === srInfo.max ? "disabled" : ""} />
                  </div>
                </div>
                <div class="kpi" style="margin-top:4px">
                  <div class="kpi__meta">${escapeHtml(srInfo.label)} (${escapeHtml(regime)})</div>
                </div>
              </div>

              <div class="subsection">
                <h3>Continental Margin ${tipIcon(TIP_LABEL["Continental Margin"])}</h3>
                <div class="form-row">
                  <div><div class="label">Shelf Width <span class="unit">km</span> ${tipIcon(TIP_LABEL["Shelf Width"])}</div></div>
                  <div class="input-pair">
                    <input type="number" class="tec-margin-shelf-w" value="${state.margin.shelfWidthKm}" min="1" max="500" step="5" />
                    <input type="range" class="tec-margin-shelf-w-slider" value="${state.margin.shelfWidthKm}" min="1" max="500" step="5" />
                  </div>
                </div>
                <div class="form-row">
                  <div><div class="label">Shelf Depth <span class="unit">m</span> ${tipIcon(TIP_LABEL["Shelf Depth"])}</div></div>
                  <div class="input-pair">
                    <input type="number" class="tec-margin-shelf-d" value="${state.margin.shelfDepthM}" min="10" max="500" step="5" />
                    <input type="range" class="tec-margin-shelf-d-slider" value="${state.margin.shelfDepthM}" min="10" max="500" step="5" />
                  </div>
                </div>
                <div class="form-row">
                  <div><div class="label">Slope Angle <span class="unit">\u00b0</span> ${tipIcon(TIP_LABEL["Margin Slope"])}</div></div>
                  <div class="input-pair">
                    <input type="number" class="tec-margin-slope" value="${state.margin.slopeAngleDeg}" min="0.5" max="15" step="0.5" />
                    <input type="range" class="tec-margin-slope-slider" value="${state.margin.slopeAngleDeg}" min="0.5" max="15" step="0.5" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div class="panel">
            <div class="panel__header"><h2>Outputs</h2></div>
            <div class="panel__body" id="tecOutputs">
              ${outputsHTML(model, activeProfile, selIdx, arcDist)}
            </div>
          </div>
        </div>

      </div>`;

    attachTooltips(containerEl);
    drawOutputCanvases(containerEl, model, activeProfile, arcDist);
  }

  render();

  // ── Event delegation ─────────────────────────────────

  containerEl.addEventListener("input", (e) => {
    const t = e.target;

    // Generic sync for paired number+slider controls (except spreading rate
    // which maps slider 0-100 to a different mm/yr display value).
    const inputPair = t.closest(".input-pair");
    if (inputPair && t.id !== "tecSpreadingRate_slider") {
      const sibling = inputPair.querySelector(
        t.type === "range" ? 'input[type="number"]' : 'input[type="range"]',
      );
      if (sibling && sibling !== t) sibling.value = t.value;
    }

    // Ridge height
    if (t.id === "tecRidgeHeight" || t.id === "tecRidgeHeight_slider") {
      state.ridgeHeightM = Number(t.value) || 2600;
      save();
      update();
      return;
    }

    // Inactive range inputs
    if (t.classList.contains("tec-inactive-height")) {
      const idx = Number(t.dataset.idx);
      if (state.inactiveRanges[idx]) {
        state.inactiveRanges[idx].originalHeightM = Number(t.value) || 0;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-inactive-age")) {
      const idx = Number(t.dataset.idx);
      if (state.inactiveRanges[idx]) {
        state.inactiveRanges[idx].ageMyr = Number(t.value) || 0;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-inactive-erosion")) {
      const idx = Number(t.dataset.idx);
      if (state.inactiveRanges[idx]) {
        state.inactiveRanges[idx].erosionRate = Number(t.value) || 5;
        save();
        update();
      }
      return;
    }

    // Slab angle
    if (t.classList.contains("tec-slab-angle") || t.classList.contains("tec-slab-angle-slider")) {
      const idx = Number(t.dataset.idx);
      if (state.mountainRanges[idx]) {
        state.mountainRanges[idx].slabAngleDeg = Number(t.value) || 45;
        save();
        update();
      }
      return;
    }

    // Convergence rate
    if (t.classList.contains("tec-convergence") || t.classList.contains("tec-convergence-slider")) {
      const idx = Number(t.dataset.idx);
      if (state.mountainRanges[idx]) {
        state.mountainRanges[idx].convergenceMmYr = Number(t.value) || 50;
        save();
        update();
      }
      return;
    }

    // Spreading rate slider
    if (t.id === "tecSpreadingRate_slider") {
      state.spreadingRateFraction = Number(t.value) / 100;
      save();
      update();
      return;
    }

    // Continental margin inputs
    if (
      t.classList.contains("tec-margin-shelf-w") ||
      t.classList.contains("tec-margin-shelf-w-slider")
    ) {
      state.margin.shelfWidthKm = Number(t.value) || 80;
      save();
      update();
      return;
    }
    if (
      t.classList.contains("tec-margin-shelf-d") ||
      t.classList.contains("tec-margin-shelf-d-slider")
    ) {
      state.margin.shelfDepthM = Number(t.value) || 130;
      save();
      update();
      return;
    }
    if (
      t.classList.contains("tec-margin-slope") ||
      t.classList.contains("tec-margin-slope-slider")
    ) {
      state.margin.slopeAngleDeg = Number(t.value) || 3.5;
      save();
      update();
      return;
    }

    // Shield volcano inputs
    if (
      t.classList.contains("tec-shield-height") ||
      t.classList.contains("tec-shield-height-slider")
    ) {
      const idx = Number(t.dataset.idx);
      if (state.shieldVolcanoes[idx]) {
        state.shieldVolcanoes[idx].heightM = Number(t.value) || 5000;
        save();
        update();
      }
      return;
    }
    if (
      t.classList.contains("tec-shield-slope") ||
      t.classList.contains("tec-shield-slope-slider")
    ) {
      const idx = Number(t.dataset.idx);
      if (state.shieldVolcanoes[idx]) {
        state.shieldVolcanoes[idx].slopeAngleDeg = Number(t.value) || 5;
        save();
        update();
      }
      return;
    }

    // Rift valley inputs
    if (t.classList.contains("tec-rift-width")) {
      const idx = Number(t.dataset.idx);
      if (state.riftValleys[idx]) {
        state.riftValleys[idx].grabenWidthKm = Number(t.value) || 50;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-rift-depth")) {
      const idx = Number(t.dataset.idx);
      if (state.riftValleys[idx]) {
        state.riftValleys[idx].grabenDepthM = Number(t.value) || 1000;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-rift-angle")) {
      const idx = Number(t.dataset.idx);
      if (state.riftValleys[idx]) {
        state.riftValleys[idx].faultAngleDeg = Number(t.value) || 60;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-rift-fill")) {
      const idx = Number(t.dataset.idx);
      if (state.riftValleys[idx]) {
        state.riftValleys[idx].volcanicFillM = Number(t.value) || 0;
        save();
        update();
      }
      return;
    }
    if (t.classList.contains("tec-rift-shoulder")) {
      const idx = Number(t.dataset.idx);
      if (state.riftValleys[idx]) {
        state.riftValleys[idx].shoulderHeightM = Number(t.value) || 0;
        save();
        update();
      }
      return;
    }
  });

  containerEl.addEventListener("change", (e) => {
    const t = e.target;

    // Planet selector
    if (t.id === "tecPlanetSelect") {
      selectPlanet(t.value);
      render();
      return;
    }

    // Mountain type dropdown
    if (t.classList.contains("tec-type-select")) {
      const idx = Number(t.dataset.idx);
      if (state.mountainRanges[idx]) {
        state.mountainRanges[idx].type = t.value;
        state.selectedRangeIdx = idx;
        save();
        render();
      }
      return;
    }

    // Inactive type dropdown
    if (t.classList.contains("tec-inactive-type")) {
      const idx = Number(t.dataset.idx);
      if (state.inactiveRanges[idx]) {
        state.inactiveRanges[idx].type = t.value;
        save();
        render();
      }
      return;
    }
  });

  containerEl.addEventListener("click", (e) => {
    const t = e.target;

    // Isostasy toggle
    if (t.classList.contains("tec-iso-btn")) {
      state.isostasyMode = t.dataset.iso || "off";
      save();
      render();
      return;
    }

    // Add active range
    if (t.id === "tecAddRange") {
      const id = "mr" + Math.random().toString(36).slice(2, 7);
      state.mountainRanges.push({
        id,
        type: "andean",
        label: "Range",
        widths: {},
        heights: {},
        slabAngleDeg: 45,
        convergenceMmYr: 50,
      });
      state.selectedRangeIdx = state.mountainRanges.length - 1;
      save();
      render();
      return;
    }

    // Remove active range
    if (t.classList.contains("tec-range-remove")) {
      const idx = Number(t.dataset.idx);
      state.mountainRanges.splice(idx, 1);
      state.selectedRangeIdx = Math.min(
        state.selectedRangeIdx,
        Math.max(0, state.mountainRanges.length - 1),
      );
      save();
      render();
      return;
    }

    // Add inactive range
    if (t.id === "tecAddInactive") {
      const id = "ir" + Math.random().toString(36).slice(2, 7);
      state.inactiveRanges.push({
        id,
        type: "ural",
        originalHeightM: 5000,
        ageMyr: 200,
        erosionRate: 5,
      });
      save();
      render();
      return;
    }

    // Remove inactive range
    if (t.classList.contains("tec-inactive-remove")) {
      const idx = Number(t.dataset.idx);
      state.inactiveRanges.splice(idx, 1);
      save();
      render();
      return;
    }

    // Range tab switch
    if (t.classList.contains("tec-range-tab")) {
      state.selectedRangeIdx = Number(t.dataset.idx);
      render();
      return;
    }

    // Add shield volcano
    if (t.id === "tecAddShield") {
      state.shieldVolcanoes.push({ heightM: 5000, slopeAngleDeg: 5 });
      save();
      render();
      return;
    }

    // Remove shield volcano
    if (t.classList.contains("tec-shield-remove")) {
      state.shieldVolcanoes.splice(Number(t.dataset.idx), 1);
      save();
      render();
      return;
    }

    // Add rift valley
    if (t.id === "tecAddRift") {
      state.riftValleys.push({
        grabenWidthKm: 50,
        grabenDepthM: 1000,
        faultAngleDeg: 60,
        volcanicFillM: 0,
        shoulderHeightM: 0,
      });
      save();
      render();
      return;
    }

    // Remove rift valley
    if (t.classList.contains("tec-rift-remove")) {
      state.riftValleys.splice(Number(t.dataset.idx), 1);
      save();
      render();
      return;
    }

    // Range card selection
    const card = t.closest(".tec-range-card[data-idx]");
    if (card && !t.classList.contains("tec-range-remove") && !t.closest("select")) {
      state.selectedRangeIdx = Number(card.dataset.idx);
      render();
      return;
    }
  });
}
