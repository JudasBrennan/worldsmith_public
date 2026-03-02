// Tectonics engine — mountain range profiles, erosion, ocean depth curves,
// isostasy, volcanic arcs, continental margins, shield volcanism, and rifts.
//
// Methodology:
//   Mountains — max peak height scales inversely with surface gravity
//   (gravitational limit on crustal column height).  Four mountain-range
//   archetypes (Andean, Laramide, Ural, Himalayan) provide zone-based
//   cross-section profiles with width and height ranges.
//   Reference: Weisskopf (1975) Science 187, 605–612.
//
//   Erosion — linear denudation rate (m/Myr) applied to inactive ranges.
//   Global outcrop median ≈ 5 m/Myr (cosmogenic nuclide data).
//
//   Oceans — two-regime plate model (Parsons & Sclater 1977, JGR 82, 803):
//   half-space cooling for young crust, exponential flattening for old crust.
//   Ridge height from Stein & Stein (1992) GDH1 model.
//
//   Isostasy — Airy (crustal roots) and Pratt (variable density) models.
//   Reference: Turcotte & Schubert (2014) Geodynamics, Ch. 2.
//
//   Volcanic arcs — arc distance = slab depth / tan(slab angle).
//   Reference: Syracuse & Abers (2006) G³, mean slab depth 105±19 km.
//
//   Continental margins — shelf/slope/rise/abyssal plain profile.
//   Shield volcanism — 1/g scaling, stagnant-lid enhancement.
//   Reference: McGovern & Solomon (1993, 1998) JGR.
//
// Inputs:  gravityG, tectonicRegime, mountainRanges[], inactiveRanges[],
//          ridgeHeightM, spreadingRateFraction, margin{}, shieldVolcanoes[],
//          riftValleys[]
// Outputs: { inputs, tectonics, display }

import { clamp, toFinite, fmt } from "./utils.js";

// ── Constants ────────────────────────────────────────────

// Maximum peak height at Earth gravity (metres).
// Spreadsheet value ≈ 9267 m (gravitational limit of crustal rock columns).
const EARTH_MAX_PEAK_M = 9267;

// Default erosion rate for exposed rock (m / Myr).
const DEFAULT_EROSION_RATE = 5;

// Ocean subsidence model (Parsons & Sclater 1977, WS8 calibration).
// Two-regime plate model:
//   Young crust: depth = ridge + 350 × √age  (half-space cooling)
//   Old crust:   depth = 6400 − 3073 × exp(−age / 62.8)  (plate model)
// The actual depth = min(half-space, plate) at each age.
const SUBSIDENCE_RATE_M = 350; // metres per sqrt(Myr)
const MAX_OCEAN_DEPTH_M = 6400;
const PLATE_FALLOFF_MYR = 62.8; // exponential decay timescale
const PLATE_INTERSECTION_M = 3073; // amplitude of exponential term
const DEFAULT_RIDGE_HEIGHT_M = 2600;

// ── Isostatic compensation (Turcotte & Schubert 2014) ────
const CRUST_DENSITY = 2800; // kg/m³ (continental crust average)
const MANTLE_DENSITY = 3300; // kg/m³ (upper mantle average)
const DEFAULT_COMPENSATION_DEPTH_M = 100_000; // 100 km Pratt compensation depth

// ── Volcanic arc (Syracuse & Abers 2006, G³) ────────────
const SLAB_DEPTH_KM = 110; // mean depth of slab beneath volcanic front

// ── Shield volcanism (McGovern & Solomon 1993, 1998) ─────
// Mauna Kea base-to-peak ≈ 10 km; Olympus Mons 21.9 km at 0.38 g validates 1/g.
const EARTH_SHIELD_REF_M = 10_000;
const STAGNANT_LID_FACTOR = 1.5; // multiplier for stagnant-lid worlds

// ── Composition-dependent max peak height (metres) ───────
// Stronger crusts (iron-rich) support taller columns; ice rheology limits peaks.
const COMPOSITION_PEAK_M = {
  "Iron world": 12_000,
  "Mercury-like": 11_000,
  "Earth-like": 9267,
  "Mars-like": 8500,
  "Ocean world": 7000,
  "Ice world": 3000,
  Coreless: 7000,
};

// ── Basal spreading yield stress (Pa) ────────────────────
// Compressive strength of the edifice material at the base.
// Cold basalt: ~300 MPa; ice: ~10 MPa.
const BASALT_YIELD_STRESS_PA = 300e6;
const ICE_YIELD_STRESS_PA = 10e6;

// ── Elastic lithosphere flexural constant ────────────────
// Calibrated so Earth Te ≈ 43 km → flexural shield limit ≈ 12 km.
const FLEXURAL_C = 7.7e6;

// ── Radiogenic heat decay (per Gyr) ──────────────────────
const HEAT_DECAY_RATE = 0.15;

// ── Convergence rate scaling ─────────────────────────────
const DEFAULT_CONVERGENCE_MM_YR = 50;
const CONVERGENCE_EXPONENT = 0.3;

// ── Seafloor spreading rate ranges (mm/yr) ───────────────
// Reference: Dalton et al. (2022) GRL — Earth range 10–200 mm/yr.
export const SPREADING_RATES = {
  mobile: { min: 20, max: 200, label: "Active spreading" },
  episodic: { min: 5, max: 50, label: "Episodic spreading" },
  stagnant: { min: 0, max: 0, label: "No spreading" },
  plutonicSquishy: { min: 2, max: 20, label: "Sluggish spreading" },
};

