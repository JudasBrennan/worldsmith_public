// Stellar activity engine — flare & CME simulation
//
// Models stellar flare frequency and energy using a power-law
// cumulative distribution calibrated to Kepler/TESS statistics,
// binned by spectral type (FGK / early-M / late-M) and stellar age.
// CME spawning uses energy-dependent base probability with
// activity-cycle rate limiting and high-N₃₂ suppression.
//
// Inputs:  effective temperature (K), age (Gyr), mass (Msun),
//          luminosity (Lsun), activity-cycle phase (0–1).
// Outputs: flare parameters (rate, power-law index), individual
//          flare events (energy, class, timing), CME decisions,
//          and cumulative rate estimates.
//
// Key references:
//   Günther et al. 2020 — TESS superflare occurrence rates
//   Lacy et al. 1976 — power-law flare energy distribution
//   Duchêne & Kraus 2013 — spectral-type activity scaling
//   Yashiro et al. 2006 — flare-CME association probability

import { clamp, toFinite } from "./utils.js";

export const FLARE_E0_ERG = 1e32;
export const FLARE_EMIN_ERG = 1e30;
export const FLARE_EMAX_ERG = 1e35;
export const FLARE_TOTAL_THRESHOLD_ERG = FLARE_EMIN_ERG;
export const FGK_CME_MIN_PER_DAY = 0.5;
export const FGK_CME_MAX_PER_DAY = 6.0;

const TEFF_BIN_FGK = "FGK";
const TEFF_BIN_EARLY_M = "earlyM";
const TEFF_BIN_LATE_M = "lateM";

const N32_TABLE = {
  [TEFF_BIN_FGK]: { old: 0.05, mid: 0.25, young: 1.0 },
  [TEFF_BIN_EARLY_M]: { old: 0.5, mid: 2.0, young: 8.0 },
  [TEFF_BIN_LATE_M]: { old: 2.0, mid: 8.0, young: 30.0 },
};

const ALPHA_TABLE = {
  [TEFF_BIN_FGK]: 1.8,
  [TEFF_BIN_EARLY_M]: 2.0,
  [TEFF_BIN_LATE_M]: 2.2,
};

const CME_PROBABILITY_BREAKS = [
  { maxEnergyErg: 1e32, probability: 0.005 },
  { maxEnergyErg: 1e33, probability: 0.12 },
  { maxEnergyErg: 1e34, probability: 0.4 },
  { maxEnergyErg: Infinity, probability: 0.75 },
];
const FLARE_CYCLE_MULTIPLIER_TABLE = {
  [TEFF_BIN_FGK]: { min: 0.35, max: 1.65 },
  [TEFF_BIN_EARLY_M]: { min: 0.6, max: 1.4 },
  [TEFF_BIN_LATE_M]: { min: 0.75, max: 1.25 },
};

const EPS = 1e-9;

function pickTeffBin(teffK) {
  const t = toFinite(teffK, 5776);
  if (t >= 3900) return TEFF_BIN_FGK;
  if (t >= 3200) return TEFF_BIN_EARLY_M;
  return TEFF_BIN_LATE_M;
}

function pickAgeBand(teffBin, ageGyr) {
  const age = toFinite(ageGyr, 4.6);
  if (teffBin === TEFF_BIN_FGK) {
    if (age < 0.5) return "young";
    if (age < 2.0) return "mid";
    return "old";
  }
  if (teffBin === TEFF_BIN_EARLY_M) {
    if (age < 1.0) return "young";
    if (age < 4.0) return "mid";
    return "old";
  }
  if (age < 2.0) return "young";
  if (age < 6.0) return "mid";
  return "old";
}

function uniform01(rngFn) {
  const raw = Number((typeof rngFn === "function" ? rngFn : Math.random)());
  const u = Number.isFinite(raw) ? raw : Math.random();
  return clamp(u, EPS, 1 - EPS);
}

function resolveActivityParams(params) {
  if (
    params &&
    typeof params === "object" &&
    params.activity &&
    typeof params.activity === "object"
  ) {
    return params.activity;
  }
  return params || {};
}

