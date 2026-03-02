// Local Cluster neighbourhood generator
//
// Populates a stellar neighbourhood around the player's home system by
// computing object counts from a user-supplied stellar density and
// neighbourhood radius, then procedurally placing star systems in 3-D
// space with deterministic (seeded) PRNG coordinates. Spectral-class
// assignment uses solar-neighbourhood population fractions (Reylé et al.
// 2021, RECONS 10 pc census), and each system receives a multiplicity
// rating (single/binary/triple/quadruple) weighted by per-class rates
// from Duchêne & Kraus (2013).
//
// Key references:
//   Reylé et al. 2021 — solar-neighbourhood object census
//   Duchêne & Kraus 2013 — multiplicity fractions by spectral class
//   Lineweaver 2004 — Galactic Habitable Zone probability model
//   HIPPARCOS — default stellar density (0.004 per ly³)
//
// Inputs:  galacticRadiusLy, locationLy, neighbourhoodRadiusLy,
//          stellarDensityPerLy3, randomSeed
// Outputs: stellarRows, system list with 3-D coordinates, spectral
//          classes, multiplicity/components, GHZ probability, and
//          aggregate neighbourhood statistics

import { clamp, toFinite } from "./utils.js";

const PM_MOD = 2147483647; // 2^31 - 1
const PM_MUL = 48271;
const OBJECT_CLASS_BROWN = "LTY";
const OBJECT_CLASS_OTHER = "OTHER";
const MULTIPLICITY_SIZES = Object.freeze({ single: 1, binary: 2, triple: 3, quadruple: 4 });

// Mass rank for companion assignment (0 = heaviest, higher = lighter).
// Companions may not be more massive than their primary star.
const SPECTRAL_RANK = Object.freeze({
  O: 0,
  B: 1,
  A: 2,
  F: 3,
  G: 4,
  K: 5,
  M: 6,
  D: 7,
  LTY: 8,
  OTHER: 9,
});

// ── Metallicity distribution parameters ─────────────────────────────
// Mean [Fe/H] and scatter for the solar neighbourhood.
// Radial and vertical gradients shift the mean for non-solar positions.
const SOLAR_GALACTIC_RADIUS_LY = 25800;
const FEH_MEAN_SOLAR = -0.05; // Nordström et al. 2004
const FEH_SIGMA = 0.2; // dex
const FEH_RADIAL_GRADIENT = -0.06 / 3261.6; // dex/ly  (−0.06 dex/kpc, Luck & Lambert 2011)
const FEH_VERTICAL_GRADIENT = -0.3 / 3261.6; // dex/ly  (−0.30 dex/kpc, Schlesinger et al. 2014)
const CLASS_FEH_OFFSET = Object.freeze({
  O: +0.05,
  B: +0.04,
  A: +0.02,
  F: 0,
  G: 0,
  K: 0,
  M: 0,
  D: 0,
  LTY: -0.05,
  OTHER: 0,
});

// Per-class multiplicity fractions.
// Sources: Duchêne & Kraus (2013) for O/B/A/FGK/M; Raghavan et al. (2010) for FGK detail.
// White dwarf and brown dwarf rates from Tokovinin (2014) and Burgasser et al. (2007).
const MULTIPLICITY_BY_CLASS = Object.freeze({
  O: Object.freeze({ binary: 0.7, triple: 0.12, quadruple: 0.05 }),
  B: Object.freeze({ binary: 0.5, triple: 0.09, quadruple: 0.04 }),
  A: Object.freeze({ binary: 0.45, triple: 0.08, quadruple: 0.03 }),
  F: Object.freeze({ binary: 0.46, triple: 0.08, quadruple: 0.03 }),
  G: Object.freeze({ binary: 0.46, triple: 0.08, quadruple: 0.03 }),
  K: Object.freeze({ binary: 0.35, triple: 0.05, quadruple: 0.02 }),
  M: Object.freeze({ binary: 0.27, triple: 0.03, quadruple: 0.01 }),
  D: Object.freeze({ binary: 0.25, triple: 0.02, quadruple: 0.005 }),
  LTY: Object.freeze({ binary: 0.15, triple: 0.01, quadruple: 0.003 }),
  OTHER: Object.freeze({ binary: 0.2, triple: 0.02, quadruple: 0.01 }),
});

