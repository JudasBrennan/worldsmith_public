// Gas Giant physics engine
//
// Derives comprehensive physical, thermal, atmospheric, magnetic,
// gravitational, and dynamical properties for gas giants from
// mass, radius, orbit, rotation, and host-star parameters.
//
// Key references:
//   Chen & Kipping 2017 — mass-radius relation
//   Sudarsky et al. 2000 — appearance classification (classes I–V)
//   Christensen et al. 2009 — magnetic dynamo scaling
//   Wisdom 1980 — chaotic zone width
//   Rhines 1975 — atmospheric band scaling

import {
  clamp,
  toFinite,
  round,
  fmt,
  eccentricityFactor,
  spinOrbitResonance,
  MOON_VOLATILE_TABLE,
  jeansParameter,
  vaporPressurePa,
  escapeTimescaleSeconds,
} from "./utils.js";
import { findNearestResonance } from "./debrisDisk.js";

/* ── Constants ───────────────────────────────────────────────────── */

const G = 6.674e-11; // m³ kg⁻¹ s⁻²
const SIGMA = 5.6704e-8; // Stefan-Boltzmann, W m⁻² K⁻⁴
const JUPITER_MASS_KG = 1.8982e27;
const JUPITER_RADIUS_KM = 69911;
const EARTH_RADIUS_KM = 6371;
const EARTH_MASS_PER_MJUP = 317.83;
const RJ_PER_RE = JUPITER_RADIUS_KM / EARTH_RADIUS_KM; // ~10.97
const AU_KM = 1.496e8;
const MSOL_PER_MJUP = 1047.35; // M☉/Mj
const SATURN_MASS_MJUP = 0.2994;
const F_XUV_SUN_1AU = 4.64; // erg/cm²/s, present-day solar XUV at 1 AU (Ribas 2005)
const SUN_AGE_GYR = 4.6;
const HEATING_EFFICIENCY = 0.15; // energy-limited mass-loss efficiency ε
const EARTH_GRAVITY_MS2 = 9.80665; // standard gravity (m/s²)
const ICE_GIANT_MASS_MJUP = 0.15; // ice-giant / gas-giant boundary (~48 M⊕)
const S_PER_GYR = 3.156e16; // seconds per gigayear
const MU_0 = 4 * Math.PI * 1e-7; // T·m/A — vacuum permeability
const P_SW_1AU = 2.0e-9; // Pa — solar wind dynamic pressure at 1 AU

/* ── Jeans escape constants ──────────────────────────────────────── */

const R_GAS = 8.3145; // J/(mol·K) — universal gas constant
const MW_H2 = 0.002; // kg/mol
const MW_HE = 0.004;
const MW_CH4 = 0.016;
const MW_NH3 = 0.017;
const MW_H2O = 0.018;
const MW_CO = 0.028;

const JEANS_RETAINED = 6; // λ ≥ 6: firmly retained over Gyr
const JEANS_MARGINAL = 3; // 3 ≤ λ < 6: marginal (slow escape)

// Non-thermal escape multipliers (Gunell et al. 2018)
const NT_H2_FACTOR = 3.0; // charge exchange, polar wind
const NT_HE_FACTOR = 5.0; // ion pickup
const NT_TEMP_FLOOR_K = 100; // non-thermal negligible below this

// Gas-giant exobase model (Yelle 2004, Murray-Clay et al. 2009)
const GG_EXOBASE_BASE_K = 200; // UV + gravity-wave heating floor (Strobel & Atreya 1983)
const GG_EXOBASE_XUV_COEFF = 3.5; // XUV heating efficiency for extended H₂/He envelopes
const GG_EXOBASE_MAX_K = 10000; // hydrodynamic blow-off cap (Lyman-α + H₃⁺ thermostat)

/* ── Mass ↔ Radius (Chen & Kipping 2017) ────────────────────────── */

// Continuity constants chosen so the piecewise relation is continuous:
//   Neptunian (2–131.6 Me):    R_e = C_N · M_e^0.53
//   Jovian    (131.6–26600 Me): R_e = C_J · M_e^(−0.044)
// Calibrated to Solar System: Neptune 17.15 Me → 3.88 Re, Jupiter 317.8 Me → 11.0 Re
const C_N = 0.861; // Neptunian coefficient (calibrated to Neptune)
const EXP_N = 0.53; // Neptunian exponent
const BOUNDARY_ME = 131.6; // Neptunian-Jovian transition (0.414 Mjup)
const EXP_J = -0.044; // Jovian exponent (Chen & Kipping 2017, Table 1)
const C_J_RAW = C_N * BOUNDARY_ME ** EXP_N * BOUNDARY_ME ** -EXP_J; // continuity

function massToRadiusEarth(massEarth) {
  const m = Math.max(1, massEarth);
  if (m < BOUNDARY_ME) return C_N * m ** EXP_N;
  return C_J_RAW * m ** EXP_J;
}

function radiusToMassEarth(radiusEarth) {
  const r = Math.max(0.5, radiusEarth);
  // Neptunian inversion: R = C_N · M^0.53 → M = (R / C_N)^(1/0.53)
  const mNept = (r / C_N) ** (1 / EXP_N);
  if (mNept < BOUNDARY_ME) return mNept;
  // Jovian regime: R is essentially flat — uninvertible.
  // Default to 1.0 Mjup (317.83 Me).
  return EARTH_MASS_PER_MJUP;
}

/** Convert Mjup → Rj using Chen & Kipping 2017. */
export function massToRadiusRj(massMjup) {
  const me = toFinite(massMjup, 1) * EARTH_MASS_PER_MJUP;
  const re = massToRadiusEarth(me);
  return re / RJ_PER_RE;
}

/** Convert Rj → Mjup using Chen & Kipping 2017 inverse. */
export function radiusToMassMjup(radiusRj) {
  const re = toFinite(radiusRj, 1) * RJ_PER_RE;
  const me = radiusToMassEarth(re);
  return me / EARTH_MASS_PER_MJUP;
}

/* ── Sudarsky classification ─────────────────────────────────────── */

// Temperature class boundaries and properties (Sudarsky et al. 2000, ApJ 538).
const SUDARSKY = [
  {
    cls: "I",
    maxTeq: 150,
    cloud: "Ammonia",
    bondAlbedo: 0.34,
    hex: "#C4A46C",
    label: "Class I — Ammonia clouds",
  },
  {
    cls: "II",
    maxTeq: 250,
    cloud: "Water",
    bondAlbedo: 0.81,
    hex: "#E8E4D4",
    label: "Class II — Water clouds",
  },
  {
    cls: "III",
    maxTeq: 800,
    cloud: "Cloudless",
    bondAlbedo: 0.12,
    hex: "#3B4559",
    label: "Class III — Cloudless",
  },
  {
    cls: "IV",
    maxTeq: 1400,
    cloud: "Alkali metals",
    bondAlbedo: 0.1,
    hex: "#4A3628",
    label: "Class IV — Alkali metals",
  },
  {
    cls: "V",
    maxTeq: Infinity,
    cloud: "Silicate/iron",
    bondAlbedo: 0.55,
    hex: "#D4654A",
    label: "Class V — Silicate/iron clouds",
  },
];

function classifySudarsky(teqK, massMjup) {
  // Ice-giant override: low mass + cold → methane-dominated appearance
  if (massMjup < ICE_GIANT_MASS_MJUP && teqK < 100) {
    return {
      cls: "I-ice",
      cloud: "Methane",
      bondAlbedo: 0.3,
      hex: "#A8D8E8",
      label: "Ice giant — Methane haze",
      subtype: "Ice giant",
    };
  }
  for (const s of SUDARSKY) {
    if (teqK <= s.maxTeq) {
      return { ...s, subtype: massMjup < ICE_GIANT_MASS_MJUP ? "Ice giant" : "Gas giant" };
    }
  }
  return { ...SUDARSKY[4], subtype: "Gas giant" };
}

/* ── Cloud layers ────────────────────────────────────────────────── */

// Condensation layers by temperature threshold; thresholds from
// Lodders & Fegley (2002) and Visscher et al. (2010).
const CLOUD_DEFS = [
  {
    name: "Iron",
    composition: "Liquid iron droplets",
    thresholdK: 1800,
    above: true,
    pressureBar: 0.01,
    hex: "#3A3A3A",
    iceGiantOnly: false,
  },
  {
    name: "Silicate",
    composition: "MgSiO₃ / Mg₂SiO₄",
    thresholdK: 1400,
    above: true,
    pressureBar: 0.1,
    hex: "#C47040",
    iceGiantOnly: false,
  },
  {
    name: "H₂O",
    composition: "Water ice / liquid",
    thresholdK: 300,
    above: false,
    pressureBar: 5,
    hex: "#FFFFFF",
    iceGiantOnly: false,
  },
  {
    name: "NH₄SH",
    composition: "Ammonium hydrosulfide",
    thresholdK: 200,
    above: false,
    pressureBar: 2,
    hex: "#8B6914",
    iceGiantOnly: false,
  },
  {
    name: "NH₃",
    composition: "Ammonia ice",
    thresholdK: 150,
    above: false,
    pressureBar: 0.7,
    hex: "#F5E6C8",
    iceGiantOnly: false,
  },
  {
    name: "CH₄",
    composition: "Methane ice",
    thresholdK: 80,
    above: false,
    pressureBar: 1.5,
    hex: "#B0D8E8",
    iceGiantOnly: true,
  },
];

