/**
 * Tidal heating validation: runs calcMoonExact against NASA datapoints
 * and compares predicted vs observed values for all major Solar System moons.
 *
 * Usage: node scripts/tidal-heating-validation.mjs
 */
import { calcMoonExact } from "../engine/moon.js";

// ── Parent planet overrides (gas giants bypass calcPlanetExact) ──────

const JUPITER = {
  inputs: {
    massEarth: 317.83,
    semiMajorAxisAu: 5.2029,
    eccentricity: 0.0484,
    rotationPeriodHours: 9.925,
    cmfPct: 0,
  },
  derived: {
    densityGcm3: 1.3262,
    radiusEarth: 11.209,
    gravityG: 2.528,
  },
};

const SATURN = {
  inputs: {
    massEarth: 95.16,
    semiMajorAxisAu: 9.5367,
    eccentricity: 0.0539,
    rotationPeriodHours: 10.656,
    cmfPct: 0,
  },
  derived: {
    densityGcm3: 0.6871,
    radiusEarth: 9.449,
    gravityG: 1.065,
  },
};

const NEPTUNE = {
  inputs: {
    massEarth: 17.147,
    semiMajorAxisAu: 30.11,
    eccentricity: 0.0113,
    rotationPeriodHours: 16.11,
    cmfPct: 0,
  },
  derived: {
    densityGcm3: 1.638,
    radiusEarth: 3.866,
    gravityG: 1.137,
  },
};

// Mars override — rocky planet, uses parentOverride to bypass calcPlanetExact
const MARS = {
  inputs: {
    massEarth: 0.1075,
    semiMajorAxisAu: 1.5237,
    eccentricity: 0.0935,
    rotationPeriodHours: 24.6229,
    cmfPct: 26,
  },
  derived: {
    densityGcm3: 3.934,
    radiusEarth: 0.532,
    gravityG: 0.378,
  },
};

const EARTH_PLANET = {
  massEarth: 1,
  cmfPct: 33,
  axialTiltDeg: 23.4,
  albedoBond: 0.3,
  greenhouseEffect: 1,
  observerHeightM: 2,
  rotationPeriodHours: 24,
  semiMajorAxisAu: 1,
  eccentricity: 0.017,
  inclinationDeg: 0,
  longitudeOfPeriapsisDeg: 0,
  subsolarLongitudeDeg: 0,
  pressureAtm: 1,
  o2Pct: 21,
  co2Pct: 0.04,
  arPct: 1,
};

// ── Moon data from NASA JPL / NSSDC fact sheets ─────────────────────
// Mass in Moon-masses (1 Mmoon = 7.342e22 kg)
// Note: engine clamps massMoon to [0.001, 10000]

