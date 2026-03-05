// Planet model (spreadsheet-faithful port)
//
// Derives physical, orbital, thermal, and atmospheric properties for a
// terrestrial planet from user inputs plus host-star parameters.  Implements
// the PLANET sheet and the temperature / atmosphere sections of the
// Calculations sheet as closely as possible.
//
// Methodology:
//   - Density from mass + core-mass fraction (CMF) via empirical power-law
//     with a floor for sub-Earth masses (< 0.6 M⊕).
//   - Radius, surface gravity, and escape velocity from density + mass.
//   - Surface temperature via a Stefan-Boltzmann effective-temperature chain
//     with greenhouse and surface-divisor corrections.
//   - Atmospheric partial pressures, mean molecular weight, and density from
//     an N₂/O₂/CO₂/Ar gas mix at a given surface pressure.
//   - Circulation cell count keyed to rotation period.
//   - Sky colours from a PanoptesV-inspired lookup table interpolated over
//     star temperature and effective surface pressure (adjusted for
//     gravity/temperature column-density), with CO₂ tint correction.
//     Interpolation uses OKLab colour space for perceptual uniformity.
//
// Inputs:  starMassMsol, starAgeGyr, and a planet object containing mass,
//          CMF, axial tilt, albedo, greenhouse effect, observer height,
//          rotation period, orbital elements, surface pressure, and gas
//          mix percentages.
// Outputs: { star, inputs, derived, display } — clamped inputs echoed back,
//          numeric derived values for downstream use, and pre-formatted
//          display strings for the UI.

import { clamp, eccentricityFactor, fmt, k2LoveNumber, spinOrbitResonance } from "./utils.js";
import { calcStar } from "./star.js";
import { findNearestResonance } from "./debrisDisk.js";

const PI = Math.PI;

// Constants used by the model (from the reference):
const STAR_MASS_TO_KG = 1.989e30;

const EARTH_RADIUS_KM = 6371;
const EARTH_DENSITY_GCM3 = 5.51; // Earth mean bulk density (g/cm³)
const DAYS_PER_YEAR = 365.256; // Julian year (IAU)

const VELOCITY_EARTH_KMS = 11.186;
const GRAVITY_EARTH_MS2 = 9.81;

// Tidal-lock model constants (same formulation as moon.js)
const G = 6.67e-11;
const M_PER_AU_PLANET = 149600000000;
const KG_PER_MEARTH = 5.972e24;
const KG_PER_MMOON = 7.342e22;
const SECONDS_TO_GYR = 3.171e-17;

// Earth's total internal heat output (~44 TW), used to normalise moon tidal
// heating on the planet.  Scales linearly with mass for other bodies.
const EARTH_INTERNAL_HEAT_W = 44e12;

// Present-day fractional contribution of each isotope to Earth's radiogenic heat.
export const ISOTOPE_HEAT_FRACTIONS = { u238: 0.39, u235: 0.04, th232: 0.4, k40: 0.17 };

// Atmospheric thermal-tide calibration constant.
// Dimensionless ratio b_atm = C_ATM_TIDE × P_s × S / (g × T_eq),
// calibrated so Venus (92 atm, S≈1.9, g≈8.8, T_eq≈229 K) gives b > 1.
// When b ≥ 1 the atmospheric torque prevents tidal synchronisation.
// Reference: Leconte et al. (2015), Ingersoll & Dobrovolskis (1978).
const C_ATM_TIDE = 12;

// Surface sublimation temperatures (K) at low pressures (~10⁻⁵ atm).
// Distinct from nebular condensation temperatures in debrisDisk.js.
// Reference: Fray & Schmitt (2009, PSS 57, 2053).
const SUBLIMATION_TABLE = [
  { species: "N\u2082", tempK: 63, label: "nitrogen" },
  { species: "CO", tempK: 68, label: "carbon monoxide" },
  { species: "CH\u2084", tempK: 91, label: "methane" },
  { species: "H\u2082O", tempK: 170, label: "water ice" },
  { species: "CO\u2082", tempK: 195, label: "carbon dioxide" },
];

// --- Composition-dependent rigidity and quality factor ---
// Replaces the old fixed TIDAL_RIGIDITY (30 GPa) and Q_ROCKY (13).
// Iron-rich cores are stiffer; water layers reduce effective rigidity.
// Reference values: silicate rock ~30 GPa, iron ~80 GPa, ice ~3.5 GPa.
function planetRigidity(cmf, wmf) {
  const rockBase = 30e9; // Pa — silicate rock (Earth-like baseline)
  const ironBoost = 50e9 * Math.max(0, cmf - 0.33); // extra stiffness above Earth CMF
  const rigidityRock = rockBase + ironBoost;
  if (wmf <= 0) return rigidityRock;
  const waterRigidity = 3.5e9; // Pa — high-pressure ice
  return rigidityRock * (1 - wmf) + waterRigidity * wmf;
}

function planetQualityFactor(cmf, wmf) {
  const baseQ = 12 + 70 * Math.max(0, cmf - 0.2); // 12 (low CMF) to ~47 (Mercury)
  if (wmf <= 0) return baseQ;
  return baseQ * (1 - wmf) + 7 * wmf; // ice/water Q ≈ 5–10
}

// --- Atmospheric tide resistance ---
// Ratio of atmospheric thermal-tide torque to gravitational body-tide torque.
// b ≥ 1 → atmosphere prevents tidal synchronisation (e.g. Venus).
function atmosphereTideRatio(pressureAtm, insolationEarth, gravityMs2, tEqK) {
  if (pressureAtm <= 0 || tEqK <= 0 || gravityMs2 <= 0) return 0;
  return (C_ATM_TIDE * pressureAtm * insolationEarth) / (gravityMs2 * tEqK);
}

// spinOrbitResonance(eccentricity) — imported from utils.js

// --- Moon tidal heating on the planet ---

// Peale et al. (1979) tidal heating formula applied to the planet.
// Uses the planet's k₂ and Q (the planet is the body being heated),
// and the moon's mass as the perturber.
function planetTidalHeatingFromMoon(
  k2Planet,
  qualityFactor,
  radiusM,
  moonMassKg,
  semiMajorAxisM,
  orbitalPeriodS,
  ecc,
) {
  if (semiMajorAxisM <= 0 || orbitalPeriodS <= 0 || ecc <= 0) return 0;
  const n = (2 * PI) / orbitalPeriodS; // mean motion (rad/s)
  return (
    (21 / 2) * // Peale, Cassen & Reynolds (1979) tidal dissipation coefficient
    (k2Planet / qualityFactor) *
    ((G * moonMassKg ** 2 * radiusM ** 5 * n) / semiMajorAxisM ** 6) *
    eccentricityFactor(ecc)
  );
}

// Sum tidal heating on the planet from all assigned moons.
function totalPlanetTidalHeating(moons, k2Planet, qualityFactor, mPlanetKg, radiusM) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const m of moons) {
    const moonMassKg = (Number(m.massMoon) || 0) * KG_PER_MMOON;
    const aM = (Number(m.semiMajorAxisKm) || 0) * 1000;
    const ecc = Number(m.eccentricity) || 0;
    if (moonMassKg <= 0 || aM <= 0) continue;
    // Kepler's 3rd law: P = 2π √(a³ / (G × M_planet))
    const orbitalPeriodS = 2 * PI * Math.sqrt(aM ** 3 / (G * mPlanetKg));
    total += planetTidalHeatingFromMoon(
      k2Planet,
      qualityFactor,
      radiusM,
      moonMassKg,
      aM,
      orbitalPeriodS,
      ecc,
    );
  }
  return total;
}

// --- Composition classification ---
// Derived from CMF and WMF, used for display labels.
function compositionClass(cmf, wmf) {
  if (wmf > 0.1) return "Ice world";
  if (wmf > 0.001) return "Ocean world";
  if (cmf > 0.6) return "Iron world";
  if (cmf > 0.45) return "Mercury-like";
  if (cmf >= 0.25) return "Earth-like";
  if (cmf >= 0.1) return "Mars-like";
  return "Coreless";
}

function waterRegime(wmf) {
  if (wmf < 0.0001) return "Dry";
  if (wmf < 0.001) return "Shallow oceans";
  if (wmf < 0.01) return "Extensive oceans";
  if (wmf < 0.1) return "Global ocean";
  if (wmf < 0.3) return "Deep ocean";
  return "Ice world";
}

// --- Body classification ---
// Mass-based: bodies below 0.01 M⊕ are dwarf planets.
// Mercury (0.055 M⊕) is a planet; Eris (0.0028 M⊕) is a dwarf planet.
function bodyClass(massEarth) {
  return massEarth < 0.01 ? "Dwarf planet" : "Planet";
}

// --- Climate state classification ---
// Flags extreme climate regimes using absorbed flux and surface temperature.
// Reference: Goldblatt et al. (2013, Nature Geoscience 6, 661);
//            Kasting (1988, Icarus 74, 472); Budyko (1969).
function classifyClimateState(surfaceTempK, absorbedFluxWm2, hasWater) {
  if (!hasWater) return "Stable";
  if (absorbedFluxWm2 > 282) return "Runaway greenhouse";
  if (surfaceTempK > 340) return "Moist greenhouse";
  if (surfaceTempK < 240) return "Snowball";
  return "Stable";
}

// --- Volatile sublimation analysis (dwarf planets / icy bodies) ---
// Compares periapsis and apoapsis equilibrium temperatures against
// sublimation thresholds to flag transient or persistent atmospheres.
function analyseVolatiles(tEqPeriK, tEqApoK) {
  return SUBLIMATION_TABLE.map(({ species, tempK, label }) => {
    const periAbove = tEqPeriK >= tempK;
    const apoAbove = tEqApoK >= tempK;
    let note;
    if (!periAbove) {
      note = `${species} ice stable`;
    } else if (!apoAbove) {
      note = `Transient ${label} atmosphere near periapsis`;
    } else {
      note = `${label} sublimation throughout orbit`;
    }
    return {
      species,
      tempK,
      canSublimate: periAbove,
      transient: periAbove && !apoAbove,
      persistent: periAbove && apoAbove,
      note,
    };
  });
}

// --- Zeng+Sasselov (2016) water-layer radius correction ---
// For WMF=0, output is identical to the existing dry formula.
// For WMF>0, the dry radius is inflated by interpolation between
// the Zeng Earth-like dry curve and the 50%-water curve:
//   R_dry_zeng  = 1.00 × M^0.270   (CMF ~0.33 pure rock)
//   R_50_water  = 1.38 × M^0.263   (50% water + 50% Earth-like rock)
// Reference: Zeng & Sasselov (2016), ApJ 819, 127
function waterRadiusInflation(massEarth, wmf) {
  if (wmf <= 0) return 1.0; // no correction
  const rDryZeng = 1.0 * massEarth ** 0.27;
  const r50Zeng = 1.38 * massEarth ** 0.263;
  const inflation = (r50Zeng / rDryZeng - 1) * Math.min(wmf / 0.5, 1);
  return 1 + inflation;
}

// --- Suggested CMF from stellar metallicity ---
// ~75% of rocky planets have CMF consistent with their host star
// (Schulze et al. 2021, PSJ 2, 113).
// [Fe/H] → Fe/Mg → CMF via molar mass balance.
// Solar: Fe/Mg ≈ 0.83, Si/Mg ≈ 0.95 → CMF ≈ 0.33 (Earth-like).
const MU_FE = 55.85; // g/mol
const MU_MG = 24.31;
const MU_SI = 28.09;
const MU_O = 16.0;
const SOLAR_FE_MG = 0.83; // solar Fe/Mg number ratio
const SOLAR_SI_MG = 0.95; // solar Si/Mg number ratio

function suggestedCmfFromMetallicity(feH) {
  // [Fe/H] scales the solar Fe/Mg ratio
  const feMg = SOLAR_FE_MG * 10 ** feH;
  const siMg = SOLAR_SI_MG; // Si/Mg is roughly constant across FGK stars
  // Mantle mass per Mg atom: MgO + SiO₂
  const muMantle = MU_MG + MU_O + siMg * (MU_SI + 2 * MU_O);
  return (feMg * MU_FE) / (feMg * MU_FE + muMantle);
}

// --- Magnetic field model ---
// Simplified Olson & Christensen (2006, EPSL 250, 561) scaling
// normalised to Earth = 1.  Uses CMF, mass, radius, density,
// rotation period, and star age.
//
// The model estimates:
//   1. Whether a dynamo is active (core size + cooling timescale)
//   2. Surface dipole field strength (geometry + heat flux + convection)
//   3. Field morphology (dipolar vs multipolar from rotation rate)
//   4. Rotation efficiency penalty (slow rotation weakens dynamo generation)
// --- Internal helper: raw (un-normalised) dynamo field strength ---
// Olson & Christensen (2006) scaling:
//   B_surface ∝ ρ_core^(1/2) × (r_core / R_planet)³ × M^(1/3) × convBoost
// Core density from mass conservation in a two-layer model:
//   ρ_core = CMF × ρ_bulk / CRF³
function rawFieldStrength(cmf, densityGcm3, radiusEarth, massEarth, convBoost) {
  const crf = Math.sqrt(cmf); // Zeng & Jacobsen (2017)
  const coreDensity = (cmf * densityGcm3) / Math.max(crf ** 3, 1e-12);
  const densityFactor = Math.sqrt(coreDensity);
  const geometryFactor = crf ** 3; // (r_core/R_planet)³
  const heatFactor = massEarth ** (1 / 3);
  return densityFactor * geometryFactor * heatFactor * convBoost;
}

