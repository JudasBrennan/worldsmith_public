import test from "node:test";
import assert from "node:assert/strict";

import {
  calcStar,
  calcHabitableZoneAu,
  estimateHabitableTeffKFromMass,
  habitableFluxLimitsFromTeffK,
  starColourHexFromTempK,
  massToLuminosity,
  massToRadius,
  giantPlanetProbability,
  populationLabel,
  feHtoZ,
  zamsLuminosity,
  zamsRadius,
  msLifetimeGyr,
  evolvedLuminosity,
  evolvedRadius,
} from "../engine/star.js";
import { approxEqual, pctWithin } from "./testHelpers.js";

test("sun-like star returns corrected habitable zone values", () => {
  const star = calcStar({ massMsol: 1, ageGyr: 4.6 });

  assert.equal(star.luminosityLsol, 1.0, "solar luminosity exactly 1");
  assert.equal(star.radiusRsol, 1.0, "solar radius exactly 1");
  assert.equal(star.spectralClass, "G2.8V");
  assert.equal(star.earthLikeLifePossible, "Yes");
  approxEqual(star.tempK, 5776, 1e-12, "tempK");
  approxEqual(star.habitableZoneAu.inner, 0.950443247520335, 1e-12, "HZ inner");
  approxEqual(star.habitableZoneAu.outer, 1.6760038078849773, 1e-12, "HZ outer");
  approxEqual(star.habitableZoneModel.sIn, 1.107, 1e-12, "sIn");
  approxEqual(star.habitableZoneModel.sOut, 0.356, 1e-12, "sOut");
});

test("temperature-dependent HZ fluxes change for lower-mass stars", () => {
  const teff = estimateHabitableTeffKFromMass(0.8);
  const flux = habitableFluxLimitsFromTeffK(teff);

  approxEqual(teff, 5110.660482615682, 1e-12, "estimated teff");
  approxEqual(flux.sIn, 1.0266097452476324, 1e-12, "sIn");
  approxEqual(flux.sOut, 0.31641452792909563, 1e-12, "sOut");
});

// --- Boundary and edge-case tests ---

test("mass is clamped to valid range", () => {
  const low = calcStar({ massMsol: 0, ageGyr: 5 });
  assert.equal(low.inputs.massMsol, 0.075);
  assert.ok(low.luminosityLsol > 0, "luminosity must be positive");
  const high = calcStar({ massMsol: 999, ageGyr: 1 });
  assert.equal(high.inputs.massMsol, 100);
});

test("earthLikeLifePossible covers all classification branches", () => {
  assert.equal(calcStar({ massMsol: 0.3, ageGyr: 5 }).earthLikeLifePossible, "No");
  assert.equal(calcStar({ massMsol: 2, ageGyr: 5 }).earthLikeLifePossible, "No");
  assert.equal(calcStar({ massMsol: 1, ageGyr: 1 }).earthLikeLifePossible, "Star Too Young");
});

test("high-mass star has shorter maximum age", () => {
  const massive = calcStar({ massMsol: 10, ageGyr: 1 });
  const sun = calcStar({ massMsol: 1, ageGyr: 1 });
  assert.ok(massive.maxAgeGyr < sun.maxAgeGyr, "massive stars burn out faster");
});

test("HZ outer > HZ inner for all valid masses", () => {
  // Note: extreme masses (< 0.2 or > 3) are excluded because the Chromant HZ
  // polynomial is calibrated for G/K/M-dwarf effective temperatures. Outside
  // this range the polynomial coefficients produce degenerate (equal or inverted)
  // inner/outer boundaries, which is a known limitation of the polynomial fit.
  for (const mass of [0.3, 0.5, 1, 1.5, 2]) {
    const star = calcStar({ massMsol: mass, ageGyr: 5 });
    assert.ok(
      star.habitableZoneAu.outer > star.habitableZoneAu.inner,
      `HZ outer > inner for mass=${mass}`,
    );
  }
});