// ── Mountain type zone definitions ───────────────────────
// Each zone: { name, wMin, wMax } in km, { hMin, hMax } in metres.
// "taper" zones use the adjacent zone's height as their peak (visual slope).
// Widths and heights from the WS8 Calculations sheet.

const MOUNTAIN_TYPES = {
  andean: {
    label: "Andean",
    description: "Oceanic-continental subduction (volcanic arc + wide plateau)",
    zones: [
      { name: "Outer-Arc Ridge", wMin: 0, wMax: 100, hMin: 200, hMax: 1500 },
      { name: "Forearc Basin", wMin: 20, wMax: 250, hMin: 0, hMax: 500 },
      { name: "Fore Slope", wMin: 30, wMax: 100, hMin: 0, hMax: 0, taper: true },
      { name: "Plateau", wMin: 0, wMax: 200, hMin: 1000, hMax: 6000 },
      { name: "Back Slope", wMin: 30, wMax: 200, hMin: 0, hMax: 0, taper: true },
      { name: "Back Arc", wMin: 0, wMax: 500, hMin: 500, hMax: 800 },
    ],
  },
  laramide: {
    label: "Laramide",
    description: "Flat-slab subduction (broad inland deformation)",
    zones: [
      { name: "Outer-Arc Ridge", wMin: 0, wMax: 150, hMin: 300, hMax: 2500 },
      { name: "Forearc Basin", wMin: 20, wMax: 200, hMin: 0, hMax: 500 },
      {
        name: "Fore Slope",
        wMin: 30,
        wMax: 100,
        hMin: 1500,
        hMax: 6000,
        taper: true,
        taperToPeak: true,
      },
      { name: "Plateau", wMin: 300, wMax: 1400, hMin: 1000, hMax: 5000 },
      {
        name: "Back Slope",
        wMin: 30,
        wMax: 200,
        hMin: 1000,
        hMax: 5500,
        taper: true,
        taperFromPeak: true,
      },
      { name: "Back Arc", wMin: 0, wMax: 500, hMin: 100, hMax: 1500 },
    ],
  },
  ural: {
    label: "Ural",
    description: "Ancient continent-continent collision (lower, no active volcanism)",
    zones: [
      { name: "Fore Slope", wMin: 0, wMax: 300, hMin: 0, hMax: 500, taper: true },
      { name: "Forearc Basin", wMin: 30, wMax: 80, hMin: 0, hMax: 0, taper: true },
      { name: "Plateau", wMin: 0, wMax: 150, hMin: 1000, hMax: 5000 },
      { name: "Back Slope", wMin: 30, wMax: 100, hMin: 0, hMax: 0, taper: true },
    ],
  },
  himalayan: {
    label: "Himalayan",
    description: "Active continent-continent collision (highest peaks, wide plateau)",
    zones: [
      { name: "Fore Slope", wMin: 100, wMax: 400, hMin: 50, hMax: 300, taper: true },
      {
        name: "Fore Ridge",
        wMin: 30,
        wMax: 100,
        hMin: 3000,
        hMax: 8000,
        taper: true,
        taperToPeak: true,
      },
      { name: "Plateau", wMin: 300, wMax: 1400, hMin: 3000, hMax: 6000 },
      {
        name: "Back Slope",
        wMin: 30,
        wMax: 200,
        hMin: 3000,
        hMax: 7000,
        taper: true,
        taperFromPeak: true,
      },
    ],
  },
};

export const MOUNTAIN_TYPE_KEYS = Object.keys(MOUNTAIN_TYPES);

/**
 * Mountain type metadata (label + description) for all four types.
 * @returns {Array<{key: string, label: string, description: string}>}
 */
export function listMountainTypes() {
  return MOUNTAIN_TYPE_KEYS.map((key) => ({
    key,
    label: MOUNTAIN_TYPES[key].label,
    description: MOUNTAIN_TYPES[key].description,
  }));
}

// ── Planet-aware helper functions ────────────────────────

/**
 * Elastic lithosphere thickness (Te) in km.
 *
 * Te scales with the square root of cooling age (thicker with time) and
 * planet mass (larger planets retain heat longer → thicker lid).  Tidal
 * heating thins the lithosphere by sustaining mantle convection.
 *
 * Earth (4.6 Gyr, 1 M⊕): ~50 km.  Mars (4.6 Gyr, 0.107 M⊕): ~28 km.
 * Io (heavy tidal): ~10 km or less.
 *
 * @param {number} ageGyr - System age in Gyr
 * @param {number} massEarth - Planet mass in Earth masses
 * @param {number} [tidalHeatingWm2=0] - Tidal heating flux in W/m²
 * @param {number} [radioisotopeAbundance=1] - Radioisotope abundance relative to Earth
 * @returns {number} Elastic lithosphere thickness in km
 */