function intervalMassPowerLaw(alpha, lowErg, highErg, minErg, maxErg) {
  const lo = Math.max(minErg, toFinite(lowErg, minErg));
  const hi = Math.min(maxErg, toFinite(highErg, maxErg));
  if (!(hi > lo)) return 0;
  const normLo = Math.pow(minErg, -alpha);
  const normHi = Math.pow(maxErg, -alpha);
  const numLo = Math.pow(lo, -alpha);
  const numHi = Math.pow(hi, -alpha);
  const denom = normLo - normHi;
  if (!(denom > 0)) return 0;
  return clamp((numLo - numHi) / denom, 0, 1);
}

function meanCmeAssociationProbability(alpha, minErg, maxErg) {
  let sum = 0;
  let lo = minErg;
  for (const band of CME_PROBABILITY_BREAKS) {
    const hi = Math.min(maxErg, band.maxEnergyErg);
    if (hi > lo) {
      const mass = intervalMassPowerLaw(alpha, lo, hi, minErg, maxErg);
      sum += mass * band.probability;
      lo = hi;
    }
    if (lo >= maxErg) break;
  }
  return clamp(sum, 0, 1);
}

function cmeSuppressionFromN32(n32) {
  const n = Math.max(EPS, toFinite(n32, 0.05));
  return clamp(Math.pow(n / 5.0, -0.5), 0.2, 1.0);
}

function cmeSaturationFactor(recentCount24h, targetPerDay) {
  const recent = Math.max(0, toFinite(recentCount24h, 0));
  const target = Math.max(EPS, toFinite(targetPerDay, 1));
  if (recent <= target) return 1;
  const excess = (recent - target) / target;
  return clamp(1 / (1 + excess * excess * 1.2), 0.08, 1);
}

/**
 * Returns a cycle-dependent flare-rate multiplier by stellar regime.
 *
 * The midpoint (`activityCycle = 0.5`) is unity so legacy baseline N32
 * values remain unchanged at default phase.
 *
 * @param {string} teffBin - FGK / earlyM / lateM
 * @param {number} activityCycle - Cycle phase in [0, 1]
 * @returns {number} Multiplicative flare-rate factor
 */
export function flareCycleMultiplierFromCycle(teffBin, activityCycle) {
  const band = FLARE_CYCLE_MULTIPLIER_TABLE[teffBin] || FLARE_CYCLE_MULTIPLIER_TABLE[TEFF_BIN_FGK];
  const t = clamp(toFinite(activityCycle, 0.5), 0, 1);
  return band.min + (band.max - band.min) * t;
}

/**
 * Computes expected associated/background/total CME rates per day from
 * flare rates, flare-energy association probabilities, and cycle phase.
 *
 * @param {object} params - Activity parameter object (flat or nested)
 * @param {object} [opts={}] - Cycle/override options
 * @param {number} [opts.activityCycle=0.5] - Cycle phase in [0, 1]
 * @returns {{
 *   teffBin: string,
 *   activityCycle: number,
 *   meanAssociationProbability: number,
 *   suppression: number,
 *   associatedRawPerDay: number,
 *   associatedRatePerDay: number,
 *   backgroundRatePerDay: number,
 *   totalRatePerDay: number,
 *   fgkTargetPerDay: number|null
 * }}
 */
