import test from "node:test";
import assert from "node:assert/strict";

import { calcLocalCluster, normalizeLocalClusterInputs } from "../engine/localCluster.js";

const INPUTS = {
  galacticRadiusLy: 50000,
  locationLy: 25800,
  neighbourhoodRadiusLy: 12,
  stellarDensityPerLy3: 0.08,
  randomSeed: 42,
};

test("calcLocalCluster → fixed seed → deterministic output", () => {
  const a = calcLocalCluster(INPUTS);
  const b = calcLocalCluster(INPUTS);
  assert.deepEqual(a.systems, b.systems);
  assert.deepEqual(a.systemCounts, b.systemCounts);
});

test("calcLocalCluster → all systems → inside neighbourhood radius", () => {
  const model = calcLocalCluster(INPUTS);
  const radius = model.inputs.neighbourhoodRadiusLy;

  for (const system of model.systems) {
    if (system.isHome) continue;
    const dist = Math.hypot(system.x, system.y, system.z);
    assert.ok(dist <= radius + 1e-9, `System ${system.id} escaped radius: ${dist} > ${radius}`);
    assert.equal(Number.isFinite(system.distanceLy), true);
    assert.ok(system.distanceLy <= radius + 1e-9);
  }
});

test("calcLocalCluster → fixed seed → sample coordinates stable", () => {
  const model = calcLocalCluster(INPUTS);
  const first = model.systems[1];

  assert.equal(first.id, "sys-1");
  assert.equal(first.name, "Star System 1");
  assert.ok(Math.abs(first.distanceLy - 9.95753670554472) < 1e-12);
});

// --- Edge-case tests ---

test("calcLocalCluster → home system → first and at origin", () => {
  const model = calcLocalCluster(INPUTS);
  const home = model.systems[0];
  assert.equal(home.isHome, true);
  assert.equal(home.x, 0);
  assert.equal(home.y, 0);
  assert.equal(home.z, 0);
  assert.equal(home.distanceLy, 0);
});

test("calcLocalCluster → different seeds → different layouts", () => {
  const a = calcLocalCluster({ ...INPUTS, randomSeed: 1 });
  const b = calcLocalCluster({ ...INPUTS, randomSeed: 2 });
  const a1 = a.systems[1];
  const b1 = b.systems[1];
  assert.ok(
    a1.distanceLy !== b1.distanceLy,
    "different seeds should produce different coordinates",
  );
});

test("calcLocalCluster → location inside GHZ → inHabitableZone true", () => {
  // GHZ inner = 0.47 * galacticRadiusLy, outer = 0.6 * galacticRadiusLy
  const model = calcLocalCluster({ ...INPUTS, locationLy: 25000 }); // 25000/50000 = 0.5 — inside
  assert.equal(model.inHabitableZone, true);
});

test("calcLocalCluster → location outside GHZ → inHabitableZone false", () => {
  const model = calcLocalCluster({ ...INPUTS, locationLy: 5000 }); // 5000/50000 = 0.1 — outside
  assert.equal(model.inHabitableZone, false);
});

test("calcLocalCluster → zero density → no stellar mass objects", () => {
  const model = calcLocalCluster({ ...INPUTS, stellarDensityPerLy3: 0 });
  assert.equal(model.totalStellarMassObjects, 0);
  // Only home system should exist
  assert.equal(model.systems.length, 1);
});

test("normalizeLocalClusterInputs → extreme galacticRadiusLy → clamped", () => {
  const norm = normalizeLocalClusterInputs({ galacticRadiusLy: 0 });
  assert.equal(norm.galacticRadiusLy, 1000);

  const big = normalizeLocalClusterInputs({ galacticRadiusLy: 9999999 });
  assert.equal(big.galacticRadiusLy, 1000000);
});

test("normalizeLocalClusterInputs → locationLy > radius → clamped", () => {
  const norm = normalizeLocalClusterInputs({ galacticRadiusLy: 1000, locationLy: 9999 });
  assert.equal(norm.locationLy, 1000);
});

test("stellarRows → sum of counts → equals totalStellarMassObjects", () => {
  const model = calcLocalCluster(INPUTS);
  const rowTotal = model.stellarRows.reduce((sum, row) => sum + row.count, 0);
  assert.equal(rowTotal, model.totalStellarMassObjects);
});

test("nearestSystems → all entries → sorted by distance ascending", () => {
  const model = calcLocalCluster(INPUTS);
  for (let i = 1; i < model.nearestSystems.length; i++) {
    assert.ok(
      model.nearestSystems[i].distanceLy >= model.nearestSystems[i - 1].distanceLy,
      `system ${i} is not sorted by distance`,
    );
  }
});

// --- Multiplicity tests ---

const VALID_MULT = new Set(["single", "binary", "triple", "quadruple"]);
const MULT_SIZE = { single: 1, binary: 2, triple: 3, quadruple: 4 };

