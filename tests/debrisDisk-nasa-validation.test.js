/**
 * NASA Debris Disk Validation
 *
 * Compares engine outputs for the Solar System's asteroid belt and
 * classical Kuiper belt against observed/derived values from NASA/JPL
 * and peer-reviewed literature.
 *
 * Sources:
 *   Pitjeva & Pitjev 2018, Astron. Lett. 44, 554  — belt masses
 *   JPL SSD Kirkwood gap diagrams                  — resonance edges
 *   Stern & Colwell 1997, ApJ 490, 879             — Kuiper belt collision dominance
 *   Standard blackbody: T_eq = 279 / sqrt(d_AU)    — equilibrium temperature
 *   Kepler's 3rd law: P = a^(3/2) yr               — orbital period
 */
import test from "node:test";
import assert from "node:assert/strict";

import { calcDebrisDisk } from "../engine/debrisDisk.js";

const SOLAR = {
  starMassMsol: 1,
  starLuminosityLsol: 1,
  starAgeGyr: 4.6,
  starTeffK: 5776,
  gasGiants: [
    { name: "Jupiter", au: 5.2026, massMjup: 1.0 },
    { name: "Saturn", au: 9.5549, massMjup: 0.2994 },
    { name: "Uranus", au: 19.218, massMjup: 0.04574 },
    { name: "Neptune", au: 30.11, massMjup: 0.05395 },
  ],
};

// ── Reference data ──────────────────────────────────────────────────

const BELTS = {
  "Asteroid Belt": {
    innerAu: 2.06,
    outerAu: 3.27,
    eccentricity: 0.1, // typical asteroid e ~ 0.05–0.15
    nasa: {
      midpointAu: 2.665,
      midTempK: 170.9, // 279 / sqrt(2.665)
      innerTempK: 194.4, // 279 / sqrt(2.06)
      outerTempK: 154.3, // 279 / sqrt(3.27)
      orbitalPeriodYr: 4.35, // 2.665^1.5
      massMearth: 4.008e-4, // Pitjeva & Pitjev 2018
      frostRelation: "Inside", // entirely inside frost line
      compositionClass: "Mixed silicate-ice",
      classificationLabel: "Asteroid belt analog",
    },
  },
  "Kuiper Belt": {
    innerAu: 39.4,
    outerAu: 47.8,
    eccentricity: 0.05, // classical belt is dynamically cold
    nasa: {
      midpointAu: 43.6,
      midTempK: 42.3, // 279 / sqrt(43.6)
      innerTempK: 44.4, // 279 / sqrt(39.4)
      outerTempK: 40.4, // 279 / sqrt(47.8)
      orbitalPeriodYr: 287.8, // 43.6^1.5
      massMearth: 1.97e-2, // Pitjeva & Pitjev 2018
      frostRelation: "Outside", // entirely outside frost line
      compositionClass: "Ice-dominated",
      classificationLabel: "Kuiper belt analog",
      dominantProcess: "Collision-dominated", // Stern & Colwell 1997
    },
  },
};

// ── Run engine ──────────────────────────────────────────────────────