function getClouds(teqK, isIceGiant) {
  const layers = [];
  for (const c of CLOUD_DEFS) {
    if (c.iceGiantOnly && !isIceGiant) continue;
    const present = c.above ? teqK >= c.thresholdK : teqK <= c.thresholdK;
    if (present) {
      layers.push({
        name: c.name,
        composition: c.composition,
        tempK: c.thresholdK,
        pressureBar: c.pressureBar,
        colourHex: c.hex,
      });
    }
  }
  return layers;
}

/* ── Atmospheric metallicity ────────────────────────────────────── */

// Empirical mass-metallicity relation (Thorngren & Fortney 2019,
// calibrated to Solar System atmospheric abundances).
//   log₁₀(Z/Z☉) ≈ 0.66 − 0.68 × log₁₀(M/Mj)
// Jupiter (1.0 Mj) → ~4.6×, Saturn (0.3) → ~10×, Neptune (0.054) → ~33×
/** Estimate atmospheric metallicity (× solar) from mass using Thorngren & Fortney 2019. */
export function estimateMetallicity(massMjup) {
  const m = clamp(toFinite(massMjup, 1), 0.01, 13);
  const logZ = 0.66 - 0.68 * Math.log10(m);
  return clamp(round(10 ** logZ, 1), 1, 200);
}

function stellarMetallicityScaleFromFeH(feH) {
  const dex = clamp(toFinite(feH, 0), -3, 1);
  return 10 ** dex;
}

/* ── Atmospheric composition ─────────────────────────────────────── */

// Solar-baseline trace-gas number fractions (%).
// At Z = 1× solar these are the mixing ratios in a H₂-dominated envelope.
const SOLAR_CH4_PCT = 0.075;
const SOLAR_NH3_PCT = 0.008;
const SOLAR_H2O_PCT = 0.025;
const SOLAR_CO_PCT = 0.05; // CO dominates over CH₄ at T > 1000 K

function getAtmosphere(massMjup, teqK, metallicity) {
  const Z = clamp(metallicity, 0.1, 200);
  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;
  const isHot = teqK > 1000;

  // Base H₂:He number ratio (varies by regime)
  const baseH2 = isIceGiant ? 80 : isHot ? 85 : 86;
  const baseHe = isIceGiant ? 18 : 14;

  // Scale trace gases by metallicity
  const ch4 = isHot ? 0 : Math.min(SOLAR_CH4_PCT * Z, 8);
  const nh3 = Math.min(SOLAR_NH3_PCT * Z, 2);
  // Hot atmospheres: H₂O partially dissociates, reducing abundance
  const h2o = isHot ? Math.min(SOLAR_H2O_PCT * Z * 0.3, 1) : Math.min(SOLAR_H2O_PCT * Z, 3);
  const co = isHot ? Math.min(SOLAR_CO_PCT * Z, 5) : 0;

  const totalMetals = ch4 + nh3 + h2o + co;
  const scaleFactor = (100 - totalMetals) / (baseH2 + baseHe);
  const h2 = baseH2 * scaleFactor;
  const he = baseHe * scaleFactor;

  // Dominant trace by abundance
  const traces = [
    { name: "CH₄", pct: ch4 },
    { name: "CO", pct: co },
    { name: "H₂O", pct: h2o },
    { name: "NH₃", pct: nh3 },
  ];
  const best = traces.reduce((a, b) => (a.pct >= b.pct ? a : b));
  const dominantTrace = best.pct > 0 ? best.name : "CH₄";

  return {
    h2Pct: round(h2, 1),
    hePct: round(he, 1),
    ch4Pct: round(ch4, 2),
    nh3Pct: round(nh3, 3),
    h2oPct: round(h2o, 3),
    coPct: round(co, 2),
    dominantTrace,
    metallicitySolar: round(Z, 1),
  };
}

/* ── Internal heat ───────────────────────────────────────────────── */

// Empirical piecewise fit: ratio of total emitted power to absorbed stellar power.
// Interpolated from Solar System giants.
// Jupiter ~1.67, Saturn ~2.5, Neptune ~2.6, Uranus ~1.06
function internalHeatRatio(massMjup) {
  const m = clamp(toFinite(massMjup, 1), 0.01, 100);

  // Sub-ice-giant: minimal Kelvin-Helmholtz contraction heat
  if (m <= 0.04) return 1.05;

  // Ice giant transition: sigmoid onset of contraction heating.
  // Below ~0.05 Mjup, envelopes are too thin for efficient convective
  // heat transport; above ~0.05 Mjup, deepening H₂O/NH₃ ionic layers
  // enable vigorous convection and sustained contraction luminosity.
  if (m <= 0.06) {
    const x = (m - 0.05) / 0.001;
    return 1.05 + 1.6 / (1 + Math.exp(-x));
  }

  // Super-Neptune regime: high contraction heat plateau
  if (m <= 0.15) return 2.65;

  // Ice giant → gas giant transition: declining ratio as absorbed
  // stellar flux grows relative to intrinsic luminosity
  if (m <= 0.3) {
    const t = (m - 0.15) / 0.15;
    return 2.65 - t * 0.88; // 2.65 → 1.77
  }

  // Gas giant regime: gradual decline through Saturn → Jupiter masses
  if (m <= 2.0) {
    const t = (m - 0.3) / 1.7;
    return 1.77 - t * 0.267; // 1.77 → 1.503
  }

  // Super-Jupiter: increasing residual heat from ongoing contraction
  return 1.503 + Math.log10(m / 2.0) * 0.5;
}

/* ── Magnetic field (Christensen energy-flux dynamo) ──────────── */

// Jupiter reference (Connerney+ 2018)
const JUPITER_SURFACE_GAUSS = 4.28;
const JUPITER_DENSITY_GCM3 = 1.326;

// Compositional convection floor: prevents unrealistically weak fields
// for planets with very low thermal flux (e.g. Uranus at 0.042 W/m²).
// Physical basis: compositional convection from phase separation
// (H/He demixing in gas giants, water/ammonia differentiation in
// ice giants) sustains dynamo action even without measurable thermal
// flux.  Jupiter's helium rain alone releases ~0.3–0.5 W/m².
const Q_FLOOR_WM2 = 0.4;

// Dynamo shell outer boundary: fraction of planet radius where the
// conducting region (metallic H or ionic fluid) ends.
//
// Gas giants: metallic hydrogen transition depth.
//   Jupiter (1.0 Mjup): r_o/R ≈ 0.83 (French+ 2012, ApJS 202, 5)
//   Saturn  (0.3 Mjup): r_o/R ≈ 0.40 (Stanley & Glatzmaier 2010)
//   Log-interpolation in mass: r_o/R = 0.40 + 0.43 × log(M/0.3)/log(1/0.3)
//
// Ice giants: density-dependent ionic ocean shell.
//   Less dense ice giants reach ionic dissociation pressure at a larger
//   fractional radius → thicker conducting shell.  Exponent 0.82
//   calibrated to Uranus (ρ=1.27) / Neptune (ρ=1.64) field ratio.
//   Reference: r_o/R ≈ 0.70 at ρ_ref (Stanley & Bloxham 2004)
const ICE_GIANT_REF_DENSITY = Math.sqrt(1.27 * 1.638); // 1.442 g/cm³
function dynamoShellRatio(massMjup, isIceGiant, densityGcm3) {
  if (isIceGiant) {
    return clamp(0.7 * (ICE_GIANT_REF_DENSITY / densityGcm3) ** 0.82, 0.5, 0.85);
  }
  const logRatio = Math.log(clamp(massMjup, 0.15, 13) / 0.3) / Math.log(1.0 / 0.3);
  return clamp(0.4 + 0.43 * logRatio, 0.3, 0.9);
}

// Christensen (2009, Nature 457, 167) energy-flux scaling (un-normalised).
// B_rms ∝ ρ^(1/2) × q^(1/3) × (r_o/R)^n
//
// The theoretical dipole attenuation is (r_o/R)³. The additional 0.2
// accounts for thin-shell dipolarity reduction (Heimpel+ 2005) and
// stable-layer field filtering above the dynamo (Christensen & Wicht 2008).
// Calibrated so Saturn (shell 0.40) reproduces observed 0.21 G.
const SHELL_EXPONENT = 3.2;
function rawGiantFieldStrength(densityGcm3, qEffWm2, shellRatio) {
  return Math.sqrt(densityGcm3) * Math.cbrt(qEffWm2) * shellRatio ** SHELL_EXPONENT;
}

// ── Gas giant self-normalisation (Jupiter) ──
const JUPITER_INTERNAL_FLUX_WM2 = 5.53; // engine-consistent (observed 5.4, Li+ 2018)
const JUPITER_SHELL_RATIO = dynamoShellRatio(1.0, false, 0);
const JUPITER_RAW_FIELD = rawGiantFieldStrength(
  JUPITER_DENSITY_GCM3,
  Math.max(JUPITER_INTERNAL_FLUX_WM2, Q_FLOOR_WM2),
  JUPITER_SHELL_RATIO,
);