// Population fractions of all stellar-mass objects (must sum to 1.00).
// Based on solar-neighbourhood census: Reylé et al. (2021) and RECONS within 10 pc.
// MS 72% | WD 6% | BD 19% | Other 3%
const MS_TOTAL_FRACTION = 0.72;
const WD_FRACTION = 0.06;
const BD_FRACTION = 0.19;
const OTHER_FRACTION = 0.03;

export const LOCAL_CLUSTER_DEFAULTS = Object.freeze({
  galacticRadiusLy: 50000,
  locationLy: 25800,
  neighbourhoodRadiusLy: 10,
  stellarDensityPerLy3: 0.004, // updated from 0.003 — matches HIPPARCOS solar-neighbourhood estimate
  randomSeed: 1,
});

const MAIN_SEQUENCE_ROWS = Object.freeze([
  { label: "Main Sequence Stars", spectralClass: "O", fraction: 0.0000003 },
  { label: "Main Sequence Stars", spectralClass: "B", fraction: 0.0013 },
  { label: "Main Sequence Stars", spectralClass: "A", fraction: 0.006 },
  { label: "Main Sequence Stars", spectralClass: "F", fraction: 0.03 },
  { label: "Main Sequence Stars", spectralClass: "G", fraction: 0.076 },
  { label: "Main Sequence Stars", spectralClass: "K", fraction: 0.121 },
  { label: "Main Sequence Stars", spectralClass: "M", fraction: 0.7645 },
]);

function round0(n) {
  return Math.round(Number(n) || 0);
}

function floor0(n) {
  return Math.floor(Number(n) || 0);
}

function normalizeSeed(seed) {
  const n = Math.floor(toFinite(seed, LOCAL_CLUSTER_DEFAULTS.randomSeed));
  return clamp(n, 1, PM_MOD - 1);
}

/**
 * Clamps and sanitises raw local-cluster inputs into safe numeric ranges.
 *
 * @param {object} [raw={}] - Raw input object with optional overrides.
 * @param {number} [raw.galacticRadiusLy] - Galactic radius in light-years (1 000 – 1 000 000).
 * @param {number} [raw.locationLy] - Distance of the home system from galactic centre (0 – galacticRadiusLy).
 * @param {number} [raw.neighbourhoodRadiusLy] - Radius of the local neighbourhood sphere (0.1 – 25).
 * @param {number} [raw.stellarDensityPerLy3] - Stellar density in objects per cubic light-year (0.000001 – 0.1).
 * @param {number} [raw.randomSeed] - PRNG seed (clamped to 1 – 2^31-2).
 * @returns {{ galacticRadiusLy: number, locationLy: number, neighbourhoodRadiusLy: number, stellarDensityPerLy3: number, randomSeed: number }}
 *   Validated and clamped inputs.
 */
export function normalizeLocalClusterInputs(raw = {}) {
  const galacticRadiusLy = clamp(
    toFinite(raw.galacticRadiusLy, LOCAL_CLUSTER_DEFAULTS.galacticRadiusLy),
    1000,
    1000000,
  );
  const locationLy = clamp(
    toFinite(raw.locationLy, LOCAL_CLUSTER_DEFAULTS.locationLy),
    0,
    galacticRadiusLy,
  );
  const neighbourhoodRadiusLy = clamp(
    toFinite(raw.neighbourhoodRadiusLy, LOCAL_CLUSTER_DEFAULTS.neighbourhoodRadiusLy),
    0.1,
    25,
  );
  const stellarDensityPerLy3 = clamp(
    toFinite(raw.stellarDensityPerLy3, LOCAL_CLUSTER_DEFAULTS.stellarDensityPerLy3),
    0.000001,
    0.1,
  );
  const randomSeed = normalizeSeed(raw.randomSeed);

  return {
    galacticRadiusLy,
    locationLy,
    neighbourhoodRadiusLy,
    stellarDensityPerLy3,
    randomSeed,
  };
}