const models = {};
for (const [name, cfg] of Object.entries(BELTS)) {
  models[name] = calcDebrisDisk({
    innerAu: cfg.innerAu,
    outerAu: cfg.outerAu,
    eccentricity: cfg.eccentricity,
    ...SOLAR,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

function pctErr(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return Math.abs((actual - expected) / expected) * 100;
}

const rows = [];
function compare(belt, prop, engine, nasa, note) {
  rows.push({ belt, prop, engine, nasa, err: pctErr(engine, nasa), note: note || "" });
}

// ── Build comparison table ──────────────────────────────────────────

for (const [name, cfg] of Object.entries(BELTS)) {
  const m = models[name];
  const n = cfg.nasa;

  compare(name, "Midpoint (AU)", m.orbital.midpointAu, n.midpointAu);
  compare(name, "Mid temp (K)", m.temperature.midK, n.midTempK);
  compare(name, "Inner temp (K)", m.temperature.innerK, n.innerTempK);
  compare(name, "Outer temp (K)", m.temperature.outerK, n.outerTempK);
  compare(name, "Orbital period (yr)", m.orbital.orbitalPeriodYears, n.orbitalPeriodYr);
  compare(name, "Frost relation", m.placement.relativeToFrostLine, n.frostRelation, "exact");
  compare(name, "Composition class", m.composition.className, n.compositionClass, "exact");
  compare(name, "Classification", m.classification.label, n.classificationLabel, "exact");
  if (n.dominantProcess) {
    compare(name, "Dominant process", m.timescales.dominantProcess, n.dominantProcess, "exact");
  }
}

// ── Print summary table ─────────────────────────────────────────────

function fmtNum(n) {
  if (typeof n === "string") return n;
  if (n >= 10000) return Math.round(n).toLocaleString("en-US");
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

test("NASA validation → summary table → prints comparison", () => {
  const W = 110;
  const sep = "\u2500".repeat(W);
  console.log("\n" + "\u2550".repeat(W));
  console.log("  DEBRIS DISK NASA VALIDATION \u2014 Engine vs Observed / Derived Values");
  console.log("\u2550".repeat(W));
  console.log(
    "  " +
      "Belt".padEnd(16) +
      "Property".padEnd(22) +
      "Engine".padStart(22) +
      "NASA/Ref".padStart(22) +
      "Err %".padStart(9) +
      "  \u22641%",
  );
  console.log(sep);

  let prev = "";
  for (const r of rows) {
    if (prev && r.belt !== prev) console.log(sep);
    prev = r.belt;
    let status;
    if (r.note === "exact") {
      const match = String(r.engine) === String(r.nasa);
      status = match ? "  \u2713" : "  \u2717";
      console.log(
        "  " +
          r.belt.padEnd(16) +
          r.prop.padEnd(22) +
          String(r.engine).padStart(22) +
          String(r.nasa).padStart(22) +
          (match ? "exact" : "MISMATCH").padStart(9) +
          status,
      );
    } else {
      status = r.err <= 1 ? "  \u2713" : r.err <= 5 ? "  ~" : "  \u2717";
      console.log(
        "  " +
          r.belt.padEnd(16) +
          r.prop.padEnd(22) +
          fmtNum(r.engine).padStart(22) +
          fmtNum(r.nasa).padStart(22) +
          (r.err.toFixed(2) + "%").padStart(9) +
          status,
      );
    }
  }

  console.log("\u2550".repeat(W));
  console.log(
    "  Sources: Pitjeva & Pitjev 2018, JPL SSD, Stern & Colwell 1997, T_eq = 279/\u221A(d)",
  );
  console.log("\u2550".repeat(W));

  const numeric = rows.filter((r) => !r.note);
  const within1 = numeric.filter((r) => r.err <= 1);
  console.log(`  Numeric comparisons within 1%: ${within1.length}/${numeric.length}`);

  const exact = rows.filter((r) => r.note === "exact");
  const matched = exact.filter((r) => String(r.engine) === String(r.nasa));
  console.log(`  Exact-match comparisons: ${matched.length}/${exact.length}`);
  console.log("");

  assert.ok(true);
});

// ── Per-belt assertions ─────────────────────────────────────────────

for (const [name, cfg] of Object.entries(BELTS)) {
  const m = models[name];
  const n = cfg.nasa;

  test(`${name} → midpoint temperature → within 1%`, () => {
    const err = pctErr(m.temperature.midK, n.midTempK);
    assert.ok(err <= 1, `${m.temperature.midK} vs ${n.midTempK}: ${err.toFixed(2)}%`);
  });

  test(`${name} → inner temperature → within 1%`, () => {
    const err = pctErr(m.temperature.innerK, n.innerTempK);
    assert.ok(err <= 1, `${m.temperature.innerK} vs ${n.innerTempK}: ${err.toFixed(2)}%`);
  });

  test(`${name} → outer temperature → within 1%`, () => {
    const err = pctErr(m.temperature.outerK, n.outerTempK);
    assert.ok(err <= 1, `${m.temperature.outerK} vs ${n.outerTempK}: ${err.toFixed(2)}%`);
  });

  test(`${name} → orbital period → within 1%`, () => {
    const err = pctErr(m.orbital.orbitalPeriodYears, n.orbitalPeriodYr);
    assert.ok(
      err <= 1,
      `${m.orbital.orbitalPeriodYears} vs ${n.orbitalPeriodYr}: ${err.toFixed(2)}%`,
    );
  });

  test(`${name} → frost line → ${n.frostRelation}`, () => {
    assert.equal(m.placement.relativeToFrostLine, n.frostRelation);
  });

  test(`${name} → composition class → ${n.compositionClass}`, () => {
    assert.equal(m.composition.className, n.compositionClass);
  });

  test(`${name} → classification label → ${n.classificationLabel}`, () => {
    assert.equal(m.classification.label, n.classificationLabel);
  });
}

// Kuiper belt specific
test("Kuiper Belt → dominant process → collision-dominated", () => {
  assert.equal(models["Kuiper Belt"].timescales.dominantProcess, "Collision-dominated");
});

// ── Condensation sequence spot checks ───────────────────────────────

test("Asteroid Belt → inner edge → silicates present, water ice absent", () => {
  const m = models["Asteroid Belt"];
  const forsterite = m.composition.species.find((s) => s.name === "Forsterite");
  const water = m.composition.species.find((s) => s.name === "Water ice");
  assert.ok(forsterite.presentAtInner, "Forsterite at ~194 K should condense");
  assert.ok(!water.presentAtInner, "Water ice at ~194 K should NOT condense (170 K threshold)");
});

test("Asteroid Belt → outer edge → water ice present", () => {
  const m = models["Asteroid Belt"];
  const water = m.composition.species.find((s) => s.name === "Water ice");
  assert.ok(water.presentAtOuter, "Water ice at ~154 K should condense");
});

test("Kuiper Belt → condensation → water/CO2 ice present, CH4 absent", () => {
  const m = models["Kuiper Belt"];
  const water = m.composition.species.find((s) => s.name === "Water ice");
  const co2 = m.composition.species.find((s) => s.name === "CO\u2082 ice");
  const ch4 = m.composition.species.find((s) => s.name === "CH\u2084 ice");
  assert.ok(water.presentAtMid, "Water ice at ~42 K");
  assert.ok(co2.presentAtMid, "CO\u2082 ice at ~42 K");
  assert.ok(
    !ch4.presentAtMid,
    "CH\u2084 ice condenses at 31 K, above 42 K so should NOT be present",
  );
});

test("Kuiper Belt → ice-to-rock ratio → >0.5", () => {
  const m = models["Kuiper Belt"];
  assert.ok(
    m.composition.iceToRockRatio > 0.5,
    `ice/rock = ${m.composition.iceToRockRatio}, expected > 0.5`,
  );
});

// ── Stability checks ───────────────────────────────────────────────

test("Asteroid Belt → stability → no giant overlap", () => {
  assert.equal(models["Asteroid Belt"].stability.isStable, true);
});

test("Kuiper Belt → stability → no giant overlap", () => {
  assert.equal(models["Kuiper Belt"].stability.isStable, true);
});

// ── Mass order-of-magnitude check ───────────────────────────────────
// Engine mass is Wyatt steady-state maximum, not actual mass.
// We just verify the engine produces physically plausible values
// and the Kuiper belt estimate is much larger than the asteroid belt.

test("mass → Kuiper belt vs asteroid belt → KB >> AB", () => {
  const abMass = models["Asteroid Belt"].mass.estimatedMassEarth;
  const kbMass = models["Kuiper Belt"].mass.estimatedMassEarth;
  assert.ok(kbMass > abMass * 5, `KB ${kbMass} should be >> AB ${abMass}`);
});

test("mass → asteroid belt estimate → sub-Earth", () => {
  const m = models["Asteroid Belt"].mass.estimatedMassEarth;
  assert.ok(m < 1 && m > 1e-8, `AB mass = ${m} M\u2295`);
});