export function computeCmeRateModel(params, opts = {}) {
  const p = resolveActivityParams(params);
  const teffBin = String(p?.teffBin || TEFF_BIN_FGK);
  const activityCycle = clamp(toFinite(opts?.activityCycle, 0.5), 0, 1);
  const alpha = Math.max(0.1, toFinite(p?.alpha, 2.0));
  const eMin = Math.max(1, toFinite(p?.EminErg, FLARE_EMIN_ERG));
  const eMax = Math.max(eMin * 1.0001, toFinite(p?.EmaxErg, FLARE_EMAX_ERG));
  const totalFlareRatePerDay = Math.max(
    0,
    toFinite(
      p?.totalFlareRatePerDay ??
        p?.lambdaFlarePerDay ??
        expectedRateAboveEnergyPerDay(p, FLARE_TOTAL_THRESHOLD_ERG),
      0,
    ),
  );
  const n32 = Math.max(0, toFinite(p?.N32, 0));
  const activityNorm = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);
  const meanAssociationProbability = meanCmeAssociationProbability(alpha, eMin, eMax);
  const suppression = cmeSuppressionFromN32(n32);
  const associatedRawPerDay = totalFlareRatePerDay * meanAssociationProbability * suppression;

  const fgkTargetPerDay = teffBin === TEFF_BIN_FGK ? cmeTargetPerDayFromCycle(activityCycle) : null;
  const associatedRatePerDay =
    fgkTargetPerDay != null
      ? Math.min(fgkTargetPerDay, associatedRawPerDay)
      : Math.max(0, associatedRawPerDay);
  const backgroundRatePerDay =
    fgkTargetPerDay != null
      ? Math.max(0, fgkTargetPerDay - associatedRatePerDay)
      : associatedRatePerDay * (0.22 + 0.35 * activityNorm);
  const totalRatePerDay = associatedRatePerDay + backgroundRatePerDay;

  return {
    teffBin,
    activityCycle,
    meanAssociationProbability,
    suppression,
    associatedRawPerDay,
    associatedRatePerDay,
    backgroundRatePerDay,
    totalRatePerDay,
    fgkTargetPerDay,
  };
}

/**
 * Computes the structured stellar-activity model using flare-frequency
 * distributions and cycle-aware CME envelope assumptions.
 *
 * Returns a three-tier object (`inputs`, `activity`, `display`) for
 * style-guide alignment and UI-friendly output while keeping all values
 * numeric in the `activity` tier.
 *
 * @param {object} star - Star properties
 * @param {number} [star.teffK=5776] - Effective temperature in Kelvin
 * @param {number} [star.ageGyr=4.6] - Stellar age in Gyr
 * @param {number} [star.massMsun] - Stellar mass in solar masses
 * @param {number} [star.massMsol=1.0] - Stellar mass alias in solar masses
 * @param {number} [star.luminosityLsun] - Stellar luminosity in solar luminosities
 * @param {number} [star.luminosityLsol=1.0] - Stellar luminosity alias in solar luminosities
 * @param {object} [opts={}] - Optional model controls
 * @param {number} [opts.activityCycle=0.5] - Activity-cycle phase in [0, 1]
 * @returns {{
 *   inputs: {teffK: number, ageGyr: number, massMsun: number, luminosityLsun: number, activityCycle: number},
 *   activity: {
 *     teffBin: string, ageBand: string, N32: number, alpha: number,
 *     E0Erg: number, EminErg: number, EmaxErg: number,
 *     flareCycleMultiplier: number, energeticFlareRatePerDay: number,
 *     totalFlareRatePerDay: number, energeticFlareRecurrenceDays: number,
 *     totalFlareRecurrenceHours: number, lambdaFlarePerDay: number,
 *     cmeAssociatedRatePerDay: number, cmeBackgroundRatePerDay: number,
 *     cmeTotalRatePerDay: number, cmeTargetPerDay: number|null,
 *     cmeMeanAssociationProbability: number, cmeSuppression: number,
 *     cmeEnvelopeMinPerDay: number, cmeEnvelopeMaxPerDay: number
 *   },
 *   display: {
 *     activityRegime: string, energeticThresholdErg: string, totalThresholdErg: string,
 *     energeticFlareRatePerDay: string, totalFlareRatePerDay: string,
 *     energeticFlareRecurrenceDays: string, totalFlareRecurrenceHours: string,
 *     cmeAssociatedRatePerDay: string, cmeBackgroundRatePerDay: string,
 *     cmeTotalRatePerDay: string, cmeEnvelopeFgkPerDay: string
 *   }
 * }}
 */