// Earth reference parameters for self-normalisation.
// Earth: CMF 0.33, ρ 5.514 g/cm³, R 1.0 R⊕, M 1.0 M⊕, age 4.6 Gyr.
const EARTH_CMF = 0.33;
const EARTH_DENSITY = 5.514;
const EARTH_TAU_CORE = 2 + 12 * EARTH_CMF * Math.sqrt(1.0); // ~5.96 Gyr
const EARTH_SOLID_FRAC = Math.max(0, Math.min(1, 4.6 / EARTH_TAU_CORE));
// Three-phase convective boost:
//   sf < 0.5:  ramp — thermal convection, inner core just forming
//   0.5–0.85:  plateau — peak compositional convection from inner core growth
//   > 0.85:    thin-shell suppression — liquid shell narrows, dynamo weakens
function coreConvBoost(sf) {
  if (sf < 0.5) return 1 + 0.4 * sf; // ramp: thermal convection onset
  if (sf < 0.85) return 1.2; // plateau: peak compositional convection
  const x = (sf - 0.85) / 0.15; // 0 at threshold, 1 at sf=1
  return 1.2 * Math.exp(-2.5 * x); // thin-shell suppression decay rate
}
const EARTH_CONV_BOOST = coreConvBoost(EARTH_SOLID_FRAC);
const EARTH_RAW_FIELD = rawFieldStrength(EARTH_CMF, EARTH_DENSITY, 1.0, 1.0, EARTH_CONV_BOOST);

function magneticFieldModel({
  cmf,
  massEarth,
  radiusEarth,
  densityGcm3,
  rotationPeriodHours,
  ageGyr,
  tidalFraction = 0,
  radioisotopeAbundance = 1,
}) {
  const none = {
    dynamoActive: false,
    dynamoReason: "",
    coreState: "solidified",
    fieldMorphology: "none",
    surfaceFieldEarths: 0,
    fieldLabel: "None",
  };

  // No significant core → no dynamo
  if (cmf < 0.01) {
    return { ...none, dynamoReason: "No significant iron core (CMF < 1%)" };
  }

  // Core solidification timescale (Gyr) — empirical fit calibrated to
  // reproduce Earth (liquid outer core at 4.6 Gyr) and Mars (solidified).
  // √M scaling approximates volume-to-surface-area cooling ratio.
  // Moon tidal heating extends core lifetime by offsetting radiative cooling.
  const tauCoreBase = (2 + 12 * cmf * Math.sqrt(massEarth)) * Math.max(radioisotopeAbundance, 0.01);
  const tauCore = tidalFraction >= 1 ? Infinity : tauCoreBase / Math.max(0.01, 1 - tidalFraction);

  // Core state
  const tidallySustained = tidalFraction > 0.1;
  let coreState;
  if (ageGyr > tauCore * 1.5) {
    return {
      ...none,
      coreState: "solidified",
      dynamoReason: `Core fully solidified (~${fmt(tauCoreBase, 1)} Gyr base lifetime)`,
    };
  } else if (ageGyr > tauCore * 0.3) {
    coreState = "partially solidified";
  } else {
    coreState = "fully liquid";
  }

  // Solidification effects on dynamo efficiency:
  // Phase 1 (sf < 0.5): inner core forming, compositional convection ramping
  // Phase 2 (sf 0.5–0.85): peak compositional convection from inner core growth
  // Phase 3 (sf > 0.85): liquid shell thinning, dynamo efficiency drops sharply
  // Mercury (sf≈1.0) has a paper-thin shell → very weak dynamo.
  const solidFrac = Math.max(0, Math.min(1, ageGyr / tauCore));
  const convBoost = coreConvBoost(solidFrac);

  // Self-normalised field strength: same formula for planet and Earth
  // reference, so Earth inputs → exactly 1.0.
  let surfaceFieldEarths = rawFieldStrength(cmf, densityGcm3, radiusEarth, massEarth, convBoost);
  surfaceFieldEarths /= EARTH_RAW_FIELD;

  // Dipolar / multipolar transition (Christensen & Aubert 2006).
  // In the dipolar regime, field strength is rotation-independent —
  // it is set by the energy budget (buoyancy flux), not rotation rate.
  // Rotation only controls whether the field organises as a dipole
  // (Ro_l < 0.12) or breaks into multipolar geometry.
  // Proxy: P_rot threshold scaled by core size and mass.
  // Earth (24h) is well inside the dipolar regime.
  const dipolarLimit = 96 * Math.sqrt(massEarth) * Math.sqrt(cmf / 0.33); // hours — Ro_l < 0.12 dipolar threshold (Christensen & Aubert 2006)
  // Rm cutoff: larger cores sustain convection at slower rotation.
  // 50× base ensures Mercury (P=1408h, CMF=70%) keeps its weak dynamo
  // while Venus (P=5832h, CMF=32%) correctly shows no field.
  const multipolarLimit = dipolarLimit * 50; // Rm below critical threshold
  const isDipolar = rotationPeriodHours <= dipolarLimit;

  if (rotationPeriodHours > multipolarLimit) {
    // Magnetic Reynolds number too low — no dynamo possible
    return {
      ...none,
      coreState,
      dynamoReason: "Rotation too slow to sustain dynamo (Rm below critical)",
    };
  }

  if (!isDipolar) {
    // Multipolar: dipole moment reduced by ~10× (Olson & Christensen 2006).
    // Smooth sigmoid transition across a factor-of-2 range around the limit
    // to avoid a discontinuous cliff.
    const x = Math.log2(rotationPeriodHours / dipolarLimit); // 0 at limit, 1 at 2× limit
    const blend = 1 / (1 + Math.exp(-6 * (x - 0.5))); // sigmoid centred at 0.5
    const multipolarFactor = 0.1; // literature: ~10× reduction
    surfaceFieldEarths *= 1 - blend * (1 - multipolarFactor);
  }

  // Clamp to reasonable range
  surfaceFieldEarths = Math.max(0, surfaceFieldEarths);

  // Practical threshold — fields below ~0.5% of Earth's are too weak to
  // sustain a measurable large-scale dynamo (e.g. Venus).
  if (surfaceFieldEarths < 0.005) {
    return {
      ...none,
      coreState,
      dynamoReason: "Field too weak to sustain measurable dynamo",
    };
  }

  let fieldLabel;
  if (surfaceFieldEarths > 2.0) fieldLabel = "Very strong";
  else if (surfaceFieldEarths > 0.5) fieldLabel = "Strong";
  else if (surfaceFieldEarths > 0.1) fieldLabel = "Moderate";
  else if (surfaceFieldEarths > 0.01) fieldLabel = "Weak";
  else fieldLabel = "Very weak";

  return {
    dynamoActive: true,
    dynamoReason: tidallySustained
      ? `Active dynamo (core ${coreState}, tidally sustained)`
      : `Active dynamo (core ${coreState}, ~${fmt(tauCore, 1)} Gyr lifetime)`,
    coreState,
    fieldMorphology: isDipolar ? "dipolar" : "multipolar",
    surfaceFieldEarths,
    fieldLabel,
  };
}

// --- Mantle outgassing model ---
// Ortenzi et al. (2020, Sci. Rep. 10, 10907): mantle redox state
// controls whether outgassing is CO₂+H₂O (oxidised) or H₂+CO (reduced).
const MANTLE_OXIDATION_MAP = {
  "highly-reduced": { deltaIW: -4, primarySpecies: "H\u2082 + CO", label: "Highly reduced" },
  reduced: {
    deltaIW: -2,
    primarySpecies: "H\u2082 + CO\u2082 (mixed)",
    label: "Moderately reduced",
  },
  earth: { deltaIW: 1, primarySpecies: "CO\u2082 + H\u2082O", label: "Earth-like" },
  oxidized: { deltaIW: 3, primarySpecies: "CO\u2082 + H\u2082O + SO\u2082", label: "Oxidized" },
};

function mantleOutgassing(oxidationState) {
  const entry = MANTLE_OXIDATION_MAP[oxidationState] || MANTLE_OXIDATION_MAP.earth;
  let hint;
  if (entry.deltaIW <= -3) {
    // ΔIW ≤ −3: strongly reducing (e.g. enstatite chondrite mantle)
    hint =
      "Reducing mantle produces H\u2082-rich atmospheres with low molecular weight and large scale height.";
  } else if (entry.deltaIW <= -1) {
    // ΔIW −3 to −1: moderately reducing
    hint = "Moderately reducing mantle produces a mix of H\u2082, CO, and CO\u2082.";
  } else if (entry.deltaIW <= 2) {
    // ΔIW −1 to +2: Earth-like oxidizing (IW+1 to IW+3 range)
    hint =
      "Oxidizing mantle produces CO\u2082 and H\u2082O, creating denser, opaque atmospheres typical of Earth/Venus.";
  } else {
    hint =
      "Highly oxidized mantle produces CO\u2082, H\u2082O, and volcanic SO\u2082 (e.g. early Venus).";
  }
  return {
    primarySpecies: entry.primarySpecies,
    oxidationLabel: entry.label,
    atmosphereHint: hint,
  };
}

// --- Tectonic regime advisory ---
// Science is genuinely unsettled (Valencia 2007 vs O'Neill 2007 vs
// Noack & Breuer 2014).  We provide hints, not calculations.
function tectonicAdvisory(massEarth, ageGyr, wmf, tidalFraction = 0) {
  const tidalNote =
    tidalFraction >= 5
      ? " Extreme moon tidal heating \u2014 expect global resurfacing and intense volcanism (Io-like)."
      : tidalFraction >= 1
        ? " Strong moon tidal heating \u2014 enhanced volcanism and possible resurfacing events."
        : tidalFraction >= 0.1
          ? " Moderate moon tidal heating \u2014 elevated volcanic activity likely."
          : "";
  if (massEarth < 0.3)
    return "Low mass \u2014 likely stagnant lid (insufficient mantle convection)." + tidalNote;
  if (wmf > 0.1)
    return (
      "Water-dominated \u2014 tectonic regime uncertain; thick ice shell may inhibit surface tectonics." +
      tidalNote
    );
  if (massEarth > 5 && ageGyr > 8)
    return (
      "Massive and old \u2014 stagnant lid likely (thick lithosphere suppresses subduction)." +
      tidalNote
    );
  if (massEarth > 3 && ageGyr > 6)
    return "Higher mass and age favour stagnant or episodic lid." + tidalNote;
  if (wmf > 0.001 && massEarth >= 0.5 && massEarth <= 3)
    return (
      "Earth-like mass range with surface water \u2014 mobile lid (plate tectonics) is plausible." +
      tidalNote
    );
  if (massEarth >= 0.5 && massEarth <= 3)
    return (
      "Earth-like mass range \u2014 plate tectonics possible if water is present to weaken the lithosphere." +
      tidalNote
    );
  return "Tectonic regime depends on mantle temperature, water content, and age." + tidalNote;
}

// --- Tectonic regime probability distribution ---
// Estimates probability of each tectonic regime from planetary parameters.
// Uses smooth Gaussian preference curves per regime, multiplied across five
// physical factors and normalised.  Science is genuinely unsettled; this
// gives informed priors, not certainties.
//
// References:
//   Valencia, D. et al. (2007) ApJL 670, L45
//   O'Neill, C. & Lenardic, A. (2007) GRL 34
//   Noack, L. & Breuer, D. (2014) P&SS 98
//   Korenaga, J. (2010) ApJL 725, L43

const REGIMES = ["stagnant", "mobile", "episodic", "plutonicSquishy"];