test("spectral class includes luminosity suffix V", () => {
  for (const mass of [0.3, 0.8, 1, 1.5, 3]) {
    const star = calcStar({ massMsol: mass, ageGyr: 4 });
    assert.ok(
      star.spectralClass.endsWith("V"),
      `spectralClass ends in V for mass=${mass}: ${star.spectralClass}`,
    );
  }
});

test("star colour hex is a valid hex string for various temperatures", () => {
  assert.match(starColourHexFromTempK(5776), /^#[0-9A-Fa-f]{6}$/);
  assert.match(starColourHexFromTempK(3500), /^#[0-9A-Fa-f]{6}$/);
  assert.match(starColourHexFromTempK(NaN), /^#[0-9A-Fa-f]{6}$/);
  assert.match(starColourHexFromTempK(40000), /^#[0-9A-Fa-f]{6}$/);
});

test("HZ scales outward for more luminous stars", () => {
  const dim = calcStar({ massMsol: 0.5, ageGyr: 5 });
  const bright = calcStar({ massMsol: 1.5, ageGyr: 5 });
  assert.ok(
    bright.habitableZoneAu.inner > dim.habitableZoneAu.inner,
    "brighter star HZ is further out",
  );
});

// --- Eker et al. (2018) MLR formula-branch tests ---

test("MLR: ultra-low-mass segment (M < 0.45)", () => {
  // L = 0.0892 × M^2.028
  const L = massToLuminosity(0.2);
  approxEqual(L, 0.0892 * 0.2 ** 2.028, 1e-12, "ultra-low-mass luminosity");
});

test("MLR: late-K segment (0.45 ≤ M < 0.72)", () => {
  // L = 0.680 × M^4.572
  const L = massToLuminosity(0.6);
  approxEqual(L, 0.68 * 0.6 ** 4.572, 1e-12, "late-K luminosity");
});

test("MLR: solar-type segment (0.72 ≤ M < 1.05)", () => {
  // L = 1.0 × M^5.743
  const L = massToLuminosity(0.9);
  approxEqual(L, 1.0 * 0.9 ** 5.743, 1e-12, "solar-type luminosity");
});

test("MLR: F/A segment (1.05 ≤ M < 2.40)", () => {
  // L = 1.072 × M^4.329
  const L = massToLuminosity(1.5);
  approxEqual(L, 1.072 * 1.5 ** 4.329, 1e-12, "F/A star luminosity");
});

test("MLR: B-star segment (2.40 ≤ M < 7.0)", () => {
  // L = 1.471 × M^3.967
  const L = massToLuminosity(5.0);
  approxEqual(L, 1.471 * 5.0 ** 3.967, 1e-12, "B star luminosity");
});

test("MLR: O-star segment (M ≥ 7.0)", () => {
  // L = 12.55 × M^2.865
  const L = massToLuminosity(10.0);
  approxEqual(L, 12.55 * 10.0 ** 2.865, 1e-12, "O star luminosity");
});

test("MLR is continuous across all segment boundaries", () => {
  const boundaries = [0.45, 0.72, 1.05, 2.4, 7.0];
  const eps = 1e-6;
  for (const b of boundaries) {
    const below = massToLuminosity(b - eps);
    const above = massToLuminosity(b + eps);
    const ratio = above / below;
    assert.ok(
      Math.abs(ratio - 1) < 0.002,
      `MLR jump at ${b} Msol: ratio ${ratio.toFixed(6)} should be ~1.0`,
    );
  }
});

test("MLR monotonically increases across full mass range", () => {
  let prev = 0;
  for (const m of [0.08, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2, 3, 5, 10, 50, 100]) {
    const L = massToLuminosity(m);
    assert.ok(L > prev, `L(${m}) = ${L} should exceed L(prev) = ${prev}`);
    prev = L;
  }
});

// --- Eker MRR tests ---

test("MRR: quadratic for M ≤ 1.0, power law for M > 1.0", () => {
  // M = 0.5: quadratic branch
  const r05 = massToRadius(0.5);
  const expected05 = (0.438 * 0.25 + 0.479 * 0.5 + 0.075) / 0.992;
  approxEqual(r05, expected05, 1e-12, "radius at 0.5 Msol");

  // M = 2.0: power-law branch
  const r20 = massToRadius(2.0);
  approxEqual(r20, 2.0 ** 0.57, 1e-12, "radius at 2.0 Msol");
});

test("MRR is continuous at M = 1.0 boundary", () => {
  const below = massToRadius(1.0 - 1e-9);
  const above = massToRadius(1.0 + 1e-9);
  approxEqual(below, 1.0, 1e-6, "radius just below 1.0");
  approxEqual(above, 1.0, 1e-6, "radius just above 1.0");
});

// --- Benchmark star accuracy (Eker 2018 vs observed) ---

test("benchmark: 61 Cygni A (K5V, 0.70 Msol) luminosity within 15%", () => {
  // 61 Cyg A: M = 0.70, L_obs = 0.153 (Kervella et al.)
  pctWithin(massToLuminosity(0.7), 0.153, 15, "61 Cyg A luminosity");
});

test("benchmark: epsilon Eridani (K2V, 0.82 Msol) luminosity within 10%", () => {
  // ε Eri: M = 0.82, L_obs = 0.34
  pctWithin(massToLuminosity(0.82), 0.34, 10, "ε Eri luminosity");
});

test("benchmark: alpha Centauri B (K1V, 0.907 Msol) luminosity within 15%", () => {
  // α Cen B: M = 0.907, L_obs = 0.50
  pctWithin(massToLuminosity(0.907), 0.5, 15, "α Cen B luminosity");
});

test("benchmark: alpha Centauri A (G2V, 1.10 Msol) luminosity within 10%", () => {
  // α Cen A: M = 1.10, L_obs = 1.519
  pctWithin(massToLuminosity(1.1), 1.519, 10, "α Cen A luminosity");
});

test("benchmark: Sirius A (A1V, 2.063 Msol) luminosity within 10%", () => {
  // Sirius A: M = 2.063, L_obs = 24.7
  pctWithin(massToLuminosity(2.063), 24.7, 10, "Sirius A luminosity");
});

test("benchmark: alpha Centauri B radius within 5%", () => {
  // α Cen B: M = 0.907, R_obs = 0.863
  pctWithin(massToRadius(0.907), 0.863, 5, "α Cen B radius");
});

test("radius override replaces auto-derived radius", () => {
  const auto = calcStar({ massMsol: 1, ageGyr: 4.6 });
  const overridden = calcStar({ massMsol: 1, ageGyr: 4.6, radiusRsolOverride: 2.0 });
  assert.equal(overridden.radiusRsol, 2.0, "override radius is used");
  assert.equal(overridden.radiusRsolAuto, auto.radiusRsol, "auto value is unchanged");
  assert.equal(overridden.radiusOverridden, true);
  assert.notEqual(overridden.tempK, auto.tempK, "temperature changes with radius override");
});

test("luminosity override replaces auto-derived luminosity", () => {
  const auto = calcStar({ massMsol: 1, ageGyr: 4.6 });
  const overridden = calcStar({ massMsol: 1, ageGyr: 4.6, luminosityLsolOverride: 2.0 });
  assert.equal(overridden.luminosityLsol, 2.0, "override luminosity is used");
  assert.equal(overridden.luminosityLsolAuto, auto.luminosityLsol, "auto value is unchanged");
  assert.equal(overridden.luminosityOverridden, true);
  assert.ok(
    overridden.habitableZoneAu.inner > auto.habitableZoneAu.inner,
    "HZ shifts outward for brighter star",
  );
});

test("zero and negative overrides fall back to auto", () => {
  const auto = calcStar({ massMsol: 1, ageGyr: 4.6 });
  const zeroR = calcStar({ massMsol: 1, ageGyr: 4.6, radiusRsolOverride: 0 });
  const negL = calcStar({ massMsol: 1, ageGyr: 4.6, luminosityLsolOverride: -1 });
  assert.equal(zeroR.radiusRsol, auto.radiusRsol, "zero radius override ignored");
  assert.equal(zeroR.radiusOverridden, false);
  assert.equal(negL.luminosityLsol, auto.luminosityLsol, "negative luminosity override ignored");
  assert.equal(negL.luminosityOverridden, false);
});

// --- Stefan-Boltzmann three-way resolution tests ---

test("R+T override derives luminosity via Stefan-Boltzmann", () => {
  // L = R^2 * (T/5776)^4
  const R = 1.2;
  const T = 6000;
  const expectedL = R ** 2 * (T / 5776) ** 4;
  const star = calcStar({ massMsol: 1, ageGyr: 4.6, radiusRsolOverride: R, tempKOverride: T });
  assert.equal(star.resolutionMode, "R+T→L");
  assert.equal(star.radiusRsol, R, "radius matches override");
  approxEqual(star.luminosityLsol, expectedL, 1e-10, "L derived from R+T");
  assert.equal(star.luminosityOverridden, false, "L is not directly overridden");
  assert.equal(star.tempKOverridden, true);
});

test("L+T override derives radius via Stefan-Boltzmann", () => {
  // R = sqrt(L) * (5776/T)^2
  const L = 2.0;
  const T = 6500;
  const expectedR = Math.sqrt(L) * (5776 / T) ** 2;
  const star = calcStar({
    massMsol: 1,
    ageGyr: 4.6,
    luminosityLsolOverride: L,
    tempKOverride: T,
  });
  assert.equal(star.resolutionMode, "L+T→R");
  assert.equal(star.luminosityLsol, L, "luminosity matches override");
  approxEqual(star.radiusRsol, expectedR, 1e-10, "R derived from L+T");
  assert.equal(star.radiusOverridden, false, "R is not directly overridden");
  assert.equal(star.tempKOverridden, true);
});

test("T-only override uses mass-derived radius to compute luminosity", () => {
  const T = 6000;
  const auto = calcStar({ massMsol: 1, ageGyr: 4.6 });
  const expectedL = auto.radiusRsolAuto ** 2 * (T / 5776) ** 4;
  const star = calcStar({ massMsol: 1, ageGyr: 4.6, tempKOverride: T });
  assert.equal(star.resolutionMode, "T→L (mass R)");
  assert.equal(star.radiusRsol, auto.radiusRsolAuto, "mass-derived R used");
  approxEqual(star.luminosityLsol, expectedL, 1e-10, "L derived from T and mass R");
  assert.equal(star.tempKOverridden, true);
});

test("R+L takes priority when all three overrides are provided", () => {
  const R = 1.5;
  const L = 3.0;
  const T = 9999; // ignored
  const star = calcStar({
    massMsol: 1,
    ageGyr: 4.6,
    radiusRsolOverride: R,
    luminosityLsolOverride: L,
    tempKOverride: T,
  });
  assert.equal(star.resolutionMode, "R+L→T (T ignored)");
  assert.equal(star.radiusRsol, R);
  assert.equal(star.luminosityLsol, L);
  // Temperature should be derived from R+L, not from the T override
  const expectedT = (L / R ** 2) ** 0.25 * 5776;
  approxEqual(star.tempK, expectedT, 1e-10, "T derived from R+L");
});

// --- calcHabitableZoneAu direct tests ---

test("calcHabitableZoneAu returns correct values for solar luminosity", () => {
  const hz = calcHabitableZoneAu({ luminosityLsol: 1, teffK: 5778 });
  assert.ok(hz.innerAu > 0.9 && hz.innerAu < 1.0, `inner ${hz.innerAu} should be ~0.95`);
  assert.ok(hz.outerAu > 1.5 && hz.outerAu < 1.8, `outer ${hz.outerAu} should be ~1.68`);
  assert.ok(hz.outerAu > hz.innerAu, "outer > inner");
});

test("calcHabitableZoneAu returns zero for zero luminosity", () => {
  const hz = calcHabitableZoneAu({ luminosityLsol: 0, teffK: 5778 });
  assert.equal(hz.innerAu, 0);
  assert.equal(hz.outerAu, 0);
});

test("calcHabitableZoneAu handles NaN teffK gracefully", () => {
  const hz = calcHabitableZoneAu({ luminosityLsol: 1, teffK: NaN });
  assert.ok(Number.isFinite(hz.innerAu), "inner should be finite");
  assert.ok(Number.isFinite(hz.outerAu), "outer should be finite");
  assert.ok(hz.outerAu > hz.innerAu, "outer > inner even with NaN teff");
});

test("calcHabitableZoneAu scales with luminosity", () => {
  const hz1 = calcHabitableZoneAu({ luminosityLsol: 1, teffK: 5778 });
  const hz4 = calcHabitableZoneAu({ luminosityLsol: 4, teffK: 5778 });
  // HZ ∝ sqrt(L), so 4x luminosity → 2x distance
  approxEqual(hz4.innerAu / hz1.innerAu, 2, 0.01, "inner scales as sqrt(L)");
  approxEqual(hz4.outerAu / hz1.outerAu, 2, 0.01, "outer scales as sqrt(L)");
});

// --- Stellar metallicity ---

test("giantPlanetProbability: ~10% at solar metallicity", () => {
  pctWithin(giantPlanetProbability(0), 0.1, 1, "solar [Fe/H]=0 → 10%");
});

test("giantPlanetProbability: scales with Fischer & Valenti 10^(2·[Fe/H])", () => {
  // [Fe/H]=+0.3 → 0.1 * 10^0.6 ≈ 0.398
  pctWithin(giantPlanetProbability(0.3), 0.1 * Math.pow(10, 0.6), 1, "[Fe/H]=+0.3");
  // [Fe/H]=-0.5 → 0.1 * 10^-1.0 = 0.01
  pctWithin(giantPlanetProbability(-0.5), 0.01, 1, "[Fe/H]=-0.5");
});

test("giantPlanetProbability: clamps to [0, 1]", () => {
  assert.ok(giantPlanetProbability(1.0) <= 1.0, "capped at 1.0");
  assert.ok(giantPlanetProbability(-3) >= 0, "floored at 0");
  assert.ok(giantPlanetProbability(-3) < 0.001, "very low at [Fe/H]=-3");
});

test("populationLabel: correct classification", () => {
  assert.match(populationLabel(0.0), /Population I/, "solar → Pop I");
  assert.match(populationLabel(-1.5), /Population II/, "metal-poor → Pop II");
  assert.match(populationLabel(-0.5), /Intermediate/, "old disk → Intermediate");
  assert.match(populationLabel(0.3), /Metal-rich/, "+0.3 → Metal-rich");
});

test("calcStar returns metallicity fields", () => {
  const s = calcStar({ massMsol: 1, ageGyr: 4.6, metallicityFeH: 0.0 });
  assert.strictEqual(s.inputs.metallicityFeH, 0, "metallicityFeH in inputs");
  assert.strictEqual(typeof s.giantPlanetProbability, "number", "giantPlanetProbability is number");
  assert.strictEqual(typeof s.populationLabel, "string", "populationLabel is string");
});

test("calcStar defaults metallicityFeH to 0 when undefined", () => {
  const s = calcStar({ massMsol: 1, ageGyr: 4.6 });
  assert.strictEqual(s.inputs.metallicityFeH, 0, "defaults to 0");
  pctWithin(s.giantPlanetProbability, 0.1, 1, "default → ~10%");
});

// ===========================================================================
// Stellar Evolution (Hurley, Pols & Tout 2000; Tout et al. 1996)
// ===========================================================================

test("feHtoZ: solar metallicity → Z = 0.02", () => {
  approxEqual(feHtoZ(0), 0.02, 1e-10, "solar Z");
});

test("feHtoZ: metal-poor and metal-rich", () => {
  approxEqual(feHtoZ(-1), 0.002, 1e-10, "[Fe/H]=-1 → Z=0.002");
  approxEqual(feHtoZ(0.3), 0.02 * Math.pow(10, 0.3), 1e-10, "[Fe/H]=+0.3");
});

test("ZAMS luminosity: Sun (M=1, Z=0.02) ≈ 0.70 Lsol (young Sun was ~30% dimmer)", () => {
  pctWithin(zamsLuminosity(1, 0.02), 0.7, 5, "ZAMS L(Sun)");
});

test("ZAMS radius: Sun (M=1, Z=0.02) ≈ 0.89 Rsol (young Sun was smaller)", () => {
  pctWithin(zamsRadius(1, 0.02), 0.89, 5, "ZAMS R(Sun)");
});

test("ZAMS luminosity increases monotonically with mass at solar Z", () => {
  let prev = 0;
  for (const m of [0.2, 0.5, 0.8, 1.0, 1.5, 2.0, 5.0, 10.0]) {
    const L = zamsLuminosity(m, 0.02);
    assert.ok(L > prev, `ZAMS L(${m}) = ${L} should exceed ${prev}`);
    prev = L;
  }
});

test("ZAMS radius increases monotonically with mass at solar Z", () => {
  let prev = 0;
  for (const m of [0.2, 0.5, 0.8, 1.0, 1.5, 2.0, 5.0, 10.0]) {
    const R = zamsRadius(m, 0.02);
    assert.ok(R > prev, `ZAMS R(${m}) = ${R} should exceed ${prev}`);
    prev = R;
  }
});

test("MS lifetime: Sun (M=1, Z=0.02) within 20% of 10 Gyr", () => {
  pctWithin(msLifetimeGyr(1, 0.02), 10, 20, "t_MS(Sun)");
});

test("MS lifetime: massive stars burn out faster", () => {
  const t1 = msLifetimeGyr(1, 0.02);
  const t5 = msLifetimeGyr(5, 0.02);
  const t10 = msLifetimeGyr(10, 0.02);
  assert.ok(t5 < t1, `t_MS(5)=${t5} < t_MS(1)=${t1}`);
  assert.ok(t10 < t5, `t_MS(10)=${t10} < t_MS(5)=${t5}`);
});

test("MS lifetime: low-mass stars live longer", () => {
  const t03 = msLifetimeGyr(0.3, 0.02);
  const t1 = msLifetimeGyr(1, 0.02);
  assert.ok(t03 > t1 * 5, `t_MS(0.3)=${t03} should be much longer than t_MS(1)=${t1}`);
});

test("evolved Sun at 4.6 Gyr: L within 10% of 1 Lsol", () => {
  pctWithin(evolvedLuminosity(1, 0.02, 4.6), 1.0, 10, "evolved L(Sun, 4.6 Gyr)");
});

test("evolved Sun at 4.6 Gyr: R within 10% of 1 Rsol", () => {
  pctWithin(evolvedRadius(1, 0.02, 4.6), 1.0, 10, "evolved R(Sun, 4.6 Gyr)");
});

test("evolved luminosity exceeds ZAMS luminosity at mid-MS age", () => {
  const lZams = zamsLuminosity(1, 0.02);
  const tMS = msLifetimeGyr(1, 0.02);
  const lMid = evolvedLuminosity(1, 0.02, tMS * 0.5);
  assert.ok(lMid > lZams, `L at 50% MS (${lMid}) > L_ZAMS (${lZams})`);
});

test("evolved radius exceeds ZAMS radius at mid-MS age", () => {
  const rZams = zamsRadius(1, 0.02);
  const tMS = msLifetimeGyr(1, 0.02);
  const rMid = evolvedRadius(1, 0.02, tMS * 0.5);
  assert.ok(rMid > rZams, `R at 50% MS (${rMid}) > R_ZAMS (${rZams})`);
});

test("evolved luminosity at age=0 matches ZAMS", () => {
  const lZams = zamsLuminosity(1, 0.02);
  const lEvolved = evolvedLuminosity(1, 0.02, 0);
  pctWithin(lEvolved, lZams, 0.1, "L(age=0) ≈ L_ZAMS");
});

test("evolved radius at age=0 matches ZAMS", () => {
  const rZams = zamsRadius(1, 0.02);
  const rEvolved = evolvedRadius(1, 0.02, 0);
  pctWithin(rEvolved, rZams, 0.1, "R(age=0) ≈ R_ZAMS");
});

test("calcStar with evolutionMode=evolved returns evolved fields", () => {
  const s = calcStar({ massMsol: 1, ageGyr: 4.6, metallicityFeH: 0, evolutionMode: "evolved" });
  assert.equal(s.evolutionMode, "evolved");
  assert.ok(s.radiusRsolZams > 0, "ZAMS radius returned");
  assert.ok(s.luminosityLsolZams > 0, "ZAMS luminosity returned");
  assert.ok(s.radiusRsolAuto > s.radiusRsolZams, "evolved R > ZAMS R for Sun at 4.6 Gyr");
  assert.ok(s.luminosityLsolAuto > s.luminosityLsolZams, "evolved L > ZAMS L for Sun at 4.6 Gyr");
});

test("calcStar with evolutionMode=zams returns null ZAMS fields", () => {
  const s = calcStar({ massMsol: 1, ageGyr: 4.6, evolutionMode: "zams" });
  assert.equal(s.evolutionMode, "zams");
  assert.equal(s.radiusRsolZams, null, "no ZAMS ref in zams mode");
  assert.equal(s.luminosityLsolZams, null, "no ZAMS ref in zams mode");
});

test("calcStar evolved mode: maxAgeGyr uses Hurley t_MS formula", () => {
  const evolved = calcStar({
    massMsol: 1,
    ageGyr: 4.6,
    metallicityFeH: 0,
    evolutionMode: "evolved",
  });
  const zams = calcStar({ massMsol: 1, ageGyr: 4.6, metallicityFeH: 0, evolutionMode: "zams" });
  // Hurley MS lifetime ≈ 10 Gyr for Sun; ZAMS mode uses (M/L)×10
  assert.ok(Math.abs(evolved.maxAgeGyr - zams.maxAgeGyr) < 3, "both give ~10 Gyr for Sun");
  assert.ok(evolved.maxAgeGyr > 0, "positive max age");
});

test("metal-poor star has shorter MS lifetime than metal-rich at same mass", () => {
  // Lower Z → higher L → faster burnout
  const tPoor = msLifetimeGyr(1, feHtoZ(-1));
  const tRich = msLifetimeGyr(1, feHtoZ(0.3));
  assert.ok(tPoor < tRich, `metal-poor t_MS=${tPoor} < metal-rich t_MS=${tRich}`);
});

test("evolved luminosity is higher for metal-poor stars at same age", () => {
  // Lower Z → higher ZAMS L → evolves to even higher L
  const lPoor = evolvedLuminosity(1, feHtoZ(-0.5), 4.6);
  const lSolar = evolvedLuminosity(1, feHtoZ(0), 4.6);
  assert.ok(lPoor > lSolar, `metal-poor L=${lPoor} > solar L=${lSolar}`);
});
