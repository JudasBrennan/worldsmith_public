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

import { clamp, toFinite, round, fmt } from "./utils.js";

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

/* ── Mass ↔ Radius (Chen & Kipping 2017) ────────────────────────── */

// Continuity constants chosen so the piecewise relation is continuous:
//   Neptunian (2–131.6 Me):    R_e = C_N · M_e^0.53
//   Jovian    (131.6–26600 Me): R_e = C_J · M_e^(−0.044)
// Calibrated to Solar System: Neptune 17.15 Me → 3.88 Re, Jupiter 317.8 Me → 11.0 Re
const C_N = 0.861; // Neptunian coefficient (calibrated to Neptune)
const EXP_N = 0.53; // Neptunian exponent
const BOUNDARY_ME = 131.6; // Neptunian-Jovian transition (0.414 Mjup)
const C_J_RAW = C_N * BOUNDARY_ME ** EXP_N * BOUNDARY_ME ** 0.044; // continuity

function massToRadiusEarth(massEarth) {
  const m = Math.max(1, massEarth);
  if (m < BOUNDARY_ME) return C_N * m ** EXP_N;
  return C_J_RAW * m ** -0.044;
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

const SUDARSKY = [
  {
    cls: "I",
    maxTeq: 150,
    cloud: "Ammonia",
    bondAlbedo: 0.57,
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
  if (massMjup < 0.15 && teqK < 100) {
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
      return { ...s, subtype: massMjup < 0.15 ? "Ice giant" : "Gas giant" };
    }
  }
  return { ...SUDARSKY[4], subtype: "Gas giant" };
}

/* ── Cloud layers ────────────────────────────────────────────────── */

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

/* ── Atmospheric composition ─────────────────────────────────────── */

// Solar-baseline trace-gas number fractions (%).
// At Z = 1× solar these are the mixing ratios in a H₂-dominated envelope.
const SOLAR_CH4_PCT = 0.075;
const SOLAR_NH3_PCT = 0.008;
const SOLAR_H2O_PCT = 0.025;
const SOLAR_CO_PCT = 0.05; // CO dominates over CH₄ at T > 1000 K

function getAtmosphere(massMjup, teqK, metallicity) {
  const Z = clamp(metallicity, 0.1, 200);
  const isIceGiant = massMjup < 0.15;
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

// Ratio of total emitted power to absorbed stellar power.
// Interpolated from Solar System giants.
// Jupiter ~1.67, Saturn ~2.5, Neptune ~2.6, Uranus ~1.06
function internalHeatRatio(massMjup) {
  const m = clamp(toFinite(massMjup, 1), 0.01, 100);
  if (m < 0.05) return 1.06; // Uranus-like (little internal heat)
  if (m < 0.1) return 1.5 + (m - 0.05) * 22; // ramp Uranus→Neptune
  if (m < 0.2) return 2.6; // Neptune-like
  if (m < 0.5) return 2.6 - (m - 0.2) * 3.0; // ramp Neptune→Saturn
  if (m < 1.5) return 1.7; // Jupiter-like
  // More massive → more residual heat from contraction
  return 1.7 + Math.log10(m / 1.5) * 0.5;
}

/* ── Magnetic field ──────────────────────────────────────────────── */

// Jupiter reference values
const JUPITER_DIPOLE_AM2 = 1.55e20; // A·m²
const JUPITER_SURFACE_GAUSS = 4.28;
const JUPITER_ROTATION_S = 9.925 * 3600;

function calcMagnetic(massMjup, radiusKm, rotationS, orbitAu) {
  // Christensen 2009 energy-flux scaling simplified:
  // Dipole moment scales as (mass/Mj)^(1/3) × (radius/Rj)^(3) × (rotation/Pj)^(-1/3)
  // This is a simplified parametric scaling, not the full Christensen model.
  const mRatio = clamp(massMjup, 0.01, 100);
  const rRatio = radiusKm / JUPITER_RADIUS_KM;
  const pRatio = rotationS / JUPITER_ROTATION_S;

  const dipole = JUPITER_DIPOLE_AM2 * mRatio ** (1 / 3) * rRatio ** 3 * pRatio ** (-1 / 3);
  const surfaceGauss = (JUPITER_SURFACE_GAUSS * mRatio ** (1 / 3)) / pRatio ** (1 / 3);

  // Magnetopause standoff: R_mp/R_p = (B²/(μ₀·ρ_sw·v_sw²))^(1/6)
  // Solar wind density scales as 1/r², velocity ~400 km/s constant
  // At Jupiter (5.2 AU): R_mp ≈ 75 Rj
  // Scale: R_mp ∝ B^(1/3) × r_orbit^(1/3)
  const bRatio = surfaceGauss / JUPITER_SURFACE_GAUSS;
  const rOrbitRatio = orbitAu / 5.2;
  const magnetopauseRp = 75 * bRatio ** (1 / 3) * rOrbitRatio ** (1 / 3);

  return {
    dipoleMomentAm2: dipole,
    surfaceFieldGauss: round(surfaceGauss, 3),
    magnetopauseRp: round(magnetopauseRp, 1),
    magnetopauseKm: round(magnetopauseRp * radiusKm, 0),
  };
}

/* ── Atmospheric dynamics ────────────────────────────────────────── */

function calcDynamics(massMjup, radiusKm, rotationHours, tEffK) {
  const isIceGiant = massMjup < 0.15;
  const omega = (2 * Math.PI) / (rotationHours * 3600); // rad/s
  const rM = radiusKm * 1000;

  // Rhines scale: L_Rh = π × √(U / β), β = 2Ω/R
  // Approximate wind speed: scale from Jupiter (150 m/s)
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
 * @returns {object} Comprehensive gas giant model
 */
export function calcGasGiant({
  massMjup: rawMass,
  radiusRj: rawRadius,
  orbitAu,
  rotationPeriodHours,
  metallicity: rawMetallicity,
  starMassMsol,
  starLuminosityLsol,
  starAgeGyr: _starAgeGyr,
  starRadiusRsol: _starRadiusRsol,
}) {
  /* ── Resolve mass ↔ radius ─────────────────────────────────────── */

  const orbit = clamp(toFinite(orbitAu, 5.2), 0.01, 1e6);
  const rot = clamp(toFinite(rotationPeriodHours, 10), 1, 100);
  const sMass = clamp(toFinite(starMassMsol, 1), 0.075, 100);
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));

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
  const gravityG = gravityMs2 / 9.80665;
  const escapeVelocityMs = Math.sqrt((2 * G * massKg) / radiusM);
  const escapeVelocityKms = escapeVelocityMs / 1000;

  /* ── Temperature ───────────────────────────────────────────────── */

  // First-pass equilibrium temp (used for Sudarsky classification)
  const teqFirst = (279 * Math.sqrt(sLum)) / Math.sqrt(orbit);
  const sud = classifySudarsky(teqFirst, massMjup);
  const bondAlbedo = sud.bondAlbedo;

  // Corrected equilibrium temperature with albedo
  const teqK = (279 * (1 - bondAlbedo) ** 0.25 * Math.sqrt(sLum)) / Math.sqrt(orbit);
  const ihRatio = internalHeatRatio(massMjup);
  const tEffK = (teqK ** 4 * ihRatio) ** 0.25;
  const internalFlux = Math.max(0, SIGMA * (tEffK ** 4 - teqK ** 4));

  /* ── Classification ───────────────────────────────────────────── */

  // Sudarsky class uses the zero-albedo temperature (teqFirst) since the
  // classification itself determines the albedo — avoids iterative instability.
  const sudFinal = classifySudarsky(teqFirst, massMjup);
  const isIceGiant = massMjup < 0.15;

  /* ── Metallicity ──────────────────────────────────────────────── */

  const hasMetallicity =
    rawMetallicity != null && Number.isFinite(Number(rawMetallicity)) && Number(rawMetallicity) > 0;
  const metallicitySource = hasMetallicity ? "user" : "derived";

  /* ── Atmosphere & clouds ───────────────────────────────────────── */

  // Use effective temperature (includes internal heating) for cloud/atmosphere
  // decisions — more physically realistic than equilibrium T alone.
  // Resolve metallicity: use user value if provided, otherwise estimate from mass.
  // Cannot use toFinite(null, fallback) here — Number(null) === 0 is finite.
  const resolvedMetallicity = hasMetallicity
    ? clamp(Number(rawMetallicity), 0.1, 200)
    : estimateMetallicity(massMjup);

  const atmosphere = getAtmosphere(massMjup, tEffK, resolvedMetallicity);
  const clouds = getClouds(tEffK, isIceGiant);

  /* ── Magnetic field ────────────────────────────────────────────── */

  const rotationS = rot * 3600;
  const magnetic = calcMagnetic(massMjup, radiusKm, rotationS, orbit);

  /* ── Gravitational zones ───────────────────────────────────────── */

  const massRatio = massMjup / (sMass * MSOL_PER_MJUP);
  const hillSphereAu = orbit * (massRatio / 3) ** (1 / 3);
  const hillSphereKm = hillSphereAu * AU_KM;

  const rocheLimitIceKm = 2.44 * radiusKm * (densityGcm3 / 0.9) ** (1 / 3);
  const rocheLimitRockKm = 2.44 * radiusKm * (densityGcm3 / 3.0) ** (1 / 3);
  const chaoticZoneHalfAu = orbit * 1.3 * massRatio ** (2 / 7);

  /* ── Dynamics ──────────────────────────────────────────────────── */

  const dynamics = calcDynamics(massMjup, radiusKm, rot, tEffK);

  /* ── Orbital ───────────────────────────────────────────────────── */

  const orbitalPeriodYears = Math.sqrt(orbit ** 3 / sMass);
  const orbitalVelocityKms = (2 * Math.PI * orbit * AU_KM) / (orbitalPeriodYears * 365.25 * 86400);

  /* ── Assemble output ───────────────────────────────────────────── */

  return {
    inputs: {
      massMjup,
      radiusRj,
      orbitAu: orbit,
      rotationPeriodHours: rot,
      metallicitySolar: atmosphere.metallicitySolar,
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
      escapeVelocityKms: round(escapeVelocityKms, 2),
    },

    thermal: {
      equilibriumTempK: round(teqK, 1),
      effectiveTempK: round(tEffK, 1),
      internalHeatRatio: round(ihRatio, 2),
      internalFluxWm2: round(internalFlux, 3),
      bondAlbedo: round(sudFinal.bondAlbedo, 3),
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

    orbital: {
      orbitalPeriodYears: round(orbitalPeriodYears, 4),
      orbitalVelocityKms: round(orbitalVelocityKms, 2),
    },

    appearance: {
      colourHex: sudFinal.hex,
      colourLabel: sudFinal.label,
    },

    display: {
      mass: `${fmt(massMjup, 3)} Mj (${fmt(massEarth, 1)} M⊕)`,
      radius: `${fmt(radiusRj, 3)} Rj (${fmt(radiusKm, 0)} km)`,
      density: `${fmt(densityGcm3, 3)} g/cm³`,
      gravity: `${fmt(gravityG, 2)} g (${fmt(gravityMs2, 1)} m/s²)`,
      escapeVelocity: `${fmt(escapeVelocityKms, 1)} km/s`,
      equilibriumTemp: `${fmt(teqK, 0)} K`,
      effectiveTemp: `${fmt(tEffK, 0)} K`,
      classification: sudFinal.label,
      hillSphere: `${fmt(hillSphereAu, 3)} AU (${fmt(hillSphereKm, 0)} km)`,
      rocheLimit: `${fmt(rocheLimitIceKm, 0)} km (ice) / ${fmt(rocheLimitRockKm, 0)} km (rock)`,
      magneticField: `${fmt(magnetic.surfaceFieldGauss, 2)} G`,
      magnetosphere: `${fmt(magnetic.magnetopauseRp, 0)} Rp (${fmt(magnetic.magnetopauseKm, 0)} km)`,
      bands: `${dynamics.bandCount} bands, ${dynamics.windDirection} winds`,
      windSpeed: `${fmt(dynamics.equatorialWindMs, 0)} m/s`,
      orbitalPeriod: `${fmt(orbitalPeriodYears, 2)} yr`,
      orbitalVelocity: `${fmt(orbitalVelocityKms, 1)} km/s`,
      chaoticZone: `±${fmt(chaoticZoneHalfAu, 3)} AU`,
      metallicity: `${fmt(atmosphere.metallicitySolar, 1)}× solar`,
    },
  };
}