function gauss(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

/**
 * Compute probability distribution over tectonic regimes.
 * @param {number} massEarth - Planet mass in Earth masses
 * @param {number} ageGyr    - System age in Gyr
 * @param {number} wmf       - Water mass fraction (0–1)
 * @param {number} cmf       - Core mass fraction (0–1)
 * @param {number} tidalFraction - Moon tidal heating / Earth internal heat
 * @returns {{ stagnant:number, mobile:number, episodic:number, plutonicSquishy:number, suggested:string }}
 */
export function tectonicProbabilities(massEarth, ageGyr, wmf, cmf, tidalFraction) {
  const lnM = Math.log(Math.max(massEarth, 0.0001));

  // Tectonic regime probability model — calibrated Gaussian mass/age/composition
  // preferences. Each regime has mass-factor (log-normal), age-factor, water-factor,
  // CMF-factor, and tidal-factor tuning. Values are empirical fits.

  // --- Factor 1: Mass (log-Gaussian preference curves) ---
  const massFactor = {
    stagnant: gauss(lnM, Math.log(0.15), 0.8) + (massEarth > 4 ? (0.3 * (massEarth - 4)) / 6 : 0),
    mobile: gauss(lnM, Math.log(1.5), 0.5),
    episodic: gauss(lnM, Math.log(3.0), 0.7),
    plutonicSquishy: gauss(lnM, Math.log(0.8), 0.6),
  };

  // --- Factor 2: Age ---
  const ageFactor = {
    stagnant: 1.0 + Math.max(0, (ageGyr - 5) / 5),
    mobile: gauss(ageGyr, 4, 3),
    episodic: gauss(ageGyr, 1.5, 2),
    plutonicSquishy: gauss(ageGyr, 1, 1.5),
  };

  // --- Factor 3: Water ---
  // Water weakens the lithosphere, enabling subduction (Korenaga 2010).
  // Very high WMF → water world with uncertain tectonics.
  const hasWater = wmf > 0.001 && wmf < 0.1;
  const waterFactor = {
    stagnant: wmf < 0.0001 ? 1.3 : wmf > 0.1 ? 1.2 : 0.8,
    mobile: hasWater ? 2.0 : wmf < 0.0001 ? 0.4 : 0.6,
    episodic: 1.0,
    plutonicSquishy: wmf > 0.1 ? 0.5 : 1.0,
  };

  // --- Factor 4: Core mass fraction ---
  // Higher CMF → less mantle volume for convection → stagnant favoured.
  const cmfFactor = {
    stagnant: 1.0 + Math.max(0, cmf - 0.4) * 2,
    mobile: 1.0 - Math.max(0, cmf - 0.4) * 1.5,
    episodic: 1.0,
    plutonicSquishy: 1.0 + Math.max(0, cmf - 0.5) * 0.5,
  };

  // --- Factor 5: Tidal heating ---
  // Revives convection, shifts away from stagnant.
  const tf = tidalFraction || 0;
  const tidalFac = {
    stagnant: 1.0 / (1 + tf),
    mobile: 1.0 + 0.3 * Math.min(tf, 2),
    episodic: 1.0 + 0.5 * Math.min(tf, 5),
    plutonicSquishy: 1.0 + 0.2 * Math.min(tf, 2),
  };

  // --- Combine and normalise ---
  const raw = {};
  for (const r of REGIMES) {
    raw[r] = Math.max(
      0.001,
      massFactor[r] * ageFactor[r] * waterFactor[r] * cmfFactor[r] * tidalFac[r],
    );
  }
  const total = REGIMES.reduce((s, r) => s + raw[r], 0);
  const result = {};
  for (const r of REGIMES) {
    result[r] = Math.round((raw[r] / total) * 1000) / 1000;
  }
  result.suggested = REGIMES.reduce((best, r) => (result[r] > result[best] ? r : best), REGIMES[0]);
  return result;
}

// --- Sky colours (PanoptesV LUT + OKLab interpolation) ---
// Reference: https://panoptesv.com/SciFi/ColorsOfAlienWorlds/AlienSkies.php
//
// Lookup table (LUT) keyed by:
//   - Spectral key: A0, F0, F5, G0, G5, K0, K5, M0, M5, M9
//   - Pressure (atm): 0.3, 1, 3, 10
//
// Interpolation:
//   - Between spectral anchors by star temperature (OKLab lerp)
//   - Between pressure anchors by log-pressure (OKLab lerp)
//   - Below 0.3 atm: extrapolate toward near-black (Mars-like thin atmosphere)
//   - Above 10 atm: extrapolate toward pale/washed-out (Venus-like dense atmosphere)
//
// Corrections applied after LUT lookup:
//   - Effective pressure: adjusts for column density via atmospheric scale
//     height (gravity + temperature).  A low-gravity or warm planet has more
//     gas column per unit pressure, shifting colours toward higher-pressure
//     entries (PanoptesV: "low gravity or low temperatures mean that you need
//     a thicker blanket of gas to reach the same pressure").
//   - CO₂ tint: blends toward amber/brown proportionally to CO₂ fraction,
//     modelling enhanced near-IR absorption of heavy CO₂ atmospheres.

// --- Sky colour lookup (PanoptesV-inspired LUT) ---
// This uses two sky states from the reference grid:
//  - sunHigh: sun high in the sky
//  - sunHorizon: sun near the horizon
//
// Each state is a pair of colours:
//  - c (centre): representative colour near the middle of the sky dome
//  - e (edge): representative colour towards the limb (used for a subtle radial gradient)
//
// Data is sampled from the provided reference grid screenshots.
const SKY_ANCHORS = [
  { key: "A0", t: 9500 },
  { key: "F0", t: 7300 },
  { key: "F5", t: 6500 },
  { key: "G0", t: 6000 },
  { key: "G5", t: 5600 },
  { key: "K0", t: 5200 },
  { key: "K5", t: 4400 },
  { key: "M0", t: 3800 },
  { key: "M5", t: 3200 },
  { key: "M9", t: 2600 },
];

const SKY_PRESSURES_ATM = [0.3, 1, 3, 10];

const SKY_LUT = {
  A0: {
    0.3: { high: { c: "#052e58", e: "#0f4983" }, horiz: { c: "#000530", e: "#000b45" } },
    1: { high: { c: "#145799", e: "#2e7dcb" }, horiz: { c: "#000a3b", e: "#00123e" } },
    3: { high: { c: "#3b9af7", e: "#6abaff" }, horiz: { c: "#000d3c", e: "#00092d" } },
    10: { high: { c: "#7fcfff", e: "#8fc6fb" }, horiz: { c: "#00113a", e: "#001036" } },
  },
  F0: {
    0.3: { high: { c: "#183656", e: "#2b5581" }, horiz: { c: "#002350", e: "#003570" } },
    1: { high: { c: "#346497", e: "#5590ca" }, horiz: { c: "#003c6f", e: "#5c7180" } },
    3: { high: { c: "#6ab2f6", e: "#a0daff" }, horiz: { c: "#0c3862", e: "#3a374c" } },
    10: { high: { c: "#b6efff", e: "#c4e6fb" }, horiz: { c: "#1f3d59", e: "#2c3d54" } },
  },
  F5: {
    0.3: { high: { c: "#1d3956", e: "#325881" }, horiz: { c: "#06345b", e: "#104c7f" } },
    1: { high: { c: "#3c6996", e: "#6096c9" }, horiz: { c: "#2b4d6f", e: "#9f9985" } },
    3: { high: { c: "#74b4ee", e: "#abddf8" }, horiz: { c: "#375272", e: "#6e5558" } },
    10: { high: { c: "#c7f9ff", e: "#d5f0fb" }, horiz: { c: "#415463", e: "#52555e" } },
  },
  G0: {
    0.3: { high: { c: "#223b56", e: "#395c80" }, horiz: { c: "#1b3248", e: "#2b4b67" } },
    1: { high: { c: "#446c95", e: "#6b9dc7" }, horiz: { c: "#3d4d5c", e: "#c4a974" } },
    3: { high: { c: "#7bb3e3", e: "#b4ddec" }, horiz: { c: "#525e6b", e: "#987158" } },
    10: { high: { c: "#d9ffff", e: "#e7fbfb" }, horiz: { c: "#636b6c", e: "#7c7066" } },
  },
  G5: {
    0.3: { high: { c: "#253c55", e: "#3d5e7f" }, horiz: { c: "#1e2e3c", e: "#2f4557" } },
    1: { high: { c: "#476c90", e: "#6f9cc1" }, horiz: { c: "#434d53", e: "#cdaf72" } },
    3: { high: { c: "#7eafd8", e: "#b5d8e1" }, horiz: { c: "#565b60", e: "#9d714e" } },
    10: { high: { c: "#dfffff", e: "#edfbf4" }, horiz: { c: "#686a62", e: "#83705d" } },
  },
  K0: {
    0.3: { high: { c: "#273c51", e: "#405e7a" }, horiz: { c: "#202b33", e: "#7b8f90" } },
    1: { high: { c: "#4a6b8a", e: "#739bba" }, horiz: { c: "#484c4b", e: "#d4af68" } },
    3: { high: { c: "#7faacb", e: "#b6d3d4" }, horiz: { c: "#5a5955", e: "#a07046" } },
    10: { high: { c: "#e6fffe", e: "#f3fbec" }, horiz: { c: "#6a6758", e: "#856d53" } },
  },
  K5: {
    0.3: { high: { c: "#293844", e: "#435768" }, horiz: { c: "#212727", e: "#868c7a" } },
    1: { high: { c: "#4d6375", e: "#768f9e" }, horiz: { c: "#48463b", e: "#d4a655" } },
    3: { high: { c: "#829faf", e: "#b8c6b7" }, horiz: { c: "#595143", e: "#9f6b38" } },
    10: { high: { c: "#eaf7de", e: "#f7efce" }, horiz: { c: "#675c45", e: "#816341" } },
  },
  M0: {
    0.3: { high: { c: "#2a3339", e: "#445157" }, horiz: { c: "#222420", e: "#878266" } },
    1: { high: { c: "#4e5c63", e: "#778586" }, horiz: { c: "#443d2d", e: "#c79442" } },
    3: { high: { c: "#849495", e: "#b9bb9d" }, horiz: { c: "#534633", e: "#935e2a" } },
    10: { high: { c: "#ebe8c0", e: "#f7e2b2" }, horiz: { c: "#5f5035", e: "#785732" } },
  },
  M5: {
    0.3: { high: { c: "#2b2e2e", e: "#464a47" }, horiz: { c: "#222019", e: "#847856" } },
    1: { high: { c: "#4f5451", e: "#787b70" }, horiz: { c: "#3c3220", e: "#b17e33" } },
    3: { high: { c: "#86897c", e: "#b9ae84" }, horiz: { c: "#4a3a24", e: "#85511e" } },
    10: { high: { c: "#ecd9a2", e: "#f8d496" }, horiz: { c: "#544225", e: "#6a4823" } },
  },
  M9: {
    0.3: { high: { c: "#2a2820", e: "#444034" }, horiz: { c: "#1a160c", e: "#6d5935" } },
    1: { high: { c: "#4e493b", e: "#766c53" }, horiz: { c: "#302411", e: "#93611e" } },
    3: { high: { c: "#80755b", e: "#b19762" }, horiz: { c: "#3c2a14", e: "#6d3d10" } },
    10: { high: { c: "#cdac6e", e: "#d7a966" }, horiz: { c: "#443015", e: "#563613" } },
  },
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  return "#" + [rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// --- OKLab perceptually-uniform interpolation ---
// sRGB ↔ linear RGB ↔ OKLab conversions (Björn Ottosson, 2020)
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? v * 12.92 * 255 : (1.055 * v ** (1 / 2.4) - 0.055) * 255;
}

// sRGB ↔ OKLab conversion matrices (Björn Ottosson, 2020).
// First matrix: sRGB linear → LMS cone response (M1).
// Second matrix: LMS cube-root → OKLab perceptual (M2).
// oklabToRgb uses the inverse matrices (M2⁻¹ then M1⁻¹).
function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l_ * l_ * l_;
  const lg = m_ * m_ * m_;
  const lb = s_ * s_ * s_;
  const r = 4.0767416621 * lr - 3.3077115913 * lg + 0.2309699292 * lb;
  const g = -1.2684380046 * lr + 2.6097574011 * lg - 0.3413193965 * lb;
  const bl = -0.0041960863 * lr - 0.7034186147 * lg + 1.707614701 * lb;
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(bl) };
}