// ── Ice giant self-normalisation (Uranus/Neptune geometric mean) ──
// Thin-shell multipolar dynamos operate in a different regime from
// thick-shell dipolar dynamos; separate normalisation avoids
// cross-regime extrapolation through a conductivity fudge factor.
const ICE_GIANT_SURFACE_GAUSS = Math.sqrt(0.23 * 0.14); // 0.1795 G
const ICE_GIANT_REF_SHELL = 0.7; // Stanley & Bloxham (2004)
const ICE_GIANT_RAW_FIELD = rawGiantFieldStrength(
  ICE_GIANT_REF_DENSITY,
  Q_FLOOR_WM2,
  ICE_GIANT_REF_SHELL,
);

// ── Magnetopause plasma inflation from tidally-heated moons ─────
// Chapman-Ferraro gives the vacuum dipole standoff; moons with
// significant tidal heating drive volcanism → outgassing → plasma
// loading that inflates the magnetosphere (e.g. Io plasma torus).
//
// Power-law model: f = (1 + H_moon / H_REF)^γ
// Calibrated to Jupiter (f≈2.4, Io-dominated) and Saturn (f≈1.6).
const PLASMA_H_REF = 4e5; // W — reference heating scale
const PLASMA_GAMMA = 0.047; // power-law inflation exponent
const PLASMA_H_THRESHOLD = 1e8; // W — minimum heating for plasma loading

// Moon self-heating constants (tidal heating ON moons FROM planet).
// Same tidal formula but with M_planet as tide-raiser and moon k₂/Q
// estimated from a cold-body model with tidal-thermal feedback.
const MOON_RHO = 2500; // kg/m³ — rocky/icy average
const MOON_MU_COLD = 65e9; // Pa — cold rock/ice rigidity
const MOON_Q_COLD = 100; // cold dissipation factor
const MOON_MU_MELT = 10e9; // Pa — partially molten rigidity
const MOON_Q_MELT = 10; // molten dissipation factor
const MELT_FLUX_THRESHOLD = 0.02; // W/m² — partial melting onset

/**
 * Tidal heating ON a single moon FROM the planet (Peale+ 1979).
 * dE/dt = (21/2)(k₂/Q)(G M_planet² R_moon⁵ n / a⁶) × f(e)
 * Includes tidal-thermal feedback: intense heating partially melts
 * the interior, reducing rigidity and Q, amplifying dissipation
 * (Io mechanism — Peale+ 1979, Moore 2003).
 */
function moonSelfTidalHeating(moonMassKg, semiMajorAxisM, ecc, planetMassKg) {
  if (ecc <= 0 || semiMajorAxisM <= 0 || moonMassKg <= 0) return 0;

  const rMoonM = Math.cbrt((3 * moonMassKg) / (4 * Math.PI * MOON_RHO));
  const gMoon = (G * moonMassKg) / (rMoonM * rMoonM);
  const k2Cold = 1.5 / (1 + (19 * MOON_MU_COLD) / (2 * MOON_RHO * gMoon * rMoonM));
  const n = Math.sqrt((G * planetMassKg) / semiMajorAxisM ** 3);
  const fe = eccentricityFactor(ecc);

  const hCold =
    (21 / 2) *
    (k2Cold / MOON_Q_COLD) *
    ((G * planetMassKg ** 2 * rMoonM ** 5 * n) / semiMajorAxisM ** 6) *
    fe;

  // Tidal-thermal feedback: intense heating → partial melting → amplification
  const surfaceArea = 4 * Math.PI * rMoonM ** 2;
  const fluxCold = hCold / surfaceArea;

  if (fluxCold > 0.001) {
    const meltFrac = 1 / (1 + (fluxCold / MELT_FLUX_THRESHOLD) ** -3);
    if (meltFrac > 0.01) {
      const effMu = Math.exp(
        Math.log(MOON_MU_COLD) * (1 - meltFrac) + Math.log(MOON_MU_MELT) * meltFrac,
      );
      const effQ = MOON_Q_COLD * (1 - meltFrac) + MOON_Q_MELT * meltFrac;
      const k2Eff = 1.5 / (1 + (19 * effMu) / (2 * MOON_RHO * gMoon * rMoonM));
      return (
        (21 / 2) *
        (k2Eff / effQ) *
        ((G * planetMassKg ** 2 * rMoonM ** 5 * n) / semiMajorAxisM ** 6) *
        fe
      );
    }
  }

  return hCold;
}

/** Sum tidal self-heating across all moons in the system. */
function totalMoonSelfHeating(moons, planetMassKg) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const m of moons) {
    const moonMassKg = (Number(m.massMoon) || 0) * KG_PER_MMOON;
    const aM = (Number(m.semiMajorAxisKm) || 0) * 1000;
    const ecc = Number(m.eccentricity) || 0;
    if (moonMassKg <= 0 || aM <= 0) continue;
    total += moonSelfTidalHeating(moonMassKg, aM, ecc, planetMassKg);
  }
  return total;
}

// ── Atmospheric sputtering plasma from moons ────────────────────
// Moons with sublimation-driven volatile atmospheres (e.g. Triton N₂)
// are sputtered by magnetospheric particles, creating plasma that
// inflates the magnetosphere.  This is distinct from tidal-heating-
// driven volcanism (Io SO₂), which is captured by moonSelfTidalHeating.
//
// Equivalent plasma power:  W_sput = min(P, P_SAT) × π R² / g × K_SPUT
// where P = surface vapor pressure (Pa), P_SAT = pressure above which
// magnetospheric ions are stopped before reaching the surface (sputtering
// saturates), R = moon radius, g = surface gravity, and K_SPUT converts
// the "sputtering source strength" to equivalent watts for the power-law
// plasma inflation formula.
//
// Calibrated so Triton's N₂ sputtering inflates Neptune from 18 → 23 Rp.
const K_SPUT = 6.5e-6; // calibrated sputtering efficiency
const P_SPUT_SAT = 10; // Pa — sputtering pressure saturation (thick atmospheres shield surface)

/**
 * Estimate equivalent plasma power (W) from atmospheric sputtering on a moon.
 *
 * Runs a lightweight volatile analysis using the same utils.js functions
 * as moon.js to identify sublimation-driven atmospheres.  SO₂ is excluded
 * because volcanic outgassing is already captured by the tidal heating proxy.
 *
 * @param {object} inp - moon input object (massMoon, densityGcm3, albedo, ...)
 * @param {number} starLumLsol - host star luminosity (L☉)
 * @param {number} orbitAu - planet's orbital distance from star (AU)
 * @param {number} ageGyr - system age (Gyr)
 * @returns {number} equivalent plasma power in watts (0 if no volatile atmosphere)
 */
function moonSputteringPlasmaW(inp, starLumLsol, orbitAu, ageGyr) {
  const moonMassKg = (Number(inp.massMoon) || 0) * KG_PER_MMOON;
  if (moonMassKg <= 0) return 0;

  const rhoKgM3 = (Number(inp.densityGcm3) || MOON_RHO / 1000) * 1000;
  const rhoGcm3 = rhoKgM3 / 1000;
  const albedo = clamp(Number(inp.albedo) || 0.3, 0, 0.95);

  // Derive physical properties from mass + density
  const rMoonM = Math.cbrt((3 * moonMassKg) / (4 * Math.PI * rhoKgM3));
  const gMoon = (G * moonMassKg) / (rMoonM * rMoonM);
  const vEscMs = Math.sqrt((2 * G * moonMassKg) / rMoonM);

  // Equilibrium temperature (same as moon.js: T_eq = 279 × (1−a)^0.25 × √L / √d)
  const tSurfK =
    orbitAu > 0
      ? (279 * Math.pow(1 - albedo, 0.25) * Math.sqrt(starLumLsol)) / Math.sqrt(orbitAu)
      : 0;
  if (tSurfK <= 0 || gMoon <= 0) return 0;

  const ageSeconds = ageGyr * 3.156e16;

  // Find the dominant retained sublimating species (excluding SO₂).
  // Only sublimation-regime atmospheres count (T < T_tp): above the triple
  // point the ice never condensed during formation, so no surface reservoir
  // exists to sustain sputtering (e.g. Ganymede at 110 K has no N₂ ice).
  let bestPressure = 0;
  let bestMassKg = 0;
  for (const vol of MOON_VOLATILE_TABLE) {
    if (vol.species === "SO\u2082") continue; // volcanic — handled by tidal heating
    if (rhoGcm3 >= vol.maxRho) continue; // not present
    if (tSurfK < vol.subK) continue; // not sublimating
    if (tSurfK >= vol.tTp) continue; // above triple point — no surface ice reservoir
    const lambda = jeansParameter(vol.massAmu, vEscMs, tSurfK);
    if (lambda <= 6) continue;
    const pPa = vaporPressurePa(vol, tSurfK);
    const tEsc = escapeTimescaleSeconds(pPa, gMoon, vol.massAmu, tSurfK, lambda);
    if (tEsc <= ageSeconds) continue; // not geologically retained
    if (pPa > bestPressure) {
      bestPressure = pPa;
      bestMassKg = vol.massAmu * 1.6605e-27;
    }
  }

  if (bestPressure <= 0) return 0;

  // Equivalent plasma power: W = min(P, P_SAT) × π R² / g × K_SPUT
  // P_SAT caps the pressure because at high P the atmosphere is optically
  // thick to sputtering ions — they're stopped before reaching the surface.
  void bestMassKg; // available for future species-dependent yields
  const pEff = Math.min(bestPressure, P_SPUT_SAT);
  return (pEff * Math.PI * rMoonM * rMoonM * K_SPUT) / gMoon;
}