test("multiplicity → home system → single with one component", () => {
  const model = calcLocalCluster(INPUTS);
  const home = model.systems[0];
  assert.equal(home.isHome, true);
  assert.equal(home.multiplicity, "single");
  assert.ok(Array.isArray(home.components));
  assert.equal(home.components.length, 1);
  assert.equal(home.components[0].objectClassKey, "HOME");
});

test("multiplicity → all neighbours → valid type and component count", () => {
  const model = calcLocalCluster(INPUTS);
  for (const system of model.systems) {
    if (system.isHome) continue;
    assert.ok(
      VALID_MULT.has(system.multiplicity),
      `${system.id}: invalid multiplicity "${system.multiplicity}"`,
    );
    assert.ok(Array.isArray(system.components), `${system.id}: components must be an array`);
    assert.equal(
      system.components.length,
      MULT_SIZE[system.multiplicity],
      `${system.id}: components.length should match multiplicity`,
    );
    assert.equal(
      system.components[0].objectClassKey,
      system.objectClassKey,
      `${system.id}: first component must match primary objectClassKey`,
    );
  }
});

test("multiplicity → different seeds → different distributions", () => {
  const a = calcLocalCluster({ ...INPUTS, randomSeed: 1 });
  const b = calcLocalCluster({ ...INPUTS, randomSeed: 999 });
  // Compare only neighbour systems (skip home which is always single)
  const aMults = a.systems
    .slice(1)
    .map((s) => s.multiplicity)
    .join(",");
  const bMults = b.systems
    .slice(1)
    .map((s) => s.multiplicity)
    .join(",");
  assert.notEqual(aMults, bMults, "different seeds should produce different multiplicity layouts");
});

// --- Scientific accuracy tests ---

test("ghzProbability → various locations → in [0, 1]", () => {
  for (const locationLy of [0, 5000, 25000, 30000, 50000]) {
    const model = calcLocalCluster({ ...INPUTS, locationLy });
    assert.ok(
      model.ghzProbability >= 0 && model.ghzProbability <= 1,
      `ghzProbability ${model.ghzProbability} out of range for location ${locationLy}`,
    );
  }
});

test("ghzProbability → near 53% of galactic radius → peaks at 1.0", () => {
  const galacticRadiusLy = 50000;
  const peak = 0.53 * galacticRadiusLy; // 26500
  const atPeak = calcLocalCluster({ ...INPUTS, galacticRadiusLy, locationLy: peak });
  const atInner = calcLocalCluster({ ...INPUTS, galacticRadiusLy, locationLy: 5000 });
  const atOuter = calcLocalCluster({ ...INPUTS, galacticRadiusLy, locationLy: 45000 });
  assert.ok(atPeak.ghzProbability > atInner.ghzProbability, "peak > inner");
  assert.ok(atPeak.ghzProbability > atOuter.ghzProbability, "peak > outer");
  assert.ok(Math.abs(atPeak.ghzProbability - 1.0) < 1e-9, "ghzProbability at peak ≈ 1.0");
});

test("systemsOmitted → small neighbourhood → zero", () => {
  // With default inputs and small density the total is well under the 751 cap
  const model = calcLocalCluster({
    ...INPUTS,
    stellarDensityPerLy3: 0.003,
    neighbourhoodRadiusLy: 5,
  });
  assert.equal(model.systemsOmitted, 0);
});

test("systemsOmitted → total exceeds 751 → positive", () => {
  // High density / large radius should exceed the 750-neighbour cap
  const model = calcLocalCluster({
    ...INPUTS,
    stellarDensityPerLy3: 0.1,
    neighbourhoodRadiusLy: 25,
  });
  assert.ok(
    model.systemsOmitted > 0,
    `expected some omitted systems, got systemsOmitted=${model.systemsOmitted}`,
  );
  assert.equal(model.systemsOmitted, Math.max(0, model.systemCounts.total - 751));
});

test("classFractions → sum of counts → ~100% of rawStellarMassObjects", () => {
  const model = calcLocalCluster(INPUTS);
  // totalStellarMassObjects should be close to rawStellarMassObjects (within rounding)
  // Previous WS8 behaviour was 140%, now it should be ~100%
  const ratio = model.totalStellarMassObjects / model.rawStellarMassObjects;
  assert.ok(ratio >= 0.9 && ratio <= 1.1, `fraction sum ratio ${ratio} should be near 1.0`);
});

test("companions → all systems → never heavier than primary", () => {
  const RANK = { O: 0, B: 1, A: 2, F: 3, G: 4, K: 5, M: 6, D: 7, LTY: 8, OTHER: 9 };
  const model = calcLocalCluster(INPUTS);
  for (const system of model.systems) {
    if (system.isHome || !Array.isArray(system.components)) continue;
    const primaryRank = RANK[system.components[0].objectClassKey] ?? 9;
    for (let i = 1; i < system.components.length; i++) {
      const compRank = RANK[system.components[i].objectClassKey] ?? 9;
      assert.ok(
        compRank >= primaryRank,
        `${system.id} companion[${i}] class ${system.components[i].objectClassKey} (rank ${compRank}) ` +
          `is heavier than primary ${system.components[0].objectClassKey} (rank ${primaryRank})`,
      );
    }
  }
});