function parkMillerNext(state) {
  return (PM_MUL * state) % PM_MOD;
}

// Box-Muller transform: two uniform samples → one standard normal variate.
function boxMullerGaussian(u1, u2) {
  const safe = Math.max(1e-12, Math.min(1 - 1e-12, u1));
  return Math.sqrt(-2 * Math.log(safe)) * Math.cos(2 * Math.PI * u2);
}

function objectClassKeyFromSpectralClass(spectralClass) {
  const sc = String(spectralClass || "")
    .trim()
    .toUpperCase();
  if (sc === "L/T/Y" || sc === OBJECT_CLASS_BROWN) return OBJECT_CLASS_BROWN;
  if (["O", "B", "A", "F", "G", "K", "M", "D"].includes(sc)) return sc;
  return OBJECT_CLASS_OTHER;
}

function buildObjectClassWeights(stellarRows) {
  const entries = [];
  let total = 0;
  for (const row of stellarRows || []) {
    const count = Math.max(0, round0(row?.count));
    if (!(count > 0)) continue;
    const key = objectClassKeyFromSpectralClass(row?.objectClassKey ?? row?.spectralClass);
    total += count;
    entries.push({ key, cumulative: total });
  }
  return { entries, total };
}

function pickObjectClassKey(weights, u) {
  if (!(weights?.total > 0) || !Array.isArray(weights?.entries) || !weights.entries.length)
    return "G";
  const target = clamp(Number(u) || 0, 0, 1 - 1e-12) * weights.total;
  for (const entry of weights.entries) {
    if (target < entry.cumulative) return entry.key;
  }
  return weights.entries[weights.entries.length - 1].key;
}

// Returns a weight table filtered to stellar classes lighter-than-or-equal-to the primary.
// Ensures companions are never more massive than their host star (Duchêne & Kraus 2013).
function buildCompanionWeights(weights, primaryKey) {
  if (!weights || !Array.isArray(weights.entries) || !weights.entries.length) return weights;
  const primaryRank = SPECTRAL_RANK[primaryKey] ?? 9;
  const entries = [];
  let total = 0;
  let prevCumul = 0;
  for (const entry of weights.entries) {
    const count = entry.cumulative - prevCumul;
    prevCumul = entry.cumulative;
    const rank = SPECTRAL_RANK[entry.key] ?? 9;
    if (rank >= primaryRank) {
      total += count;
      entries.push({ key: entry.key, cumulative: total });
    }
  }
  if (entries.length === 0) {
    return { entries: [{ key: primaryKey, cumulative: 1 }], total: 1 };
  }
  return { entries, total };
}

// Computes mass-weighted multiplicity fractions from the neighbourhood's stellar composition.
// Uses per-class rates rather than a single global FGK-star value.
function calcWeightedMultiplicity(stellarRows) {
  let totalCount = 0;
  let wBinary = 0;
  let wTriple = 0;
  let wQuad = 0;
  for (const row of stellarRows || []) {
    const count = Math.max(0, row?.count || 0);
    if (!(count > 0)) continue;
    const key = objectClassKeyFromSpectralClass(row?.objectClassKey ?? row?.spectralClass);
    const fracs = MULTIPLICITY_BY_CLASS[key] ?? MULTIPLICITY_BY_CLASS.OTHER;
    totalCount += count;
    wBinary += count * fracs.binary;
    wTriple += count * fracs.triple;
    wQuad += count * fracs.quadruple;
  }
  if (!(totalCount > 0)) {
    return { binary: 0.27, triple: 0.03, quadruple: 0.01 };
  }
  return {
    binary: wBinary / totalCount,
    triple: wTriple / totalCount,
    quadruple: wQuad / totalCount,
  };
}