function lerpHex(hexA, hexB, t) {
  const A = hexToRgb(hexA);
  const B = hexToRgb(hexB);
  const labA = rgbToOklab(A.r, A.g, A.b);
  const labB = rgbToOklab(B.r, B.g, B.b);
  const mixed = oklabToRgb(
    lerp(labA.L, labB.L, t),
    lerp(labA.a, labB.a, t),
    lerp(labA.b, labB.b, t),
  );
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

// --- Tidal lock helpers ---
function tidalLockTimeGyr(omega, orbitM, momentI, Q, mOtherKg, k2, radiusM) {
  const sec = (omega * orbitM ** 6 * momentI * Q) / (3 * G * mOtherKg ** 2 * k2 * radiusM ** 5);
  return sec * SECONDS_TO_GYR;
}

// Clausius-Clapeyron water boiling point approximation.
// Calibrated: 1 atm → 373 K; ~0.006 atm → ~273 K (triple point); 218 atm → 647 K (critical).
function waterBoilingK(pAtm) {
  if (pAtm <= 0) return 0;
  if (pAtm >= 218) return 647;
  const LV_R = 40700 / 8.314; // latent heat of vaporisation / gas constant
  return 1 / (1 / 373.15 - Math.log(pAtm) / LV_R);
}

function spectralKeyFromTempK(tempK) {
  const t = Number(tempK);
  if (!Number.isFinite(t)) {
    return { lower: SKY_ANCHORS[4], upper: SKY_ANCHORS[4], u: 0 }; // G5-ish default
  }
  // find bounding anchors
  let lower = SKY_ANCHORS[SKY_ANCHORS.length - 1];
  let upper = SKY_ANCHORS[0];

  for (let i = 0; i < SKY_ANCHORS.length; i++) {
    const a = SKY_ANCHORS[i];
    if (t >= a.t) {
      upper = a;
      break;
    }
  }
  for (let i = SKY_ANCHORS.length - 1; i >= 0; i--) {
    const a = SKY_ANCHORS[i];
    if (t <= a.t) {
      lower = a;
      break;
    }
  }

  // if outside range
  if (t >= SKY_ANCHORS[0].t) return { lower: SKY_ANCHORS[0], upper: SKY_ANCHORS[0], u: 0 };
  if (t <= SKY_ANCHORS[SKY_ANCHORS.length - 1].t)
    return {
      lower: SKY_ANCHORS[SKY_ANCHORS.length - 1],
      upper: SKY_ANCHORS[SKY_ANCHORS.length - 1],
      u: 0,
    };

  // ensure lower.t <= t <= upper.t (note anchors are descending in t)
  // Actually "upper" is the hotter (earlier in list), "lower" is cooler (later in list).
  const tHot = upper.t;
  const tCool = lower.t;
  const u = clamp01((tHot - t) / (tHot - tCool)); // 0 at hot, 1 at cool
  return { lower, upper, u };
}

function pressureBracket(pressureAtm) {
  const p = Math.max(0.001, Number(pressureAtm) || 1);
  const logs = SKY_PRESSURES_ATM.map((x) => Math.log10(x));
  const lp = Math.log10(p);

  let i1 = 0,
    i2 = SKY_PRESSURES_ATM.length - 1;
  for (let i = 0; i < SKY_PRESSURES_ATM.length - 1; i++) {
    if (lp >= logs[i] && lp <= logs[i + 1]) {
      i1 = i;
      i2 = i + 1;
      break;
    }
  }
  // Within LUT range — normal interpolation
  if (lp >= logs[0] && lp <= logs[logs.length - 1]) {
    const t = clamp01((lp - logs[i1]) / (logs[i2] - logs[i1]));
    return { p1: SKY_PRESSURES_ATM[i1], p2: SKY_PRESSURES_ATM[i2], t, extraLow: 0, extraHigh: 0 };
  }
  // Below 0.3 atm — extrapolate toward black (fade factor 0→1)
  if (lp < logs[0]) {
    const fade = clamp01((logs[0] - lp) / (logs[0] - Math.log10(0.001)));
    return {
      p1: SKY_PRESSURES_ATM[0],
      p2: SKY_PRESSURES_ATM[0],
      t: 0,
      extraLow: fade,
      extraHigh: 0,
    };
  }
  // Above 10 atm — extrapolate toward white/pale (fade factor 0→1)
  const fade = clamp01((lp - logs[logs.length - 1]) / (Math.log10(200) - logs[logs.length - 1]));
  return {
    p1: SKY_PRESSURES_ATM[logs.length - 1],
    p2: SKY_PRESSURES_ATM[logs.length - 1],
    t: 0,
    extraLow: 0,
    extraHigh: fade,
  };
}

function lutSample(key, pressureAtm, state) {
  const rec = SKY_LUT[key];
  if (!rec) return null;
  const br = pressureBracket(pressureAtm);
  const a = rec[String(br.p1)]?.[state];
  const b = rec[String(br.p2)]?.[state];
  if (!a || !b) return null;
  let center = lerpHex(a.c, b.c, br.t);
  let edge = lerpHex(a.e, b.e, br.t);
  // Thin-atmosphere extrapolation: fade toward near-black
  if (br.extraLow > 0) {
    const black = state === "horiz" ? "#050508" : "#0a0a10";
    center = lerpHex(center, black, br.extraLow);
    edge = lerpHex(edge, black, br.extraLow);
  }
  // Thick-atmosphere extrapolation: fade toward pale/white
  if (br.extraHigh > 0) {
    const pale = state === "horiz" ? "#8a8580" : "#f0eee8";
    center = lerpHex(center, pale, br.extraHigh);
    edge = lerpHex(edge, pale, br.extraHigh);
  }
  return { center, edge };
}

// Earth reference values for effective-pressure correction
const EARTH_GRAVITY_MS2 = 9.81;
const EARTH_SURFACE_TEMP_K = 288;

/**
 * Compute sky colours from star temperature, surface pressure, and optionally
 * surface gravity + temperature (for column-density correction) and CO₂
 * fraction (for atmospheric tint).
 *
 * The effective pressure used for the LUT lookup accounts for atmospheric
 * scale height: lower gravity or higher temperature → taller scale height →
 * more column mass per unit pressure → colours shift toward thicker-atmosphere
 * entries.  Reference: PanoptesV ("low gravity or low temperatures mean that
 * you need a thicker blanket of gas to reach the same pressure").
 *
 * CO₂-rich atmospheres receive a warm tint shift (toward amber/brown) that
 * increases with CO₂ fraction, loosely modelling the enhanced near-IR
 * absorption and Rayleigh-favoured longer wavelengths of heavy CO₂ gas.
 */
function skyColoursFromSpectralAndPressure({
  starTempK,
  pressureAtm,
  gravityMs2,
  surfaceTempK,
  co2Fraction,
}) {
  // Effective pressure: adjust for column density via scale height ratio.
  // H = kT/(mg), so Hplanet/Hearth = (T/Tearth)·(gearth/g).
  // More column → colours of a thicker atmosphere → multiply pressure.
  const grav = Number.isFinite(gravityMs2) && gravityMs2 > 0 ? gravityMs2 : EARTH_GRAVITY_MS2;
  const temp =
    Number.isFinite(surfaceTempK) && surfaceTempK > 0 ? surfaceTempK : EARTH_SURFACE_TEMP_K;
  const scaleHeightRatio = (temp / EARTH_SURFACE_TEMP_K) * (EARTH_GRAVITY_MS2 / grav);
  const effectivePressure = pressureAtm * scaleHeightRatio;

  const sp = spectralKeyFromTempK(starTempK);
  const keyHot = sp.upper.key;
  const keyCool = sp.lower.key;
  const u = sp.u;

  const hotHigh = lutSample(keyHot, effectivePressure, "high");
  const coolHigh = lutSample(keyCool, effectivePressure, "high");
  const hotHoriz = lutSample(keyHot, effectivePressure, "horiz");
  const coolHoriz = lutSample(keyCool, effectivePressure, "horiz");

  // fallback to something sensible if LUT missing
  let highCenter = hotHigh && coolHigh ? lerpHex(hotHigh.center, coolHigh.center, u) : "#6aa0d8";
  let highEdge = hotHigh && coolHigh ? lerpHex(hotHigh.edge, coolHigh.edge, u) : "#bfe4ff";
  let horizCenter =
    hotHoriz && coolHoriz ? lerpHex(hotHoriz.center, coolHoriz.center, u) : "#5c6a78";
  let horizEdge = hotHoriz && coolHoriz ? lerpHex(hotHoriz.edge, coolHoriz.edge, u) : "#d6b06b";

  // CO₂ tint: blend toward amber/brown proportionally to CO₂ fraction.
  // At 100% CO₂ the sky shifts substantially; at Earth-like 0.04% it's negligible.
  const co2 = Number.isFinite(co2Fraction) ? clamp01(co2Fraction) : 0;
  if (co2 > 0.005) {
    // tint strength rises with sqrt for a perceptually gradual curve
    const strength = clamp01(Math.sqrt(co2) * 0.7);
    highCenter = lerpHex(highCenter, "#9a7b50", strength);
    highEdge = lerpHex(highEdge, "#c4a870", strength);
    horizCenter = lerpHex(horizCenter, "#6b4520", strength);
    horizEdge = lerpHex(horizEdge, "#8b5a28", strength);
  }

  return {
    sunHigh: { center: highCenter, edge: highEdge, hex: highCenter },
    sunHorizon: { center: horizCenter, edge: horizEdge, hex: horizCenter },
    dayHex: highCenter,
    dayEdgeHex: highEdge,
    horizonHex: horizCenter,
    horizonEdgeHex: horizEdge,
    spectralKey: u < 0.5 ? keyHot : keyCool,
  };
}

// --- Vegetation colours (alien photosynthesis model) ---
// References:
//   - PanoptesV: https://panoptesv.com/SciFi/ColorsOfAlienWorlds/AlienFields.php
//   - Kiang (2007): "The Color of Life on Earth and Extrasolar Planets"
//   - Lehmer et al. (2021): "Peak Absorbance Wavelength of Photosynthetic Pigments"
//   - Arp et al. (2020): "Quieting a Noisy Antenna" (Science 368)
//
// Photosynthetic pigments evolve to absorb light where stellar flux is high
// and changing rapidly with wavelength.  The surface spectrum depends on BOTH
// star type AND atmospheric thickness (Rayleigh scattering redistributes flux
// between direct and diffuse components).  Colour varies non-trivially across
// the (spectral class × pressure) space — e.g. G-type at 3 atm is olive/gold
// but at 10 atm is purple; A-type reverses direction entirely.
//
// The 2D LUT below was sampled from PanoptesV's pre-computed colour swatches
// at 1, 3, and 10 atm across spectral classes A0–M8.  Pale = low pigment
// concentration, deep = high concentration.  Interpolation uses OKLab for
// perceptual uniformity, bilinearly across temperature and log-pressure.

const VEG_LUT = {
  A0: {
    1: { pale: "#955939", deep: "#300a05" },
    3: { pale: "#4c5367", deep: "#012250" },
    10: { pale: "#7b752c", deep: "#2f3300" },
  },
  F0: {
    1: { pale: "#635466", deep: "#00082b" },
    3: { pale: "#497931", deep: "#003707" },
    10: { pale: "#9d613b", deep: "#663405" },
  },
  F5: {
    1: { pale: "#526c54", deep: "#002620" },
    3: { pale: "#738323", deep: "#253c00" },
    10: { pale: "#804e4b", deep: "#220c0c" },
  },
  G0: {
    1: { pale: "#5e823d", deep: "#003d10" },
    3: { pale: "#928420", deep: "#4b4f01" },
    10: { pale: "#7c4956", deep: "#190418" },
  },
  G5: {
    1: { pale: "#7a8f2f", deep: "#0d5108" },
    3: { pale: "#a37524", deep: "#543201" },
    10: { pale: "#834a60", deep: "#2f0624" },
  },
  K0: {
    1: { pale: "#aa8825", deep: "#584901" },
    3: { pale: "#ab6631", deep: "#5c2d02" },
    10: { pale: "#9a516d", deep: "#701d37" },
  },
  K5: {
    1: { pale: "#91524e", deep: "#44080c" },
    3: { pale: "#8e5a6a", deep: "#410a31" },
    10: { pale: "#85778c", deep: "#332c6d" },
  },
  M0: {
    1: { pale: "#786573", deep: "#21113c" },
    3: { pale: "#837584", deep: "#23225f" },
    10: { pale: "#939394", deep: "#274e7a" },
  },
  M5: {
    1: { pale: "#84878a", deep: "#03396b" },
    3: { pale: "#939391", deep: "#244b75" },
    10: { pale: "#aaa897", deep: "#486c79" },
  },
  M9: {
    1: { pale: "#cbbb99", deep: "#838674" },
    3: { pale: "#d0bd99", deep: "#898872" },
    10: { pale: "#d8c199", deep: "#948a71" },
  },
};

const VEG_TWILIGHT_LUT = {
  K0: {
    1: { pale: "#a5ae99", deep: "#3f787a" },
    3: { pale: "#e4c499", deep: "#9c8669" },
    10: { pale: "#e4c499", deep: "#937e63" },
  },
  K5: {
    1: { pale: "#c8bc99", deep: "#7d8874" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M0: {
    1: { pale: "#d5c099", deep: "#908b72" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M5: {
    1: { pale: "#dcc299", deep: "#988c70" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M9: {
    1: { pale: "#e3c499", deep: "#9e896c" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
};

const PLANT_NOTES = [
  { tMin: 7500, note: "Orange-brown to blue — adapted to UV-rich starlight" },
  { tMin: 6000, note: "Blue-violet to green — near Earth-like" },
  { tMin: 5200, note: "Green to olive — Earth-like photosynthesis" },
  { tMin: 4400, note: "Orange to red — broad-spectrum absorption" },
  { tMin: 3700, note: "Purple to blue-gray — deep broad-spectrum absorption" },
  { tMin: 3000, note: "Gray-blue to tan — absorbs most available light" },
  { tMin: 0, note: "Tan-gray — absorbs all available light" },
];

const VEG_STOP_COUNT = 6;

/** Generate N evenly-spaced colour stops between two hex colours via OKLab. */
function generateStops(hexA, hexB, n) {
  const stops = [];
  for (let i = 0; i < n; i++) {
    stops.push(lerpHex(hexA, hexB, i / (n - 1)));
  }
  return stops;
}

/**
 * Sample the vegetation LUT at a given spectral key and pressure via
 * log-pressure interpolation between the 1/3/10 atm anchors.
 */
function vegLutSample(lut, key, pAtm) {
  const entry = lut[key];
  if (!entry) return null;

  const p = Math.max(0.01, Math.min(100, pAtm));
  const logP = Math.log10(p);

  // Pressure anchors: log10(1)=0, log10(3)=0.477, log10(10)=1
  //
  // Below 1 atm: extrapolate the 1→3 trend in reverse with 50% dampening.
  // Less atmosphere = less Rayleigh scattering = more raw stellar spectrum
  // reaching the surface.  Physically plausible but no published model
  // provides sub-1-atm vegetation colour data.
  //
  // Above 10 atm: extrapolate the 3→10 trend with 50% dampening.
  // Rayleigh scattering saturates at extreme optical depth.

  if (logP < 0) {
    // 0.01–1 atm: reverse the 1→3 direction, dampened by 50%
    const extraT = logP * 0.5; // negative, so lerpHex goes "before" entry[1]
    return {
      pale: lerpHex(entry[1].pale, entry[3].pale, extraT),
      deep: lerpHex(entry[1].deep, entry[3].deep, extraT),
    };
  }
  // logP === 0 → exactly 1 atm
  if (logP === 0) return entry[1];

  const log3 = Math.log10(3);
  if (logP <= log3) {
    const t = logP / log3;
    return {
      pale: lerpHex(entry[1].pale, entry[3].pale, t),
      deep: lerpHex(entry[1].deep, entry[3].deep, t),
    };
  }
  if (logP <= 1) {
    const t = (logP - log3) / (1 - log3);
    return {
      pale: lerpHex(entry[3].pale, entry[10].pale, t),
      deep: lerpHex(entry[3].deep, entry[10].deep, t),
    };
  }
  // 10–100 atm: continue 3→10 direction, dampened by 50%
  const extraT = 1 + (logP - 1) * 0.5;
  return {
    pale: lerpHex(entry[3].pale, entry[10].pale, extraT),
    deep: lerpHex(entry[3].deep, entry[10].deep, extraT),
  };
}

/**
 * Compute estimated vegetation colours from stellar spectrum, atmospheric
 * pressure, insolation, and tidal-lock status.
 *
 * Uses a 2D LUT (spectral class × pressure) sampled from PanoptesV, with
 * bilinear OKLab interpolation.  Returns pale/deep hex pairs, a 6-stop
 * gradient, optional twilight variants, and a descriptive note.
 */
function vegetationColours({ starTempK, pressureAtm, insolationEarth, tidallyLocked }) {
  const sp = spectralKeyFromTempK(starTempK);
  const keyHot = sp.upper.key;
  const keyCool = sp.lower.key;
  const u = sp.u;
  const effP = Number.isFinite(pressureAtm) ? pressureAtm : 1;

  // Bilinear: interpolate each spectral anchor at the given pressure,
  // then blend between spectral anchors by temperature fraction.
  const hotSample = vegLutSample(VEG_LUT, keyHot, effP) || vegLutSample(VEG_LUT, "G5", effP);
  const coolSample = vegLutSample(VEG_LUT, keyCool, effP) || vegLutSample(VEG_LUT, "G5", effP);

  let pale = lerpHex(hotSample.pale, coolSample.pale, u);
  let deep = lerpHex(hotSample.deep, coolSample.deep, u);

  // Insolation correction: low light → broader absorption → darken
  if (Number.isFinite(insolationEarth) && insolationEarth > 0) {
    const factor = clamp01(0.5 + 0.15 * Math.log2(insolationEarth));
    if (factor < 0.45) {
      const darken = (0.45 - factor) / 0.45;
      pale = lerpHex(pale, "#1a1a18", darken * 0.4);
      deep = lerpHex(deep, "#080808", darken * 0.3);
    }
  }

  // Twilight-adapted colours for tidally locked K/M worlds
  let twilightPale = null;
  let twilightDeep = null;
  if (tidallyLocked) {
    const hotTwi = vegLutSample(VEG_TWILIGHT_LUT, keyHot, effP);
    const coolTwi = vegLutSample(VEG_TWILIGHT_LUT, keyCool, effP);
    if (hotTwi && coolTwi) {
      twilightPale = lerpHex(hotTwi.pale, coolTwi.pale, u);
      twilightDeep = lerpHex(hotTwi.deep, coolTwi.deep, u);
    } else if (coolTwi) {
      twilightPale = coolTwi.pale;
      twilightDeep = coolTwi.deep;
    }
  }

  const temp = Number(starTempK) || 5600;
  const baseNote =
    PLANT_NOTES.find((n) => temp >= n.tMin)?.note || PLANT_NOTES[PLANT_NOTES.length - 1].note;
  const pressureNote =
    effP > 1
      ? " — colour shifted by thick atmosphere"
      : effP < 1
        ? " — less atmospheric filtering (thin atmosphere)"
        : "";
  const twilightNote = tidallyLocked
    ? " (twilight-adapted variants available — tidally locked)"
    : "";
  const note = baseNote + pressureNote + twilightNote;

  const stops = generateStops(pale, deep, VEG_STOP_COUNT);
  const twilightStops =
    twilightPale && twilightDeep ? generateStops(twilightPale, twilightDeep, VEG_STOP_COUNT) : null;

  return {
    paleHex: pale,
    deepHex: deep,
    stops,
    twilightPaleHex: twilightPale,
    twilightDeepHex: twilightDeep,
    twilightStops,
    note,
  };
}

// Temperature chain constants (Calculations sheet):
const STEFAN_BOLTZ_ERG = 0.000056703; // erg*cm^-2*s^-1*K^-4
const L_SOL_ERG_S = 3.846e33;
const AU_CM = 14960000000000; // cm
const GREENHOUSE_SCALE = 0.5841; // calibrated to reproduce Earth T_surf (288 K) from T_eff (255 K)
// Surface divisor: accounts for the temperature difference between the
// atmospheric effective-emission level and the actual surface in the
// presence of convective transport.  Only physically meaningful when an
// atmosphere exists, so it ramps from 1.0 (vacuum) to 0.9 (Earth-like+).
const SURFACE_DIVISOR_MIN = 0.9;

// Atmosphere constants:
const ATM_TO_KPA = 101.3;
const ATM_TO_PA = 101325;
const R_GAS = 8.3145;

// Gas molecular weights (kg/mol) (Calculations B141..B144):
const MW_O2 = 0.032;
const MW_CO2 = 0.044;
const MW_AR = 0.04;
const MW_N2 = 0.028;
const MW_H2O = 0.018;
const MW_CH4 = 0.016;
const MW_H2 = 0.002;
const MW_HE = 0.004;
const MW_SO2 = 0.064;
const MW_NH3 = 0.017;

// Jeans escape constants (Ribas et al. 2005, Jeans 1925, Hunten 1973):
const F_XUV_SUN_1AU = 4.64; // erg/cm²/s, present-day solar XUV at 1 AU
const SUN_AGE_GYR = 4.6;
const JEANS_RETAINED = 6; // λ ≥ 6: firmly retained over geological time
const JEANS_MARGINAL = 3; // 3 ≤ λ < 6: marginal (slow escape)
const EXOBASE_XUV_COEFF = 3.0; // calibrated to Earth T_exo ~ 1000 K
const EXOBASE_CO2_COEFF = 100; // CO₂ radiative cooling suppression
const EXOBASE_MAX_K = 5000; // cap at hydrodynamic blowoff regime
const P_HALF_XUV = 0.06; // atm; half-absorption pressure for XUV (Beer-Lambert)
// Non-thermal escape: charge exchange, polar wind, ion pickup (Gunell+ 2018)
const NT_H2_FACTOR = 3.0; // threshold multiplier for H₂ (Lost < 9, Marginal 9–18)
const NT_HE_FACTOR = 5.0; // threshold multiplier for He  (Lost < 15, Marginal 15–30)
const NT_TEMP_FLOOR_K = 100; // non-thermal negligible below 100 K (outer system)

// Gas species table for Jeans escape
const GAS_SPECIES = [
  { key: "n2", label: "N\u2082", mw: MW_N2 },
  { key: "o2", label: "O\u2082", mw: MW_O2 },
  { key: "co2", label: "CO\u2082", mw: MW_CO2 },
  { key: "ar", label: "Ar", mw: MW_AR },
  { key: "h2o", label: "H\u2082O", mw: MW_H2O },
  { key: "ch4", label: "CH\u2084", mw: MW_CH4 },
  { key: "h2", label: "H\u2082", mw: MW_H2 },
  { key: "he", label: "He", mw: MW_HE },
  { key: "so2", label: "SO\u2082", mw: MW_SO2 },
  { key: "nh3", label: "NH\u2083", mw: MW_NH3 },
];

function jeansStatus(lambda) {
  if (lambda >= JEANS_RETAINED) return "Retained";
  if (lambda >= JEANS_MARGINAL) return "Marginal";
  return "Lost";
}

function computeExobaseTemp(tEqK, fXuvRatio, pressureAtm, co2Fraction) {
  if (tEqK <= 0) return 0;
  // Thin-atmosphere correction: less column density absorbs less XUV.
  const etaAbs = pressureAtm / (pressureAtm + P_HALF_XUV);
  const boost =
    (EXOBASE_XUV_COEFF * etaAbs * Math.sqrt(Math.max(0, fXuvRatio))) /
    (1 + EXOBASE_CO2_COEFF * pressureAtm * co2Fraction);
  return Math.min(tEqK * (1 + boost), EXOBASE_MAX_K);
}

function effectiveStatus(lambda, mw, exobaseTempK) {
  const thermal = jeansStatus(lambda);
  if (exobaseTempK > NT_TEMP_FLOOR_K) {
    let factor = 1;
    if (mw <= MW_H2) factor = NT_H2_FACTOR;
    else if (mw <= MW_HE) factor = NT_HE_FACTOR;
    if (factor > 1) {
      if (lambda >= factor * JEANS_RETAINED) return "Retained";
      if (lambda >= factor * JEANS_MARGINAL) return "Marginal";
      return "Lost";
    }
  }
  return thermal;
}

function computeJeansEscape(escapeVelocityKms, exobaseTempK) {
  const vEsc = escapeVelocityKms * 1000;
  const vEsc2 = vEsc * vEsc;
  const denom = 2 * R_GAS * Math.max(exobaseTempK, 1);
  const species = {};
  for (const g of GAS_SPECIES) {
    const lambda = (vEsc2 * g.mw) / denom;
    const thermal = jeansStatus(lambda);
    const status = effectiveStatus(lambda, g.mw, exobaseTempK);
    species[g.key] = {
      lambda,
      thermalStatus: thermal,
      status,
      nonThermal: status !== thermal,
      label: g.label,
    };
  }
  return species;
}

// Greenhouse-from-gas coefficients:
// Core gases — calibrated against NASA Planetary Fact Sheet (Earth, Venus, Mars).
const GH_CO2_COEFF = 0.503; // logarithmic (band saturation, Myhre 1998)
const GH_H2O_COEFF = 0.336; // logarithmic (broadband IR absorber, adjusted for CO₂ overlap)
const GH_CH4_COEFF = 0.085; // square-root (IPCC TAR Table 6.2)
// Full (expert) gases:
const GH_H2_CIA_COEFF = 3.0; // H₂-N₂ collision-induced absorption (Wordsworth & Pierrehumbert 2013)
const GH_SO2_COEFF = 0.15; // logarithmic (7.3 µm + 8.7 µm bands)
const GH_NH3_COEFF = 1.5; // square-root (10.5 µm atmospheric window)
const GH_PP_REF = 0.001; // reference partial pressure (atm)
const GH_PB_EXP = 0.684; // Lorentz pressure-broadening exponent (Robinson & Catling 2012)
// CO₂-H₂O band overlap: H₂O and CO₂ share absorption in the 12–18 µm and
// 4.3 µm regions.  When CO₂ is optically thick it saturates those bands,
// reducing H₂O's marginal contribution.  Half-saturation at τ_CO₂ = 6.
const GH_CO2_H2O_OVERLAP_K = 6;
// Core-opacity overlap for expert gases: at high τ_core, pressure-broadened
// CO₂ wings fill the atmospheric window, reducing marginal SO₂/NH₃ contribution.
// Different k per gas — SO₂ bands (7.3+8.7 µm) overlap more with broadened CO₂
// than NH₃ (10.5 µm window).  WorldSmith calibration against NASA Venus data.
const GH_SO2_OVERLAP_K = 8;
const GH_NH3_OVERLAP_K = 20;

/**
 * Compute grey IR optical depth τ from atmospheric gas composition.
 *
 * Core gases (CO₂, H₂O, CH₄) use pressure-broadened logarithmic/sqrt scaling.
 * H₂O receives a CO₂ band-overlap suppression factor (shared 12–18 µm bands)
 * that prevents over-counting in CO₂-dominated atmospheres (e.g. Venus).
 * Full mode adds H₂-N₂ CIA, SO₂, and NH₃.  SO₂ and NH₃ receive a core-opacity
 * overlap factor: at high τ_core, pressure-broadened CO₂ fills the atmospheric
 * window, reducing their marginal contribution.  He has no IR absorption.
 *
 * @param {object}  opts
 * @param {number}  opts.pressureAtm  Total surface pressure (atm)
 * @param {number}  opts.co2Pct       CO₂ fraction (%)
 * @param {number}  opts.h2oPct       H₂O fraction (%)
 * @param {number}  opts.ch4Pct       CH₄ fraction (%)
 * @param {number} [opts.h2Pct=0]     H₂ fraction (%)
 * @param {number} [opts.n2Pct=0]     N₂ fraction (%) — needed for H₂-N₂ CIA
 * @param {number} [opts.so2Pct=0]    SO₂ fraction (%)
 * @param {number} [opts.nh3Pct=0]    NH₃ fraction (%)
 * @param {boolean} [opts.full=false]  Include expert gas terms
 * @returns {number} Grey IR optical depth τ
 */
export function computeGreenhouseTau({
  pressureAtm,
  co2Pct,
  h2oPct,
  ch4Pct,
  h2Pct = 0,
  n2Pct = 0,
  so2Pct = 0,
  nh3Pct = 0,
  full = false,
}) {
  const P = pressureAtm;
  if (P <= 0) return 0;

  const pb = P ** GH_PB_EXP;
  const ref = GH_PP_REF;

  // Core greenhouse gases
  const tauCO2 = GH_CO2_COEFF * Math.log(1 + (P * co2Pct) / 100 / ref) * pb;
  // CO₂-H₂O band overlap suppression: when CO₂ is optically thick it
  // saturates shared IR bands (12–18 µm), reducing H₂O's marginal effect.
  const overlapFactor = 1 / (1 + tauCO2 / GH_CO2_H2O_OVERLAP_K);
  const tauH2O = GH_H2O_COEFF * Math.log(1 + (P * h2oPct) / 100 / ref) * pb * overlapFactor;
  const tauCH4 =
    ch4Pct > 0 ? GH_CH4_COEFF * Math.sqrt(Math.max(0, (P * ch4Pct) / 100 / ref)) * pb : 0;

  let tau = tauCO2 + tauH2O + tauCH4;

  // Expert gases (Full mode only)
  if (full) {
    // H₂-N₂ collision-induced absorption — scales with H₂×N₂ fractions and P²
    // (broadband mechanism, not a line absorber — no spectral overlap suppression)
    if (h2Pct > 0 && n2Pct > 0) {
      tau += GH_H2_CIA_COEFF * (h2Pct / 100) * (n2Pct / 100) * P * P;
    }
    // SO₂ and NH₃: at high core τ, pressure-broadened CO₂ wings fill the
    // atmospheric window, reducing the marginal contribution of window absorbers.
    if (so2Pct > 0) {
      const rawSO2 = GH_SO2_COEFF * Math.log(1 + (P * so2Pct) / 100 / ref) * pb;
      tau += rawSO2 / (1 + tau / GH_SO2_OVERLAP_K);
    }
    if (nh3Pct > 0) {
      const rawNH3 = GH_NH3_COEFF * Math.sqrt(Math.max(0, (P * nh3Pct) / 100 / ref)) * pb;
      tau += rawNH3 / (1 + tau / GH_NH3_OVERLAP_K);
    }
  }

  return tau;
}

/**
 * Calculate comprehensive terrestrial-planet properties from host-star
 * parameters and user-editable planet inputs.  Mirrors the PLANET and
 * Calculations sheets of the WS8 spreadsheet.
 *
 * @param {object}  params
 * @param {number}  params.starMassMsol        Host star mass (M☉)
 * @param {number}  params.starAgeGyr          Host star age (Gyr)
 * @param {object}  params.planet              Planet input fields
 * @param {number}  params.planet.massEarth    Mass (M⊕)
 * @param {number}  params.planet.cmfPct       Core-mass fraction (%)
 * @param {number}  params.planet.axialTiltDeg Axial tilt (degrees, 0–180)
 * @param {number}  params.planet.albedoBond   Bond albedo (0–0.95)
 * @param {number}  params.planet.greenhouseEffect Dimensionless greenhouse factor
 * @param {number}  params.planet.observerHeightM  Observer height (metres)
 * @param {number}  params.planet.rotationPeriodHours Sidereal rotation period (hours)
 * @param {number}  params.planet.semiMajorAxisAu    Semi-major axis (AU)
 * @param {number}  params.planet.eccentricity       Orbital eccentricity (0–0.99)
 * @param {number}  params.planet.inclinationDeg     Orbital inclination (degrees)
 * @param {number}  params.planet.longitudeOfPeriapsisDeg Longitude of periapsis (degrees)
 * @param {number}  params.planet.subsolarLongitudeDeg    Sub-solar longitude (degrees)
 * @param {number}  params.planet.pressureAtm  Surface pressure (atm)
 * @param {number}  params.planet.o2Pct        Oxygen fraction (%)
 * @param {number}  params.planet.co2Pct       CO₂ fraction (%)
 * @param {number}  params.planet.arPct        Argon fraction (%)
 * @param {number} [params.planet.h2oPct=0]    Water vapor fraction (%)
 * @param {number} [params.planet.ch4Pct=0]    Methane fraction (%)
 * @param {number} [params.planet.h2Pct=0]     Hydrogen fraction (%)
 * @param {number} [params.planet.hePct=0]     Helium fraction (%)
 * @param {number} [params.planet.so2Pct=0]    Sulfur dioxide fraction (%)
 * @param {number} [params.planet.nh3Pct=0]    Ammonia fraction (%)
 * @param {string} [params.planet.greenhouseMode="manual"] "core"|"full"|"manual"
 * @returns {object} { star, inputs, derived, display }
 */
export function calcPlanetExact({
  starMassMsol,
  starAgeGyr,
  starRadiusRsolOverride,
  starLuminosityLsolOverride,
  starTempKOverride,
  starEvolutionMode,
  planet,
  moons,
  gasGiants,
}) {
  const star = calcStar({
    massMsol: starMassMsol,
    ageGyr: starAgeGyr,
    radiusRsolOverride: starRadiusRsolOverride,
    luminosityLsolOverride: starLuminosityLsolOverride,
    tempKOverride: starTempKOverride,
    evolutionMode: starEvolutionMode,
  });

  // Suggested CMF from stellar metallicity (needed before input resolution)
  const suggestedCmf = suggestedCmfFromMetallicity(star.metallicityFeH ?? 0);
  const suggestedCmfPct = suggestedCmf * 100;

  // Inputs (clamped to sensible bounds)
  const massEarth = clamp(planet.massEarth, 0.0001, 1000);
  const cmfIsAuto = planet.cmfPct < 0 || planet.cmfPct == null;
  const cmfPct = cmfIsAuto ? suggestedCmfPct : clamp(planet.cmfPct, 0, 100); // percent
  const wmfPct = clamp(planet.wmfPct ?? 0, 0, 50); // water mass fraction %
  const axialTiltDeg = clamp(planet.axialTiltDeg, 0, 180);

  const albedoBond = clamp(planet.albedoBond, 0, 0.95); // ≤0.95: prevents runaway cooling
  const greenhouseMode = planet.greenhouseMode || "manual";
  const greenhouseEffectManual = clamp(planet.greenhouseEffect, 0, 500); // 500 K max — Venus-like upper bound

  const observerHeightM = clamp(planet.observerHeightM, 0, 10000); // 10 km — above tropopause

  const rotationPeriodHours = clamp(planet.rotationPeriodHours, 0.1, 1e6); // 0.1 h = breakup speed for rocky body
  const semiMajorAxisAu = clamp(planet.semiMajorAxisAu, 0.01, 1e6);
  const eccentricity = clamp(planet.eccentricity, 0, 0.99);
  const inclinationDeg = clamp(planet.inclinationDeg, 0, 180);
  const longitudeOfPeriapsisDeg = clamp(planet.longitudeOfPeriapsisDeg, 0, 360);
  const subsolarLongitudeDeg = clamp(planet.subsolarLongitudeDeg, 0, 360);

  const pressureAtm = clamp(planet.pressureAtm, 0, 100);

  let o2Pct = clamp(planet.o2Pct, 0, 100);
  let co2Pct = clamp(planet.co2Pct, 0, 100);
  let arPct = clamp(planet.arPct, 0, 100);
  let h2oPct = clamp(planet.h2oPct ?? 0, 0, 100);
  let ch4Pct = clamp(planet.ch4Pct ?? 0, 0, 100);
  let h2Pct = clamp(planet.h2Pct ?? 0, 0, 100);
  let hePct = clamp(planet.hePct ?? 0, 0, 100);
  let so2Pct = clamp(planet.so2Pct ?? 0, 0, 100);
  let nh3Pct = clamp(planet.nh3Pct ?? 0, 0, 100);
  const radioisotopeMode = planet.radioisotopeMode || "simple";
  let radioisotopeAbundance;
  if (radioisotopeMode === "advanced") {
    const u238 = clamp(planet.u238Abundance ?? 1, 0, 5);
    const u235 = clamp(planet.u235Abundance ?? 1, 0, 5);
    const th232 = clamp(planet.th232Abundance ?? 1, 0, 5);
    const k40 = clamp(planet.k40Abundance ?? 1, 0, 5);
    radioisotopeAbundance = Math.max(
      u238 * ISOTOPE_HEAT_FRACTIONS.u238 +
        u235 * ISOTOPE_HEAT_FRACTIONS.u235 +
        th232 * ISOTOPE_HEAT_FRACTIONS.th232 +
        k40 * ISOTOPE_HEAT_FRACTIONS.k40,
      0.01,
    );
  } else {
    radioisotopeAbundance = clamp(planet.radioisotopeAbundance ?? 1, 0.1, 3.0);
  }
  // User-friendly guardrail: do not allow derived N2 to go negative.
  // These are from the raw user inputs; if Jeans escape auto-strip is active,
  // they are recomputed below from the effective (post-strip) gas percentages.
  const rawGasInputTotalPct =
    o2Pct + co2Pct + arPct + h2oPct + ch4Pct + h2Pct + hePct + so2Pct + nh3Pct;
  const rawN2PctRaw = 100 - rawGasInputTotalPct;
  const rawGasMixOverflowPct = Math.max(0, rawGasInputTotalPct - 100);
  const rawGasMixClamped = rawGasMixOverflowPct > 0;
  let gasInputTotalPct = rawGasInputTotalPct;
  let n2PctRaw = rawN2PctRaw;
  let n2Pct = Math.max(0, n2PctRaw);
  // Star derived (also present on PLANET sheet)
  const starMassKg = STAR_MASS_TO_KG * starMassMsol;
  const hzInnerAuRaw = Number(star.habitableZoneAu?.inner);
  const hzOuterAuRaw = Number(star.habitableZoneAu?.outer);
  const hzInnerAu = Number.isFinite(hzInnerAuRaw) ? hzInnerAuRaw : 0;
  const hzOuterAu = Number.isFinite(hzOuterAuRaw) ? hzOuterAuRaw : 0;

  // Physical characteristics (PLANET C13..C16)
  const cmf = cmfPct / 100;
  const wmf = wmfPct / 100;

  // Radius-first mass–radius relation (Zeng+2016 CMF scaling with
  // mass-dependent compression exponent calibrated to Solar System):
  //   R(M, CMF) = (1.07 − 0.21 × CMF) × M^α
  //   α(M) = min(1/3, 0.257 − 0.0161 × ln M)
  // At low mass α → 1/3 (uncompressed spheres); at M = 1 M⊕ α = 0.257
  // (self-compression). Validated: Mercury 0.3%, Venus 0.8%, Earth 0.2%,
  // Mars 0.5%. Replaces the WS8 density-floor formula (16-21% off for
  // sub-Earth iron-rich bodies).
  const lnM = Math.log(Math.max(massEarth, 1e-6));
  const alpha = Math.min(1 / 3, 0.257 - 0.0161 * lnM); // Zeng+2016 compression exponent fit
  const radiusDry = (1.07 - 0.21 * cmf) * massEarth ** alpha; // Zeng+2016 CMF-scaled radius
  const densityDryGcm3 = (massEarth * EARTH_DENSITY_GCM3) / radiusDry ** 3;

  // Water-layer radius inflation (Zeng+Sasselov 2016 interpolation)
  const waterInflation = waterRadiusInflation(massEarth, wmf);
  const radiusEarth = radiusDry * waterInflation;
  const radiusKm = radiusEarth * EARTH_RADIUS_KM;

  // Effective bulk density (recomputed from inflated radius)
  const densityGcm3 =
    wmf > 0 ? (massEarth * EARTH_DENSITY_GCM3) / radiusEarth ** 3 : densityDryGcm3;

  const gravityG = massEarth / radiusEarth ** 2;
  const gravityMs2 = gravityG * GRAVITY_EARTH_MS2;

  const escapeVelocityVEarth = Math.sqrt(massEarth / radiusEarth);
  const escapeVelocityKms = escapeVelocityVEarth * VELOCITY_EARTH_KMS;

  // ── Jeans escape ──────────────────────────────────────────────────
  // Equilibrium temperature (no greenhouse) — same formula as tEqK below.
  const tEqNoGh =
    (278 * star.luminosityLsol ** 0.25 * (1 - albedoBond) ** 0.25) / Math.sqrt(semiMajorAxisAu);

  // XUV flux ratio relative to present-day Earth at 1 AU (Ribas et al. 2005)
  const starAge = Math.max(0.1, starAgeGyr);
  const fXuv1Au = F_XUV_SUN_1AU * star.luminosityLsol * (starAge / SUN_AGE_GYR) ** -1.23;
  const fXuvAtOrbit = fXuv1Au / (semiMajorAxisAu * semiMajorAxisAu);
  const fXuvRatio = fXuvAtOrbit / F_XUV_SUN_1AU;

  // Exobase temperature: XUV-heated thermosphere countered by CO₂ cooling.
  const co2Frac = clamp(planet.co2Pct ?? 0, 0, 100) / 100;
  const exobaseTempK = computeExobaseTemp(tEqNoGh, fXuvRatio, pressureAtm, co2Frac);

  // Per-species Jeans escape analysis
  const jeansSpecies = computeJeansEscape(escapeVelocityKms, exobaseTempK);

  // Auto-strip: when enabled, zero out gases with "Lost" status and recompute
  // N₂ and gas-mix totals.  The original user inputs are preserved in the
  // `inputs` return object; only the physics uses the effective values.
  const atmosphericEscape = !!planet.atmosphericEscape;
  const stripped = [];
  if (atmosphericEscape) {
    const gasKeys = [
      [
        "o2",
        () => {
          o2Pct = 0;
        },
      ],
      [
        "co2",
        () => {
          co2Pct = 0;
        },
      ],
      [
        "ar",
        () => {
          arPct = 0;
        },
      ],
      [
        "h2o",
        () => {
          h2oPct = 0;
        },
      ],
      [
        "ch4",
        () => {
          ch4Pct = 0;
        },
      ],
      [
        "h2",
        () => {
          h2Pct = 0;
        },
      ],
      [
        "he",
        () => {
          hePct = 0;
        },
      ],
      [
        "so2",
        () => {
          so2Pct = 0;
        },
      ],
      [
        "nh3",
        () => {
          nh3Pct = 0;
        },
      ],
    ];
    for (const [key, zero] of gasKeys) {
      if (jeansSpecies[key].status === "Lost") {
        zero();
        stripped.push(key);
      }
    }
    // Recompute gas-mix totals from effective (post-strip) percentages
    gasInputTotalPct = o2Pct + co2Pct + arPct + h2oPct + ch4Pct + h2Pct + hePct + so2Pct + nh3Pct;
    n2PctRaw = 100 - gasInputTotalPct;
    n2Pct = Math.max(0, n2PctRaw);
  }

  // Composition labels
  const compClass = compositionClass(cmf, wmf);
  const bClass = bodyClass(massEarth);
  const watRegime = waterRegime(wmf);

  // Core radius fraction (Zeng & Jacobsen 2017): CRF ≈ CMF^0.5
  const coreRadiusFraction = cmf > 0 ? Math.sqrt(cmf) : 0;
  const coreRadiusKm = coreRadiusFraction * radiusKm;

  // Insolation relative to Earth (L/d²)
  const insolationEarth = star.luminosityLsol / semiMajorAxisAu ** 2;

  // Habitable zone membership
  const inHabitableZone =
    hzInnerAu > 0 && semiMajorAxisAu >= hzInnerAu && semiMajorAxisAu <= hzOuterAu;

  // Tidal lock to star (composition-dependent rigidity and Q)
  const rigidity = planetRigidity(cmf, wmf);
  const qualityFactor = planetQualityFactor(cmf, wmf);
  const radiusM = radiusKm * 1000;
  const densityKgM3 = densityGcm3 * 1000;
  const mPlanetKg = massEarth * KG_PER_MEARTH;
  const orbitM = semiMajorAxisAu * M_PER_AU_PLANET;
  const omegaPlanet = (2 * PI) / (rotationPeriodHours * 3600);
  const I_planet = 0.4 * mPlanetKg * radiusM ** 2;
  const k2Planet = k2LoveNumber(densityKgM3, gravityMs2, radiusM, rigidity);
  const tidalLockBodyGyr = tidalLockTimeGyr(
    omegaPlanet,
    orbitM,
    I_planet,
    qualityFactor,
    starMassKg,
    k2Planet,
    radiusM,
  );

  // Atmospheric thermal-tide resistance (Leconte+ 2015).
  // Thick atmospheres generate a pressure-asymmetry torque opposing synchronisation.
  const tEqK =
    (278 * star.luminosityLsol ** 0.25 * (1 - albedoBond) ** 0.25) / Math.sqrt(semiMajorAxisAu); // 278 K = (L_sun / (16πσ))^(1/4) — equilibrium temp at 1 AU for a blackbody
  const bAtm = atmosphereTideRatio(pressureAtm, insolationEarth, gravityMs2, tEqK);
  const atmospherePreventsLocking = bAtm >= 1;

  // Effective lock timescale: atmospheric torque slows or prevents despinning.
  const tidalLockStarGyr = atmospherePreventsLocking
    ? Infinity
    : Number.isFinite(tidalLockBodyGyr)
      ? tidalLockBodyGyr / (1 - bAtm)
      : tidalLockBodyGyr;

  // Spin-orbit resonance selection (Goldreich & Peale 1966).
  // When tidally evolved, eccentricity determines which resonance the planet
  // was captured into during despinning (3:2 for Mercury, 1:1 for most).
  const tidallyEvolved =
    !atmospherePreventsLocking &&
    Number.isFinite(tidalLockStarGyr) &&
    tidalLockStarGyr <= starAgeGyr;
  const resonance = tidallyEvolved ? spinOrbitResonance(eccentricity) : null;

  // Orbital period in hours (for resonance rotation period)
  // Kepler's third law: P² = a³/M → P = √(a³/M) years
  const orbPeriodYears = Math.sqrt(semiMajorAxisAu ** 3 / starMassMsol);
  const resonanceRotationHours = resonance
    ? (orbPeriodYears * DAYS_PER_YEAR * 24) / resonance.p
    : null;

  // Only true for 1:1 synchronous lock — higher resonances still illuminate all sides
  const tidallyLockedToStar = tidallyEvolved && resonance.ratio === "1:1";

  // Moon tidal heating on the planet (Peale et al. 1979, reciprocal formula).
  // Tidal dissipation from orbiting moons heats the planet's interior,
  // potentially extending core liquid lifetime and sustaining the dynamo.
  const planetTidalHeatingW = totalPlanetTidalHeating(
    moons,
    k2Planet,
    qualityFactor,
    mPlanetKg,
    radiusM,
  );
  const surfaceAreaM2 = 4 * PI * radiusM ** 2;
  const planetTidalHeatingWm2 = surfaceAreaM2 > 0 ? planetTidalHeatingW / surfaceAreaM2 : 0;
  const internalHeatW = EARTH_INTERNAL_HEAT_W * massEarth * radioisotopeAbundance;
  const planetTidalFraction = internalHeatW > 0 ? planetTidalHeatingW / internalHeatW : 0;

  // Magnetic field model
  const magField = magneticFieldModel({
    cmf,
    massEarth,
    radiusEarth,
    densityGcm3,
    rotationPeriodHours,
    ageGyr: starAgeGyr,
    tidalFraction: planetTidalFraction,
    radioisotopeAbundance,
  });

  // Mantle outgassing and tectonic advisory
  const outgassing = mantleOutgassing(planet.mantleOxidation || "earth");
  const tecProbs = tectonicProbabilities(massEarth, starAgeGyr, wmf, cmf, planetTidalFraction);
  const tecRegimeInput = planet.tectonicRegime || "auto";
  const tecRegime = tecRegimeInput === "auto" ? tecProbs.suggested : tecRegimeInput;
  const tecAdvisory = tectonicAdvisory(massEarth, starAgeGyr, wmf, planetTidalFraction);

  // Axial tilt derived text outputs
  const rotationDirection =
    axialTiltDeg === 90
      ? "Undefined"
      : axialTiltDeg >= 0 && axialTiltDeg < 90
        ? "Prograde"
        : "Retrograde";

  const tropics =
    axialTiltDeg < 90 ? `0 - ${fmt(axialTiltDeg, 2)}` : `0 - ${fmt(180 - axialTiltDeg, 2)}`;

  const polarCircles =
    axialTiltDeg < 90
      ? `${fmt(90 - axialTiltDeg, 2)} - 90`
      : `${fmt(90 - (180 - axialTiltDeg), 2)} - 90`;

  // Greenhouse mode: compute τ from gases (core/full) or use manual input
  const isFull = greenhouseMode === "full";
  const computedTau = computeGreenhouseTau({
    pressureAtm,
    co2Pct,
    h2oPct,
    ch4Pct,
    h2Pct,
    n2Pct,
    so2Pct,
    nh3Pct,
    full: isFull,
  });
  const computedGreenhouseEffect = computedTau / GREENHOUSE_SCALE;
  const greenhouseEffect =
    greenhouseMode === "manual" ? greenhouseEffectManual : computedGreenhouseEffect;

  // Temperature chain (Calculations C128..C135)
  const luminosityErgS = L_SOL_ERG_S * star.luminosityLsol;
  const distanceCm = AU_CM * semiMajorAxisAu;
  const tGreenhouse = greenhouseEffect * GREENHOUSE_SCALE;

  const X = Math.sqrt(((1 - albedoBond) * luminosityErgS) / (16 * PI * STEFAN_BOLTZ_ERG));
  const tEff = Math.sqrt(X) * (1 / Math.sqrt(distanceCm));
  // NOTE: tEq and tSur are T⁴ quantities (K⁴), NOT temperatures in Kelvin.
  // The chain mirrors the spreadsheet's intermediate cells exactly.
  // tKel recovers the actual surface temperature via the fourth-root: ⁴√(T⁴) = T.
  const tEq = tEff ** 4 * (1 + (3 * tGreenhouse) / 4); // C133 — T_eq⁴ in K⁴
  // Surface divisor ramps from 1.0 (vacuum) → 0.9 (Earth-like atmosphere+).
  // clamp(tGreenhouse, 0, 1) so the divisor is fully engaged by τ ≥ 1.
  const surfDiv = 1 - (1 - SURFACE_DIVISOR_MIN) * Math.min(tGreenhouse, 1);
  const tSur = tEq / surfDiv; // C134 — T_surface⁴ in K⁴
  const tKel = Math.round(Math.sqrt(Math.sqrt(tSur))); // C135 — surface temp in K
  const tC = tKel - 273;

  // Liquid water check (Clausius-Clapeyron boiling point model)
  const liquidWaterPossible =
    pressureAtm >= 0.006 && tKel >= 273 && tKel <= waterBoilingK(pressureAtm);

  // Absorbed stellar flux (W/m²) — globally averaged after albedo
  const absorbedFluxWm2 = (insolationEarth * 1361 * (1 - albedoBond)) / 4;

  // Climate state classification (snowball / greenhouse flags)
  const climateState = classifyClimateState(tKel, absorbedFluxWm2, watRegime !== "Dry");

  // Sky colours (after gravity + temperature are known for column-density correction)
  const sky = skyColoursFromSpectralAndPressure({
    starTempK: star.tempK,
    pressureAtm,
    gravityMs2,
    surfaceTempK: tKel,
    co2Fraction: co2Pct / 100,
  });

  // Vegetation colours (manual override or auto-calculated)
  let veg;
  if (planet.vegOverride && planet.vegPaleHexOverride && planet.vegDeepHexOverride) {
    const pale = planet.vegPaleHexOverride;
    const deep = planet.vegDeepHexOverride;
    veg = {
      paleHex: pale,
      deepHex: deep,
      stops: generateStops(pale, deep, VEG_STOP_COUNT),
      twilightPaleHex: null,
      twilightDeepHex: null,
      twilightStops: null,
      note: "Manual override",
    };
  } else {
    veg = vegetationColours({
      starTempK: star.tempK,
      pressureAtm,
      insolationEarth,
      tidallyLocked: tidallyLockedToStar,
    });
  }

  // Horizon distance (PLANET C27)
  const horizonKm =
    Math.sqrt(2 * radiusEarth * (EARTH_RADIUS_KM * 1000) * observerHeightM + observerHeightM ** 2) /
    1000;

  // Orbit characteristics (PLANET C34..C37, F36..F37)
  const periapsisAu = semiMajorAxisAu * (1 - eccentricity);
  const apoapsisAu = semiMajorAxisAu * (1 + eccentricity);

  // Equilibrium temperature at periapsis and apoapsis (blackbody + albedo,
  // no greenhouse).  Same formula as tEqK (line above) but substituting
  // the actual distance at orbital extremes.
  const tEqPeriK =
    periapsisAu > 0
      ? (278 * star.luminosityLsol ** 0.25 * (1 - albedoBond) ** 0.25) / Math.sqrt(periapsisAu)
      : tEqK;
  const tEqApoK =
    apoapsisAu > 0
      ? (278 * star.luminosityLsol ** 0.25 * (1 - albedoBond) ** 0.25) / Math.sqrt(apoapsisAu)
      : tEqK;

  // Volatile sublimation analysis (dwarf planets only)
  const isDwarfPlanet = massEarth < 0.01;
  const volatileFlags = isDwarfPlanet ? analyseVolatiles(tEqPeriK, tEqApoK) : null;

  // Nearest gas giant mean-motion resonance
  const nearestResonance = findNearestResonance(
    semiMajorAxisAu,
    Array.isArray(gasGiants) ? gasGiants : [],
  );

  const orbitalPeriodEarthYears = Math.sqrt(semiMajorAxisAu ** 3 / starMassMsol); // F36
  const orbitalPeriodEarthDays = orbitalPeriodEarthYears * DAYS_PER_YEAR; // F37

  const localDaysPerYear = (orbitalPeriodEarthDays * 24) / rotationPeriodHours; // C37

  // "Undefined" is only reached when inclinationDeg === 90 exactly (clamped
  // to [0,180] above), matching the spreadsheet's boundary behaviour.
  const orbitalDirection =
    inclinationDeg > 90 ? "Retrograde" : inclinationDeg < 90 ? "Prograde" : "Undefined";

  // Atmosphere
  const pressureKpa = pressureAtm * ATM_TO_KPA;

  const ppO2Atm = pressureAtm * (o2Pct / 100);
  const ppCO2Atm = pressureAtm * (co2Pct / 100);
  const ppArAtm = pressureAtm * (arPct / 100);
  const ppN2Atm = pressureAtm * (n2Pct / 100);
  const ppH2OAtm = pressureAtm * (h2oPct / 100);
  const ppCH4Atm = pressureAtm * (ch4Pct / 100);
  const ppH2Atm = pressureAtm * (h2Pct / 100);
  const ppHeAtm = pressureAtm * (hePct / 100);
  const ppSO2Atm = pressureAtm * (so2Pct / 100);
  const ppNH3Atm = pressureAtm * (nh3Pct / 100);

  const ppO2Kpa = ppO2Atm * ATM_TO_KPA;
  const ppCO2Kpa = ppCO2Atm * ATM_TO_KPA;
  const ppArKpa = ppArAtm * ATM_TO_KPA;
  const ppN2Kpa = ppN2Atm * ATM_TO_KPA;
  const ppH2OKpa = ppH2OAtm * ATM_TO_KPA;
  const ppCH4Kpa = ppCH4Atm * ATM_TO_KPA;
  const ppH2Kpa = ppH2Atm * ATM_TO_KPA;
  const ppHeKpa = ppHeAtm * ATM_TO_KPA;
  const ppSO2Kpa = ppSO2Atm * ATM_TO_KPA;
  const ppNH3Kpa = ppNH3Atm * ATM_TO_KPA;

  const atmWeightKgMol =
    (n2Pct * MW_N2 +
      o2Pct * MW_O2 +
      co2Pct * MW_CO2 +
      arPct * MW_AR +
      h2oPct * MW_H2O +
      ch4Pct * MW_CH4 +
      h2Pct * MW_H2 +
      hePct * MW_HE +
      so2Pct * MW_SO2 +
      nh3Pct * MW_NH3) *
    (1 / 100);

  const atmDensityKgM3 = tKel > 0 ? (pressureAtm * ATM_TO_PA * atmWeightKgMol) / (R_GAS * tKel) : 0;

  // Atmospheric circulation cells (PLANET C60..C67)
  let cellCount = "NA";
  if (rotationPeriodHours >= 48) cellCount = "1";
  else if (rotationPeriodHours >= 6 && rotationPeriodHours < 48) cellCount = "3";
  else if (rotationPeriodHours >= 3 && rotationPeriodHours < 6) cellCount = "7";
  else if (rotationPeriodHours > 0 && rotationPeriodHours < 3) cellCount = "5";

  const cellRanges = [];
  function addCell(n, range) {
    cellRanges.push({ name: `Cell ${n}`, rangeDegNS: range });
  }
  if (cellCount === "1") {
    addCell(1, "0-90");
  } else if (cellCount === "3") {
    addCell(1, "0-30");
    addCell(2, "30-60");
    addCell(3, "60-90");
  } else if (cellCount === "7") {
    addCell(1, "0-24");
    addCell(2, "24-27");
    addCell(3, "27-31");
    addCell(4, "31-41");
    addCell(5, "41-58");
    addCell(6, "58-71");
    addCell(7, "71-90");
  } else if (cellCount === "5") {
    addCell(1, "0-23");
    addCell(2, "23-30");
    addCell(3, "30-47");
    addCell(4, "47-56");
    addCell(5, "56-90°");
  }

  // Apparent size of star (Calculations C146)
  const apparentStarDeg = (star.radiusRsol / semiMajorAxisAu) * 0.5332;

  return {
    star,
    inputs: {
      massEarth,
      cmfPct,
      wmfPct,
      axialTiltDeg,
      albedoBond,
      greenhouseEffect: greenhouseEffectManual,
      observerHeightM,
      rotationPeriodHours,
      semiMajorAxisAu,
      eccentricity,
      inclinationDeg,
      longitudeOfPeriapsisDeg,
      subsolarLongitudeDeg,
      pressureAtm,
      o2Pct,
      co2Pct,
      arPct,
      h2oPct,
      ch4Pct,
      h2Pct,
      hePct,
      so2Pct,
      nh3Pct,
      greenhouseMode,
      tectonicRegime: tecRegime,
      mantleOxidation: planet.mantleOxidation || "earth",
      radioisotopeAbundance,
      radioisotopeMode,
      u238Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.u238Abundance ?? 1, 0, 5) : undefined,
      u235Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.u235Abundance ?? 1, 0, 5) : undefined,
      th232Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.th232Abundance ?? 1, 0, 5) : undefined,
      k40Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.k40Abundance ?? 1, 0, 5) : undefined,
    },
    derived: {
      starMassKg,
      starRadiusRsol: star.radiusRsol,
      starLuminosityLsol: star.luminosityLsol,
      hzInnerAu,
      hzOuterAu,
      inHabitableZone,
      insolationEarth,
      tidalLockStarGyr,
      tidallyLockedToStar,
      tidallyEvolved,
      atmospherePreventsLocking,
      spinOrbitResonance: resonance ? resonance.ratio : null,
      resonanceRotationHours,
      liquidWaterPossible,

      skyColourDayHex: sky.dayHex,
      skyColourDayEdgeHex: sky.dayEdgeHex,
      skyColourHorizonHex: sky.horizonHex,
      skyColourHorizonEdgeHex: sky.horizonEdgeHex,
      skySpectralKey: sky.spectralKey,

      densityGcm3,
      radiusEarth,
      radiusKm,
      gravityG,
      gravityMs2,
      escapeVelocityVEarth,
      escapeVelocityKms,
      rotationDirection,
      tropics,
      polarCircles,

      surfaceTempK: tKel,
      surfaceTempC: tC,
      absorbedFluxWm2,
      climateState,

      horizonKm,

      periapsisAu,
      apoapsisAu,
      tEqPeriK: Math.round(tEqPeriK),
      tEqApoK: Math.round(tEqApoK),
      volatileFlags,
      nearestResonance,
      orbitalPeriodEarthYears,
      orbitalPeriodEarthDays,
      localDaysPerYear,
      orbitalDirection,

      pressureKpa,
      n2Pct,
      n2PctRaw: rawN2PctRaw,
      gasInputTotalPct: rawGasInputTotalPct,
      gasMixOverflowPct: rawGasMixOverflowPct,
      gasMixClamped: rawGasMixClamped,
      greenhouseMode,
      greenhouseEffect,
      computedGreenhouseEffect,
      computedGreenhouseTau: computedTau,

      ppO2Atm,
      ppCO2Atm,
      ppArAtm,
      ppN2Atm,
      ppH2OAtm,
      ppCH4Atm,
      ppH2Atm,
      ppHeAtm,
      ppSO2Atm,
      ppNH3Atm,
      ppO2Kpa,
      ppCO2Kpa,
      ppArKpa,
      ppN2Kpa,
      ppH2OKpa,
      ppCH4Kpa,
      ppH2Kpa,
      ppHeKpa,
      ppSO2Kpa,
      ppNH3Kpa,
      atmWeightKgMol,
      atmDensityKgM3,

      // Jeans escape
      jeansEscape: {
        exobaseTempK: Math.round(exobaseTempK),
        xuvFluxRatio: fXuvRatio,
        tEqNoGhK: Math.round(tEqNoGh),
        species: jeansSpecies,
        stripped,
        atmosphericEscape,
      },

      circulationCellCount: cellCount,
      circulationCellRanges: cellRanges,

      apparentStarDeg,

      // Classification & composition (Phase A)
      bodyClass: bClass,
      compositionClass: compClass,
      waterRegime: watRegime,
      coreRadiusFraction,
      coreRadiusKm,
      suggestedCmfPct,
      cmfIsAuto,

      // Magnetic field (Phase B)
      dynamoActive: magField.dynamoActive,
      dynamoReason: magField.dynamoReason,
      coreState: magField.coreState,
      fieldMorphology: magField.fieldMorphology,
      surfaceFieldEarths: magField.surfaceFieldEarths,
      fieldLabel: magField.fieldLabel,
      planetTidalHeatingW,
      planetTidalHeatingWm2,
      planetTidalFraction,
      planetTidalHeatingEarth: planetTidalHeatingWm2 / 0.087,

      // Mantle & tectonics (Phase C)
      tectonicRegime: tecRegime,
      tectonicSuggested: tecProbs.suggested,
      tectonicProbabilities: tecProbs,
      tectonicAdvisory: tecAdvisory,
      mantleOxidation: outgassing.oxidationLabel,
      primaryOutgassedSpecies: outgassing.primarySpecies,
      outgassingHint: outgassing.atmosphereHint,
      radioisotopeAbundance,

      vegetationPaleHex: veg.paleHex,
      vegetationDeepHex: veg.deepHex,
      vegetationStops: veg.stops,
      vegetationTwilightPaleHex: veg.twilightPaleHex,
      vegetationTwilightDeepHex: veg.twilightDeepHex,
      vegetationTwilightStops: veg.twilightStops,
      vegetationNote: veg.note,
    },
    display: {
      hz: `${fmt(hzInnerAu, 3)} – ${fmt(hzOuterAu, 3)} AU`,
      starRadiusKm: fmt(star.radiusRsol * 696340, 0) + " km",
      starLuminosity: fmt(star.luminosityLsol, 6) + " L☉",
      density: fmt(densityGcm3, 3) + " g/cm³",
      radius: fmt(radiusEarth, 3) + " R⊕",
      gravity: fmt(gravityG, 3) + " g",
      escape: fmt(escapeVelocityKms, 2) + " km/s",
      tempK: fmt(tKel, 0) + " K",
      tempC: fmt(tC, 0) + " °C",
      horizon: fmt(horizonKm, 2) + " km",
      peri: fmt(periapsisAu, 4) + " AU",
      apo: fmt(apoapsisAu, 4) + " AU",
      tempPeri:
        eccentricity > 0.005
          ? fmt(Math.round(tEqPeriK), 0) + " K (" + fmt(Math.round(tEqPeriK) - 273, 0) + " \u00b0C)"
          : null,
      tempApo:
        eccentricity > 0.005
          ? fmt(Math.round(tEqApoK), 0) + " K (" + fmt(Math.round(tEqApoK) - 273, 0) + " \u00b0C)"
          : null,
      volatileSummary: volatileFlags
        ? volatileFlags
            .filter((v) => v.canSublimate)
            .map((v) => v.note)
            .join("; ") || "All surface ices stable"
        : null,
      resonance: nearestResonance
        ? `${nearestResonance.label} (${fmt(nearestResonance.resonanceAu, 3)} AU, ${fmt(nearestResonance.deltaPct * 100, 1)}% off)`
        : "No nearby resonance",
      yearDays: fmt(orbitalPeriodEarthDays, 2) + " days",
      localDays: fmt(localDaysPerYear, 2) + " local days",
      pressureKpa: fmt(pressureKpa, 2) + " kPa",
      atmWeight: fmt(atmWeightKgMol, 5) + " kg/mol",
      atmDensity: fmt(atmDensityKgM3, 4) + " kg/m³",
      apparentStar: fmt(apparentStarDeg, 3) + "°",
      insolation: fmt(insolationEarth, 3) + "× Earth",
      tidalLock: atmospherePreventsLocking
        ? "Atmosphere-stabilised"
        : tidallyLockedToStar
          ? "Synchronous (1:1)"
          : tidallyEvolved
            ? `Spin-orbit resonance (${resonance.ratio})`
            : fmt(tidalLockStarGyr, 2) + " Gyr to despinning",
      bodyClass: bClass,
      compositionClass: compClass,
      waterRegime: watRegime,
      climateState,
      absorbedFlux: fmt(absorbedFluxWm2, 1) + " W/m\u00b2",
      coreRadius: `${fmt(coreRadiusFraction, 2)} R (${fmt(coreRadiusKm, 0)} km)`,
      suggestedCmf: `~${fmt(suggestedCmfPct, 0)}%`,
      suggestedCmfNote:
        (star.metallicityFeH ?? 0) === 0
          ? "solar metallicity"
          : `[Fe/H] ${(star.metallicityFeH ?? 0) > 0 ? "+" : ""}${fmt(star.metallicityFeH ?? 0, 2)}, ${(star.metallicityFeH ?? 0) > 0 ? "iron-rich" : "iron-poor"}`,
      cmfIsAuto,
      magneticField: magField.dynamoActive
        ? `${magField.fieldLabel} (${fmt(magField.surfaceFieldEarths, 2)}\u00d7 Earth)`
        : "None",
      fieldMorphology:
        magField.fieldMorphology === "none"
          ? "\u2014"
          : magField.fieldMorphology.charAt(0).toUpperCase() + magField.fieldMorphology.slice(1),
      outgassing: outgassing.primarySpecies,
      moonTidalHeating:
        planetTidalHeatingWm2 / 0.087 >= 0.01
          ? `${fmt(planetTidalHeatingWm2 / 0.087, 2)}\u00d7 Earth geothermal`
          : null,
      tectonicRegime:
        tecRegime === "plutonic-squishy"
          ? "Plutonic-Squishy"
          : tecRegime.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      tectonicIsAuto: tecRegimeInput === "auto",
      radioisotopeAbundance:
        radioisotopeAbundance === 1
          ? "Earth (1.0\u00d7)"
          : fmt(radioisotopeAbundance, 2) + "\u00d7 Earth",
    },
  };
}