test("binaryFraction → M-dwarf-dominated → lower than FGK rate", () => {
  // High density, small radius: ~75% M dwarfs → lower multiplicity than FGK
  const mDwarfHeavy = calcLocalCluster({
    ...INPUTS,
    stellarDensityPerLy3: 0.08,
    neighbourhoodRadiusLy: 12,
  });
  const binaryFraction = mDwarfHeavy.systemCounts.binary / (mDwarfHeavy.systemCounts.total || 1);
  // M-dwarf binary fraction ~27%, so system binary fraction should be well below the old WS8 33%
  assert.ok(
    binaryFraction < 0.33,
    `binary fraction ${binaryFraction} should be < 0.33 (WS8 FGK rate)`,
  );
});

test("diskZScale → small radius → 1.0 (no compression)", () => {
  // All generated z values should equal distanceLy * cos(phi) exactly — i.e. no compression
  const model = calcLocalCluster({ ...INPUTS, neighbourhoodRadiusLy: 12 });
  for (const system of model.systems) {
    if (system.isHome) continue;
    const reconstructed = Math.hypot(system.x, system.y, system.z);
    assert.ok(
      Math.abs(reconstructed - system.distanceLy) < 1e-9,
      `distanceLy mismatch for ${system.id}`,
    );
  }
});

// ── Metallicity tests ─────────────────────────────────────────────────

test("metallicityFeH → all systems → finite value", () => {
  const model = calcLocalCluster(INPUTS);
  for (const system of model.systems) {
    assert.equal(
      Number.isFinite(system.metallicityFeH),
      true,
      `${system.id} has non-finite metallicityFeH: ${system.metallicityFeH}`,
    );
  }
});

test("metallicityFeH → fixed seed → deterministic", () => {
  const a = calcLocalCluster(INPUTS);
  const b = calcLocalCluster(INPUTS);
  for (let i = 0; i < a.systems.length; i++) {
    assert.equal(
      a.systems[i].metallicityFeH,
      b.systems[i].metallicityFeH,
      `system ${i} metallicity differs between runs`,
    );
  }
});

test("metallicityFeH → different seeds → different distributions", () => {
  const a = calcLocalCluster({ ...INPUTS, randomSeed: 1 });
  const b = calcLocalCluster({ ...INPUTS, randomSeed: 999 });
  const aFeH = a.systems
    .slice(1)
    .map((s) => s.metallicityFeH)
    .join(",");
  const bFeH = b.systems
    .slice(1)
    .map((s) => s.metallicityFeH)
    .join(",");
  assert.notEqual(aFeH, bFeH, "different seeds should produce different metallicities");
});

test("metallicityFeH → all systems → within [-3, 0.5]", () => {
  const model = calcLocalCluster(INPUTS);
  for (const system of model.systems) {
    assert.ok(
      system.metallicityFeH >= -3.0 && system.metallicityFeH <= 0.5,
      `${system.id} metallicityFeH ${system.metallicityFeH} out of range`,
    );
  }
});

test("metallicityFeH → homeMetallicityFeH provided → uses it", () => {
  const model = calcLocalCluster({ ...INPUTS, homeMetallicityFeH: -0.15 });
  const home = model.systems[0];
  assert.equal(home.metallicityFeH, -0.15, "home system should use provided metallicity");
});

test("metallicityFeH → homeMetallicityFeH omitted → defaults to 0", () => {
  const model = calcLocalCluster(INPUTS);
  const home = model.systems[0];
  assert.equal(home.metallicityFeH, 0, "home system defaults to solar metallicity");
});

test("metallicityFeH → solar neighbourhood → mean near -0.05 dex", () => {
  const model = calcLocalCluster({
    ...INPUTS,
    locationLy: 25800,
    stellarDensityPerLy3: 0.08,
    neighbourhoodRadiusLy: 12,
  });
  const neighbours = model.systems.filter((s) => !s.isHome);
  const mean = neighbours.reduce((s, sys) => s + sys.metallicityFeH, 0) / neighbours.length;
  assert.ok(
    mean > -0.4 && mean < 0.3,
    `mean metallicity ${mean} should be near -0.05 dex for solar neighbourhood`,
  );
});

test("metallicityFeH → inner vs outer disk → inner mean higher", () => {
  const inner = calcLocalCluster({ ...INPUTS, locationLy: 15000 });
  const outer = calcLocalCluster({ ...INPUTS, locationLy: 40000 });
  const avg = (systems) => {
    const nb = systems.filter((s) => !s.isHome);
    return nb.reduce((s, sys) => s + sys.metallicityFeH, 0) / nb.length;
  };
  assert.ok(
    avg(inner.systems) > avg(outer.systems),
    "inner disk mean should exceed outer disk mean",
  );
});
