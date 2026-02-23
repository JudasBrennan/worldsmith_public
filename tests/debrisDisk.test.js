import test from "node:test";
import assert from "node:assert/strict";

import { calcDebrisDisk, calcDebrisDiskSuggestions } from "../engine/debrisDisk.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

const SOLAR = {
  starMassMsol: 1,
  starLuminosityLsol: 1,
  starAgeGyr: 4.6,
};

/* ── Resonance-based suggestions ───────────────────────────────────── */

test("0 gas giants → frost-line fallback suggestions", () => {
  const s = calcDebrisDiskSuggestions({ gasGiants: [], starLuminosityLsol: 1 });
  assert.equal(s.length, 3);
  assert.equal(s[0].label, "Outer disk");
  assert.equal(s[1].label, "Inner disk");
  assert.equal(s[2].label, "Mid disk");
  // Frost line for L=1 → 4.85 AU
  // Outer: 6×4.85 → 10×4.85 = 29.1 → 48.5
  assert.ok(s[0].innerAu > 25 && s[0].innerAu < 35, `outer inner = ${s[0].innerAu}`);
  assert.ok(s[0].outerAu > 40 && s[0].outerAu < 55, `outer outer = ${s[0].outerAu}`);
  assert.equal(s[0].resonanceInner, null);
});

test("1 gas giant → all zones returned; contiguous ones marked not recommended", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [{ name: "Neptune", au: 30.05 }],
  });
  // All 4 zones present (outer, inner, extended outer, warm inner)
  assert.equal(s.length, 4);
  assert.equal(s[0].label, "Outer disk");
  assert.equal(s[0].recommended, true);
  assert.equal(s[1].label, "Inner disk");
  assert.equal(s[1].recommended, true);
  // Extended outer (P4) touches Outer (P1) at 2:1 resonance → not recommended
  assert.equal(s[2].label, "Extended outer disk");
  assert.equal(s[2].recommended, false);
  // Warm inner (P5) touches Inner (P2) at 4:1 resonance → not recommended
  assert.equal(s[3].label, "Warm inner disk");
  assert.equal(s[3].recommended, false);
});

test("2 close gas giants → no inter-giant gap zone", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "Jupiter", au: 5.2 },
      { name: "Saturn", au: 9.5 },
    ],
  });
  const rec = s.filter((x) => x.recommended);
  const labels = rec.map((x) => x.label);
  assert.ok(labels.includes("Outer disk"));
  assert.ok(labels.includes("Inner disk"));
  assert.ok(!labels.some((l) => l.startsWith("Gap disk")), "no gap for close giants");
});

test("2 far-apart gas giants → inter-giant gap zone present", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "Hot Jupiter", au: 0.5 },
      { name: "Cold Jupiter", au: 30 },
    ],
  });
  const gap = s.find((x) => x.label.startsWith("Gap disk"));
  assert.ok(gap, "should produce a gap zone for widely-separated giants");
  assert.ok(gap.innerAu > 0.5 && gap.outerAu < 30, "gap should be between the two giants");
});

test("Outer disk resonances: Neptune @ 30.05 → ~39.4–47.7 AU", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [{ name: "Neptune", au: 30.05 }],
  });
  approxEqual(s[0].innerAu, 39.4, 0.5);
  approxEqual(s[0].outerAu, 47.7, 0.5);
});

test("Inner disk resonances: Jupiter @ 5.2 → ~2.06–3.28 AU", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "Jupiter", au: 5.2 },
      { name: "Neptune", au: 30.05 },
    ],
  });
  const inner = s.find((x) => x.label === "Inner disk");
  approxEqual(inner.innerAu, 2.06, 0.1);
  approxEqual(inner.outerAu, 3.28, 0.1);
});

test("count limits number of returned zones (includes all, not just recommended)", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [{ name: "Neptune", au: 30.05 }],
    count: 2,
  });
  assert.equal(s.length, 2);
  assert.equal(s[0].label, "Outer disk");
  assert.equal(s[1].label, "Inner disk");
});

test("suggestions include priority field sorted ascending", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "Jupiter", au: 5.2 },
      { name: "Neptune", au: 30.05 },
    ],
  });
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i].priority >= s[i - 1].priority, "priorities should be ascending");
  }
});

test("suggestions filter out invalid gas giants (NaN, 0, negative)", () => {
  const s = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "Bad", au: NaN },
      { name: "Zero", au: 0 },
      { name: "Good", au: 10 },
    ],
  });
  // 1 valid giant → all 4 zones returned, 2 recommended
  assert.equal(s[0].sculptorAu, 10);
  assert.equal(s.filter((x) => x.recommended).length, 2);
});

test("no two recommended suggestions overlap (recommended zones disjoint)", () => {
  // Single giant — recommended zones should tile without overlap
  const s1 = calcDebrisDiskSuggestions({
    gasGiants: [{ name: "Jupiter", au: 5.2 }],
  });
  const r1 = s1.filter((x) => x.recommended);
  for (let i = 0; i < r1.length; i++) {
    for (let j = i + 1; j < r1.length; j++) {
      const a = r1[i];
      const b = r1[j];
      const overlaps = a.innerAu < b.outerAu && b.innerAu < a.outerAu;
      assert.ok(
        !overlaps,
        `Zones "${a.label}" (${a.innerAu}–${a.outerAu}) and "${b.label}" (${b.innerAu}–${b.outerAu}) overlap`,
      );
    }
  }
  // Multi-giant — also disjoint
  const s2 = calcDebrisDiskSuggestions({
    gasGiants: [
      { name: "A", au: 1 },
      { name: "B", au: 5 },
      { name: "C", au: 30 },
    ],
  });
  const r2 = s2.filter((x) => x.recommended);
  for (let i = 0; i < r2.length; i++) {
    for (let j = i + 1; j < r2.length; j++) {
      const a = r2[i];
      const b = r2[j];
      const overlaps = a.innerAu < b.outerAu && b.innerAu < a.outerAu;
      assert.ok(
        !overlaps,
        `Zones "${a.label}" (${a.innerAu}–${a.outerAu}) and "${b.label}" (${b.innerAu}–${b.outerAu}) overlap`,
      );
    }
  }
});