function buildMultiplicityBag(systemCounts, targetCount) {
  if (!(targetCount > 0) || !(systemCounts.total > 0)) {
    return Array.from({ length: targetCount }, () => "single");
  }
  const t = systemCounts.total;
  const nBinary = Math.round((targetCount * systemCounts.binary) / t);
  const nTriple = Math.round((targetCount * systemCounts.triple) / t);
  const nQuad = Math.round((targetCount * systemCounts.quadruple) / t);
  const nSingle = Math.max(0, targetCount - nBinary - nTriple - nQuad);
  const bag = [];
  for (let i = 0; i < nSingle; i++) bag.push("single");
  for (let i = 0; i < nBinary; i++) bag.push("binary");
  for (let i = 0; i < nTriple; i++) bag.push("triple");
  for (let i = 0; i < nQuad; i++) bag.push("quadruple");
  while (bag.length < targetCount) bag.push("single");
  return bag.slice(0, targetCount);
}

// Assigns multiplicity and a components array to each system.
// Uses a phase-offset PRNG sequence independent of coordinate/class sequences.
// Companions are drawn from a filtered weight table (no companion heavier than primary).
function assignMultiplicity(systems, systemCounts, weights, seed) {
  if (!Array.isArray(systems) || !systems.length) return systems;

  const bag = buildMultiplicityBag(systemCounts, systems.length);

  // Phase-offset: run PRNG 17 extra iterations from the seed so this sequence
  // does not overlap the class-assignment sequence.
  let state = normalizeSeed(seed);
  for (let i = 0; i < 17; i++) state = parkMillerNext(state);

  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    state = parkMillerNext(state);
    const j = Math.floor((state / PM_MOD) * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }

  // Assign multiplicity and draw companion classes.
  return systems.map((system, idx) => {
    const multiplicity = bag[idx] ?? "single";
    const componentCount = MULTIPLICITY_SIZES[multiplicity] ?? 1;
    const components = [{ objectClassKey: system.objectClassKey }];
    const companionWeights = buildCompanionWeights(weights, system.objectClassKey);
    for (let c = 1; c < componentCount; c++) {
      state = parkMillerNext(state);
      components.push({ objectClassKey: pickObjectClassKey(companionWeights, state / PM_MOD) });
    }
    return { ...system, multiplicity, components };
  });
}

// Assigns [Fe/H] metallicity to each system based on galactic position,
// spectral class, and Gaussian scatter.  Phase offset 37 avoids overlap
// with coordinate (0), class (1), and multiplicity (17) PRNG sequences.
function assignMetallicity(systems, locationLy, seed) {
  if (!Array.isArray(systems) || !systems.length) return systems;

  const radialOffset =
    (toFinite(locationLy, SOLAR_GALACTIC_RADIUS_LY) - SOLAR_GALACTIC_RADIUS_LY) *
    FEH_RADIAL_GRADIENT;
  const baseMean = FEH_MEAN_SOLAR + radialOffset;

  let state = normalizeSeed(seed);
  for (let i = 0; i < 37; i++) state = parkMillerNext(state);

  return systems.map((system) => {
    const verticalShift = Math.abs(system.z || 0) * FEH_VERTICAL_GRADIENT;
    const classShift = CLASS_FEH_OFFSET[system.objectClassKey] ?? 0;
    const mean = baseMean + verticalShift + classShift;

    state = parkMillerNext(state);
    const u1 = state / PM_MOD;
    state = parkMillerNext(state);
    const u2 = state / PM_MOD;
    const scatter = boxMullerGaussian(u1, u2) * FEH_SIGMA;

    return { ...system, metallicityFeH: clamp(mean + scatter, -3.0, 0.5) };
  });
}

function assignObjectClassesToSystems(systems, stellarRows, seed) {
  if (!Array.isArray(systems) || !systems.length) return [];
  const weights = buildObjectClassWeights(stellarRows);
  let state = parkMillerNext(normalizeSeed(seed));
  return systems.map((system) => {
    state = parkMillerNext(state);
    const key = pickObjectClassKey(weights, state / PM_MOD);
    return { ...system, objectClassKey: key };
  });
}

