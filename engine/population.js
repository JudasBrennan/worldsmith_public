// Population model — land-use cascade, logistic growth, and rank-size distribution.
//
// Models the relationship between a planet's physical characteristics
// (surface area, water regime, climate zones) and its population dynamics.
//
// Land-use cascade: surface → land → habitable → productive → carrying capacity
// Growth model: Verhulst logistic P(t) = K / (1 + ((K−P0)/P0) × e^(−r×t))
// Distribution: Zipf's law P(rank) = P(1) / rank^q
//
// References:
//   Verhulst (1838, Correspondance mathématique et physique 10, 113–121)
//   Zipf (1949, Human Behavior and the Principle of Least Effort)
//   FAO (2020, FAOSTAT Land Use data)

import { clamp, toFinite, round, fmt } from "./utils.js";

// ── Constants ────────────────────────────────────────────────

/** Ocean surface-coverage fraction by water-regime label. */
const OCEAN_FRACTION = {
  Dry: 0,
  "Shallow oceans": 0.5,
  "Extensive oceans": 0.71,
  "Global ocean": 0.9,
  "Deep ocean": 0.95,
  "Ice world": 0,
};

/** People per km² of productive land by technology era. */
const TECH_ERA_DENSITY = {
  "Hunter-Gatherer": 0.05,
  Neolithic: 2,
  "Bronze Age": 8,
  "Iron Age": 15,
  Medieval: 30,
  "Early Industrial": 80,
  Industrial: 200,
  "Post-Industrial": 400,
  "Sci-Fi High": 1000,
};

/** Intrinsic growth rate r (per year) by technology era. */
const TECH_ERA_GROWTH = {
  "Hunter-Gatherer": 0.005,
  Neolithic: 0.008,
  "Bronze Age": 0.01,
  "Iron Age": 0.01,
  Medieval: 0.01,
  "Early Industrial": 0.015,
  Industrial: 0.02,
  "Post-Industrial": 0.005,
  "Sci-Fi High": 0.003,
};

/** Crops feed ~4× more people per unit area than livestock (FAO). */
const CROP_EFFICIENCY = 4;

/** Earth default crop fraction for normalization. */
const EARTH_CROP_FRAC = 0.77;

const EARTH_RADIUS_KM = 6371;

/** Ordered era names for UI dropdowns. */
export const TECH_ERAS = Object.keys(TECH_ERA_DENSITY);

// ── Helper ───────────────────────────────────────────────────

/** Format large population numbers with SI suffixes. */
function fmtPopulation(n) {
  if (n >= 1e12) return fmt(n / 1e12, 2) + " trillion";
  if (n >= 1e9) return fmt(n / 1e9, 2) + " billion";
  if (n >= 1e6) return fmt(n / 1e6, 2) + " million";
  if (n >= 1e3) return fmt(n / 1e3, 1) + " thousand";
  return fmt(n, 0);
}

// ── Exported functions ───────────────────────────────────────

/**
 * Ocean and land fractions from the planet's water-regime label.
 * @param {string} waterRegime
 * @returns {{ oceanFraction: number, landFraction: number }}
 */
export function oceanLandSplit(waterRegime) {
  const ocean = OCEAN_FRACTION[waterRegime] ?? 0.5;
  return { oceanFraction: round(ocean, 3), landFraction: round(1 - ocean, 3) };
}

/**
 * Fraction of land area that is habitable, derived from climate zones.
 *
 * Zones with master class E (polar) or X (special) are excluded.
 * For latitude-band zones, area is weighted by the spherical strip
 * formula |sin(lat2) − sin(lat1)|.
 *
 * @param {Array} zones - Climate zone array from calcClimateZones().zones
 * @returns {number} 0–1 fraction
 */