export function computeStellarActivityModel(star, opts = {}) {
  const teffK = toFinite(star?.teffK, 5776);
  const ageGyr = Math.max(0, toFinite(star?.ageGyr, 4.6));
  const massMsun = toFinite(star?.massMsun ?? star?.massMsol, 1.0);
  const luminosityLsun = toFinite(star?.luminosityLsun ?? star?.luminosityLsol, 1.0);
  const activityCycle = clamp(toFinite(opts?.activityCycle, 0.5), 0, 1);

  const teffBin = pickTeffBin(teffK);
  const ageBand = pickAgeBand(teffBin, ageGyr);
  const N32 = N32_TABLE[teffBin][ageBand];
  const alpha = ALPHA_TABLE[teffBin];
  const flareCycleMultiplier = flareCycleMultiplierFromCycle(teffBin, activityCycle);
  const energeticFlareRatePerDay = N32 * flareCycleMultiplier;
  const totalFlareRatePerDay =
    energeticFlareRatePerDay * Math.pow(FLARE_TOTAL_THRESHOLD_ERG / FLARE_E0_ERG, -alpha);
  const energeticFlareRecurrenceDays =
    energeticFlareRatePerDay > 0 ? 1 / energeticFlareRatePerDay : Infinity;
  const totalFlareRecurrenceHours = totalFlareRatePerDay > 0 ? 24 / totalFlareRatePerDay : Infinity;
  const cme = computeCmeRateModel(
    {
      teffBin,
      N32,
      alpha,
      EminErg: FLARE_TOTAL_THRESHOLD_ERG,
      EmaxErg: FLARE_EMAX_ERG,
      totalFlareRatePerDay,
      energeticFlareRatePerDay,
    },
    { activityCycle },
  );

  const inputs = {
    teffK,
    ageGyr,
    massMsun,
    luminosityLsun,
    activityCycle,
  };

  const activity = {
    teffBin,
    ageBand,
    N32,
    alpha,
    E0Erg: FLARE_E0_ERG,
    EminErg: FLARE_TOTAL_THRESHOLD_ERG,
    EmaxErg: FLARE_EMAX_ERG,
    flareCycleMultiplier,
    energeticFlareRatePerDay,
    totalFlareRatePerDay,
    energeticFlareRecurrenceDays,
    totalFlareRecurrenceHours,
    // Backward-compat alias used by existing consumers/tests.
    lambdaFlarePerDay: totalFlareRatePerDay,
    cmeAssociatedRatePerDay: cme.associatedRatePerDay,
    cmeBackgroundRatePerDay: cme.backgroundRatePerDay,
    cmeTotalRatePerDay: cme.totalRatePerDay,
    cmeTargetPerDay: cme.fgkTargetPerDay,
    cmeMeanAssociationProbability: cme.meanAssociationProbability,
    cmeSuppression: cme.suppression,
    cmeEnvelopeMinPerDay: FGK_CME_MIN_PER_DAY,
    cmeEnvelopeMaxPerDay: FGK_CME_MAX_PER_DAY,
  };

  const display = {
    activityRegime: `${teffBin}/${ageBand}`,
    energeticThresholdErg: `${FLARE_E0_ERG}`,
    totalThresholdErg: `${FLARE_TOTAL_THRESHOLD_ERG}`,
    energeticFlareRatePerDay: `${energeticFlareRatePerDay}`,
    totalFlareRatePerDay: `${totalFlareRatePerDay}`,
    energeticFlareRecurrenceDays: Number.isFinite(energeticFlareRecurrenceDays)
      ? `${energeticFlareRecurrenceDays}`
      : "Infinity",
    totalFlareRecurrenceHours: Number.isFinite(totalFlareRecurrenceHours)
      ? `${totalFlareRecurrenceHours}`
      : "Infinity",
    cmeAssociatedRatePerDay: `${cme.associatedRatePerDay}`,
    cmeBackgroundRatePerDay: `${cme.backgroundRatePerDay}`,
    cmeTotalRatePerDay: `${cme.totalRatePerDay}`,
    cmeEnvelopeFgkPerDay: teffBin === TEFF_BIN_FGK ? "0.5 to 6.0/day" : "n/a",
  };

  return { inputs, activity, display };
}

/**
 * Creates a deterministic pseudo-random number generator from a seed
 * using a splitmix32-style hash. Produces values in [0, 1).
 *
 * @param {number|string} seed - Numeric or string seed value
 * @returns {function(): number} Stateful RNG function returning [0, 1)
 */