export function elasticLithosphereThicknessKm(
  ageGyr,
  massEarth,
  tidalHeatingWm2 = 0,
  radioisotopeAbundance = 1,
) {
  const age = Math.max(toFinite(ageGyr, 4.6), 0.01);
  const mass = Math.max(toFinite(massEarth, 1), 0.01);
  const tidal = Math.max(toFinite(tidalHeatingWm2, 0), 0);
  const abundance = Math.max(toFinite(radioisotopeAbundance, 1), 0.01);
  let te = 20 * Math.sqrt(age / abundance) * Math.pow(mass, 0.3);
  if (tidal > 0.1) {
    te *= Math.max(0.2, 1 - 0.3 * Math.log10(tidal));
  }
  return clamp(te, 5, 300);
}

/**
 * Maximum shield volcano height supported by lithospheric flexure.
 *
 * Thicker elastic lithosphere can support taller loads.  On Earth
 * (Te ≈ 50 km), the flexural limit is ~12 km — close to observed
 * shield heights.  On Mars (Te ≈ 100+ km), flexure is not the
 * limiting factor.
 *
 * @param {number} teKm - Elastic lithosphere thickness in km
 * @param {number} gravityG - Surface gravity in Earth-g
 * @param {number} [crustDensity=2800] - Crustal density in kg/m³
 * @returns {number} Flexural height limit in metres
 */
export function flexuralShieldLimit(teKm, gravityG, crustDensity = CRUST_DENSITY) {
  const te = Math.max(toFinite(teKm, 50), 1);
  const g = Math.max(toFinite(gravityG, 1), 0.01);
  const rho = toFinite(crustDensity, CRUST_DENSITY);
  return (FLEXURAL_C * te) / (rho * g * 9.81);
}

/**
 * Maximum shield volcano height before basal spreading (self-weight
 * yield).  On silicate worlds this is very high (~36 km at 1 g) and
 * rarely limiting; on ice worlds yield stress is ~10× lower.
 *
 * @param {number} gravityG - Surface gravity in Earth-g
 * @param {string} [compositionClass="Earth-like"] - Planet composition class
 * @returns {number} Basal spreading height limit in metres
 */
export function basalSpreadingLimit(gravityG, compositionClass = "Earth-like") {
  const g = Math.max(toFinite(gravityG, 1), 0.01);
  const yieldStress =
    compositionClass === "Ice world" ? ICE_YIELD_STRESS_PA : BASALT_YIELD_STRESS_PA;
  return yieldStress / (CRUST_DENSITY * g * 9.81);
}

/**
 * Climate-adjusted erosion rate (m/Myr).
 *
 * Warmer temperatures accelerate chemical weathering; higher atmospheric
 * moisture increases precipitation and runoff.  The baseline 5 m/Myr
 * corresponds to Earth's global median (cosmogenic nuclide data).
 *
 * @param {number} surfaceTempK - Mean surface temperature in K
 * @param {number} h2oPct - Atmospheric H₂O fraction (%)
 * @returns {number} Erosion rate in m/Myr
 */
export function climateErosionRate(surfaceTempK, h2oPct) {
  const t = toFinite(surfaceTempK, 288);
  const h2o = Math.max(toFinite(h2oPct, 0), 0);
  const tempFactor = Math.max(0.2, t / 288);
  const moistureFactor = Math.max(0.1, 1 + h2o);
  return clamp(DEFAULT_EROSION_RATE * tempFactor * moistureFactor, 0.5, 50);
}

/**
 * Composition-dependent maximum peak height constant (metres).
 *
 * Different crustal materials have different compressive strengths.
 * Iron-rich crusts support taller columns; ice rheology severely limits
 * peak height.
 *
 * @param {string} compositionClass - Planet composition class
 * @returns {number} Max peak constant in metres (before gravity scaling)
 */
export function compositionMaxPeakM(compositionClass) {
  return COMPOSITION_PEAK_M[compositionClass] ?? EARTH_MAX_PEAK_M;
}

/**
 * Mountain height scaling factor from tectonic convergence rate.
 *
 * Faster convergence drives higher mountains.  Scaled relative to
 * Earth's average of ~50 mm/yr with a sub-linear exponent (0.3)
 * because peak height is limited by gravitational and erosional
 * equilibrium, not directly proportional to convergence rate.
 *
 * @param {number} convergenceMmYr - Convergence rate in mm/yr
 * @returns {number} Multiplicative factor (1.0 at 50 mm/yr)
 */
export function convergenceFactor(convergenceMmYr) {
  const rate = Math.max(toFinite(convergenceMmYr, DEFAULT_CONVERGENCE_MM_YR), 1);
  return clamp(Math.pow(rate / DEFAULT_CONVERGENCE_MM_YR, CONVERGENCE_EXPONENT), 0.5, 2.0);
}

/**
 * Volcanic activity fraction relative to Earth (0–2).
 *
 * Radiogenic heat production decays exponentially with planet age.
 * Tidal heating can sustain or even boost volcanism beyond what
 * radiogenic decay alone would allow (e.g. Io).
 *
 * @param {number} ageGyr - System age in Gyr
 * @param {number} [tidalHeatingWm2=0] - Tidal heating flux in W/m²
 * @param {number} [radioisotopeAbundance=1] - Radioisotope abundance relative to Earth
 * @returns {number} Activity fraction (1.0 ≈ Earth-level)
 */