// Generates 3-D coordinates uniformly distributed inside a sphere.
// zScale < 1 flattens the z-axis to approximate galactic disk geometry for large radii.
function generateSystemCoordinates(count, radiusLy, seed, zScale = 1.0) {
  const neighbours = [];
  if (!(count > 0) || !(radiusLy > 0)) return neighbours;

  let state = parkMillerNext(seed);
  for (let i = 0; i < count; i++) {
    const e = parkMillerNext(state);
    const f = parkMillerNext(e);
    const g = parkMillerNext(f);

    const h = e / PM_MOD;
    const ii = f / PM_MOD;
    const j = g / PM_MOD;

    const distRaw = h ** (1 / 3) * radiusLy;
    const theta = ii * 2 * Math.PI;
    const phi = Math.acos(2 * j - 1);

    const x = distRaw * Math.sin(phi) * Math.cos(theta);
    const y = distRaw * Math.sin(phi) * Math.sin(theta);
    const z = distRaw * Math.cos(phi) * zScale;
    const distanceLy = Math.hypot(x, y, z);

    neighbours.push({
      id: `sys-${i + 1}`,
      name: `Star System ${i + 1}`,
      index: i + 1,
      isHome: false,
      x,
      y,
      z,
      distanceLy,
    });

    state = g;
  }
  return neighbours;
}

/**
 * Generates a full local stellar neighbourhood from the given parameters.
 *
 * Computes population counts by spectral class, places star systems in
 * 3-D space using a seeded Park-Miller PRNG, assigns spectral classes
 * and multiplicity, and evaluates Galactic Habitable Zone metrics.
 *
 * @param {object} [rawInputs={}] - Raw input overrides (see {@link normalizeLocalClusterInputs}).
 * @returns {{
 *   inputs: object,
 *   galacticHabitableZoneLy: { inner: number, outer: number },
 *   inHabitableZone: boolean,
 *   ghzProbability: number,
 *   neighbourhoodVolumeLy3: number,
 *   rawStellarMassObjects: number,
 *   stellarRows: Array<{ label: string, spectralClass: string, objectClassKey: string, count: number }>,
 *   mainSequenceTotal: number,
 *   whiteDwarfs: number,
 *   brownDwarfs: number,
 *   otherStellarMassObjects: number,
 *   totalStellarMassObjects: number,
 *   systemCounts: { single: number, binary: number, triple: number, quadruple: number, total: number },
 *   systemsOmitted: number,
 *   systems: Array<object>,
 *   nearestSystems: Array<object>,
 * }} Full neighbourhood result including star systems, coordinates, and statistics.
 */
