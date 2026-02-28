import test from "node:test";
import assert from "node:assert/strict";

import { calcDebrisDisk, calcDebrisDiskSuggestions } from "../engine/debrisDisk.js";
import { approxEqual } from "./testHelpers.js";

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

test("composition: metal-poor stars increase ice/rock, metal-rich decrease it", () => {
  const lowFeH = calcDebrisDisk({
    innerAu: 2.7,
    outerAu: 3.5,
    starMetallicityFeH: -0.5,
    ...SOLAR,
  });
  const solarFeH = calcDebrisDisk({
    innerAu: 2.7,
    outerAu: 3.5,
    starMetallicityFeH: 0.0,
    ...SOLAR,
  });
  const highFeH = calcDebrisDisk({
    innerAu: 2.7,
    outerAu: 3.5,
    starMetallicityFeH: 0.3,
    ...SOLAR,
  });
  assert.ok(
    lowFeH.composition.iceToRockRatio > solarFeH.composition.iceToRockRatio,
    "low [Fe/H] should increase ice-to-rock ratio",
  );
  assert.ok(
    highFeH.composition.iceToRockRatio < solarFeH.composition.iceToRockRatio,
    "high [Fe/H] should decrease ice-to-rock ratio",
  );
});

test("composition class stays temperature-driven across stellar metallicity", () => {
  const lowFeH = calcDebrisDisk({
    innerAu: 2.06,
    outerAu: 3.28,
    starMetallicityFeH: -1.5,
    ...SOLAR,
  });
  const highFeH = calcDebrisDisk({
    innerAu: 2.06,
    outerAu: 3.28,
    starMetallicityFeH: 0.5,
    ...SOLAR,
  });
  assert.equal(lowFeH.composition.className, "Mixed silicate-ice");
  assert.equal(highFeH.composition.className, "Mixed silicate-ice");
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

/* ── Backward compatibility ──────────────────────────────────────── */

test("backward compat: default ecc/inc/mass when omitted", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  assert.equal(d.inputs.eccentricity, 0.05, "default ecc");
  assert.equal(d.inputs.inclination, 0, "default inc");
  assert.equal(d.inputs.totalMassMearth, null, "no mass override");
  assert.equal(d.mass.source, "Wyatt steady-state");
});

/* ── Condensation sequence ───────────────────────────────────────── */

test("condensation: asteroid belt has silicates, no water ice at inner edge", () => {
  const d = calcDebrisDisk({ innerAu: 2.06, outerAu: 3.28, ...SOLAR });
  const forsterite = d.composition.species.find((s) => s.name === "Forsterite");
  const waterIce = d.composition.species.find((s) => s.name === "Water ice");
  assert.ok(forsterite.presentAtInner, "Forsterite should condense at inner edge");
  assert.ok(!waterIce.presentAtInner, "Water ice should NOT condense at inner edge (~165 K)");
});

test("condensation: Kuiper belt has water and CO₂ ice", () => {
  const d = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, ...SOLAR });
  const waterIce = d.composition.species.find((s) => s.name === "Water ice");
  const co2 = d.composition.species.find((s) => s.name === "CO\u2082 ice");
  assert.ok(waterIce.presentAtMid, "Water ice should be present");
  assert.ok(co2.presentAtMid, "CO\u2082 ice should be present");
});

test("condensation: very cold disk has CO and N₂ ice", () => {
  const d = calcDebrisDisk({ innerAu: 500, outerAu: 800, ...SOLAR });
  const coIce = d.composition.species.find((s) => s.name === "CO ice");
  const n2Ice = d.composition.species.find((s) => s.name === "N\u2082 ice");
  assert.ok(coIce.presentAtMid, "CO ice should be present at ~10 K");
  assert.ok(n2Ice.presentAtMid, "N\u2082 ice should be present at ~10 K");
});

test("condensation: ice-to-rock ratio > 0.5 beyond frost line, zero inside frost line", () => {
  const kb = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, ...SOLAR });
  assert.ok(kb.composition.iceToRockRatio > 0.5, `ice/rock = ${kb.composition.iceToRockRatio}`);
  const hot = calcDebrisDisk({ innerAu: 0.5, outerAu: 1.0, ...SOLAR });
  assert.equal(hot.composition.iceToRockRatio, 0, "no ice inside frost line");
});

/* ── Eccentricity ────────────────────────────────────────────────── */

test("eccentricity: peri < mid < apo", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, eccentricity: 0.3, ...SOLAR });
  assert.ok(d.orbital.periAu < d.orbital.midpointAu);
  assert.ok(d.orbital.apoAu > d.orbital.midpointAu);
  assert.ok(d.temperature.periK > d.temperature.midK);
  assert.ok(d.temperature.apoK < d.temperature.midK);
});