export function habitabilityFraction(zones) {
  if (!zones || !zones.length) return 0;

  // Tidally-locked: equal-weight zones
  const isTidal = zones.some((z) =>
    ["substellar", "terminator", "antistellar"].includes(z.cellRole),
  );
  if (isTidal) {
    const hab = zones.filter((z) => z.master !== "E" && z.master !== "X");
    return round(hab.length / zones.length, 3);
  }

  // Global single zone
  const isGlobal = zones.length === 1 && zones[0].latMin === 0 && zones[0].latMax === 90;
  if (isGlobal) {
    return zones[0].master !== "E" && zones[0].master !== "X" ? 1 : 0;
  }

  // Normal latitude bands — spherical area weighting
  let totalW = 0;
  let habW = 0;
  const seen = new Set();

  for (const z of zones) {
    const key = `${z.latMin}-${z.latMax}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const s1 = Math.sin((z.latMin * Math.PI) / 180);
    const s2 = Math.sin((z.latMax * Math.PI) / 180);
    const w = Math.abs(s2 - s1);
    totalW += w;

    const bandsHere = zones.filter((zz) => zz.latMin === z.latMin && zz.latMax === z.latMax);
    if (bandsHere.some((zz) => zz.master !== "E" && zz.master !== "X")) {
      habW += w;
    }
  }

  return totalW > 0 ? round(habW / totalW, 3) : 0;
}

/**
 * Fraction of habitable land that is productive (arable or grazing-suitable).
 *
 * Based on aridity: BW desert → 0.05, BS steppe → 0.3, otherwise aridity
 * score directly. Spherical area-weighted.
 *
 * @param {Array} zones - Climate zone array from calcClimateZones().zones
 * @returns {number} 0–1 fraction
 */
export function productivityFraction(zones) {
  if (!zones || !zones.length) return 0;

  const habitable = zones.filter((z) => z.master !== "E" && z.master !== "X");
  if (!habitable.length) return 0;

  let totalW = 0;
  let prodW = 0;
  const seen = new Set();

  for (const z of habitable) {
    const key = `${z.latMin}-${z.latMax}-${z.variant}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const s1 = Math.sin((z.latMin * Math.PI) / 180);
    const s2 = Math.sin((z.latMax * Math.PI) / 180);
    const w = Math.abs(s2 - s1);
    totalW += w;

    let prod = clamp(z.aridity, 0, 1);
    if (z.master === "B") {
      prod = z.aridity < 0.25 ? 0.05 : 0.3;
    }
    prodW += w * prod;
  }

  return totalW > 0 ? round(prodW / totalW, 3) : 0;
}

/**
 * Carrying capacity K.
 *
 * The crop/livestock split influences density: crops feed ~4× more per
 * unit area. Normalized so the Earth-default 77% crops produces exactly
 * the stated tech-era density.
 *
 * @param {number} productiveAreaKm2
 * @param {number} techDensity - People per km² for the tech era
 * @param {number} cropFractionPct - % of productive land used for crops (0–100)
 * @returns {number} Carrying capacity (people)
 */
export function carryingCapacity(productiveAreaKm2, techDensity, cropFractionPct) {
  const area = Math.max(toFinite(productiveAreaKm2, 0), 0);
  const density = Math.max(toFinite(techDensity, 30), 0);
  const cropFrac = clamp(toFinite(cropFractionPct, 77) / 100, 0, 1);

  const earthMix = 1 + (CROP_EFFICIENCY - 1) * EARTH_CROP_FRAC;
  const actualMix = 1 + (CROP_EFFICIENCY - 1) * cropFrac;
  const effectiveDensity = density * (actualMix / earthMix);

  return Math.round(area * effectiveDensity);
}

/**
 * Logistic (Verhulst) population at time t.
 *
 * P(t) = K / (1 + ((K − P0) / P0) × e^(−r × t))
 *
 * @param {number} K  - Carrying capacity
 * @param {number} P0 - Initial population
 * @param {number} r  - Intrinsic growth rate (per year)
 * @param {number} t  - Time elapsed (years)
 * @returns {number}
 */
export function logisticPopulation(K, P0, r, t) {
  const k = Math.max(toFinite(K, 1000), 1);
  const p0 = clamp(toFinite(P0, 100), 1, k);
  const rate = Math.max(toFinite(r, 0.01), 0);
  const time = Math.max(toFinite(t, 0), 0);

  if (rate === 0 || time === 0) return p0;

  const ratio = (k - p0) / p0;
  return Math.round(k / (1 + ratio * Math.exp(-rate * time)));
}

/**
 * Time series of population values for charting.
 *
 * @param {number} K
 * @param {number} P0
 * @param {number} r
 * @param {number} tMax - Maximum time (years)
 * @param {number} [steps=100]
 * @returns {Array<{year: number, population: number}>}
 */
