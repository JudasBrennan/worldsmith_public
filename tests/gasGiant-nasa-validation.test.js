/**
 * NASA Gas Giant Validation
 *
 * Compares engine outputs for Jupiter, Saturn, Uranus, and Neptune
 * against observed values from NASA/JPL Planetary Fact Sheets.
 *
 * Sources: references/jupiter-factsheet.md, saturn-factsheet.md,
 *          uranus-factsheet.md, neptune-factsheet.md
 */
import test from "node:test";
import assert from "node:assert/strict";

import { calcGasGiant } from "../engine/gasGiant.js";
import { suggestStyles, computeGasGiantVisualProfile } from "../ui/gasGiantStyles.js";

const SOLAR = {
  starMassMsol: 1,
  starLuminosityLsol: 1,
  starAgeGyr: 4.6,
  starRadiusRsol: 1,
};

// ── NASA/JPL factsheet reference data ─────────────────────────────

const GIANTS = {
  Jupiter: {
    massMjup: 1.0,
    radiusRj: 1.0,
    orbitAu: 5.2026,
    rotationPeriodHours: 9.925,
    nasa: {
      densityGcm3: 1.326,
      gravityMs2: 24.79,
      escapeVelocityKms: 60.2,
      effectiveTempK: 124.4,
      bondAlbedo: 0.343,
      orbitalPeriodYr: 4332.59 / 365.25,
      orbitalVelocityKms: 13.07,
      flattening: (71492 - 66854) / 71492,
      eqRadiusKm: 71492,
      polRadiusKm: 66854,
    },
  },
  Saturn: {
    massMjup: 568.32e24 / 1.8982e27,
    radiusRj: 58232 / 69911,
    orbitAu: 9.5549,
    rotationPeriodHours: 10.656,
    nasa: {
      densityGcm3: 0.687,
      gravityMs2: 10.44,
      escapeVelocityKms: 36.09,
      effectiveTempK: 95.0,
      bondAlbedo: 0.342,
      orbitalPeriodYr: 10759.22 / 365.25,
      orbitalVelocityKms: 9.68,
      flattening: (60268 - 54364) / 60268,
      eqRadiusKm: 60268,
      polRadiusKm: 54364,
    },
  },
  Uranus: {
    massMjup: 86.813e24 / 1.8982e27,
    radiusRj: 25362 / 69911,
    orbitAu: 19.218,
    rotationPeriodHours: 17.24,
    nasa: {
      densityGcm3: 1.27,
      gravityMs2: 8.87,
      escapeVelocityKms: 21.38,
      effectiveTempK: 58.2,
      bondAlbedo: 0.3,
      orbitalPeriodYr: 30685.4 / 365.25,
      orbitalVelocityKms: 6.8,
      flattening: (25559 - 24973) / 25559,
      eqRadiusKm: 25559,
      polRadiusKm: 24973,
    },
  },
  Neptune: {
    massMjup: 102.413e24 / 1.8982e27,
    radiusRj: 24622 / 69911,
    orbitAu: 30.11,
    rotationPeriodHours: 16.11,
    nasa: {
      densityGcm3: 1.638,
      gravityMs2: 11.15,
      escapeVelocityKms: 23.56,
      effectiveTempK: 72.0,
      bondAlbedo: 0.29,
      orbitalPeriodYr: 60182 / 365.25,
      orbitalVelocityKms: 5.43,
      flattening: (24764 - 24341) / 24764,
      eqRadiusKm: 24764,
      polRadiusKm: 24341,
    },
  },
};

// ── Run engine for all giants ─────────────────────────────────────