export function volcanicActivity(ageGyr, tidalHeatingWm2 = 0, radioisotopeAbundance = 1) {
  const age = Math.max(toFinite(ageGyr, 4.6), 0);
  const tidal = Math.max(toFinite(tidalHeatingWm2, 0), 0);
  const abundance = Math.max(toFinite(radioisotopeAbundance, 1), 0.01);
  let activity = Math.exp((-HEAT_DECAY_RATE * age) / abundance);
  if (tidal > 0.1) {
    activity += 0.5 * Math.min(1, tidal / 2);
  }
  return clamp(activity, 0.01, 2.0);
}

// ── Exported calculation functions ───────────────────────

/**
 * Maximum mountain peak height for a given surface gravity and
 * crustal composition.
 *
 * The gravitational limit on crustal rock columns scales inversely with
 * surface gravity: H_max = C / g, where C depends on crustal strength.
 * At Earth gravity (1 g) with Earth-like composition, H_max ≈ 9267 m
 * (close to Everest at 8849 m, which has not yet reached the
 * theoretical limit).  Ice worlds have much lower C (~3000 m).
 *
 * @param {number} gravityG - Surface gravity in Earth-g units
 * @param {string} [compClass="Earth-like"] - Planet composition class
 * @returns {number} Maximum peak height in metres
 */
export function maxPeakHeight(gravityG, compClass) {
  const g = toFinite(gravityG, 1);
  const c = compositionMaxPeakM(compClass);
  return c / Math.max(g, 0.01);
}

/**
 * Build a cross-section profile for an active mountain range.
 *
 * Returns an array of zone objects with computed position, width, and
 * height.  Heights are clamped to the gravity-limited maximum and
 * scaled by convergence rate.
 *
 * @param {string} type - "andean"|"laramide"|"ural"|"himalayan"
 * @param {number} gravityG - Surface gravity in Earth-g units
 * @param {Object} [widthFractions={}] - Per-zone width position (0–1 within min–max range), keyed by zone index
 * @param {Object} [heightFractions={}] - Per-zone height position (0–1 within min–max range), keyed by zone index
 * @param {Object} [options={}] - Planet-aware options
 * @param {string} [options.compositionClass] - Planet composition class
 * @param {number} [options.convergenceMmYr] - Convergence rate in mm/yr
 * @returns {{ type: string, label: string, zones: Array, totalWidthKm: number, peakM: number }}
 */
export function mountainProfile(
  type,
  gravityG,
  widthFractions = {},
  heightFractions = {},
  options = {},
) {
  const mt = MOUNTAIN_TYPES[type] || MOUNTAIN_TYPES.andean;
  const cap = maxPeakHeight(gravityG, options.compositionClass);
  const gravScale = 1 / Math.max(toFinite(gravityG, 1), 0.01);
  const convFactor = convergenceFactor(options.convergenceMmYr);

  const zones = [];
  let x = 0;
  let peak = 0;

  for (let i = 0; i < mt.zones.length; i++) {
    const z = mt.zones[i];
    const wFrac = clamp(toFinite(widthFractions[i], 0.5), 0, 1);
    const hFrac = clamp(toFinite(heightFractions[i], 0.5), 0, 1);

    const width = z.wMin + (z.wMax - z.wMin) * wFrac;

    // Scale height by gravity ratio and convergence factor, then clamp
    let minH = Math.min(z.hMin * gravScale * convFactor, cap);
    let maxH = Math.min(z.hMax * gravScale * convFactor, cap);
    let height = minH + (maxH - minH) * hFrac;

    if (z.taper) {
      height = Math.min(height, cap);
    }

    height = Math.min(height, cap);

    zones.push({
      name: z.name,
      x,
      width,
      minHeight: minH,
      maxHeight: maxH,
      height,
      taper: z.taper || false,
      taperToPeak: z.taperToPeak || false,
      taperFromPeak: z.taperFromPeak || false,
    });

    if (height > peak) peak = height;
    x += width;
  }

  return {
    type,
    label: mt.label,
    zones,
    totalWidthKm: x,
    peakM: peak,
  };
}

/**
 * Compute eroded mountain height for an inactive range.
 *
 * Linear denudation: height decreases by erosionRate * ageMyr,
 * floored at 0.
 *
 * @param {number} originalHeightM - Original peak height in metres
 * @param {number} ageMyr - Time since deactivation in Myr
 * @param {number} [erosionRate=5] - Erosion rate in m/Myr
 * @returns {number} Eroded height in metres (≥ 0)
 */
export function erodedHeight(originalHeightM, ageMyr, erosionRate = DEFAULT_EROSION_RATE) {
  const h = toFinite(originalHeightM, 0);
  const a = toFinite(ageMyr, 0);
  const r = toFinite(erosionRate, DEFAULT_EROSION_RATE);
  return Math.max(0, h - r * a);
}

/**
 * Ocean depth as a function of oceanic crust age.
 *
 * Two-regime plate model (Parsons & Sclater 1977):
 *   Half-space:  depth = ridge + 350 × √age
 *   Plate model: depth = 6400 − 3073 × exp(−age / 62.8)
 * The actual depth is min(half-space, plate), which naturally transitions
 * from sqrt behaviour for young crust to exponential flattening for old crust.
 *
 * @param {number} crustAgeMyr - Age of oceanic crust in Myr
 * @param {number} [ridgeHeightM=2600] - Mid-ocean ridge elevation in metres
 * @returns {number} Ocean depth in metres (positive downward from sea level)
 */