export function populationTimeSeries(K, P0, r, tMax, steps = 100) {
  const maxT = Math.max(toFinite(tMax, 1000), 1);
  const n = clamp(toFinite(steps, 100), 10, 500);
  const dt = maxT / n;
  const series = [];
  for (let i = 0; i <= n; i++) {
    const t = round(i * dt, 1);
    series.push({ year: t, population: logisticPopulation(K, P0, r, t) });
  }
  return series;
}

/**
 * Zipf rank-size distribution.
 *
 * P(rank) = P(1) / rank^q, solved so the sum equals totalPop.
 *
 * @param {number} totalPop
 * @param {number} count - Number of regions
 * @param {number} [zipfExponent=1.0]
 * @returns {Array<{rank: number, population: number, fraction: number}>}
 */
export function rankSizeDistribution(totalPop, count, zipfExponent = 1.0) {
  const pop = Math.max(toFinite(totalPop, 0), 0);
  const n = clamp(Math.round(toFinite(count, 6)), 1, 100);
  const q = clamp(toFinite(zipfExponent, 1.0), 0.5, 1.5);

  if (pop === 0) return [];

  // Generalized harmonic number H(n, q)
  let H = 0;
  for (let i = 1; i <= n; i++) H += 1 / Math.pow(i, q);

  const p1 = pop / H;
  const result = [];
  for (let i = 1; i <= n; i++) {
    const rPop = Math.round(p1 / Math.pow(i, q));
    result.push({ rank: i, population: rPop, fraction: round(rPop / pop, 4) });
  }
  return result;
}

/**
 * Full population calculation: land-use cascade, logistic growth, distribution.
 *
 * @param {object} opts
 * @param {number}  opts.radiusKm
 * @param {string}  opts.waterRegime
 * @param {Array}   opts.climateZones
 * @param {string}  opts.techEra
 * @param {number}  opts.initialPopulation
 * @param {number}  opts.growthRate         - null → use era default
 * @param {number}  opts.timeElapsedYears
 * @param {number}  opts.continentCount
 * @param {number}  opts.regionCount
 * @param {number}  opts.zipfExponent
 * @param {number}  [opts.oceanPctOverride]     - null → auto
 * @param {number}  [opts.habitablePctOverride] - null → auto
 * @param {number}  [opts.productivePctOverride]- null → auto
 * @param {number}  [opts.cropPctOverride]      - null → auto (77%)
 * @returns {{ inputs: object, population: object, display: object }}
 */