/** Sum sputtering plasma equivalent power across all moons (watts). */
function totalMoonSputteringPlasmaW(moons, starLumLsol, orbitAu, ageGyr) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const m of moons) total += moonSputteringPlasmaW(m, starLumLsol, orbitAu, ageGyr);
  return total;
}

function calcMagnetic(
  massMjup,
  radiusKm,
  densityGcm3,
  internalFluxWm2,
  moonTidalFluxWm2,
  isIceGiant,
  orbitAu,
  moons,
  starLumLsol,
  ageGyr,
) {
  // 1. Total convective heat flux available to drive dynamo
  const qTotal = internalFluxWm2 + moonTidalFluxWm2;
  const qEff = Math.max(qTotal, Q_FLOOR_WM2);

  // 2. Dynamo shell geometry (density-dependent for ice giants)
  const shell = dynamoShellRatio(massMjup, isIceGiant, densityGcm3);

  // 3. Self-normalised surface field (Christensen 2009)
  //    Dual normalisation: gas giants → Jupiter, ice giants → Uranus/Neptune mean
  const rawField = rawGiantFieldStrength(densityGcm3, qEff, shell);
  const surfaceGauss = isIceGiant
    ? ICE_GIANT_SURFACE_GAUSS * (rawField / ICE_GIANT_RAW_FIELD)
    : JUPITER_SURFACE_GAUSS * (rawField / JUPITER_RAW_FIELD);

  // 5. Field morphology (Stanley & Bloxham 2004, Christensen & Aubert 2006)
  //    Gas giants: thick metallic-H shell → dipolar
  //    Ice giants: thin ionic conducting shell → multipolar
  const fieldMorphology = isIceGiant ? "multipolar" : "dipolar";

  // 6. Dipole moment: B_eq = μ₀ m / (4π R³) → m = B R³ / (μ₀/4π)
  //    μ₀/4π = 1e-7 T·m/A
  const radiusM = radiusKm * 1000;
  const surfaceTesla = surfaceGauss * 1e-4;
  const dipoleMomentAm2 = (surfaceTesla * radiusM ** 3) / 1e-7;

  // 7. Magnetopause standoff (Chapman-Ferraro + plasma inflation)
  //    R_CF/R = [B²/(2μ₀ P_sw)]^(1/6)  — first-principles dipole pressure balance
  //    P_sw = P_1AU / r²  — solar wind dynamic pressure at orbit distance
  //    Plasma sources: (a) tidal heating → volcanism (Io SO₂)
  //                    (b) atmospheric sputtering (Triton N₂)
  //    f = (1 + H_total/H_REF)^γ when H_total > threshold
  const bTesla = surfaceGauss * 1e-4;
  const pSw = P_SW_1AU / (orbitAu * orbitAu);
  const rCF = Math.pow((bTesla * bTesla) / (2 * MU_0 * pSw), 1 / 6);
  const massKg = massMjup * JUPITER_MASS_KG;
  const moonHeat = totalMoonSelfHeating(moons, massKg);
  const sputterW = totalMoonSputteringPlasmaW(moons, starLumLsol, orbitAu, ageGyr);
  const totalPlasma = moonHeat + sputterW;
  // Threshold applies to volcanic plasma (tidal heating) only; sputtering
  // is sublimation-driven and operates at lower power levels.
  const hasPlasmaSource = sputterW > 0 || moonHeat >= PLASMA_H_THRESHOLD;
  const plasmaFactor = hasPlasmaSource ? Math.pow(1 + totalPlasma / PLASMA_H_REF, PLASMA_GAMMA) : 1;
  const magnetopauseRp = rCF * plasmaFactor;

  // 8. Field label and Earth-normalised value
  const surfaceFieldEarths = surfaceGauss / 0.31;
  let fieldLabel;
  if (surfaceFieldEarths > 50) fieldLabel = "Extremely strong";
  else if (surfaceFieldEarths > 10) fieldLabel = "Very strong";
  else if (surfaceFieldEarths > 2) fieldLabel = "Strong";
  else if (surfaceFieldEarths > 0.3) fieldLabel = "Moderate";
  else if (surfaceFieldEarths > 0.05) fieldLabel = "Weak";
  else fieldLabel = "Very weak";

  return {
    dynamoActive: true,
    dynamoReason: isIceGiant
      ? "Active dynamo (ionic ocean convection)"
      : "Active dynamo (metallic hydrogen convection)",
    fieldMorphology,
    fieldLabel,
    surfaceFieldGauss: round(surfaceGauss, 3),
    surfaceFieldEarths: round(surfaceFieldEarths, 2),
    shellRatio: round(shell, 3),
    conductivityRegime: isIceGiant ? "ionic" : "metallic-H",
    effectiveFluxWm2: round(qEff, 3),
    dipoleMomentAm2,
    magnetopauseRp: round(magnetopauseRp, 1),
    magnetopauseKm: round(magnetopauseRp * radiusKm, 0),
    sputteringPlasmaW: round(sputterW, 0),
  };
}

/* ── Atmospheric dynamics ────────────────────────────────────────── */

function calcDynamics(massMjup, radiusKm, rotationHours, tEffK) {
  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;
  const omega = (2 * Math.PI) / (rotationHours * 3600); // rad/s
  const rM = radiusKm * 1000;

  // Rhines scale (Rhines 1975): L_Rh = π × √(U / β), β = 2Ω/R
  // Wind speed scaled from Jupiter: 150 m/s at T_eff = 125 K
  const uWind = 150 * Math.sqrt(Math.max(tEffK, 50) / 125);
  const beta = (2 * omega) / rM;
  const lRhines = beta > 0 ? Math.PI * Math.sqrt(uWind / beta) : rM;

  // Number of bands ≈ π·R / L_Rhines (latitudinal bands)
  const bandCount = Math.max(2, Math.min(30, Math.round((Math.PI * rM) / lRhines)));

  // Equatorial wind speed estimate
  const eqWind = isIceGiant ? uWind * 0.8 : uWind;

  // Wind direction: gas giants → eastward (prograde), ice giants → westward
  const windDirection = isIceGiant ? "Westward" : "Eastward";

  return {
    bandCount,
    equatorialWindMs: round(eqWind, 1),
    windDirection,
  };
}

/* ── Oblateness ──────────────────────────────────────────────────── */

function calcOblateness(massMjup, radiusKm, rotationHours, densityGcm3) {
  const massKg = massMjup * JUPITER_MASS_KG;
  const rM = radiusKm * 1000;
  const omega = (2 * Math.PI) / (rotationHours * 3600);
  const q = (omega ** 2 * rM ** 3) / (G * massKg);

  // Effective moment-of-inertia factor ξ = C/(MR²), calibrated via
  // Darwin-Radau to reproduce solar-system gas giant flattening.
  // Gas giants: log-mass interpolation (Saturn 0.239 ↔ Jupiter 0.269)
  // Ice giants: density-dependent  (Uranus 0.276, Neptune 0.225)
  let xi;
  if (massMjup >= ICE_GIANT_MASS_MJUP) {
    const logM = Math.log10(massMjup);
    const logSat = Math.log10(0.3);
    const t = clamp((logM - logSat) / -logSat, 0, 1.5);
    xi = 0.239 + t * 0.03;
  } else {
    xi = clamp(0.276 - 0.138 * (densityGcm3 - 1.27), 0.2, 0.3);
  }

  // Darwin-Radau approximation: f = 2.5q / (1 + 6.25·(1−1.5ξ)²)
  const x = 1 - 1.5 * xi;
  const f = clamp((2.5 * q) / (1 + 6.25 * x * x), 0, 0.5);

  const eqRadiusKm = radiusKm * (1 + f / 3);
  const polRadiusKm = radiusKm * (1 - (2 * f) / 3);
  const j2 = (2 * f - q) / 3; // first-order hydrostatic (was q/3)
  return {
    flattening: round(f, 5),
    equatorialRadiusKm: round(eqRadiusKm, 0),
    polarRadiusKm: round(polRadiusKm, 0),
    j2: round(j2, 6),
  };
}

/* ── Mass loss / evaporation ─────────────────────────────────────── */

function calcMassLoss(massMjup, radiusKm, orbitAu, starMassMsol, starLuminosityLsol, starAgeGyr) {
  const massKg = massMjup * JUPITER_MASS_KG;
  const rM = radiusKm * 1000;
  const age = Math.max(0.1, starAgeGyr);
  // XUV flux: Ribas et al. 2005, ApJ 622 — power-law decay F_XUV ∝ t^−1.23
  const fXuv1Au = F_XUV_SUN_1AU * starLuminosityLsol * (age / SUN_AGE_GYR) ** -1.23;
  const fXuvAtOrbit = fXuv1Au / orbitAu ** 2; // erg/cm²/s
  const fXuvSI = fXuvAtOrbit * 1e-3; // W/m²
  // Energy-limited escape: dM/dt = ε π R³ F_XUV / (G M)
  const massLossKgS = (HEATING_EFFICIENCY * Math.PI * rM ** 3 * fXuvSI) / (G * massKg);
  const evapTimescaleGyr = massKg / Math.max(massLossKgS, 1e-30) / S_PER_GYR;
  // Roche lobe radius (Eggleton 1983, ApJ 268): R_L ≈ 0.462·a·(q/3)^(1/3)
  const starMassMjup = starMassMsol * MSOL_PER_MJUP;
  const rocheLobeKm = 0.462 * orbitAu * (massMjup / (3 * starMassMjup)) ** (1 / 3) * AU_KM;
  const rocheOverflow = radiusKm > rocheLobeKm;
  return {
    massLossRateKgS: massLossKgS,
    evaporationTimescaleGyr: round(Math.min(evapTimescaleGyr, 1e12), 3),
    xuvFluxErgCm2S: round(fXuvAtOrbit, 4),
    rocheLobeRadiusKm: round(rocheLobeKm, 0),
    rocheLobeOverflow: rocheOverflow,
  };
}