export function oceanDepth(crustAgeMyr, ridgeHeightM = DEFAULT_RIDGE_HEIGHT_M) {
  const age = Math.max(0, toFinite(crustAgeMyr, 0));
  const ridge = toFinite(ridgeHeightM, DEFAULT_RIDGE_HEIGHT_M);
  const halfSpace = ridge + SUBSIDENCE_RATE_M * Math.sqrt(age);
  const plate = MAX_OCEAN_DEPTH_M - PLATE_INTERSECTION_M * Math.exp(-age / PLATE_FALLOFF_MYR);
  return Math.min(halfSpace, plate, MAX_OCEAN_DEPTH_M);
}

/**
 * Generate a full ocean depth-vs-age curve for plotting.
 *
 * @param {number} [ridgeHeightM=2600] - Mid-ocean ridge elevation
 * @param {number} [maxAgeMyr=1000] - Maximum crust age on x-axis
 * @param {number} [steps=100] - Number of sample points
 * @returns {Array<{ageMyr: number, depthM: number}>}
 */
export function oceanDepthCurve(
  ridgeHeightM = DEFAULT_RIDGE_HEIGHT_M,
  maxAgeMyr = 1000,
  steps = 100,
) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const age = (i / steps) * maxAgeMyr;
    pts.push({ ageMyr: age, depthM: oceanDepth(age, ridgeHeightM) });
  }
  return pts;
}

// ── Phase 2 science enhancements ─────────────────────────

/**
 * Seafloor spreading rate estimate from tectonic regime.
 *
 * @param {string} regime - "mobile"|"stagnant"|"episodic"|"plutonicSquishy"
 * @param {number} [fraction=0.5] - 0–1 position within regime's rate range
 * @returns {{ rateMmYr: number, min: number, max: number, label: string }}
 */
export function spreadingRate(regime, fraction = 0.5) {
  const sr = SPREADING_RATES[regime] || SPREADING_RATES.mobile;
  const f = clamp(toFinite(fraction, 0.5), 0, 1);
  return {
    rateMmYr: sr.min + (sr.max - sr.min) * f,
    min: sr.min,
    max: sr.max,
    label: sr.label,
  };
}

/**
 * Distance from trench to volcanic arc based on slab dip angle.
 *
 * arc_distance = slab_depth / tan(slab_angle)
 *
 * Reference: Syracuse & Abers (2006) G³ — global mean slab depth
 * beneath volcanic front is 105 ± 19 km.  We use 110 km as default.
 *
 * @param {number} slabAngleDeg - Slab dip angle in degrees (10–90)
 * @param {number} [slabDepthKm=110] - Depth to slab beneath volcanic front
 * @returns {number} Arc distance in km
 */
export function volcanicArcDistance(slabAngleDeg, slabDepthKm = SLAB_DEPTH_KM) {
  const angle = clamp(toFinite(slabAngleDeg, 45), 1, 89.99);
  const depth = toFinite(slabDepthKm, SLAB_DEPTH_KM);
  return depth / Math.tan((angle * Math.PI) / 180);
}

/**
 * Airy isostatic model: depth of crustal root beneath a mountain.
 *
 * root = h × ρ_c / (ρ_m − ρ_c)
 *
 * For Earth standard densities (2800 / 3300 kg/m³), ratio ≈ 5.6,
 * meaning Everest (8849 m) should have a root ~50 km deep — consistent
 * with observed Himalayan Moho depths of ~70 km (35 km normal + 35 km root).
 *
 * Reference: Turcotte & Schubert (2014) Geodynamics, Ch. 2.
 *
 * @param {number} elevationM - Mountain height above sea level in metres
 * @param {number} [crustDensity=2800] - Crustal density kg/m³
 * @param {number} [mantleDensity=3300] - Mantle density kg/m³
 * @returns {number} Root depth in metres (positive downward from Moho)
 */
export function airyRootDepth(
  elevationM,
  crustDensity = CRUST_DENSITY,
  mantleDensity = MANTLE_DENSITY,
) {
  const h = Math.max(0, toFinite(elevationM, 0));
  const rc = toFinite(crustDensity, CRUST_DENSITY);
  const rm = toFinite(mantleDensity, MANTLE_DENSITY);
  const denom = rm - rc;
  if (denom <= 0) return 0;
  return h * (rc / denom);
}

/**
 * Pratt isostatic model: crustal density at a given elevation.
 *
 * ρ(h) = ρ_0 × D / (D + h)
 *
 * Higher topography → lower density column, all columns extend to the
 * same compensation depth D.
 *
 * Reference: Turcotte & Schubert (2014) Geodynamics, Ch. 2.
 *
 * @param {number} elevationM - Height above sea level in metres
 * @param {number} [compensationDepthM=100000] - Compensation depth (metres)
 * @param {number} [baseDensity=2800] - Base crustal density kg/m³
 * @returns {number} Effective crustal density in kg/m³
 */
export function prattDensity(
  elevationM,
  compensationDepthM = DEFAULT_COMPENSATION_DEPTH_M,
  baseDensity = CRUST_DENSITY,
) {
  const h = Math.max(0, toFinite(elevationM, 0));
  const D = Math.max(1, toFinite(compensationDepthM, DEFAULT_COMPENSATION_DEPTH_M));
  const rho0 = toFinite(baseDensity, CRUST_DENSITY);
  return (rho0 * D) / (D + h);
}