export function calcPopulation({
  radiusKm = EARTH_RADIUS_KM,
  waterRegime = "Extensive oceans",
  climateZones = [],
  techEra = "Medieval",
  initialPopulation = 1000,
  growthRate = null,
  timeElapsedYears = 0,
  continentCount = 6,
  regionCount = 10,
  zipfExponent = 1.0,
  oceanPctOverride = null,
  habitablePctOverride = null,
  productivePctOverride = null,
  cropPctOverride = null,
} = {}) {
  // ── Surface area ──
  const r = Math.max(toFinite(radiusKm, EARTH_RADIUS_KM), 1);
  const surfaceAreaKm2 = 4 * Math.PI * r * r;

  // ── Ocean / land split ──
  const autoOcean = oceanLandSplit(waterRegime);
  const oceanPct =
    oceanPctOverride != null
      ? clamp(toFinite(oceanPctOverride, 71), 0, 99)
      : round(autoOcean.oceanFraction * 100, 1);
  const landFrac = 1 - oceanPct / 100;
  const landAreaKm2 = surfaceAreaKm2 * landFrac;

  // ── Habitability ──
  const autoHab = habitabilityFraction(climateZones);
  const habitablePct =
    habitablePctOverride != null
      ? clamp(toFinite(habitablePctOverride, 50), 0, 100)
      : round(autoHab * 100, 1);
  const habitableAreaKm2 = landAreaKm2 * (habitablePct / 100);

  // ── Productivity ──
  const autoProd = productivityFraction(climateZones);
  const productivePct =
    productivePctOverride != null
      ? clamp(toFinite(productivePctOverride, 50), 0, 100)
      : round(autoProd * 100, 1);
  const productiveAreaKm2 = habitableAreaKm2 * (productivePct / 100);

  // ── Crop / livestock ──
  const cropPct = cropPctOverride != null ? clamp(toFinite(cropPctOverride, 77), 0, 100) : 77;

  // ── Tech era ──
  const era = TECH_ERAS.includes(techEra) ? techEra : "Medieval";
  const techDensity = TECH_ERA_DENSITY[era];
  const defaultRate = TECH_ERA_GROWTH[era];
  const rGrowth =
    growthRate != null ? clamp(toFinite(growthRate, defaultRate), 0, 0.05) : defaultRate;

  // ── Carrying capacity ──
  const K = carryingCapacity(productiveAreaKm2, techDensity, cropPct);

  // ── Population ──
  const P0 = clamp(Math.round(toFinite(initialPopulation, 1000)), 1, Math.max(K, 1));
  const t = Math.max(toFinite(timeElapsedYears, 0), 0);
  const currentPop = logisticPopulation(K, P0, rGrowth, t);

  // ── Time series ──
  const tTo95 = rGrowth > 0 && K > P0 ? Math.log((19 * (K - P0)) / P0) / rGrowth : 1000;
  const tMax = Math.max(t, tTo95, 100);
  const timeSeries = populationTimeSeries(K, P0, rGrowth, tMax, 100);

  // ── Distribution ──
  const nCont = clamp(Math.round(toFinite(continentCount, 6)), 1, 20);
  const nReg = clamp(Math.round(toFinite(regionCount, 10)), 1, 50);
  const q = clamp(toFinite(zipfExponent, 1.0), 0.5, 1.5);
  const continents = rankSizeDistribution(currentPop, nCont, q);
  const regions = continents.map((c) => ({
    ...c,
    subregions: rankSizeDistribution(c.population, nReg, q),
  }));

  // ── Density ──
  const overallDens = landAreaKm2 > 0 ? currentPop / landAreaKm2 : 0;
  const habDens = habitableAreaKm2 > 0 ? currentPop / habitableAreaKm2 : 0;

  // ── Doubling time ──
  const doublingYears = rGrowth > 0 ? Math.LN2 / rGrowth : Infinity;
  const satPct = K > 0 ? (currentPop / K) * 100 : 0;

  return {
    inputs: {
      radiusKm: r,
      waterRegime,
      techEra: era,
      oceanPct,
      habitablePct,
      productivePct,
      cropPct,
      initialPopulation: P0,
      growthRate: rGrowth,
      timeElapsedYears: t,
      continentCount: nCont,
      regionCount: nReg,
      zipfExponent: q,
      oceanIsAuto: oceanPctOverride == null,
      habitableIsAuto: habitablePctOverride == null,
      productiveIsAuto: productivePctOverride == null,
      cropIsAuto: cropPctOverride == null,
    },
    population: {
      surfaceAreaKm2,
      landAreaKm2,
      habitableAreaKm2,
      productiveAreaKm2,
      K,
      currentPopulation: currentPop,
      overallDensityPerKm2: round(overallDens, 2),
      habitableDensityPerKm2: round(habDens, 2),
      timeSeries,
      continents: regions,
      doublingTimeYears: round(doublingYears, 1),
      saturationPct: round(satPct, 1),
    },
    display: {
      surfaceArea: fmt(surfaceAreaKm2, 0) + " km\u00b2",
      landArea: fmt(landAreaKm2, 0) + " km\u00b2",
      habitableArea: fmt(habitableAreaKm2, 0) + " km\u00b2",
      productiveArea: fmt(productiveAreaKm2, 0) + " km\u00b2",
      carryingCapacity: fmtPopulation(K),
      currentPopulation: fmtPopulation(currentPop),
      overallDensity: fmt(overallDens, 1) + "/km\u00b2",
      habitableDensity: fmt(habDens, 1) + "/km\u00b2",
      doublingTime: rGrowth > 0 ? fmt(doublingYears, 0) + " years" : "\u221e",
      saturation: fmt(satPct, 1) + "%",
      techEra: era,
      growthRate: fmt(rGrowth * 100, 2) + "%/yr",
    },
  };
}