export function createSeededRng(seed) {
  let s = seedToUint32(seed);
  if (s === 0) s = 0x9e3779b9;

  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes flare frequency parameters for a star based on its
 * spectral type bin and age band. Returns the power-law index
 * (alpha), reference rate (N32), and total flare rate (lambda).
 *
 * @param {object} star - Star properties
 * @param {number} [star.teffK=5776] - Effective temperature in Kelvin
 * @param {number} [star.ageGyr=4.6] - Stellar age in Gyr
 * @param {number} [star.massMsun=1.0] - Mass in solar masses
 * @param {number} [star.luminosityLsun=1.0] - Luminosity in solar luminosities
 * @returns {object} Compatibility shape with flat activity fields plus
 *   `inputs`, `activity`, and `display` tiers.
 */
export function computeFlareParams(star) {
  const model = computeStellarActivityModel(star);
  const activity = model.activity;
  return {
    ...activity,
    // Legacy alias used by existing consumers/tests.
    star: { ...model.inputs },
    // New structured tiers (style-guide aligned).
    inputs: model.inputs,
    activity,
    display: model.display,
  };
}

/**
 * Classifies a flare by its total energy into one of five
 * categories: micro, small, medium, large, or super.
 *
 * @param {number} energyErg - Flare energy in ergs
 * @returns {"micro"|"small"|"medium"|"large"|"super"} Flare class
 */
export function flareClassFromEnergy(energyErg) {
  const e = toFinite(energyErg, FLARE_EMIN_ERG);
  if (e < 1e31) return "micro";
  if (e < 1e32) return "small";
  if (e < 1e33) return "medium";
  if (e < 1e34) return "large";
  return "super";
}

/**
 * Samples a single flare energy from the truncated power-law
 * distribution defined by params (Emin, Emax, alpha) using
 * inverse-CDF transform sampling.
 *
 * @param {object} params - Flare parameters from computeFlareParams
 * @param {number} [params.alpha=2.0] - Power-law index
 * @param {number} [params.EminErg] - Minimum energy bound (erg)
 * @param {number} [params.EmaxErg] - Maximum energy bound (erg)
 * @param {function} [rng=Math.random] - RNG function returning [0, 1)
 * @returns {number} Sampled flare energy in ergs
 */
export function sampleFlareEnergyErg(params, rng) {
  const p = resolveActivityParams(params);
  const alpha = Math.max(0.1, toFinite(p?.alpha, 2.0));
  const Emin = Math.max(1, toFinite(p?.EminErg, FLARE_EMIN_ERG));
  const Emax = Math.max(Emin * 1.0001, toFinite(p?.EmaxErg, FLARE_EMAX_ERG));
  const u = uniform01(rng);

  const lo = Math.pow(Emin, -alpha);
  const hi = Math.pow(Emax, -alpha);
  const x = lo - u * (lo - hi);
  return Math.pow(x, -1 / alpha);
}

/**
 * Schedules the next flare event using an exponential waiting-time
 * distribution (Poisson process) and samples its energy.
 *
 * @param {number} now - Current simulation time in seconds
 * @param {object} params - Flare parameters from computeFlareParams
 * @param {number} [params.lambdaFlarePerDay] - Mean flare rate (per day)
 * @param {function} [rng=Math.random] - RNG function returning [0, 1)
 * @returns {{timeSec: number, energyErg: number|null, flareClass: string}}
 */
export function scheduleNextFlare(now, params, rng) {
  const nowSec = toFinite(now, 0);
  const p = resolveActivityParams(params);
  const lambdaPerDay = Math.max(0, toFinite(p?.lambdaFlarePerDay, 0));
  const lambdaSec = lambdaPerDay / 86400;
  if (!(lambdaSec > 0)) {
    return { timeSec: Infinity, energyErg: null, flareClass: "micro" };
  }

  const u = uniform01(rng);
  const dt = -Math.log(1 - u) / lambdaSec;
  const energyErg = sampleFlareEnergyErg(params, rng);
  return {
    timeSec: nowSec + dt,
    energyErg,
    flareClass: flareClassFromEnergy(energyErg),
  };
}

/**
 * Schedules the next CME event from a Poisson process with the supplied
 * mean CME rate (per day).
 *
 * @param {number} now - Current simulation time in seconds
 * @param {number} ratePerDay - Mean CME rate per day
 * @param {function} [rng=Math.random] - RNG function returning [0, 1)
 * @returns {number} Absolute event time in seconds (or Infinity)
 */
export function scheduleNextCme(now, ratePerDay, rng) {
  const nowSec = toFinite(now, 0);
  const lambdaPerDay = Math.max(0, toFinite(ratePerDay, 0));
  const lambdaSec = lambdaPerDay / 86400;
  if (!(lambdaSec > 0)) return Infinity;
  const u = uniform01(rng);
  return nowSec + -Math.log(1 - u) / lambdaSec;
}

function baseCmeProbability(flareEnergyErg) {
  const e = toFinite(flareEnergyErg, 0);
  for (const band of CME_PROBABILITY_BREAKS) {
    if (e < band.maxEnergyErg) return band.probability;
  }
  return 0.5;
}

/**
 * Computes the target CME rate per day as a linear function of
 * the stellar activity cycle phase (0 = minimum, 1 = maximum).
 * Range: 0.5–6.0 CMEs/day.
 *
 * @param {number} activityCycle - Activity cycle phase in [0, 1]
 * @returns {number} Target CME rate per day
 */
export function cmeTargetPerDayFromCycle(activityCycle) {
  const t = clamp(toFinite(activityCycle, 0.5), 0, 1);
  return FGK_CME_MIN_PER_DAY + (FGK_CME_MAX_PER_DAY - FGK_CME_MIN_PER_DAY) * t;
}

/**
 * Probabilistically decides whether a flare triggers a coronal
 * mass ejection. Applies energy-dependent base probability,
 * high-N₃₂ suppression, and daily rate caps (cycle-aware for
 * FGK stars, hard cap of 20 for M dwarfs).
 *
 * @param {number} flareEnergy - Triggering flare energy in ergs
 * @param {object} params - Flare parameters from computeFlareParams
 * @param {number} recentCMECount24h - CMEs already spawned in last 24 h
 * @param {object} star - Star properties (used for teffK fallback)
 * @param {object} [opts={}] - Options
 * @param {number} [opts.activityCycle] - Activity cycle phase [0, 1]
 * @param {function} [opts.rng] - RNG function returning [0, 1)
 * @returns {boolean} True if a CME is spawned
 */
export function maybeSpawnCME(flareEnergy, params, recentCMECount24h, star, opts = {}) {
  const p = resolveActivityParams(params);
  const teffBin = String(p?.teffBin || pickTeffBin(star?.teffK));
  const recent = Math.max(0, toFinite(recentCMECount24h, 0));
  const n32 = Math.max(EPS, toFinite(p?.N32, 0.05));
  const suppression = cmeSuppressionFromN32(n32);
  const fgkTarget = teffBin === TEFF_BIN_FGK ? cmeTargetPerDayFromCycle(opts.activityCycle) : null;
  const fallbackTarget = Math.max(1.0, Math.min(20.0, toFinite(p?.cmeTotalRatePerDay, 6.0)));
  const target = fgkTarget ?? fallbackTarget;
  const saturation = cmeSaturationFactor(recent, target);
  const pCME = baseCmeProbability(flareEnergy) * suppression * saturation;

  const u = uniform01(opts.rng);
  return u < pCME;
}

/**
 * Computes the expected flare rate (per day) above a given energy
 * threshold using the cumulative power-law: N(>E) = N32 * (E/E0)^(-alpha).
 *
 * @param {object} params - Flare parameters from computeFlareParams
 * @param {number} [params.N32] - Reference rate at E0
 * @param {number} [params.alpha] - Power-law index
 * @param {number} thresholdEnergyErg - Energy threshold in ergs
 * @returns {number} Expected flare rate per day above threshold
 */
export function expectedRateAboveEnergyPerDay(params, thresholdEnergyErg) {
  const p = resolveActivityParams(params);
  const e = Math.max(1, toFinite(thresholdEnergyErg, FLARE_E0_ERG));
  const n32 = Math.max(0, toFinite(p?.N32, 0));
  const alpha = Math.max(0.1, toFinite(p?.alpha, 2.0));
  return n32 * Math.pow(e / FLARE_E0_ERG, -alpha);
}

function seedToUint32(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed ?? "");
  if (!s) return 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