/**
 * Continental margin profile from coastline to abyssal plain.
 *
 * Four zones: shelf (flat, shallow), slope (steep descent), rise
 * (gradual), abyssal plain (flat, deep).  Shelf break depth (~130 m)
 * is tied to Pleistocene sea-level lowstands.
 *
 * @param {Object} [params]
 * @param {number} [params.shelfWidthKm=80] - Continental shelf width (km)
 * @param {number} [params.shelfDepthM=130] - Shelf break depth (metres)
 * @param {number} [params.slopeAngleDeg=3.5] - Continental slope angle (°)
 * @param {number} [params.riseWidthKm=200] - Continental rise width (km)
 * @param {number} [params.abyssalDepthM=4500] - Abyssal plain depth (metres)
 * @returns {{ points: Array<{distKm: number, depthM: number}>, segments: Array, totalWidthKm: number }}
 */
export function continentalMarginProfile({
  shelfWidthKm = 80,
  shelfDepthM = 130,
  slopeAngleDeg = 3.5,
  riseWidthKm = 200,
  abyssalDepthM = 4500,
} = {}) {
  const shelf = toFinite(shelfWidthKm, 80);
  const shelfD = toFinite(shelfDepthM, 130);
  const slopeA = clamp(toFinite(slopeAngleDeg, 3.5), 0.5, 45);
  const riseW = toFinite(riseWidthKm, 200);
  const abyssal = toFinite(abyssalDepthM, 4500);

  // Slope: descent from shelf break to ~3000 m (or abyssal if shallower)
  const slopeBottomM = Math.min(3000, abyssal);
  const slopeDropM = slopeBottomM - shelfD;
  const slopeWidthKm = slopeDropM > 0 ? slopeDropM / 1000 / Math.tan((slopeA * Math.PI) / 180) : 0;

  // Rise: gradual descent from slope bottom to abyssal
  const riseDropM = abyssal - slopeBottomM;

  const points = [];
  const segments = [];

  // Shelf
  points.push({ distKm: 0, depthM: 0 });
  points.push({ distKm: shelf, depthM: shelfD });
  segments.push({ name: "Shelf", startKm: 0, endKm: shelf, startM: 0, endM: shelfD });

  // Slope
  const slopeEnd = shelf + slopeWidthKm;
  points.push({ distKm: slopeEnd, depthM: slopeBottomM });
  segments.push({
    name: "Slope",
    startKm: shelf,
    endKm: slopeEnd,
    startM: shelfD,
    endM: slopeBottomM,
  });

  // Rise
  const riseEnd = slopeEnd + riseW;
  const riseDepth = slopeBottomM + riseDropM;
  points.push({ distKm: riseEnd, depthM: riseDepth });
  segments.push({
    name: "Rise",
    startKm: slopeEnd,
    endKm: riseEnd,
    startM: slopeBottomM,
    endM: riseDepth,
  });

  // Abyssal plain (extend 100 km flat)
  const abyssalEnd = riseEnd + 100;
  points.push({ distKm: abyssalEnd, depthM: abyssal });
  segments.push({
    name: "Abyssal Plain",
    startKm: riseEnd,
    endKm: abyssalEnd,
    startM: abyssal,
    endM: abyssal,
  });

  return { points, segments, totalWidthKm: abyssalEnd };
}

/**
 * Maximum shield volcano height for a given gravity.
 *
 * Three independent structural height limits are computed and the
 * minimum is used:
 *   1. Gravitational (1/g) — the classic scaling
 *   2. Flexural — lithosphere elastic thickness limits load support
 *   3. Basal spreading — self-weight yield stress limits edifice height
 *
 * Stagnant-lid enhancement is applied on top (volcano stays on its
 * magma source).  Volcanic activity is reported separately as an
 * informational metric, not as a structural cap.
 *
 * Reference: McGovern & Solomon (1993, 1998) JGR.
 *
 * @param {number} gravityG - Surface gravity in Earth-g units
 * @param {boolean} [stagnantLid=false] - If true, apply stagnant-lid enhancement
 * @param {Object} [options={}] - Planet-aware options
 * @param {number} [options.ageGyr] - System age in Gyr
 * @param {number} [options.massEarth] - Planet mass in Earth masses
 * @param {number} [options.tidalHeatingWm2] - Tidal heating flux in W/m²
 * @param {string} [options.compositionClass] - Planet composition class
 * @returns {number} Maximum shield height in metres
 */
export function maxShieldHeight(gravityG, stagnantLid = false, options = {}) {
  const g = Math.max(toFinite(gravityG, 1), 0.01);

  // Limit 1: classic 1/g scaling
  const gravLimit = EARTH_SHIELD_REF_M / g;

  // Limit 2: flexural support (if planet data available)
  const age = toFinite(options.ageGyr, 4.6);
  const mass = toFinite(options.massEarth, 1);
  const tidal = toFinite(options.tidalHeatingWm2, 0);
  const te = elasticLithosphereThicknessKm(
    age,
    mass,
    tidal,
    toFinite(options.radioisotopeAbundance, 1),
  );
  const flexLimit = flexuralShieldLimit(te, gravityG);

  // Limit 3: basal spreading
  const spreadLimit = basalSpreadingLimit(gravityG, options.compositionClass);

  // Take the most restrictive structural limit
  let h = Math.min(gravLimit, flexLimit, spreadLimit);

  // Stagnant-lid enhancement (volcano stays on magma source)
  if (stagnantLid) h *= STAGNANT_LID_FACTOR;

  return h;
}