const MOONS = [
  // ═══ JOVIAN SYSTEM ═══
  {
    name: "Io",
    parent: JUPITER,
    moon: {
      massMoon: 1.2166, // 8.932e22 kg
      densityGcm3: 3.528,
      albedo: 0.52,
      semiMajorAxisKm: 421800,
      eccentricity: 0.0041,
      inclinationDeg: 0.036,
      compositionOverride: "Partially molten",
    },
    observed: {
      totalW: 1.0e14, // Veeder et al. 2012: 0.6–1.6×10¹⁴
      fluxWm2: 2.24,
      recessionCmYr: null,
      source: "Veeder+2012 (0.6–1.6e14 W)",
    },
  },
  {
    name: "Europa",
    parent: JUPITER,
    moon: {
      massMoon: 0.6538, // 4.800e22 kg
      densityGcm3: 3.013,
      albedo: 0.68,
      semiMajorAxisKm: 671100,
      eccentricity: 0.0094,
      inclinationDeg: 0.466,
    },
    observed: {
      totalW: 1.0e12, // Hussmann & Spohn 2004 estimate
      fluxWm2: 0.05,
      recessionCmYr: null,
      source: "Hussmann+Spohn 2004 (est)",
    },
  },
  {
    name: "Ganymede",
    parent: JUPITER,
    moon: {
      massMoon: 2.0184, // 1.4819e23 kg
      densityGcm3: 1.942,
      albedo: 0.43,
      semiMajorAxisKm: 1070400,
      eccentricity: 0.0013,
      inclinationDeg: 0.177,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Negligible (radiogenic only)",
    },
  },
  {
    name: "Callisto",
    parent: JUPITER,
    moon: {
      massMoon: 1.4653, // 1.0759e23 kg
      densityGcm3: 1.834,
      albedo: 0.17,
      semiMajorAxisKm: 1882700,
      eccentricity: 0.0074,
      inclinationDeg: 0.192,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Negligible (not in resonance)",
    },
  },

  // ═══ SATURNIAN SYSTEM ═══
  {
    name: "Mimas",
    parent: SATURN,
    moon: {
      massMoon: 0.000511, // 3.75e19 kg — BELOW engine clamp 0.001!
      densityGcm3: 1.149,
      albedo: 0.96,
      semiMajorAxisKm: 185540,
      eccentricity: 0.0202,
      inclinationDeg: 1.574,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Paradox: high e but no volcanism",
    },
    note: "Mass below engine clamp (0.001 Mmoon)",
  },
  {
    name: "Enceladus",
    parent: SATURN,
    moon: {
      massMoon: 0.001472, // 1.080e20 kg
      densityGcm3: 1.61,
      albedo: 0.81,
      semiMajorAxisKm: 238400,
      eccentricity: 0.0047,
      inclinationDeg: 0.009,
      compositionOverride: "Subsurface ocean",
    },
    observed: {
      totalW: 15.8e9, // Howett et al. 2011
      fluxWm2: 0.02,
      recessionCmYr: null,
      source: "Howett+2011 Cassini (15.8 GW)",
    },
  },
  {
    name: "Tethys",
    parent: SATURN,
    moon: {
      massMoon: 0.00841, // 6.175e20 kg
      densityGcm3: 0.984,
      albedo: 0.8,
      semiMajorAxisKm: 294670,
      eccentricity: 0.0001,
      inclinationDeg: 1.091,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "~Zero (e≈0, nearly pure ice)",
    },
  },
  {
    name: "Dione",
    parent: SATURN,
    moon: {
      massMoon: 0.01492, // 1.0955e21 kg
      densityGcm3: 1.476,
      albedo: 0.52,
      semiMajorAxisKm: 377420,
      eccentricity: 0.0022,
      inclinationDeg: 0.028,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Low; slight geological resurfacing",
    },
  },
  {
    name: "Rhea",
    parent: SATURN,
    moon: {
      massMoon: 0.03142, // 2.307e21 kg
      densityGcm3: 1.233,
      albedo: 0.57,
      semiMajorAxisKm: 527070,
      eccentricity: 0.001,
      inclinationDeg: 0.327,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Negligible (low e, far out)",
    },
  },
  {
    name: "Titan",
    parent: SATURN,
    moon: {
      massMoon: 1.8322, // 1.3452e23 kg
      densityGcm3: 1.881,
      albedo: 0.27,
      semiMajorAxisKm: 1221870,
      eccentricity: 0.0288,
      inclinationDeg: 0.306,
    },
    observed: {
      totalW: 3.5e12, // Lainey et al. 2012/2020
      fluxWm2: 0.005,
      recessionCmYr: null,
      source: "Lainey+2012/2020 (3.5 TW est)",
    },
  },
  {
    name: "Iapetus",
    parent: SATURN,
    moon: {
      massMoon: 0.0246, // 1.806e21 kg
      densityGcm3: 1.083,
      albedo: 0.2,
      semiMajorAxisKm: 3560840,
      eccentricity: 0.0283,
      inclinationDeg: 7.489,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Ancient (despun, equatorial ridge)",
    },
  },

  // ═══ NEPTUNIAN SYSTEM ═══
  {
    name: "Triton",
    parent: NEPTUNE,
    moon: {
      massMoon: 0.2916, // 2.141e22 kg
      densityGcm3: 2.065,
      albedo: 0.7,
      semiMajorAxisKm: 354800,
      eccentricity: 0.000016,
      inclinationDeg: 157.345,
    },
    observed: {
      totalW: null, // Current heating ~0 (orbit circularised)
      fluxWm2: null,
      recessionCmYr: null,
      source: "~Zero now (e≈0, circularised)",
    },
  },

  // ═══ EARTH SYSTEM ═══
  {
    name: "Moon",
    parent: null,
    planet: EARTH_PLANET,
    moon: {
      massMoon: 1.0,
      densityGcm3: 3.344,
      albedo: 0.11,
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.145,
    },
    observed: {
      totalW: 3.0e9, // ~3 GW (mostly radiogenic), tidal contribution ~0.5 GW
      fluxWm2: null,
      recessionCmYr: 3.83, // LLR measurement
      source: "LLR recession 3.83 cm/yr",
    },
  },

  // ═══ MARTIAN SYSTEM ═══
  {
    name: "Phobos",
    parent: MARS,
    moon: {
      massMoon: 0.000000145, // 1.065e16 kg — FAR below engine clamp!
      densityGcm3: 1.876,
      albedo: 0.07,
      semiMajorAxisKm: 9375,
      eccentricity: 0.0151,
      inclinationDeg: 1.075,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: -1.8, // spiralling inward, ~50 Myr to Roche
      source: "Inward migration ~-1.8 cm/yr",
    },
    note: "Mass far below engine clamp (0.001 Mmoon) — results unreliable",
  },
  {
    name: "Deimos",
    parent: MARS,
    moon: {
      massMoon: 0.0000000202, // 1.48e15 kg — FAR below engine clamp!
      densityGcm3: 1.471,
      albedo: 0.07,
      semiMajorAxisKm: 23457,
      eccentricity: 0.0002,
      inclinationDeg: 1.793,
    },
    observed: {
      totalW: null,
      fluxWm2: null,
      recessionCmYr: null,
      source: "Negligible (tiny, nearly circular)",
    },
    note: "Mass far below engine clamp (0.001 Mmoon) — results unreliable",
  },
];