const models = {};
for (const [name, cfg] of Object.entries(GIANTS)) {
  models[name] = calcGasGiant({
    massMjup: cfg.massMjup,
    radiusRj: cfg.radiusRj,
    orbitAu: cfg.orbitAu,
    rotationPeriodHours: cfg.rotationPeriodHours,
    ...SOLAR,
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function pctErr(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return Math.abs((actual - expected) / expected) * 100;
}

const rows = [];
function compare(planet, prop, engine, nasa, note) {
  rows.push({ planet, prop, engine, nasa, err: pctErr(engine, nasa), note: note || "" });
}

// ── Build comparison table ────────────────────────────────────────

for (const [name, cfg] of Object.entries(GIANTS)) {
  const m = models[name];
  const n = cfg.nasa;
  compare(name, "Density (g/cm\u00b3)", m.physical.densityGcm3, n.densityGcm3);
  compare(name, "Escape vel. (km/s)", m.physical.escapeVelocityKms, n.escapeVelocityKms);
  compare(name, "Orbital period (yr)", m.orbital.orbitalPeriodYears, n.orbitalPeriodYr);
  compare(name, "Orbital vel. (km/s)", m.orbital.orbitalVelocityKms, n.orbitalVelocityKms);
  compare(name, "Eq. radius (km)", m.oblateness.equatorialRadiusKm, n.eqRadiusKm);
  compare(name, "Polar radius (km)", m.oblateness.polarRadiusKm, n.polRadiusKm);
  compare(name, "Flattening", m.oblateness.flattening, n.flattening);
  compare(name, "Gravity (m/s\u00b2)", m.physical.equatorialGravityMs2, n.gravityMs2);
  compare(name, "Eff. temp. (K)", m.thermal.effectiveTempK, n.effectiveTempK, "b");
  compare(name, "Bond albedo", m.thermal.bondAlbedo, n.bondAlbedo, "b");
}

// ── Print summary table ───────────────────────────────────────────

function fmtNum(n) {
  if (n >= 10000) return Math.round(n).toLocaleString("en-US");
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

test("NASA gas giant validation \u2014 summary table", () => {
  const W = 93;
  const sep = "\u2500".repeat(W);
  console.log("\n" + "\u2550".repeat(W));
  console.log("  GAS GIANT NASA VALIDATION \u2014 Engine vs NASA/JPL Factsheets");
  console.log("\u2550".repeat(W));
  console.log(
    "  " +
      "Planet".padEnd(10) +
      "Property".padEnd(22) +
      "Engine".padStart(11) +
      "NASA".padStart(11) +
      "Err %".padStart(9) +
      "  \u22641.5%",
  );
  console.log(sep);

  let prev = "";
  for (const r of rows) {
    if (prev && r.planet !== prev) console.log(sep);
    prev = r.planet;
    const status = r.note ? ` [${r.note}]` : r.err <= 1.5 ? "  \u2713" : "  \u2717";
    console.log(
      "  " +
        r.planet.padEnd(10) +
        r.prop.padEnd(22) +
        fmtNum(r.engine).padStart(11) +
        fmtNum(r.nasa).padStart(11) +
        (r.err.toFixed(1) + "%").padStart(9) +
        status,
    );
  }

  console.log("\u2550".repeat(W));
  console.log("  [b] Engine albedo from Sudarsky/ice-giant class; real planets may differ");
  console.log("\u2550".repeat(W));

  const fair = rows.filter((r) => !r.note);
  const within = fair.filter((r) => r.err <= 1.5);
  console.log(`  Fair comparisons within 1.5%: ${within.length}/${fair.length}`);
  console.log("");

  assert.ok(true);
});

// ── Per-planet assertions (fair comparisons at 1.5%) ──────────────

for (const [name, cfg] of Object.entries(GIANTS)) {
  const m = models[name];
  const n = cfg.nasa;

  test(`${name}: density within 1.5%`, () => {
    const err = pctErr(m.physical.densityGcm3, n.densityGcm3);
    assert.ok(err <= 1.5, `${m.physical.densityGcm3} vs ${n.densityGcm3}: ${err.toFixed(1)}%`);
  });

  test(`${name}: escape velocity within 1.5%`, () => {
    const err = pctErr(m.physical.escapeVelocityKms, n.escapeVelocityKms);
    assert.ok(
      err <= 1.5,
      `${m.physical.escapeVelocityKms} vs ${n.escapeVelocityKms}: ${err.toFixed(1)}%`,
    );
  });

  test(`${name}: orbital period within 1.5%`, () => {
    const err = pctErr(m.orbital.orbitalPeriodYears, n.orbitalPeriodYr);
    assert.ok(
      err <= 1.5,
      `${m.orbital.orbitalPeriodYears} vs ${n.orbitalPeriodYr}: ${err.toFixed(1)}%`,
    );
  });

  test(`${name}: orbital velocity within 1.5%`, () => {
    const err = pctErr(m.orbital.orbitalVelocityKms, n.orbitalVelocityKms);
    assert.ok(
      err <= 1.5,
      `${m.orbital.orbitalVelocityKms} vs ${n.orbitalVelocityKms}: ${err.toFixed(1)}%`,
    );
  });

  test(`${name}: equatorial radius within 1.5%`, () => {
    const err = pctErr(m.oblateness.equatorialRadiusKm, n.eqRadiusKm);
    assert.ok(
      err <= 1.5,
      `${m.oblateness.equatorialRadiusKm} vs ${n.eqRadiusKm}: ${err.toFixed(1)}%`,
    );
  });

  test(`${name}: polar radius within 1.5%`, () => {
    const err = pctErr(m.oblateness.polarRadiusKm, n.polRadiusKm);
    assert.ok(err <= 1.5, `${m.oblateness.polarRadiusKm} vs ${n.polRadiusKm}: ${err.toFixed(1)}%`);
  });

  test(`${name}: flattening within 1.5%`, () => {
    const err = pctErr(m.oblateness.flattening, n.flattening);
    assert.ok(err <= 1.5, `${m.oblateness.flattening} vs ${n.flattening}: ${err.toFixed(1)}%`);
  });

  test(`${name}: equatorial gravity within 1.5%`, () => {
    const err = pctErr(m.physical.equatorialGravityMs2, n.gravityMs2);
    assert.ok(
      err <= 1.5,
      `${m.physical.equatorialGravityMs2} vs ${n.gravityMs2}: ${err.toFixed(1)}%`,
    );
  });
}

// ── Visual type & ring validation ────────────────────────────────

const EXPECTED_VISUAL = {
  Jupiter: { styleId: "jupiter", sudarsky: "I", rings: false, ringDepth: "Tenuous" },
  Saturn: { styleId: "saturn", sudarsky: "I", rings: true, ringDepth: "Dense" },
  Uranus: { styleId: "uranus", sudarsky: "I-ice", rings: false, ringDepth: "Tenuous" },
  Neptune: { styleId: "neptune", sudarsky: "I-ice", rings: false, ringDepth: "Tenuous" },
};

for (const [name, expected] of Object.entries(EXPECTED_VISUAL)) {
  const m = models[name];

  test(`${name}: Sudarsky class = ${expected.sudarsky}`, () => {
    assert.equal(m.classification.sudarsky, expected.sudarsky);
  });

  test(`${name}: visual style = "${expected.styleId}"`, () => {
    const { primary } = suggestStyles(m);
    assert.equal(primary, expected.styleId, `suggestStyles primary for ${name}`);
  });

  test(`${name}: computeGasGiantVisualProfile styleId = "${expected.styleId}"`, () => {
    const profile = computeGasGiantVisualProfile(m);
    assert.equal(profile.bodyType, "gasGiant");
    assert.equal(profile.styleId, expected.styleId);
  });

  test(`${name}: ring optical depth = "${expected.ringDepth}"`, () => {
    assert.equal(m.ringProperties.opticalDepthClass, expected.ringDepth);
  });

  test(`${name}: rings displayed = ${expected.rings}`, () => {
    const depth = m.ringProperties.opticalDepthClass;
    const showRings = depth === "Dense" || depth === "Moderate";
    assert.equal(showRings, expected.rings);
  });
}
