/**
 * Stellar Evolution — NASA & Observational Validation Tests
 *
 * Compares Hurley, Pols & Tout (2000) + Tout et al. (1996) evolution engine
 * outputs against observed properties of well-studied main-sequence stars with
 * interferometric radii, asteroseismic ages, and precise parallaxes.
 *
 * Also tests downstream propagation through calcPlanetExact (insolation,
 * habitable zone, surface temperature) to verify that evolved stellar
 * properties flow correctly into the planet engine.
 *
 * References:
 *   - IAU 2015 Resolution B3 (solar constants)
 *   - Kervella et al. 2017, A&A 597 (α Cen A/B interferometry)
 *   - Joyce & Chaboyer 2018, ApJ 864 (α Cen asteroseismic ages)
 *   - Kervella et al. 2008, A&A 488 (61 Cyg A CHARA interferometry)
 *   - Bond et al. 2017, ApJ 840 (Sirius A HST astrometry)
 *   - Di Folco et al. 2004, A&A 426 (ε Eri VLTI interferometry)
 *   - Teixeira et al. 2009 (τ Ceti asteroseismic mass)
 *   - Bruntt et al. 2010, MNRAS 405 (70 Oph A)
 *   - Bahcall et al. 2001 (standard solar model ZAMS)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  calcStar,
  feHtoZ,
  zamsLuminosity,
  zamsRadius,
  msLifetimeGyr,
  evolvedLuminosity,
  evolvedRadius,
  calcHabitableZoneAu,
} from "../engine/star.js";

import { calcPlanetExact } from "../engine/planet.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padStart(n);
const padEnd = (s, n) => String(s).padEnd(n);

function pctError(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

function pctAbs(actual, expected) {
  return Math.abs(pctError(actual, expected));
}

function assertPctWithin(actual, expected, pct, label) {
  const err = pctAbs(actual, expected);
  assert.ok(
    err <= pct,
    `${label}: ${actual.toFixed(4)} is ${err.toFixed(1)}% from ${expected} (limit ${pct}%)`,
  );
}

// ── Reference Star Data ──────────────────────────────────────────────────────
// All values from published observations (interferometry, asteroseismology,
// parallaxes). See file header for full citations.

const STARS = [
  {
    name: "Sun",
    massMsol: 1.0,
    ageGyr: 4.567,
    feH: 0.0,
    obsL: 1.0,
    obsR: 1.0,
    obsTeff: 5772,
    tolL: 12,
    tolR: 8,
    tolT: 3,
    source: "IAU 2015",
  },
  {
    name: "Alpha Cen A",
    massMsol: 1.106,
    ageGyr: 5.3,
    feH: 0.24,
    obsL: 1.519,
    obsR: 1.223,
    obsTeff: 5790,
    tolL: 20,
    tolR: 15,
    tolT: 5,
    source: "Kervella+ 2017",
  },
  {
    name: "Alpha Cen B",
    massMsol: 0.907,
    ageGyr: 5.3,
    feH: 0.22,
    obsL: 0.503,
    obsR: 0.863,
    obsTeff: 5260,
    tolL: 20,
    tolR: 15,
    tolT: 5,
    source: "Kervella+ 2017",
  },
  {
    name: "Tau Ceti",
    massMsol: 0.783,
    ageGyr: 7.0,
    feH: -0.5,
    obsL: 0.488,
    obsR: 0.793,
    obsTeff: 5344,
    tolL: 25,
    tolR: 15,
    tolT: 6,
    source: "Teixeira+ 2009",
  },
  {
    name: "70 Oph A",
    massMsol: 0.89,
    ageGyr: 6.2,
    feH: 0.04,
    obsL: 0.457,
    obsR: 0.862,
    obsTeff: 5314,
    tolL: 20,
    tolR: 15,
    tolT: 5,
    source: "Bruntt+ 2010",
  },
  {
    name: "Eps Eridani",
    massMsol: 0.82,
    ageGyr: 0.6,
    feH: -0.09,
    obsL: 0.34,
    obsR: 0.735,
    obsTeff: 5084,
    tolL: 25,
    tolR: 15,
    tolT: 6,
    source: "Di Folco+ 2004",
  },
  {
    name: "61 Cyg A",
    massMsol: 0.7,
    ageGyr: 6.0,
    feH: -0.2,
    obsL: 0.153,
    obsR: 0.665,
    obsTeff: 4526,
    tolL: 25,
    tolR: 15,
    tolT: 6,
    source: "Kervella+ 2008",
  },
  {
    name: "Sirius A",
    massMsol: 2.063,
    ageGyr: 0.24,
    feH: -0.2,
    obsL: 25.4,
    obsR: 1.711,
    obsTeff: 9940,
    tolL: 25,
    tolR: 20,
    tolT: 8,
    source: "Bond+ 2017",
  },
  {
    name: "Pi3 Orionis",
    massMsol: 1.236,
    ageGyr: 1.4,
    feH: 0.0,
    obsL: 2.82,
    obsR: 1.323,
    obsTeff: 6516,
    tolL: 25,
    tolR: 20,
    tolT: 6,
    source: "Spectroscopic",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  Part 1 — Evolved L, R, T vs Observed (per-star assertions)
// ══════════════════════════════════════════════════════════════════════════════

test("evolvedLuminosity/Radius → benchmark MS stars → match observed L, R, T", () => {
  const header = [
    padEnd("Star", 16),
    pad("M", 5),
    pad("Age", 5),
    pad("[Fe/H]", 6),
    pad("L_eng", 7),
    pad("L_obs", 7),
    pad("ΔL%", 7),
    pad("R_eng", 7),
    pad("R_obs", 7),
    pad("ΔR%", 7),
    pad("T_eng", 7),
    pad("T_obs", 7),
    pad("ΔT%", 6),
  ].join(" │ ");

  console.log(
    "\n  ╔══════════════════════════════════════════════════════════════" +
      "══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "  ║   STELLAR EVOLUTION — EVOLVED PROPERTIES vs OBSERVATIONS" +
      "                                                              ║",
  );
  console.log(
    "  ╠══════════════════════════════════════════════════════════════" +
      "══════════════════════════════════════════════════════════════╣",
  );
  console.log(`  ║ ${header} ║`);
  console.log(
    "  ╟────────────────────────────────────────────────────────────" +
      "──────────────────────────────────────────────────────────────╢",
  );

  for (const s of STARS) {
    const Z = feHtoZ(s.feH);
    const L = evolvedLuminosity(s.massMsol, Z, s.ageGyr);
    const R = evolvedRadius(s.massMsol, Z, s.ageGyr);
    const T = (L / R ** 2) ** 0.25 * 5772;

    const dL = pctError(L, s.obsL);
    const dR = pctError(R, s.obsR);
    const dT = pctError(T, s.obsTeff);

    const row = [
      padEnd(s.name, 16),
      pad(s.massMsol.toFixed(3), 5),
      pad(s.ageGyr.toFixed(2), 5),
      pad(s.feH.toFixed(2), 6),
      pad(L.toFixed(3), 7),
      pad(s.obsL.toFixed(3), 7),
      pad(dL.toFixed(1), 7),
      pad(R.toFixed(3), 7),
      pad(s.obsR.toFixed(3), 7),
      pad(dR.toFixed(1), 7),
      pad(T.toFixed(0), 7),
      pad(s.obsTeff.toFixed(0), 7),
      pad(dT.toFixed(1), 6),
    ].join(" │ ");

    console.log(`  ║ ${row} ║`);

    assertPctWithin(L, s.obsL, s.tolL, `${s.name} luminosity`);
    assertPctWithin(R, s.obsR, s.tolR, `${s.name} radius`);
    assertPctWithin(T, s.obsTeff, s.tolT, `${s.name} temperature`);
  }

  console.log(
    "  ╚══════════════════════════════════════════════════════════════" +
      "══════════════════════════════════════════════════════════════╝",
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 2 — ZAMS Values (young Sun problem)
// ══════════════════════════════════════════════════════════════════════════════

test("zamsLuminosity/Radius → Sun Z=0.02 → match standard solar model", () => {
  const Z = feHtoZ(0);

  // Standard solar model: young Sun ≈ 0.70 Lsol, ≈ 0.89 Rsol
  // (Bahcall et al. 2001, Feulner 2012 review)
  const lZams = zamsLuminosity(1.0, Z);
  const rZams = zamsRadius(1.0, Z);
  const tZams = (lZams / rZams ** 2) ** 0.25 * 5772;

  console.log("\n  ZAMS Solar Values (Tout et al. 1996):");
  console.log(`  L_ZAMS = ${lZams.toFixed(4)} Lsol  (expected ~0.70, faint young Sun)`);
  console.log(`  R_ZAMS = ${rZams.toFixed(4)} Rsol  (expected ~0.89)`);
  console.log(`  T_ZAMS = ${tZams.toFixed(0)} K     (expected ~5600 K)`);

  assertPctWithin(lZams, 0.7, 5, "ZAMS L(Sun)");
  assertPctWithin(rZams, 0.89, 5, "ZAMS R(Sun)");
  assertPctWithin(tZams, 5600, 3, "ZAMS T(Sun)");
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 3 — MS Lifetimes
// ══════════════════════════════════════════════════════════════════════════════

test("msLifetimeGyr → various masses → match astrophysical expectations", () => {
  // Reference: Hurley et al. 2000; standard stellar evolution models
  const cases = [
    { m: 0.5, Z: 0.02, expected: 130, tolPct: 30, label: "0.5 Msol (red dwarf, >100 Gyr)" },
    { m: 1.0, Z: 0.02, expected: 10, tolPct: 20, label: "1.0 Msol (Sun, ~10 Gyr)" },
    { m: 1.5, Z: 0.02, expected: 2.8, tolPct: 30, label: "1.5 Msol (F star, ~2.8 Gyr)" },
    { m: 2.0, Z: 0.02, expected: 1.1, tolPct: 30, label: "2.0 Msol (A star, ~1.1 Gyr)" },
    { m: 5.0, Z: 0.02, expected: 0.1, tolPct: 50, label: "5.0 Msol (B star, ~100 Myr)" },
  ];

  console.log("\n  MS Lifetime Validation:");
  console.log(
    `  ${padEnd("Star type", 35)} ${pad("t_MS", 8)} ${pad("Expected", 8)} ${pad("Δ%", 8)}`,
  );
  console.log(`  ${"-".repeat(63)}`);

  for (const c of cases) {
    const tMS = msLifetimeGyr(c.m, c.Z);
    const dPct = pctError(tMS, c.expected);
    console.log(
      `  ${padEnd(c.label, 35)} ${pad(tMS.toFixed(3), 8)} ${pad(c.expected.toFixed(3), 8)} ${pad(dPct.toFixed(1), 8)}`,
    );
    assertPctWithin(tMS, c.expected, c.tolPct, c.label);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 4 — calcStar evolved mode full integration
// ══════════════════════════════════════════════════════════════════════════════

test("calcStar → evolved mode benchmarks → correct L, R, T for known stars", () => {
  console.log("\n  calcStar (evolved mode) — Full Integration:");
  console.log(
    `  ${padEnd("Star", 16)} ${pad("L", 7)} ${pad("R", 7)} ${pad("T(K)", 7)} ` +
      `${pad("MaxAge", 7)} ${pad("HZ_in", 7)} ${pad("HZ_out", 7)} ${pad("Spectral", 9)}`,
  );
  console.log(`  ${"-".repeat(77)}`);

  for (const s of STARS) {
    const star = calcStar({
      massMsol: s.massMsol,
      ageGyr: s.ageGyr,
      metallicityFeH: s.feH,
      evolutionMode: "evolved",
    });

    console.log(
      `  ${padEnd(s.name, 16)} ${pad(star.luminosityLsol.toFixed(3), 7)} ` +
        `${pad(star.radiusRsol.toFixed(3), 7)} ${pad(star.tempK.toFixed(0), 7)} ` +
        `${pad(star.maxAgeGyr.toFixed(2), 7)} ${pad(star.habitableZoneAu.inner.toFixed(3), 7)} ` +
        `${pad(star.habitableZoneAu.outer.toFixed(3), 7)} ${pad(star.spectralClass, 9)}`,
    );

    // Basic sanity: L, R, T should be finite and positive
    assert.ok(star.luminosityLsol > 0, `${s.name} L > 0`);
    assert.ok(star.radiusRsol > 0, `${s.name} R > 0`);
    assert.ok(star.tempK > 0, `${s.name} T > 0`);
    assert.ok(star.maxAgeGyr > 0, `${s.name} maxAge > 0`);

    // Age must not exceed MS lifetime
    assert.ok(
      s.ageGyr <= star.maxAgeGyr * 1.05,
      `${s.name}: age ${s.ageGyr} should not exceed maxAge ${star.maxAgeGyr.toFixed(2)}`,
    );

    // Match observations
    assertPctWithin(star.luminosityLsol, s.obsL, s.tolL, `${s.name} L (calcStar)`);
    assertPctWithin(star.radiusRsol, s.obsR, s.tolR, `${s.name} R (calcStar)`);
    assertPctWithin(star.tempK, s.obsTeff, s.tolT, `${s.name} T (calcStar)`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 5 — Evolved vs ZAMS mode comparison
// ══════════════════════════════════════════════════════════════════════════════

test("calcStar → evolved vs ZAMS mode → evolved L/R not drastically below", () => {
  console.log("\n  Evolved vs ZAMS Mode Comparison:");
  console.log(
    `  ${padEnd("Star", 16)} ${pad("L_evol", 8)} ${pad("L_zams", 8)} ${pad("ΔL%", 6)} ` +
      `${pad("R_evol", 8)} ${pad("R_zams", 8)} ${pad("ΔR%", 6)}`,
  );
  console.log(`  ${"-".repeat(66)}`);

  for (const s of STARS) {
    const evolved = calcStar({
      massMsol: s.massMsol,
      ageGyr: s.ageGyr,
      metallicityFeH: s.feH,
      evolutionMode: "evolved",
    });
    const zams = calcStar({
      massMsol: s.massMsol,
      ageGyr: s.ageGyr,
      metallicityFeH: s.feH,
      evolutionMode: "zams",
    });

    const dL = pctError(evolved.luminosityLsol, zams.luminosityLsol);
    const dR = pctError(evolved.radiusRsol, zams.radiusRsol);

    console.log(
      `  ${padEnd(s.name, 16)} ${pad(evolved.luminosityLsol.toFixed(3), 8)} ` +
        `${pad(zams.luminosityLsol.toFixed(3), 8)} ${pad(dL.toFixed(1), 6)} ` +
        `${pad(evolved.radiusRsol.toFixed(3), 8)} ${pad(zams.radiusRsol.toFixed(3), 8)} ${pad(dR.toFixed(1), 6)}`,
    );

    // Evolved stars with significant age should have higher L and R than
    // static mass-derived values (or at minimum not be drastically lower)
    if (s.ageGyr > 2.0) {
      assert.ok(
        evolved.luminosityLsol >= zams.luminosityLsol * 0.5,
        `${s.name}: evolved L should not be drastically below ZAMS-mode L`,
      );
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 6 — Metallicity Effects on Evolution
// ══════════════════════════════════════════════════════════════════════════════

test("metallicity shifts evolution: metal-poor → brighter, shorter-lived", () => {
  const mass = 1.0;
  const age = 4.6;
  const metallicities = [
    { feH: -1.0, label: "[Fe/H]=-1.0 (halo)" },
    { feH: -0.5, label: "[Fe/H]=-0.5 (old disk)" },
    { feH: 0.0, label: "[Fe/H]=+0.0 (solar)" },
    { feH: 0.3, label: "[Fe/H]=+0.3 (metal-rich)" },
  ];

  console.log("\n  Metallicity Effects on 1 Msol star at 4.6 Gyr:");
  console.log(
    `  ${padEnd("Metallicity", 25)} ${pad("Z", 8)} ${pad("L", 7)} ${pad("R", 7)} ` +
      `${pad("T(K)", 6)} ${pad("t_MS", 7)} ${pad("HZ_in", 7)} ${pad("HZ_out", 7)}`,
  );
  console.log(`  ${"-".repeat(82)}`);

  let prevL = Infinity;
  let prevTms = 0;

  for (const m of metallicities) {
    const Z = feHtoZ(m.feH);
    const star = calcStar({
      massMsol: mass,
      ageGyr: age,
      metallicityFeH: m.feH,
      evolutionMode: "evolved",
    });

    console.log(
      `  ${padEnd(m.label, 25)} ${pad(Z.toFixed(5), 8)} ${pad(star.luminosityLsol.toFixed(3), 7)} ` +
        `${pad(star.radiusRsol.toFixed(3), 7)} ${pad(star.tempK.toFixed(0), 6)} ` +
        `${pad(star.maxAgeGyr.toFixed(2), 7)} ${pad(star.habitableZoneAu.inner.toFixed(3), 7)} ` +
        `${pad(star.habitableZoneAu.outer.toFixed(3), 7)}`,
    );

    // Metal-poor → higher L (lower opacity → hotter core → more luminous)
    assert.ok(
      star.luminosityLsol < prevL || m.feH <= -1.0,
      `L should decrease with increasing [Fe/H]: ${m.label}`,
    );
    prevL = star.luminosityLsol;

    // Metal-poor → shorter MS lifetime (higher L burns fuel faster)
    assert.ok(star.maxAgeGyr >= prevTms, `t_MS should increase with Z: ${m.label}`);
    prevTms = star.maxAgeGyr;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 7 — Downstream: Planet Engine with Evolved Star
// ══════════════════════════════════════════════════════════════════════════════

// Earth inputs (from NASA factsheet)
const EARTH_PLANET = {
  massEarth: 1.0,
  cmfPct: 32,
  wmfPct: 0,
  axialTiltDeg: 23.44,
  albedoBond: 0.306,
  greenhouseEffect: 1,
  greenhouseMode: "manual",
  observerHeightM: 2,
  rotationPeriodHours: 23.934,
  semiMajorAxisAu: 1.0,
  eccentricity: 0.0167,
  inclinationDeg: 0,
  longitudeOfPeriapsisDeg: 0,
  subsolarLongitudeDeg: 0,
  pressureAtm: 1,
  o2Pct: 20.95,
  co2Pct: 0.04,
  arPct: 0.93,
  h2oPct: 0.4,
};

test("calcPlanetExact → evolved Sun vs ZAMS → near-solar insolation and temp", () => {
  const evolvedPlanet = calcPlanetExact({
    starMassMsol: 1.0,
    starAgeGyr: 4.567,
    starEvolutionMode: "evolved",
    planet: EARTH_PLANET,
  });

  const zamsPlanet = calcPlanetExact({
    starMassMsol: 1.0,
    starAgeGyr: 4.567,
    starEvolutionMode: "zams",
    planet: EARTH_PLANET,
  });

  console.log("\n  Earth with Evolved vs ZAMS Sun:");
  console.log(
    `  ${padEnd("Property", 25)} ${pad("Evolved", 10)} ${pad("ZAMS-mode", 10)} ${pad("NASA", 10)} ${pad("Δ_evol%", 8)}`,
  );
  console.log(`  ${"-".repeat(67)}`);

  const rows = [
    {
      prop: "Star L (Lsol)",
      ev: evolvedPlanet.star.luminosityLsol,
      zm: zamsPlanet.star.luminosityLsol,
      nasa: 1.0,
    },
    {
      prop: "Star R (Rsol)",
      ev: evolvedPlanet.star.radiusRsol,
      zm: zamsPlanet.star.radiusRsol,
      nasa: 1.0,
    },
    {
      prop: "Star T (K)",
      ev: evolvedPlanet.star.tempK,
      zm: zamsPlanet.star.tempK,
      nasa: 5772,
    },
    {
      prop: "Insolation (Earth)",
      ev: evolvedPlanet.derived.insolationEarth,
      zm: zamsPlanet.derived.insolationEarth,
      nasa: 1.0,
    },
    {
      prop: "Surface Temp (K)",
      ev: evolvedPlanet.derived.surfaceTempK,
      zm: zamsPlanet.derived.surfaceTempK,
      nasa: 288,
    },
    {
      prop: "HZ Inner (AU)",
      ev: evolvedPlanet.star.habitableZoneAu.inner,
      zm: zamsPlanet.star.habitableZoneAu.inner,
      nasa: 0.95,
    },
    {
      prop: "HZ Outer (AU)",
      ev: evolvedPlanet.star.habitableZoneAu.outer,
      zm: zamsPlanet.star.habitableZoneAu.outer,
      nasa: 1.68,
    },
  ];

  for (const r of rows) {
    const dPct = pctError(r.ev, r.nasa);
    console.log(
      `  ${padEnd(r.prop, 25)} ${pad(r.ev.toFixed(4), 10)} ${pad(r.zm.toFixed(4), 10)} ` +
        `${pad(r.nasa.toFixed(4), 10)} ${pad(dPct.toFixed(1), 8)}`,
    );
  }

  // Evolved Sun at 4.567 Gyr should produce near-solar insolation
  assertPctWithin(evolvedPlanet.derived.insolationEarth, 1.0, 12, "Earth insolation (evolved Sun)");

  // Surface temp should still be reasonable for Earth
  assertPctWithin(evolvedPlanet.derived.surfaceTempK, 288, 6, "Earth surface temp (evolved Sun)");

  // HZ inner edge should be near 0.95 AU
  assertPctWithin(evolvedPlanet.star.habitableZoneAu.inner, 0.95, 10, "HZ inner (evolved Sun)");
});

test("calcPlanetExact → evolved 1.5 Msol → insolation scales with L ratio", () => {
  // A 1.5 Msol star at 2 Gyr with solar Z should be significantly brighter
  // than the same mass in ZAMS mode → planet insolation should differ
  const evolvedPlanet = calcPlanetExact({
    starMassMsol: 1.5,
    starAgeGyr: 2.0,
    starEvolutionMode: "evolved",
    planet: { ...EARTH_PLANET, semiMajorAxisAu: 2.5 },
  });

  const zamsPlanet = calcPlanetExact({
    starMassMsol: 1.5,
    starAgeGyr: 2.0,
    starEvolutionMode: "zams",
    planet: { ...EARTH_PLANET, semiMajorAxisAu: 2.5 },
  });

  console.log("\n  1.5 Msol planet at 2.5 AU — Evolved vs ZAMS mode:");
  console.log(`  Star L (evolved): ${evolvedPlanet.star.luminosityLsol.toFixed(3)} Lsol`);
  console.log(`  Star L (ZAMS):    ${zamsPlanet.star.luminosityLsol.toFixed(3)} Lsol`);
  console.log(`  Insol (evolved):  ${evolvedPlanet.derived.insolationEarth.toFixed(4)} Earth`);
  console.log(`  Insol (ZAMS):     ${zamsPlanet.derived.insolationEarth.toFixed(4)} Earth`);

  // Evolved should give different insolation (brighter star → more insolation)
  const starEvolved = calcStar({
    massMsol: 1.5,
    ageGyr: 2.0,
    evolutionMode: "evolved",
  });
  const starZams = calcStar({ massMsol: 1.5, ageGyr: 2.0, evolutionMode: "zams" });

  // Insolation ∝ L/d², so ratio should match L ratio
  const lRatio = starEvolved.luminosityLsol / starZams.luminosityLsol;
  const insolRatio = evolvedPlanet.derived.insolationEarth / zamsPlanet.derived.insolationEarth;
  assertPctWithin(insolRatio, lRatio, 2, "Insolation ratio matches L ratio");
});

test("calcHabitableZoneAu → evolved vs ZAMS Sun → HZ shifts outward", () => {
  // Compare HZ for Sun at 4.567 Gyr evolved vs young ZAMS
  const Z = feHtoZ(0);
  const lEvolved = evolvedLuminosity(1.0, Z, 4.567);
  const lZams = zamsLuminosity(1.0, Z);

  const hzEvolved = calcHabitableZoneAu({ luminosityLsol: lEvolved, teffK: 5772 });
  const hzZams = calcHabitableZoneAu({ luminosityLsol: lZams, teffK: 5772 });

  console.log("\n  HZ Boundary Shift — Evolved (4.567 Gyr) vs ZAMS Sun:");
  console.log(`  L_evolved = ${lEvolved.toFixed(4)}, L_ZAMS = ${lZams.toFixed(4)}`);
  console.log(
    `  HZ inner: ${hzEvolved.innerAu.toFixed(3)} AU  (ZAMS: ${hzZams.innerAu.toFixed(3)} AU)`,
  );
  console.log(
    `  HZ outer: ${hzEvolved.outerAu.toFixed(3)} AU  (ZAMS: ${hzZams.outerAu.toFixed(3)} AU)`,
  );

  // HZ ∝ sqrt(L), so evolved HZ should be wider
  assert.ok(hzEvolved.innerAu > hzZams.innerAu, "Evolved HZ inner edge further out than ZAMS");
  assert.ok(hzEvolved.outerAu > hzZams.outerAu, "Evolved HZ outer edge further out than ZAMS");

  // Ratio should be approximately sqrt(L_evolved/L_ZAMS)
  const expectedRatio = Math.sqrt(lEvolved / lZams);
  const actualRatio = hzEvolved.innerAu / hzZams.innerAu;
  assertPctWithin(actualRatio, expectedRatio, 1, "HZ inner ratio ≈ sqrt(L ratio)");
});

// ══════════════════════════════════════════════════════════════════════════════
//  Part 8 — Combined Summary Table
// ══════════════════════════════════════════════════════════════════════════════

test("calcStar → evolved mode all benchmarks → mean errors within limits", () => {
  const results = [];

  for (const s of STARS) {
    const star = calcStar({
      massMsol: s.massMsol,
      ageGyr: s.ageGyr,
      metallicityFeH: s.feH,
      evolutionMode: "evolved",
    });

    results.push({
      name: s.name,
      source: s.source,
      dL: pctError(star.luminosityLsol, s.obsL),
      dR: pctError(star.radiusRsol, s.obsR),
      dT: pctError(star.tempK, s.obsTeff),
      absL: pctAbs(star.luminosityLsol, s.obsL),
      absR: pctAbs(star.radiusRsol, s.obsR),
      absT: pctAbs(star.tempK, s.obsTeff),
    });
  }

  console.log("\n  ╔═══════════════════════════════════════════════════════════════════════╗");
  console.log("  ║  STELLAR EVOLUTION ENGINE — NASA VALIDATION SUMMARY                 ║");
  console.log("  ║  Hurley, Pols & Tout (2000) + Tout et al. (1996) vs Observations   ║");
  console.log("  ╠════════════════╤══════════════════╤═════════╤═════════╤═════════════╣");
  console.log(
    `  ║ ${padEnd("Star", 14)} │ ${padEnd("Source", 16)} │ ${pad("ΔL%", 7)} │ ${pad("ΔR%", 7)} │ ${pad("ΔT%", 7)}     ║`,
  );
  console.log("  ╟────────────────┼──────────────────┼─────────┼─────────┼─────────────╢");

  for (const r of results) {
    const fmtDelta = (d) => (d >= 0 ? `+${d.toFixed(1)}` : d.toFixed(1));
    console.log(
      `  ║ ${padEnd(r.name, 14)} │ ${padEnd(r.source, 16)} │ ${pad(fmtDelta(r.dL), 7)} │ ${pad(fmtDelta(r.dR), 7)} │ ${pad(fmtDelta(r.dT), 7)}     ║`,
    );
  }

  // Statistics
  const avgAbsL = results.reduce((s, r) => s + r.absL, 0) / results.length;
  const avgAbsR = results.reduce((s, r) => s + r.absR, 0) / results.length;
  const avgAbsT = results.reduce((s, r) => s + r.absT, 0) / results.length;
  const maxAbsL = Math.max(...results.map((r) => r.absL));
  const maxAbsR = Math.max(...results.map((r) => r.absR));
  const maxAbsT = Math.max(...results.map((r) => r.absT));

  console.log("  ╟────────────────┼──────────────────┼─────────┼─────────┼─────────────╢");
  console.log(
    `  ║ ${padEnd("Mean |Δ|", 14)} │ ${padEnd("", 16)} │ ${pad(avgAbsL.toFixed(1), 7)} │ ${pad(avgAbsR.toFixed(1), 7)} │ ${pad(avgAbsT.toFixed(1), 7)}     ║`,
  );
  console.log(
    `  ║ ${padEnd("Max |Δ|", 14)} │ ${padEnd("", 16)} │ ${pad(maxAbsL.toFixed(1), 7)} │ ${pad(maxAbsR.toFixed(1), 7)} │ ${pad(maxAbsT.toFixed(1), 7)}     ║`,
  );
  console.log("  ╚════════════════╧══════════════════╧═════════╧═════════╧═════════════╝");

  // Overall quality gates
  assert.ok(avgAbsL < 20, `Mean L error ${avgAbsL.toFixed(1)}% should be < 20%`);
  assert.ok(avgAbsR < 12, `Mean R error ${avgAbsR.toFixed(1)}% should be < 12%`);
  assert.ok(avgAbsT < 5, `Mean T error ${avgAbsT.toFixed(1)}% should be < 5%`);
});