/**
 * Shield volcano profile (simplified concave-up shield shape).
 *
 * @param {number} heightM - Peak height in metres
 * @param {number} [slopeAngleDeg=5] - Flank slope angle in degrees (3–12 typical)
 * @returns {{ points: Array<{rKm: number, hM: number}>, baseRadiusKm: number }}
 */
export function shieldVolcanoProfile(heightM, slopeAngleDeg = 5) {
  const h = Math.max(0, toFinite(heightM, 5000));
  const angle = clamp(toFinite(slopeAngleDeg, 5), 1, 30);
  const baseR = h / 1000 / Math.tan((angle * Math.PI) / 180);

  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = baseR * (1 - t);
    // Concave-up profile: h = H × t^0.6 (flatter flanks, steeper near summit)
    const hPt = h * Math.pow(t, 0.6);
    pts.push({ rKm: r, hM: hPt });
  }
  return { points: pts, baseRadiusKm: baseR };
}

/**
 * Rift valley (graben) cross-section profile.
 *
 * Zones: left shoulder → left fault scarp → graben floor (with optional
 * volcanic fill) → right fault scarp → right shoulder.  Heights are
 * negative (below baseline) for the graben floor.
 *
 * @param {Object} params
 * @param {number} params.grabenWidthKm - Total graben width (10–200 km)
 * @param {number} params.grabenDepthM - Graben floor depth below surroundings (100–5000 m)
 * @param {number} params.faultAngleDeg - Normal fault dip angle (30–70°)
 * @param {number} [params.volcanicFillM=0] - Volcanic fill in graben floor (metres)
 * @param {number} [params.shoulderHeightM=0] - Uplifted rift shoulder height (metres)
 * @returns {{ zones: Array<{name: string, x: number, width: number, height: number}>, totalWidthKm: number }}
 */
export function riftProfile({
  grabenWidthKm = 50,
  grabenDepthM = 1000,
  faultAngleDeg = 60,
  volcanicFillM = 0,
  shoulderHeightM = 0,
} = {}) {
  const gw = Math.max(1, toFinite(grabenWidthKm, 50));
  const gd = Math.max(0, toFinite(grabenDepthM, 1000));
  const fa = clamp(toFinite(faultAngleDeg, 60), 15, 85);
  const vf = Math.max(0, toFinite(volcanicFillM, 0));
  const sh = Math.max(0, toFinite(shoulderHeightM, 0));

  // Fault scarp width from depth and angle
  const scarpW = gd / 1000 / Math.tan((fa * Math.PI) / 180);
  // Shoulder width: proportional to shoulder height
  const shoulderW = sh > 0 ? Math.max(scarpW, sh / 1000 / Math.tan((30 * Math.PI) / 180)) : scarpW;

  const zones = [];
  let x = 0;

  // Left shoulder
  zones.push({ name: "Left Shoulder", x, width: shoulderW, height: sh });
  x += shoulderW;

  // Left fault scarp
  zones.push({
    name: "Left Scarp",
    x,
    width: scarpW,
    height: -gd + vf,
    taper: true,
    taperFromPeak: true,
  });
  x += scarpW;

  // Graben floor
  zones.push({ name: "Graben Floor", x, width: gw, height: -gd + vf });
  x += gw;

  // Right fault scarp
  zones.push({
    name: "Right Scarp",
    x,
    width: scarpW,
    height: -gd + vf,
    taper: true,
    taperToPeak: true,
  });
  x += scarpW;

  // Right shoulder
  zones.push({ name: "Right Shoulder", x, width: shoulderW, height: sh });
  x += shoulderW;

  return { zones, totalWidthKm: x };
}

/**
 * Full tectonics calculation matching (and extending) the WS8 Tectonics tab.
 *
 * @param {Object} params
 * @param {number} params.gravityG - Surface gravity in g
 * @param {string} [params.tectonicRegime="mobile"] - Active tectonic regime
 * @param {Array}  [params.mountainRanges] - Active mountain ranges
 * @param {Array}  [params.inactiveRanges] - Inactive ranges with age + erosion
 * @param {number} [params.ridgeHeightM=2600] - Mid-ocean ridge height
 * @param {number} [params.spreadingRateFraction=0.5] - 0–1 within regime range
 * @param {Object} [params.margin] - Continental margin parameters
 * @param {Array}  [params.shieldVolcanoes] - Shield volcano definitions
 * @param {Array}  [params.riftValleys] - Rift valley definitions
 * @param {number} [params.massEarth=1] - Planet mass in Earth masses
 * @param {number} [params.ageGyr=4.6] - System age in Gyr
 * @param {number} [params.surfaceTempK=288] - Mean surface temperature in K
 * @param {number} [params.h2oPct=0] - Atmospheric H₂O fraction (%)
 * @param {string} [params.compositionClass="Earth-like"] - Planet composition class
 * @param {number} [params.tidalHeatingWm2=0] - Tidal heating flux in W/m²
 * @param {number} [params.radioisotopeAbundance=1] - Radioisotope abundance relative to Earth
 * @returns {{ inputs: Object, tectonics: Object, display: Object }}
 */