/* ── Per-species Jeans escape ─────────────────────────────────────── */

const GG_GAS_SPECIES = [
  { key: "h2", label: "H\u2082", mw: MW_H2 },
  { key: "he", label: "He", mw: MW_HE },
  { key: "ch4", label: "CH\u2084", mw: MW_CH4 },
  { key: "nh3", label: "NH\u2083", mw: MW_NH3 },
  { key: "h2o", label: "H\u2082O", mw: MW_H2O },
  { key: "co", label: "CO", mw: MW_CO },
];

function ggJeansStatus(lambda) {
  if (lambda >= JEANS_RETAINED) return "Retained";
  if (lambda >= JEANS_MARGINAL) return "Marginal";
  return "Lost";
}

function ggEffectiveStatus(lambda, mw, exobaseTempK) {
  const thermal = ggJeansStatus(lambda);
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

/**
 * Gas-giant exobase temperature.
 * Extended H₂/He envelopes absorb XUV efficiently across a large column
 * (no surface to limit absorption depth). The exobase sits at ~nanobar
 * pressure where molecular diffusion dominates.
 *
 * @param {number} tEffK   Effective temperature (includes internal heat)
 * @param {number} fXuvRatio  XUV flux relative to present-day Sun at 1 AU
 * @returns {number} Exobase temperature in K
 */
function computeGasGiantExobaseTemp(tEffK, fXuvRatio) {
  if (tEffK <= 0) return 0;
  const base = Math.max(tEffK, GG_EXOBASE_BASE_K);
  return Math.min(
    base * (1 + GG_EXOBASE_XUV_COEFF * Math.sqrt(Math.max(0, fXuvRatio))),
    GG_EXOBASE_MAX_K,
  );
}

/**
 * Per-species Jeans escape analysis for gas giant atmospheres.
 * @param {number} escapeVelocityKms  Surface escape velocity (km/s)
 * @param {number} exobaseTempK       Exobase temperature (K)
 * @returns {object} Per-species escape status keyed by species key
 */
function computeGasGiantJeansEscape(escapeVelocityKms, exobaseTempK) {
  const vEsc = escapeVelocityKms * 1000; // m/s
  const vEsc2 = vEsc * vEsc;
  const denom = 2 * R_GAS * Math.max(exobaseTempK, 1);
  const species = {};
  for (const g of GG_GAS_SPECIES) {
    const lambda = (vEsc2 * g.mw) / denom;
    const thermal = ggJeansStatus(lambda);
    const status = ggEffectiveStatus(lambda, g.mw, exobaseTempK);
    species[g.key] = {
      lambda: round(lambda, 1),
      thermalStatus: thermal,
      status,
      nonThermal: status !== thermal,
      label: g.label,
    };
  }
  return species;
}

/* ── Moon tidal heating ─────────────────────────────────────────── */

const KG_PER_MMOON = 7.342e22; // kg per lunar mass (M☾)

/**
 * Fluid Love number k₂ for gas/ice giants.
 * k₂ depends on central mass concentration: ice giants have proportionally
 * massive rocky/icy cores (low k₂ ≈ 0.10), while gas giants have large H/He
 * envelopes approaching the fluid limit (k₂ ≈ 0.38). Modelled as a sigmoid
 * in log-mass space, calibrated to Solar System measurements.
 *
 * Jupiter k₂ ≈ 0.379 (Wahl+ 2016, Juno), Saturn k₂ ≈ 0.39 (Lainey+ 2017),
 * Uranus k₂ ≈ 0.104, Neptune k₂ ≈ 0.127 (Gavrilov & Zharkov 1977).
 *
 * @param {number} massMjup  Mass in Jupiter masses
 * @returns {number} Fluid Love number k₂
 */
function gasGiantK2(massMjup) {
  const K2_FLOOR = 0.09; // sub-ice-giant, heavily core-dominated
  const K2_CEIL = 0.385; // gas giant, fluid-envelope-dominated
  const LOG_MID = -1.14; // midpoint ≈ 0.072 Mjup (core→envelope transition)
  const STEEPNESS = 15; // transition sharpness in log-mass space
  const logM = Math.log10(clamp(massMjup, 0.001, 100));
  return K2_FLOOR + (K2_CEIL - K2_FLOOR) / (1 + Math.exp(-STEEPNESS * (logM - LOG_MID)));
}

/**
 * Tidal quality factor Q for gas/ice giants.
 * Piecewise mass-dependent fit calibrated to Solar System observations.
 * Q is non-monotonic: Saturn's Q is anomalously low due to resonance
 * locking (Fuller, Luan & Quataert 2016).
 *
 * Jupiter Q ≈ 3.5×10⁴ (Lainey+ 2009), Saturn Q ≈ 2500
 * (Lainey+ 2012/2017, resonance locking), ice giants Q ≈ 1.5×10⁴
 * (Tittemore & Wisdom 1990, Zhang & Hamilton 2008).
 *
 * @param {number} massMjup  Mass in Jupiter masses
 * @returns {number} Tidal quality factor Q
 */
function gasGiantTidalQ(massMjup) {
  if (massMjup >= 0.8) return 3.5e4; // Jupiter-like (Lainey+ 2009)
  if (massMjup >= 0.5) {
    // Log-space interpolation Saturn → Jupiter
    const t = (massMjup - 0.5) / 0.3;
    return 10 ** (Math.log10(2500) + t * (Math.log10(35000) - Math.log10(2500)));
  }
  if (massMjup >= 0.2) return 2500; // Saturn-like (resonance locking, Fuller+ 2016)
  if (massMjup >= ICE_GIANT_MASS_MJUP) {
    // Log-space interpolation ice giant → Saturn
    const t = (massMjup - ICE_GIANT_MASS_MJUP) / (0.2 - ICE_GIANT_MASS_MJUP);
    return 10 ** (Math.log10(15000) + t * (Math.log10(2500) - Math.log10(15000)));
  }
  return 1.5e4; // Ice giant
}

/**
 * Tidal heating on a gas giant from a single moon (Peale, Cassen & Reynolds 1979).
 * Same formula as planet.js:planetTidalHeatingFromMoon but using fluid k₂ and Q.
 *
 * dE/dt = (21/2) × (k₂/Q) × (G × M_moon² × R_planet⁵ × n / a⁶) × f(e)
 */
function ggTidalHeatingFromMoon(k2, Q, radiusM, moonMassKg, semiMajorAxisM, orbitalPeriodS, ecc) {
  if (semiMajorAxisM <= 0 || orbitalPeriodS <= 0 || ecc <= 0) return 0;
  const n = (2 * Math.PI) / orbitalPeriodS;
  return (
    (21 / 2) *
    (k2 / Q) *
    ((G * moonMassKg ** 2 * radiusM ** 5 * n) / semiMajorAxisM ** 6) *
    eccentricityFactor(ecc)
  );
}

/**
 * Sum tidal heating on a gas giant from all assigned moons.
 * @param {Array|null} moons  Array of moon input objects
 * @param {number} k2         Fluid Love number
 * @param {number} Q          Tidal quality factor
 * @param {number} massKg     Gas giant mass in kg
 * @param {number} radiusM    Gas giant radius in metres
 * @returns {number} Total tidal heating power in Watts
 */
function totalGasGiantTidalHeating(moons, k2, Q, massKg, radiusM) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const m of moons) {
    const moonMassKg = (Number(m.massMoon) || 0) * KG_PER_MMOON;
    const aM = (Number(m.semiMajorAxisKm) || 0) * 1000;
    const ecc = Number(m.eccentricity) || 0;
    if (moonMassKg <= 0 || aM <= 0) continue;
    const orbitalPeriodS = 2 * Math.PI * Math.sqrt(aM ** 3 / (G * massKg));
    total += ggTidalHeatingFromMoon(k2, Q, radiusM, moonMassKg, aM, orbitalPeriodS, ecc);
  }
  return total;
}

/* ── Interior / core ─────────────────────────────────────────────── */

function calcInterior(massMjup) {
  // Thorngren et al. 2016, ApJ 831, 64: M_Z = 49.3 × M_J^0.61 (M⊕)
  const totalHeavy = 49.3 * massMjup ** 0.61;
  const coreMass = Math.min(totalHeavy * 0.5, 25);
  const totalMassEarth = massMjup * EARTH_MASS_PER_MJUP;
  const bulkZ = clamp(totalHeavy / totalMassEarth, 0, 1);
  return {
    totalHeavyElementsMearth: round(totalHeavy, 1),
    estimatedCoreMassMearth: round(coreMass, 1),
    bulkMetallicityFraction: round(bulkZ, 4),
  };
}