test("eccentricity: higher e → faster collision velocity", () => {
  const low = calcDebrisDisk({ innerAu: 30, outerAu: 50, eccentricity: 0.01, ...SOLAR });
  const high = calcDebrisDisk({ innerAu: 30, outerAu: 50, eccentricity: 0.4, ...SOLAR });
  assert.ok(high.collision.velocityKms > low.collision.velocityKms * 10);
});

test("eccentricity: e=0 → peri=apo=mid, circular label", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, eccentricity: 0, ...SOLAR });
  assert.equal(d.orbital.periAu, d.orbital.midpointAu);
  assert.equal(d.orbital.apoAu, d.orbital.midpointAu);
  assert.equal(d.display.periApo, "Circular");
});

/* ── Mass override ───────────────────────────────────────────────── */

test("mass override: user mass used exactly", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, totalMassMearth: 0.1, ...SOLAR });
  assert.equal(d.mass.estimatedMassEarth, 0.1);
  assert.equal(d.mass.source, "User override");
});

test("mass override: higher mass → higher optical depth", () => {
  const low = calcDebrisDisk({ innerAu: 30, outerAu: 50, totalMassMearth: 0.001, ...SOLAR });
  const high = calcDebrisDisk({ innerAu: 30, outerAu: 50, totalMassMearth: 10, ...SOLAR });
  assert.ok(high.luminosity.opticalDepth > low.luminosity.opticalDepth);
});

/* ── Collision velocity ──────────────────────────────────────────── */

test("collision velocity: Kuiper belt with e=0.05 → reasonable range", () => {
  const d = calcDebrisDisk({ innerAu: 39.4, outerAu: 47.7, eccentricity: 0.05, ...SOLAR });
  assert.ok(d.collision.velocityKms > 0.01 && d.collision.velocityKms < 5);
});

test("collision velocity: very low e → gentle regime", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, eccentricity: 0.001, ...SOLAR });
  assert.equal(d.collision.regime, "Gentle (accretionary)");
});

/* ── Surface density ─────────────────────────────────────────────── */

test("surface density: asteroid belt in reasonable range", () => {
  const d = calcDebrisDisk({ innerAu: 2.06, outerAu: 3.28, ...SOLAR });
  assert.ok(d.surfaceDensity.gcm2 > 0, "surface density should be positive");
  assert.ok(d.surfaceDensity.ratioMMSN < 1, "Wyatt steady-state should be well below MMSN");
});

/* ── IR excess ───────────────────────────────────────────────────── */

test("IR excess: young disk brighter than old", () => {
  const young = calcDebrisDisk({
    innerAu: 30,
    outerAu: 50,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 0.1,
    starTeffK: 5776,
  });
  const old = calcDebrisDisk({
    innerAu: 30,
    outerAu: 50,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 10,
    starTeffK: 5776,
  });
  assert.ok(young.irExcess.value > old.irExcess.value, "young disk brighter IR excess");
});

test("IR excess: label is valid detectability category", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR, starTeffK: 5776 });
  const valid = ["Easily detected", "Marginal", "Below threshold"];
  assert.ok(valid.includes(d.irExcess.label), `label = ${d.irExcess.label}`);
});

test("IR excess: no star Teff → null value", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  assert.equal(d.irExcess.value, null);
  assert.equal(d.irExcess.label, "Star Teff unavailable");
});

/* ── Dynamical stability ─────────────────────────────────────────── */

test("stability: disk overlapping Jupiter → unstable", () => {
  const d = calcDebrisDisk({
    innerAu: 2,
    outerAu: 8,
    ...SOLAR,
    gasGiants: [{ name: "Jupiter", au: 5.2, massMjup: 1 }],
  });
  assert.equal(d.stability.isStable, false);
  assert.ok(d.stability.overlappingGiants.length > 0);
  assert.equal(d.stability.overlappingGiants[0].name, "Jupiter");
});

test("stability: far disk → stable", () => {
  const d = calcDebrisDisk({
    innerAu: 100,
    outerAu: 150,
    ...SOLAR,
    gasGiants: [{ name: "Jupiter", au: 5.2, massMjup: 1 }],
  });
  assert.equal(d.stability.isStable, true);
  assert.equal(d.stability.overlappingGiants.length, 0);
});

test("stability: no giants → stable", () => {
  const d = calcDebrisDisk({ innerAu: 30, outerAu: 50, ...SOLAR });
  assert.equal(d.stability.isStable, true);
});