// ── Formatting helpers ───────────────────────────────────────────────

function fmtSci(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  return v.toFixed(4);
}

function fmtRatio(predicted, observed) {
  if (observed == null || observed === 0 || predicted == null) return "—";
  const r = predicted / observed;
  if (r < 0.001) return r.toExponential(1) + "×";
  if (r > 1000) return r.toExponential(1) + "×";
  return r.toFixed(2) + "×";
}

function grade(predicted, observed) {
  if (observed == null || observed === 0 || predicted == null) return "  ";
  const r = predicted / observed;
  if (r >= 0.3 && r <= 3) return "OK";
  if (r >= 0.1 && r <= 10) return "~1";
  return "!!";
}

// ── Run and display ──────────────────────────────────────────────────

const SEP =
  "═══════════════════════════════════════════════════════════════════════════════════════════════════════════";

console.log("\n" + SEP);
console.log("  TIDAL HEATING VALIDATION — WorldSmith vs Solar System Observations");
console.log(SEP);
console.log("");
console.log("  TABLE 1: Tidal Heating Power");
console.log(
  "  ─────────────────────────────────────────────────────────────────────────────────────────────────────",
);
console.log("  Moon          │ Predicted (W)  │ Observed (W)   │ Ratio   │ Grade │ Source");
console.log(
  "  ──────────────┼────────────────┼────────────────┼─────────┼───────┼──────────────────────────────────",
);

for (const entry of MOONS) {
  const args = { starMassMsol: 1, starAgeGyr: 4.6, moon: entry.moon };
  if (entry.parent) args.parentOverride = entry.parent;
  else args.planet = entry.planet;

  const r = calcMoonExact(args);
  const pred = r.tides.tidalHeatingW;
  const obs = entry.observed.totalW;

  const name = entry.name.padEnd(14);
  const predStr = fmtSci(pred).padStart(14);
  const obsStr = (obs != null ? fmtSci(obs) : "—").padStart(14);
  const rat = fmtRatio(pred, obs).padStart(7);
  const g = grade(pred, obs).padStart(5);

  console.log(`  ${name}│ ${predStr} │ ${obsStr} │ ${rat} │ ${g} │ ${entry.observed.source}`);
}

console.log("");
console.log("  TABLE 2: Surface Heat Flux (W/m²)");
console.log(
  "  ─────────────────────────────────────────────────────────────────────────────────────────────────────",
);
console.log(
  "  Moon          │ Predicted      │ Observed       │ Ratio   │ Grade │ Composition class",
);
console.log(
  "  ──────────────┼────────────────┼────────────────┼─────────┼───────┼──────────────────────────────────",
);