/* ── Age-dependent radius correction ─────────────────────────────── */

function calcAgeRadiusCorrection(massMjup, radiusRj, starAgeGyr, teqK) {
  const age = Math.max(0.1, starAgeGyr);
  // Fortney et al. 2007, ApJ 659: simplified Kelvin-Helmholtz cooling
  // ~10% inflation at 5 Gyr reference age, decaying as t^-0.35
  const inflationFactor = 1 + 0.1 * (5 / age) ** 0.35;
  // Hot Jupiter proximity inflation: 0.1–0.3 Rj bonus for T_eq > 1000 K
  let proximityBonus = 0;
  if (teqK > 1000) {
    proximityBonus = 0.1 + 0.2 * clamp((teqK - 1000) / 1000, 0, 1);
  }
  const baseRj = massToRadiusRj(massMjup);
  const suggestedRj = round(baseRj * inflationFactor + proximityBonus, 3);
  const deviation = radiusRj - suggestedRj;
  let note;
  if (Math.abs(deviation) < 0.05) {
    note = `Radius consistent with ${fmt(age, 1)} Gyr cooling`;
  } else if (deviation > 0) {
    note = `Radius ${fmt(deviation, 2)} Rj larger than expected at ${fmt(age, 1)} Gyr`;
  } else {
    note = `Radius ${fmt(Math.abs(deviation), 2)} Rj smaller than expected at ${fmt(age, 1)} Gyr`;
  }
  return {
    suggestedRadiusRj: suggestedRj,
    radiusInflationFactor: round(inflationFactor, 3),
    proximityInflationRj: round(proximityBonus, 3),
    radiusAgeNote: note,
  };
}

/* ── Ring properties ─────────────────────────────────────────────── */

function calcRingProperties(massMjup, teqK, rocheLimitRockKm, rocheLimitIceKm) {
  let ringType, ringComposition;
  if (teqK < 150) {
    ringType = "Icy";
    ringComposition = "Water ice, ammonia ice";
  } else if (teqK < 300) {
    ringType = "Mixed";
    ringComposition = "Ice and silicate dust";
  } else {
    ringType = "Rocky";
    ringComposition = "Silicate dust, rocky debris";
  }
  // Ring mass model: small baseline (captured debris) plus a Gaussian
  // enhancement centred on ~0.3 Mjup.  Saturn-mass cold giants sit in
  // a "sweet spot" where icy moon tidal disruption is most likely
  // (Canup 2010; Crida & Charnoz 2012).  σ = 0.12 in log₁₀(M) keeps
  // the enhancement narrow enough that Jupiter (1 Mjup) stays Tenuous
  // while Saturn (0.3 Mjup) reaches Dense.
  const baseMassKg = 1e12 * Math.sqrt(massMjup); // minimal captured-debris baseline
  const logM = Math.log10(Math.max(0.01, massMjup));
  const logMPeak = Math.log10(SATURN_MASS_MJUP); // ≈ −0.524
  const sigma = 0.12; // log₁₀(M) Gaussian width
  const enhancement = Math.exp(-((logM - logMPeak) ** 2) / (2 * sigma * sigma));
  const estimatedMassKg = baseMassKg + 3e19 * enhancement; // 3e19 ≈ Saturn ring mass
  const areaKm2 = Math.PI * (rocheLimitIceKm ** 2 - rocheLimitRockKm ** 2);
  const surfaceDensity = areaKm2 > 0 ? estimatedMassKg / (areaKm2 * 1e6) : 0;
  const opticalDepth = surfaceDensity / 67; // 67 kg/m² ≈ Saturn B-ring surface density
  let opticalDepthClass;
  if (opticalDepth > 1) opticalDepthClass = "Dense";
  else if (opticalDepth > 0.1) opticalDepthClass = "Moderate";
  else opticalDepthClass = "Tenuous";
  return {
    ringType,
    ringComposition,
    estimatedMassKg,
    opticalDepthClass,
    opticalDepth: round(opticalDepth, 3),
    innerRadiusKm: round(rocheLimitRockKm, 0),
    outerRadiusKm: round(rocheLimitIceKm, 0),
  };
}

/* ── Tidal effects ───────────────────────────────────────────────── */

function calcTidalEffects(massMjup, radiusKm, orbitAu, ecc, starMassMsol, starAgeGyr) {
  const age = Math.max(0.1, starAgeGyr);
  const aRatio = orbitAu / 0.05;
  const rRatio = radiusKm / JUPITER_RADIUS_KM;
  // Locking timescale: ~1 Gyr for 1 Mjup at 0.05 AU around 1 Msol
  const lockingGyr = (aRatio ** 6 * massMjup) / (rRatio ** 5 * starMassMsol ** 2);
  // Circularisation scales inversely with eccentricity dissipation factor
  const eFactor = ecc > 0.001 ? eccentricityFactor(ecc) : 1;
  const circGyr =
    (aRatio ** 6.5 * massMjup) / (rRatio ** 5 * starMassMsol ** 2) / Math.max(1, eFactor);
  return {
    lockingTimescaleGyr: round(lockingGyr, 3),
    isTidallyLocked: lockingGyr < age,
    circularisationTimescaleGyr: round(circGyr, 3),
    isCircularised: circGyr < age,
  };
}

/* ── Main export ─────────────────────────────────────────────────── */

/**
 * Calculate comprehensive gas giant properties.
 *
 * @param {object} params
 * @param {number|null} params.massMjup    Mass in Jupiter masses (null → derive from radius)
 * @param {number|null} params.radiusRj    Radius in Jupiter radii (null → derive from mass)
 * @param {number} params.orbitAu          Orbital distance in AU
 * @param {number} params.rotationPeriodHours  Sidereal rotation period (hours)
 * @param {number|null} params.metallicity Atmospheric metallicity in solar units (null → derive from mass)
 * @param {number} params.starMassMsol     Host star mass (M☉)
 * @param {number} params.starLuminosityLsol  Host star luminosity (L☉)
 * @param {number} params.starAgeGyr       Host star age (Gyr)
 * @param {number} params.starRadiusRsol   Host star radius (R☉)
 * @param {number} [params.stellarMetallicityFeH] Host star metallicity [Fe/H] (dex)
 * @returns {object} Comprehensive gas giant model
 */