export function calcLocalCluster(rawInputs = {}) {
  const inputs = normalizeLocalClusterInputs(rawInputs);

  const ghzInnerLy = round0(inputs.galacticRadiusLy * 0.47);
  const ghzOuterLy = round0(inputs.galacticRadiusLy * 0.6);
  const inHabitableZone = inputs.locationLy >= ghzInnerLy && inputs.locationLy <= ghzOuterLy;

  // GHZ probability: Gaussian centred at 53% of galactic radius, sigma = 10% × R.
  // Matches Lineweaver (2004) more closely than a hard annular band.
  const ghzPeak = 0.53 * inputs.galacticRadiusLy;
  const ghzSigma = 0.1 * inputs.galacticRadiusLy;
  const ghzProbability = Math.exp(-0.5 * ((inputs.locationLy - ghzPeak) / ghzSigma) ** 2);

  const neighbourhoodVolumeLy3 = (4 / 3) * Math.PI * inputs.neighbourhoodRadiusLy ** 3;
  const rawStellarMassObjects = inputs.stellarDensityPerLy3 * neighbourhoodVolumeLy3;

  // Class fractions now sum to 100% of rawStellarMassObjects (corrected from WS8's 140%).
  const stellarRows = [];
  let mainSequenceTotal = 0;
  for (const row of MAIN_SEQUENCE_ROWS) {
    const count = round0(rawStellarMassObjects * MS_TOTAL_FRACTION * row.fraction);
    mainSequenceTotal += count;
    stellarRows.push({
      label: row.label,
      spectralClass: row.spectralClass,
      objectClassKey: row.spectralClass,
      count,
    });
  }

  const whiteDwarfs = round0(rawStellarMassObjects * WD_FRACTION);
  const brownDwarfs = round0(rawStellarMassObjects * BD_FRACTION);
  const otherStellarMassObjects = floor0(rawStellarMassObjects * OTHER_FRACTION);

  stellarRows.push({
    label: "White Dwarfs",
    spectralClass: "D",
    objectClassKey: "D",
    count: whiteDwarfs,
  });
  stellarRows.push({
    label: "Brown Dwarfs",
    spectralClass: "L/T/Y",
    objectClassKey: OBJECT_CLASS_BROWN,
    count: brownDwarfs,
  });
  stellarRows.push({
    label: "Other Stellar Mass Objects",
    spectralClass: "-",
    objectClassKey: OBJECT_CLASS_OTHER,
    count: otherStellarMassObjects,
  });

  const totalStellarMassObjects = stellarRows.reduce((acc, row) => acc + row.count, 0);

  // Compute mass-weighted multiplicity fractions from the neighbourhood's stellar composition.
  // starsPerSystem = 1 + b + 2t + 3q (derived from the system-fraction identity).
  const mults = calcWeightedMultiplicity(stellarRows);
  const starsPerSystem = 1 + mults.binary + 2 * mults.triple + 3 * mults.quadruple;
  const binarySystems = round0((totalStellarMassObjects / starsPerSystem) * mults.binary);
  const tripleSystems = round0((totalStellarMassObjects / starsPerSystem) * mults.triple);
  const quadrupleSystems = round0((totalStellarMassObjects / starsPerSystem) * mults.quadruple);
  const singleSystems = Math.max(
    0,
    totalStellarMassObjects - (binarySystems * 2 + tripleSystems * 3 + quadrupleSystems * 4),
  );
  const totalStarSystems = singleSystems + binarySystems + tripleSystems + quadrupleSystems;

  const systemCounts = {
    single: singleSystems,
    binary: binarySystems,
    triple: tripleSystems,
    quadruple: quadrupleSystems,
    total: totalStarSystems,
  };

  const neighbourSystemCount = clamp(totalStarSystems - 1, 0, 750);
  const systemsOmitted = Math.max(0, totalStarSystems - 1 - neighbourSystemCount);

  // Flatten the z-axis for large neighbourhood radii to approximate galactic disk geometry.
  // Below 50 ly the sphere approximation is excellent; above that z is progressively compressed.
  // At 500 ly radius zScale ≈ 0.55; at 1050+ ly zScale floors at 0.15.
  const diskZScale =
    inputs.neighbourhoodRadiusLy > 50
      ? Math.max(0.15, 1 - (inputs.neighbourhoodRadiusLy - 50) / 1000)
      : 1.0;

  const weights = buildObjectClassWeights(stellarRows);
  const neighbours = assignMetallicity(
    assignMultiplicity(
      assignObjectClassesToSystems(
        generateSystemCoordinates(
          neighbourSystemCount,
          inputs.neighbourhoodRadiusLy,
          inputs.randomSeed,
          diskZScale,
        ),
        stellarRows,
        inputs.randomSeed,
      ),
      systemCounts,
      weights,
      inputs.randomSeed,
    ),
    inputs.locationLy,
    inputs.randomSeed,
  );

  const homeFeH = clamp(toFinite(rawInputs.homeMetallicityFeH, 0), -3, 1);
  const homeSystem = {
    id: "home",
    name: "Home Star System",
    index: 0,
    isHome: true,
    objectClassKey: "HOME",
    multiplicity: "single",
    components: [{ objectClassKey: "HOME" }],
    x: 0,
    y: 0,
    z: 0,
    distanceLy: 0,
    metallicityFeH: homeFeH,
  };

  const systems = [homeSystem, ...neighbours];
  const nearestSystems = [...neighbours].sort((a, b) => a.distanceLy - b.distanceLy);

  return {
    inputs,
    galacticHabitableZoneLy: { inner: ghzInnerLy, outer: ghzOuterLy },
    inHabitableZone,
    ghzProbability,
    neighbourhoodVolumeLy3,
    rawStellarMassObjects,
    stellarRows,
    mainSequenceTotal,
    whiteDwarfs,
    brownDwarfs,
    otherStellarMassObjects,
    totalStellarMassObjects,
    systemCounts,
    systemsOmitted,
    systems,
    nearestSystems,
  };
}