test("frost-line scales with luminosity for 0-giant fallback", () => {
  const dim = calcDebrisDiskSuggestions({ gasGiants: [], starLuminosityLsol: 0.01 });
  const bright = calcDebrisDiskSuggestions({ gasGiants: [], starLuminosityLsol: 100 });
  assert.ok(
    bright[0].innerAu > dim[0].innerAu * 5,
    "brighter star should place outer disk much farther",
  );
});

/* ── Dust temperature ──────────────────────────────────────────────── */

test("Kuiper belt analog temp ~40–50 K at midpoint", () => {
  const d = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, ...SOLAR });
  assert.ok(d.temperature.midK >= 30 && d.temperature.midK <= 55, `midK = ${d.temperature.midK}`);
});

test("asteroid belt analog temp ~165–200 K at midpoint", () => {
  const d = calcDebrisDisk({ innerAu: 2.06, outerAu: 3.28, ...SOLAR });
  assert.ok(d.temperature.midK >= 140 && d.temperature.midK <= 220, `midK = ${d.temperature.midK}`);
});

/* ── Composition ───────────────────────────────────────────────────── */

test("asteroid belt → Mixed silicate-ice", () => {
  const d = calcDebrisDisk({ innerAu: 2.06, outerAu: 3.28, ...SOLAR });
  assert.equal(d.composition.className, "Mixed silicate-ice");
});

test("Kuiper belt → Ice-dominated", () => {
  const d = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, ...SOLAR });
  assert.equal(d.composition.className, "Ice-dominated");
});

/* ── Fractional luminosity ─────────────────────────────────────────── */

test("fractional luminosity decreases with age", () => {
  const young = calcDebrisDisk({
    innerAu: 30,
    outerAu: 50,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 0.1,
  });
  const old = calcDebrisDisk({
    innerAu: 30,
    outerAu: 50,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 10,
  });
  assert.ok(
    young.luminosity.fractionalLuminosity > old.luminosity.fractionalLuminosity,
    "Young disk should be brighter",
  );
});

/* ── Blowout grain size ────────────────────────────────────────────── */

test("blowout grain size for solar star → ~0.57 μm", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  approxEqual(d.grains.blowoutSizeUm, 0.57, 0.05);
});

test("blowout grain size for M-dwarf → very small", () => {
  const d = calcDebrisDisk({
    innerAu: 5,
    outerAu: 10,
    starMassMsol: 0.3,
    starLuminosityLsol: 0.01,
    starAgeGyr: 5,
  });
  assert.ok(d.grains.blowoutSizeUm < 0.1, `blowout = ${d.grains.blowoutSizeUm} μm`);
});

/* ── Poynting-Robertson drag ───────────────────────────────────────── */

test("PR drag at 40 AU → millions of years", () => {
  const d = calcDebrisDisk({ innerAu: 35, outerAu: 50, ...SOLAR });
  assert.ok(d.timescales.prDragYears > 1e6, `PR drag = ${d.timescales.prDragYears} yr`);
});

/* ── Classification labels ─────────────────────────────────────────── */

test("classification: asteroid belt region → Asteroid belt analog", () => {
  const d = calcDebrisDisk({ innerAu: 2, outerAu: 3.5, ...SOLAR });
  assert.equal(d.classification.label, "Asteroid belt analog");
});

test("classification: Kuiper belt region → Kuiper belt analog", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  assert.equal(d.classification.label, "Kuiper belt analog");
});

test("classification: very close → Warm exozodiacal dust", () => {
  const d = calcDebrisDisk({ innerAu: 0.1, outerAu: 0.5, ...SOLAR });
  assert.equal(d.classification.label, "Warm exozodiacal dust");
});

/* ── Mass estimate ────────────────────────────────────────────────── */

test("Kuiper belt analog mass estimate is sub-Earth (not billions)", () => {
  const d = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, ...SOLAR });
  // Wyatt steady-state max mass should be < ~5 M⊕, not 62 billion
  assert.ok(d.mass.estimatedMassEarth < 5, `mass = ${d.mass.estimatedMassEarth} M⊕, should be < 5`);
  assert.ok(
    d.mass.estimatedMassEarth > 0.001,
    `mass = ${d.mass.estimatedMassEarth} M⊕, should be > 0.001`,
  );
});

test("asteroid belt analog mass estimate is reasonable", () => {
  const d = calcDebrisDisk({ innerAu: 2.06, outerAu: 3.28, ...SOLAR });
  // Asteroid belt real mass ~0.0005 M⊕; Wyatt max should be modest
  assert.ok(d.mass.estimatedMassEarth < 1, `mass = ${d.mass.estimatedMassEarth} M⊕, should be < 1`);
  assert.ok(
    d.mass.estimatedMassEarth > 1e-6,
    `mass = ${d.mass.estimatedMassEarth} M⊕, should be > 1e-6`,
  );
});

/* ── Frost line placement ──────────────────────────────────────────── */

test("frost line placement: asteroid belt inside, Kuiper belt outside", () => {
  const ab = calcDebrisDisk({ innerAu: 2, outerAu: 3.5, ...SOLAR });
  const kb = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  assert.equal(ab.placement.relativeToFrostLine, "Inside");
  assert.equal(kb.placement.relativeToFrostLine, "Outside");
});