for (const entry of MOONS) {
  const args = { starMassMsol: 1, starAgeGyr: 4.6, moon: entry.moon };
  if (entry.parent) args.parentOverride = entry.parent;
  else args.planet = entry.planet;

  const r = calcMoonExact(args);
  const pred = r.tides.tidalHeatingWm2;
  const obs = entry.observed.fluxWm2;

  const name = entry.name.padEnd(14);
  const predStr = fmtSci(pred).padStart(14);
  const obsStr = (obs != null ? fmtSci(obs) : "—").padStart(14);
  const rat = fmtRatio(pred, obs).padStart(7);
  const g = grade(pred, obs).padStart(5);
  const comp = r.tides.compositionClass;

  console.log(`  ${name}│ ${predStr} │ ${obsStr} │ ${rat} │ ${g} │ ${comp}`);
}

console.log("");
console.log("  TABLE 3: Orbital Recession");
console.log(
  "  ─────────────────────────────────────────────────────────────────────────────────────────────────────",
);
console.log(
  "  Moon          │ Predicted cm/yr│ Observed cm/yr │ Ratio   │ Direction │ Orbital fate",
);
console.log(
  "  ──────────────┼────────────────┼────────────────┼─────────┼───────────┼────────────────────────────",
);

for (const entry of MOONS) {
  const args = { starMassMsol: 1, starAgeGyr: 4.6, moon: entry.moon };
  if (entry.parent) args.parentOverride = entry.parent;
  else args.planet = entry.planet;

  const r = calcMoonExact(args);
  const pred = r.tides.recessionCmYr;
  const obs = entry.observed.recessionCmYr;

  const name = entry.name.padEnd(14);
  const predStr = fmtSci(pred).padStart(14);
  const obsStr = (obs != null ? fmtSci(obs) : "—").padStart(14);
  const rat = fmtRatio(pred, obs).padStart(7);
  const dir = (pred > 0 ? "outward" : pred < 0 ? "inward" : "stable").padEnd(9);
  const fate = r.display.orbitalFate;

  console.log(`  ${name}│ ${predStr} │ ${obsStr} │ ${rat} │ ${dir}  │ ${fate}`);
}

console.log("");
console.log("  TABLE 4: Material Properties");
console.log(
  "  ─────────────────────────────────────────────────────────────────────────────────────────────────────",
);
console.log(
  "  Moon          │ ρ (g/cm³) │ Class            │ μ (GPa)  │ Q     │ k₂         │ Locked?",
);
console.log(
  "  ──────────────┼───────────┼──────────────────┼──────────┼───────┼────────────┼────────────",
);

for (const entry of MOONS) {
  const args = { starMassMsol: 1, starAgeGyr: 4.6, moon: entry.moon };
  if (entry.parent) args.parentOverride = entry.parent;
  else args.planet = entry.planet;

  const r = calcMoonExact(args);
  const t = r.tides;

  const name = entry.name.padEnd(14);
  const rho = entry.moon.densityGcm3.toFixed(3).padStart(9);
  const comp = t.compositionClass.padEnd(16);
  const mu = t.rigidityMoonGPa.toFixed(1).padStart(8);
  const q = t.qMoon.toFixed(0).padStart(5);
  const k2 = t.k2Moon.toFixed(6).padStart(10);
  const locked = t.moonLockedToPlanet.padEnd(10);

  console.log(`  ${name}│ ${rho} │ ${comp} │ ${mu} │ ${q} │ ${k2} │ ${locked}`);
}

console.log("");
console.log(SEP);
console.log("  NOTES:");
console.log("  • Grade: OK = within 3× observed, ~1 = within 10×, !! = >10× off");
console.log("  • [PM] = Partially molten override, [SO] = Subsurface ocean override");
console.log("  • Io/Europa e maintained by Laplace resonance (not modelled)");
console.log("  • Enceladus enhanced by partial melting feedback (not modelled)");
console.log("  • Triton e≈0 (orbit fully circularised) — negligible eccentricity tides");
console.log("  • Mimas/Phobos/Deimos masses below engine clamp (0.001 Mmoon) — unreliable");
console.log("  • Engine uses Q=10⁵ for gas/ice giant planets (recession calculation)");
console.log(SEP + "\n");