export function calcGasGiant({
  massMjup: rawMass,
  radiusRj: rawRadius,
  orbitAu,
  eccentricity: rawEcc,
  inclinationDeg: rawIncl,
  axialTiltDeg: rawTilt,
  rotationPeriodHours,
  metallicity: rawMetallicity,
  starMassMsol,
  starLuminosityLsol,
  starAgeGyr,
  starRadiusRsol,
  stellarMetallicityFeH,
  otherGiants,
  moons,
}) {
  /* ── Resolve mass ↔ radius ─────────────────────────────────────── */

  const orbit = clamp(toFinite(orbitAu, 5.2), 0.01, 1e6);
  const eccentricity = clamp(toFinite(rawEcc, 0), 0, 0.99);
  const inclinationDeg = clamp(toFinite(rawIncl, 0), 0, 180);
  const axialTiltDeg = clamp(toFinite(rawTilt, 0), 0, 180);
  const rot = clamp(toFinite(rotationPeriodHours, 10), 1, 100); // 1–100 h spin period
  const sMass = clamp(toFinite(starMassMsol, 1), 0.075, 100); // H-burning min to ~100 M☉
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));
  const sAge = clamp(toFinite(starAgeGyr, 4.6), 0.01, 15); // 10 Myr to 15 Gyr
  void starRadiusRsol;

  let massMjup, radiusRj;
  let massSource, radiusSource;

  const hasMass = rawMass != null && Number.isFinite(Number(rawMass)) && Number(rawMass) > 0;
  const hasRadius =
    rawRadius != null && Number.isFinite(Number(rawRadius)) && Number(rawRadius) > 0;

  if (hasMass && hasRadius) {
    massMjup = clamp(Number(rawMass), 0.01, 13);
    radiusRj = clamp(Number(rawRadius), 0.15, 2.5);
    massSource = "user";
    radiusSource = "user";
  } else if (hasMass) {
    massMjup = clamp(Number(rawMass), 0.01, 13);
    radiusRj = clamp(massToRadiusRj(massMjup), 0.15, 2.5);
    massSource = "user";
    radiusSource = "derived";
  } else if (hasRadius) {
    radiusRj = clamp(Number(rawRadius), 0.15, 2.5);
    massMjup = clamp(radiusToMassMjup(radiusRj), 0.01, 13);
    massSource = "derived";
    radiusSource = "user";
  } else {
    massMjup = 1;
    radiusRj = 1;
    massSource = "default";
    radiusSource = "default";
  }

  /* ── Physical properties ───────────────────────────────────────── */

  const massEarth = massMjup * EARTH_MASS_PER_MJUP;
  const massKg = massMjup * JUPITER_MASS_KG;
  const radiusKm = radiusRj * JUPITER_RADIUS_KM;
  const radiusEarth = radiusKm / EARTH_RADIUS_KM;
  const radiusM = radiusKm * 1000;
  const volumeM3 = (4 / 3) * Math.PI * radiusM ** 3;
  const densityKgM3 = massKg / volumeM3;
  const densityGcm3 = densityKgM3 / 1000;
  const gravityMs2 = (G * massKg) / radiusM ** 2;
  const gravityG = gravityMs2 / EARTH_GRAVITY_MS2;
  const escapeVelocityMs = Math.sqrt((2 * G * massKg) / radiusM);
  const escapeVelocityKms = escapeVelocityMs / 1000;

  /* ── Temperature ───────────────────────────────────────────────── */

  // First-pass equilibrium temp (used for Sudarsky classification)
  // 279 K = (L☉/(16πσ AU²))^0.25, zero-albedo equilibrium coefficient
  const teqFirst = (279 * Math.sqrt(sLum)) / Math.sqrt(orbit);
  // Sudarsky class uses the zero-albedo temperature (teqFirst) since the
  // classification itself determines the albedo — avoids iterative instability.
  const sudFinal = classifySudarsky(teqFirst, massMjup);
  const bondAlbedo = sudFinal.bondAlbedo;

  // Corrected equilibrium temperature with albedo (same 279 K coefficient)
  const teqK = (279 * (1 - bondAlbedo) ** 0.25 * Math.sqrt(sLum)) / Math.sqrt(orbit);
  const ihRatio = internalHeatRatio(massMjup);
  const tEffK = (teqK ** 4 * ihRatio) ** 0.25;
  const internalFlux = Math.max(0, SIGMA * (tEffK ** 4 - teqK ** 4));

  // Moon tidal heating on the gas giant (Peale et al. 1979, fluid k₂/Q)
  const surfaceAreaM2 = 4 * Math.PI * radiusM ** 2;
  const ggK2 = gasGiantK2(massMjup);
  const ggQ = gasGiantTidalQ(massMjup);
  const moonTidalHeatingW = totalGasGiantTidalHeating(moons, ggK2, ggQ, massKg, radiusM);
  const moonTidalHeatingWm2 = surfaceAreaM2 > 0 ? moonTidalHeatingW / surfaceAreaM2 : 0;
  const moonTidalFraction = internalFlux > 0 ? moonTidalHeatingWm2 / internalFlux : 0;

  // Periapsis / apoapsis equilibrium and effective temps
  const periapsisAu = orbit * (1 - eccentricity);
  const apoapsisAu = orbit * (1 + eccentricity);
  const teqPeriK =
    periapsisAu > 0
      ? (279 * (1 - bondAlbedo) ** 0.25 * Math.sqrt(sLum)) / Math.sqrt(periapsisAu)
      : teqK;
  const teqApoK =
    apoapsisAu > 0
      ? (279 * (1 - bondAlbedo) ** 0.25 * Math.sqrt(sLum)) / Math.sqrt(apoapsisAu)
      : teqK;
  const tEffPeriK = (teqPeriK ** 4 * ihRatio) ** 0.25;
  const tEffApoK = (teqApoK ** 4 * ihRatio) ** 0.25;

  // Insolation (stellar flux relative to Earth)
  const insolationEarth = sLum / orbit ** 2;

  /* ── Classification ───────────────────────────────────────────── */

  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;

  /* ── Metallicity ──────────────────────────────────────────────── */

  const hasMetallicity =
    rawMetallicity != null && Number.isFinite(Number(rawMetallicity)) && Number(rawMetallicity) > 0;
  const metallicitySource = hasMetallicity ? "user" : "derived";
  const stellarFeH = clamp(toFinite(stellarMetallicityFeH, 0), -3, 1);
  const stellarMetallicityScale = stellarMetallicityScaleFromFeH(stellarFeH);

  /* ── Atmosphere & clouds ───────────────────────────────────────── */

  // Use effective temperature (includes internal heating) for cloud/atmosphere
  // decisions — more physically realistic than equilibrium T alone.
  // Resolve metallicity: use user value if provided, otherwise estimate from mass
  // and scale by host-star metallicity (10^[Fe/H]).
  // Cannot use toFinite(null, fallback) here — Number(null) === 0 is finite.
  const resolvedMetallicity = hasMetallicity
    ? clamp(Number(rawMetallicity), 0.1, 200)
    : clamp(estimateMetallicity(massMjup) * stellarMetallicityScale, 0.1, 200);

  const atmosphere = getAtmosphere(massMjup, tEffK, resolvedMetallicity);
  const clouds = getClouds(tEffK, isIceGiant);

  /* ── Magnetic field ────────────────────────────────────────────── */

  const magnetic = calcMagnetic(
    massMjup,
    radiusKm,
    densityGcm3,
    internalFlux,
    moonTidalHeatingWm2,
    isIceGiant,
    orbit,
    moons,
    sLum,
    sAge,
  );

  /* ── Gravitational zones ───────────────────────────────────────── */

  const massRatio = massMjup / (sMass * MSOL_PER_MJUP);
  const hillSphereAu = orbit * (massRatio / 3) ** (1 / 3);
  const hillSphereKm = hillSphereAu * AU_KM;

  // 2.44 = rigid-body Roche limit coefficient (Chandrasekhar 1969)
  const rocheLimitIceKm = 2.44 * radiusKm * (densityGcm3 / 0.9) ** (1 / 3);
  const rocheLimitRockKm = 2.44 * radiusKm * (densityGcm3 / 3.0) ** (1 / 3);
  const chaoticZoneHalfAu = orbit * 1.3 * massRatio ** (2 / 7); // Wisdom (1980) chaotic zone half-width

  /* ── Dynamics ──────────────────────────────────────────────────── */

  const dynamics = calcDynamics(massMjup, radiusKm, rot, tEffK);

  /* ── New physics ────────────────────────────────────────────────── */

  const oblateness = calcOblateness(massMjup, radiusKm, rot, densityGcm3);
  const interior = calcInterior(massMjup);
  const massLoss = calcMassLoss(massMjup, radiusKm, orbit, sMass, sLum, sAge);

  // Per-species Jeans escape
  const fXuvRatio = massLoss.xuvFluxErgCm2S / F_XUV_SUN_1AU;
  const ggExobaseTempK = computeGasGiantExobaseTemp(tEffK, fXuvRatio);
  const ggJeansSpecies = computeGasGiantJeansEscape(escapeVelocityKms, ggExobaseTempK);

  const tidal = calcTidalEffects(massMjup, radiusKm, orbit, eccentricity, sMass, sAge);
  const ringProps = calcRingProperties(massMjup, teqK, rocheLimitRockKm, rocheLimitIceKm);
  const ageRadius = calcAgeRadiusCorrection(massMjup, radiusRj, sAge, teqK);

  // Equatorial gravity (GM/R_eq² — matches NASA convention)
  const eqRadiusM = oblateness.equatorialRadiusKm * 1000;
  const equatorialGravityMs2 = (G * massKg) / eqRadiusM ** 2;
  const equatorialGravityG = equatorialGravityMs2 / EARTH_GRAVITY_MS2;

  /* ── Orbital ───────────────────────────────────────────────────── */

  const orbitalPeriodYears = Math.sqrt(orbit ** 3 / sMass);
  const orbitalPeriodDays = orbitalPeriodYears * 365.25;
  const orbitalVelocityKms = (2 * Math.PI * orbit * AU_KM) / (orbitalPeriodDays * 86400);

  // Orbital direction from inclination
  const orbitalDirection =
    inclinationDeg > 90 ? "Retrograde" : inclinationDeg < 90 ? "Prograde" : "Undefined";

  // Local days per year
  const localDaysPerYear = (orbitalPeriodDays * 24) / rot;

  // Spin-orbit resonance (Goldreich & Peale 1966)
  const tidallyEvolved = tidal.isTidallyLocked;
  const resonance = tidallyEvolved ? spinOrbitResonance(eccentricity) : null;
  const resonanceRotationHours = resonance ? (orbitalPeriodDays * 24) / resonance.p : null;

  // Giant-to-giant mean-motion resonance
  const nearestResonance = findNearestResonance(
    orbit,
    Array.isArray(otherGiants) ? otherGiants : [],
  );

  // Build Jeans escape display string
  let jeansDisplayStr = `Atmospheric escape (T_exo ${fmt(round(ggExobaseTempK, 0), 0)} K, XUV ${fmt(round(fXuvRatio, 2), 2)}\u00d7 Earth):`;
  for (const g of GG_GAS_SPECIES) {
    const sp = ggJeansSpecies[g.key];
    const ntTag = sp.nonThermal ? " (non-thermal)" : "";
    jeansDisplayStr += `\n  ${sp.label}: \u03bb=${fmt(sp.lambda, 1)} \u2014 ${sp.status}${ntTag}`;
  }

  /* ── Assemble output ───────────────────────────────────────────── */

  return {
    inputs: {
      massMjup,
      radiusRj,
      orbitAu: orbit,
      eccentricity,
      inclinationDeg,
      axialTiltDeg,
      rotationPeriodHours: rot,
      metallicitySolar: atmosphere.metallicitySolar,
      stellarMetallicityFeH: round(stellarFeH, 2),
      massSource,
      radiusSource,
      metallicitySource,
    },

    classification: {
      sudarsky: sudFinal.cls,
      label: sudFinal.label,
      subtype: sudFinal.subtype,
      cloudType: sudFinal.cloud,
    },

    physical: {
      massEarth: round(massEarth, 2),
      massMjup: round(massMjup, 4),
      massKg,
      radiusKm: round(radiusKm, 0),
      radiusEarth: round(radiusEarth, 3),
      radiusRj: round(radiusRj, 3),
      densityGcm3: round(densityGcm3, 4),
      gravityMs2: round(gravityMs2, 2),
      gravityG: round(gravityG, 3),
      equatorialGravityMs2: round(equatorialGravityMs2, 2),
      equatorialGravityG: round(equatorialGravityG, 3),
      escapeVelocityKms: round(escapeVelocityKms, 2),
      suggestedRadiusRj: ageRadius.suggestedRadiusRj,
      radiusInflationFactor: ageRadius.radiusInflationFactor,
      proximityInflationRj: ageRadius.proximityInflationRj,
      radiusAgeNote: ageRadius.radiusAgeNote,
    },

    thermal: {
      equilibriumTempK: round(teqK, 1),
      effectiveTempK: round(tEffK, 1),
      teqPeriK: round(teqPeriK, 1),
      teqApoK: round(teqApoK, 1),
      tEffPeriK: round(tEffPeriK, 1),
      tEffApoK: round(tEffApoK, 1),
      internalHeatRatio: round(ihRatio, 2),
      internalFluxWm2: round(internalFlux, 3),
      bondAlbedo: round(sudFinal.bondAlbedo, 3),
      insolationEarth: round(insolationEarth, 4),
      moonTidalHeatingW: round(moonTidalHeatingW, 0),
      moonTidalHeatingWm2: round(moonTidalHeatingWm2, 6),
      moonTidalFraction: round(moonTidalFraction, 4),
      k2: round(ggK2, 3),
      tidalQ: Math.round(ggQ),
    },

    atmosphere,
    clouds,
    magnetic,

    gravity: {
      hillSphereAu: round(hillSphereAu, 4),
      hillSphereKm: round(hillSphereKm, 0),
      rocheLimit_iceKm: round(rocheLimitIceKm, 0),
      rocheLimit_rockKm: round(rocheLimitRockKm, 0),
      chaoticZoneAu: round(chaoticZoneHalfAu, 4),
      ringZoneInnerKm: round(rocheLimitRockKm, 0),
      ringZoneOuterKm: round(rocheLimitIceKm, 0),
    },

    dynamics,
    oblateness,
    interior,
    massLoss,
    jeansEscape: {
      exobaseTempK: round(ggExobaseTempK, 0),
      xuvFluxRatio: round(fXuvRatio, 4),
      species: ggJeansSpecies,
    },
    tidal: {
      ...tidal,
      spinOrbitResonance: resonance ? resonance.ratio : null,
      resonanceRotationHours: resonanceRotationHours ? round(resonanceRotationHours, 2) : null,
    },
    ringProperties: ringProps,

    orbital: {
      periapsisAu: round(periapsisAu, 4),
      apoapsisAu: round(apoapsisAu, 4),
      orbitalPeriodYears: round(orbitalPeriodYears, 4),
      orbitalPeriodDays: round(orbitalPeriodDays, 2),
      orbitalVelocityKms: round(orbitalVelocityKms, 2),
      orbitalDirection,
      localDaysPerYear: round(localDaysPerYear, 2),
      insolationEarth: round(insolationEarth, 4),
      nearestResonance,
    },

    appearance: {
      colourHex: sudFinal.hex,
      colourLabel: sudFinal.label,
    },

    display: {
      mass: `${fmt(massMjup, 3)} Mj (${fmt(massEarth, 1)} M⊕)`,
      radius: `${fmt(radiusRj, 3)} Rj (${fmt(radiusKm, 0)} km)`,
      density: `${fmt(densityGcm3, 3)} g/cm³`,
      gravity: `${fmt(equatorialGravityG, 2)} g (${fmt(equatorialGravityMs2, 1)} m/s²)`,
      escapeVelocity: `${fmt(escapeVelocityKms, 1)} km/s`,
      equilibriumTemp: `${fmt(teqK, 0)} K`,
      effectiveTemp: `${fmt(tEffK, 0)} K`,
      classification: sudFinal.label,
      hillSphere: `${fmt(hillSphereAu, 3)} AU (${fmt(hillSphereKm, 0)} km)`,
      rocheLimit: `${fmt(rocheLimitIceKm, 0)} km (ice) / ${fmt(rocheLimitRockKm, 0)} km (rock)`,
      magneticField: `${fmt(magnetic.surfaceFieldGauss, 2)} G (${magnetic.fieldLabel})`,
      magneticMorphology:
        magnetic.fieldMorphology.charAt(0).toUpperCase() + magnetic.fieldMorphology.slice(1),
      magnetosphere: `${fmt(magnetic.magnetopauseRp, 0)} Rp (${fmt(magnetic.magnetopauseKm, 0)} km)`,
      moonTidalHeating:
        moonTidalHeatingW > 0
          ? `${moonTidalHeatingW.toExponential(2)} W (${fmt(moonTidalFraction * 100, 2)}% of internal heat)`
          : "No moons assigned",
      sputteringPlasma:
        magnetic.sputteringPlasmaW > 0
          ? `${magnetic.sputteringPlasmaW.toExponential(2)} W equiv. (atmospheric sputtering)`
          : "None",
      bands: `${dynamics.bandCount} bands, ${dynamics.windDirection} winds`,
      windSpeed: `${fmt(dynamics.equatorialWindMs, 0)} m/s`,
      orbitalPeriod: `${fmt(orbitalPeriodYears, 2)} yr (${fmt(orbitalPeriodDays, 1)} days)`,
      orbitalVelocity: `${fmt(orbitalVelocityKms, 1)} km/s`,
      insolation: `${fmt(insolationEarth, 3)}× Earth`,
      peri: eccentricity > 0.005 ? `${fmt(periapsisAu, 4)} AU` : null,
      apo: eccentricity > 0.005 ? `${fmt(apoapsisAu, 4)} AU` : null,
      tempPeri:
        eccentricity > 0.005
          ? `T_eq ${fmt(Math.round(teqPeriK), 0)} K, T_eff ${fmt(Math.round(tEffPeriK), 0)} K`
          : null,
      tempApo:
        eccentricity > 0.005
          ? `T_eq ${fmt(Math.round(teqApoK), 0)} K, T_eff ${fmt(Math.round(tEffApoK), 0)} K`
          : null,
      orbitalDirection,
      localDaysPerYear: `${fmt(localDaysPerYear, 2)} local days`,
      resonance: nearestResonance
        ? `${nearestResonance.label} (${fmt(nearestResonance.resonanceAu, 3)} AU, ${fmt(nearestResonance.deltaPct * 100, 1)}% off)`
        : "No nearby resonance",
      chaoticZone: `±${fmt(chaoticZoneHalfAu, 3)} AU`,
      metallicity: `${fmt(atmosphere.metallicitySolar, 1)}× solar`,
      oblateness: `f = ${fmt(oblateness.flattening, 4)} (J₂ = ${fmt(oblateness.j2, 5)})`,
      equatorialRadius: `${fmt(oblateness.equatorialRadiusKm, 0)} km eq / ${fmt(oblateness.polarRadiusKm, 0)} km pol`,
      heavyElements: `${fmt(interior.totalHeavyElementsMearth, 1)} M⊕ total (core ≈ ${fmt(interior.estimatedCoreMassMearth, 1)} M⊕)`,
      bulkMetallicity: `Z = ${fmt(interior.bulkMetallicityFraction, 3)}`,
      massLossRate: `${massLoss.massLossRateKgS.toExponential(2)} kg/s`,
      evaporationTimescale: `${massLoss.evaporationTimescaleGyr >= 1e10 ? "≫ Hubble time" : fmt(massLoss.evaporationTimescaleGyr, 2) + " Gyr"}`,
      rocheLobeRadius: `${fmt(massLoss.rocheLobeRadiusKm, 0)} km${massLoss.rocheLobeOverflow ? " (OVERFLOW)" : ""}`,
      jeansEscape: jeansDisplayStr,
      suggestedRadius: `${fmt(ageRadius.suggestedRadiusRj, 3)} Rj at ${fmt(sAge, 1)} Gyr`,
      radiusAgeNote: ageRadius.radiusAgeNote,
      ringType: `${ringProps.ringType} — ${ringProps.ringComposition}`,
      ringDetails: `τ ≈ ${fmt(ringProps.opticalDepth, 2)} (${ringProps.opticalDepthClass}), ${ringProps.estimatedMassKg.toExponential(2)} kg`,
      tidalLocking: `τ_lock = ${tidal.lockingTimescaleGyr >= 1e6 ? "≫ age" : fmt(tidal.lockingTimescaleGyr, 2) + " Gyr"}${tidal.isTidallyLocked ? (resonance && resonance.ratio !== "1:1" ? ` — Spin-orbit resonance (${resonance.ratio})` : " — Synchronous (1:1)") : ""}`,
      circularisation: `τ_circ = ${tidal.circularisationTimescaleGyr >= 1e6 ? "≫ age" : fmt(tidal.circularisationTimescaleGyr, 2) + " Gyr"}${tidal.isCircularised ? " — Circularised" : ""}`,
    },
  };
}
