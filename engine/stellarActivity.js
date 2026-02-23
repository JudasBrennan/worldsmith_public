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
 * @returns {{teffBin: string, ageBand: string, N32: number, alpha: number,
 *   E0Erg: number, EminErg: number, EmaxErg: number,
 *   lambdaFlarePerDay: number, star: object}}
 */
export function computeFlareParams(star) {
  const teffK = toFinite(star?.teffK, 5776);
  const ageGyr = Math.max(0, toFinite(star?.ageGyr, 4.6));
  const massMsun = toFinite(star?.massMsun ?? star?.massMsol, 1.0);
  const luminosityLsun = toFinite(star?.luminosityLsun ?? star?.luminosityLsol, 1.0);

  const teffBin = pickTeffBin(teffK);
  const ageBand = pickAgeBand(teffBin, ageGyr);
  const N32 = N32_TABLE[teffBin][ageBand];
  const alpha = ALPHA_TABLE[teffBin];

  // N(>Emin) = N32 * (Emin/E0)^(-alpha)
  const lambdaFlarePerDay = N32 * Math.pow(FLARE_EMIN_ERG / FLARE_E0_ERG, -alpha);

  return {
    teffBin,
    ageBand,
    N32,
    alpha,
    E0Erg: FLARE_E0_ERG,
    EminErg: FLARE_EMIN_ERG,
    EmaxErg: FLARE_EMAX_ERG,
    lambdaFlarePerDay,
    star: { teffK, ageGyr, massMsun, luminosityLsun },
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
  const alpha = Math.max(0.1, toFinite(params?.alpha, 2.0));
  const Emin = Math.max(1, toFinite(params?.EminErg, FLARE_EMIN_ERG));
  const Emax = Math.max(Emin * 1.0001, toFinite(params?.EmaxErg, FLARE_EMAX_ERG));
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
  const lambdaPerDay = Math.max(0, toFinite(params?.lambdaFlarePerDay, 0));
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

function baseCmeProbability(flareEnergyErg) {
  const e = toFinite(flareEnergyErg, 0);
  if (e < 1e32) return 0.02;
  if (e < 1e33) return 0.1;
  if (e < 1e34) return 0.3;
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
  return 0.5 + (6.0 - 0.5) * t;
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
  const teffBin = String(params?.teffBin || pickTeffBin(star?.teffK));
  const recent = Math.max(0, toFinite(recentCMECount24h, 0));
  const n32 = Math.max(EPS, toFinite(params?.N32, 0.05));
  const suppression = clamp(Math.pow(n32 / 5.0, -0.5), 0.2, 1.0);
  const pCME = baseCmeProbability(flareEnergy) * suppression;

  if (teffBin === TEFF_BIN_FGK) {
    const target = cmeTargetPerDayFromCycle(opts.activityCycle);
    if (recent >= target) return false;
  } else if (recent >= 20) {
    return false;
  }

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
  const e = Math.max(1, toFinite(thresholdEnergyErg, FLARE_E0_ERG));
  const n32 = Math.max(0, toFinite(params?.N32, 0));
  const alpha = Math.max(0.1, toFinite(params?.alpha, 2.0));
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