export function calcTectonics({
  gravityG = 1,
  tectonicRegime = "mobile",
  mountainRanges = [],
  inactiveRanges = [],
  ridgeHeightM = DEFAULT_RIDGE_HEIGHT_M,
  spreadingRateFraction = 0.5,
  margin,
  shieldVolcanoes = [],
  riftValleys = [],
  massEarth = 1,
  ageGyr = 4.6,
  surfaceTempK = 288,
  h2oPct = 0,
  compositionClass = "Earth-like",
  tidalHeatingWm2 = 0,
  radioisotopeAbundance = 1,
} = {}) {
  const g = toFinite(gravityG, 1);
  const ridge = toFinite(ridgeHeightM, DEFAULT_RIDGE_HEIGHT_M);
  const maxPeak = maxPeakHeight(g, compositionClass);

  // Planet-aware derived quantities
  const te = elasticLithosphereThicknessKm(
    ageGyr,
    massEarth,
    tidalHeatingWm2,
    radioisotopeAbundance,
  );
  const activity = volcanicActivity(ageGyr, tidalHeatingWm2, radioisotopeAbundance);
  const erosionRate = climateErosionRate(surfaceTempK, h2oPct);

  // Spreading rate
  const spreading = spreadingRate(tectonicRegime, spreadingRateFraction);

  // Active mountain profiles (with arc distance if slab angle provided)
  const profiles = mountainRanges.map((mr) => {
    const profile = mountainProfile(mr.type || "andean", g, mr.widths || {}, mr.heights || {}, {
      compositionClass,
      convergenceMmYr: mr.convergenceMmYr,
    });
    const hasSubduction = mr.type === "andean" || mr.type === "laramide";
    if (hasSubduction && mr.slabAngleDeg != null) {
      profile.arcDistanceKm = volcanicArcDistance(mr.slabAngleDeg);
      profile.slabAngleDeg = toFinite(mr.slabAngleDeg, 45);
    }
    return profile;
  });

  // Inactive mountain erosion (using climate-adjusted rate)
  const inactiveProfiles = inactiveRanges.map((ir) => {
    const origH = toFinite(ir.originalHeightM, maxPeak * 0.5);
    const age = toFinite(ir.ageMyr, 0);
    const rate = toFinite(ir.erosionRate, erosionRate);
    const eroded = erodedHeight(origH, age, rate);
    return {
      type: ir.type || "andean",
      label: MOUNTAIN_TYPES[ir.type]?.label || "Andean",
      originalHeightM: origH,
      ageMyr: age,
      erosionRate: rate,
      erodedHeightM: eroded,
    };
  });

  // Ocean depth curve
  const subsidence = oceanDepthCurve(ridge);

  // Continental margin
  const marginProfile = margin ? continentalMarginProfile(margin) : continentalMarginProfile();

  // Shield volcanism (planet-aware)
  const isStagnant = tectonicRegime === "stagnant";
  const shieldOpts = {
    ageGyr,
    massEarth,
    tidalHeatingWm2,
    compositionClass,
    radioisotopeAbundance,
  };
  const maxShield = maxShieldHeight(g, isStagnant, shieldOpts);
  const shieldProfiles = shieldVolcanoes.map((sv) => {
    const h = clamp(toFinite(sv.heightM, maxShield * 0.5), 0, maxShield);
    return {
      ...shieldVolcanoProfile(h, sv.slopeAngleDeg),
      heightM: h,
      slopeAngleDeg: toFinite(sv.slopeAngleDeg, 5),
    };
  });

  // Rift valleys
  const riftProfiles = riftValleys.map((rv) => riftProfile(rv));

  return {
    inputs: {
      gravityG: g,
      tectonicRegime,
      ridgeHeightM: ridge,
      spreadingRateFraction,
      mountainRanges,
      inactiveRanges,
      shieldVolcanoes,
      riftValleys,
      radioisotopeAbundance,
    },
    tectonics: {
      maxPeakHeightM: maxPeak,
      mountainProfiles: profiles,
      inactiveProfiles,
      ocean: {
        ridgeHeightM: ridge,
        maxDepthM: MAX_OCEAN_DEPTH_M,
        subsidence,
        spreadingRate: spreading,
      },
      margin: marginProfile,
      maxShieldHeightM: maxShield,
      shieldProfiles,
      riftProfiles,
      elasticLithosphereKm: te,
      volcanicActivityFraction: activity,
      climateErosionRateMyr: erosionRate,
    },
    display: {
      maxPeakHeight: fmt(maxPeak, 0) + " m",
      ridgeHeight: fmt(ridge, 0) + " m",
      maxOceanDepth: fmt(MAX_OCEAN_DEPTH_M, 0) + " m",
      spreadingRate: fmt(spreading.rateMmYr, 0) + " mm/yr",
      maxShieldHeight: fmt(maxShield, 0) + " m",
      elasticLithosphere: fmt(te, 0) + " km",
      volcanicActivity: fmt(activity * 100, 0) + "%",
      climateErosionRate: fmt(erosionRate, 1) + " m/Myr",
    },
  };
}
