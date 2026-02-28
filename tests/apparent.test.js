import test from "node:test";
import assert from "node:assert/strict";

import {
  calcApparentModel,
  calcBodyApparentFromHome,
  calcMoonApparentFromHome,
  calcStarAbsoluteMagnitude,
  calcStarApparentAtOrbit,
  convertGasGiantRadiusRjToKm,
  convertPlanetRadiusEarthToKm,
  bondToGeometricAlbedo,
  classifyBodyType,
  BODY_TYPE_LABEL,
  SOL_REFERENCES,
  formatAngularLabel,
} from "../engine/apparent.js";
import { approxEqual } from "./testHelpers.js";

test("star absolute/app magnitude baseline is sun-like at 1 AU", () => {
  const abs = calcStarAbsoluteMagnitude(1);
  approxEqual(abs, 4.81013, 1e-5);

  const apparent = calcStarApparentAtOrbit({
    starAbsoluteMagnitude: abs,
    starRadiusRsol: 1,
    orbitAu: 1,
  });

  // Earth sees the Sun around -26.76 apparent magnitude.
  approxEqual(apparent.magnitude, -26.761995663280967, 1e-6);
  approxEqual(apparent.brightnessRelativeToEarthSun, 1, 1e-5);
  approxEqual(apparent.apparentSizeRelativeToEarthSun, 1, 1e-9);
});

test("body apparent model clamps current distance into valid geometric bounds", () => {
  const body = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5,
    radiusKm: 69911,
    geometricAlbedo: 0.5,
    hasAtmosphere: true,
    currentDistanceAu: 50,
    phaseAngleDeg: 30,
  });

  // For home=1, orbit=5 -> distance range [4, 6]
  assert.equal(body.minDistanceAu, 4);
  assert.equal(body.maxDistanceAu, 6);
  assert.equal(body.currentDistanceAu, 6);
  assert.equal(Number.isFinite(body.apparentMagnitude), true);
});

test("moon brightness ratio uses full moon baseline correctly", () => {
  const moon = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384748,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });

  assert.equal(Number.isFinite(moon.apparentMagnitude), true);
  approxEqual(moon.brightnessRelativeToFullMoon, 1, 0.05);
  // At average distance (384748 km), the Moon is ~3% smaller than the Sun in angular
  // size — annular is the correct answer. Total eclipses only occur near perigee.
  assert.equal(moon.eclipseType, "Annular Eclipses Only");
});

test("composed apparent model returns star/body/moon sections", () => {
  const model = calcApparentModel({
    starMassMsol: 1,
    homeOrbitAu: 1,
    orbitSamples: [
      { id: "planet:venus", name: "Venus", orbitAu: 0.72 },
      { id: "planet:mars", name: "Mars", orbitAu: 1.52 },
    ],
    bodySamples: [
      {
        id: "planet:venus",
        name: "Venus",
        classLabel: "Planet",
        orbitAu: 0.72,
        radiusKm: 6052,
        geometricAlbedo: 0.75,
        hasAtmosphere: true,
      },
    ],
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384748,
      geometricAlbedo: 0.12,
      phaseDeg: 45,
    },
  });

  assert.equal(model.starByOrbit.length, 3);
  assert.equal(model.bodiesFromHome.length, 1);
  assert.equal(model.moon.name, "Moon");
});

test("radius converters map Earth and Jupiter units to kilometres", () => {
  approxEqual(convertPlanetRadiusEarthToKm(1), 6371, 1e-12);
  approxEqual(convertGasGiantRadiusRjToKm(1), 69911, 1e-12);
});

/* ── Body type classification ──────────────────────────────────── */

test("classifyBodyType and integration through calcBodyApparentFromHome", () => {
  // Direct classification
  assert.equal(classifyBodyType(6371, false), 1); // Earth-size rocky airless
  assert.equal(classifyBodyType(6371, true), 2); // Earth-size with atmosphere
  assert.equal(classifyBodyType(69911, true), 3); // Jupiter-size gas giant
  assert.equal(classifyBodyType(300, false), 4); // tiny body (< 0.1 R_earth)
  assert.equal(BODY_TYPE_LABEL[1], "Rocky (airless)");
  assert.equal(BODY_TYPE_LABEL[3], "Gas giant");

  // Integration: type threads through calcBodyApparentFromHome
  const rocky = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 1.52,
    radiusKm: 3390,
    geometricAlbedo: 0.17,
    hasAtmosphere: false,
  });
  assert.equal(rocky.bodyType, 1);
  assert.equal(rocky.bodyTypeLabel, "Rocky (airless)");

  const gasGiant = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5.2,
    radiusKm: 69911,
    geometricAlbedo: 0.538,
    hasAtmosphere: true,
  });
  assert.equal(gasGiant.bodyType, 3);
  assert.equal(gasGiant.bodyTypeLabel, "Gas giant");
});

/* ── Star luminosity correction ────────────────────────────────── */

test("brighter star makes planet appear brighter (lower magnitude)", () => {
  const base = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5,
    radiusKm: 69911,
    geometricAlbedo: 0.5,
    hasAtmosphere: true,
    starLuminosityLsol: 1,
    phaseAngleDeg: 30,
  });
  const bright = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5,
    radiusKm: 69911,
    geometricAlbedo: 0.5,
    hasAtmosphere: true,
    starLuminosityLsol: 10,
    phaseAngleDeg: 30,
  });
  assert.ok(
    bright.apparentMagnitude < base.apparentMagnitude,
    "10x luminosity should produce lower (brighter) magnitude",
  );
  // -2.5*log10(10) = -2.5 magnitude difference
  approxEqual(base.apparentMagnitude - bright.apparentMagnitude, 2.5, 0.01);
});

/* ── Phase angle > 160° guard ──────────────────────────────────── */

test("phase angle above 160 degrees returns NaN magnitude", () => {
  const body = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 0.72,
    radiusKm: 6052,
    geometricAlbedo: 0.689,
    hasAtmosphere: true,
    phaseAngleDeg: 165,
  });
  assert.equal(Number.isFinite(body.apparentMagnitude), false);
});

/* ── Bond → geometric albedo conversion ────────────────────────── */

test("bondToGeometricAlbedo converts using type-dependent phase integral", () => {
  // Type 1 (rocky airless): q ≈ 0.48 → geo = bond / 0.48
  const geo1 = bondToGeometricAlbedo(0.3, 1);
  approxEqual(geo1, 0.3 / 0.48, 1e-6);

  // Type 2 (rocky atmosphere): q ≈ 0.90
  const geo2 = bondToGeometricAlbedo(0.3, 2);
  approxEqual(geo2, 0.3 / 0.9, 1e-6);

  // Type 3 (gas giant): q ≈ 0.94
  const geo3 = bondToGeometricAlbedo(0.5, 3);
  approxEqual(geo3, 0.5 / 0.94, 1e-6);

  // Type 4 (tiny): q ≈ 0.39
  const geo4 = bondToGeometricAlbedo(0.1, 4);
  approxEqual(geo4, 0.1 / 0.39, 1e-6);
});

/* ── Visibility thresholds match WS8 ──────────────────────────── */

test("visibility classification includes Day and night tier for very bright objects", () => {
  // Outer planet at opposition (elongation ~180°) with very bright star → Day and night
  const veryBright = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 2,
    radiusKm: 60000,
    geometricAlbedo: 0.9,
    hasAtmosphere: true,
    phaseAngleDeg: 0,
    currentDistanceAu: 1,
    starLuminosityLsol: 100,
  });
  assert.ok(
    Number.isFinite(veryBright.apparentMagnitude) && veryBright.apparentMagnitude < -6,
    `Expected magnitude < -6, got ${veryBright.apparentMagnitude}`,
  );
  assert.equal(veryBright.observable, "Day and night");
  assert.equal(veryBright.visibility, "Day and night");
});

/* ── Eclipse comparison uses absolute angular sizes ────────────── */

test("perigee moon produces total eclipses (vs annular at average distance)", () => {
  // At perigee (~356500 km), Moon angular radius > Sun angular radius → total
  const moonPerigee = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "PerigeeMoon",
      radiusMoon: 1,
      semiMajorAxisKm: 356500,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });
  assert.equal(moonPerigee.eclipseType, "Total Eclipses Possible");
});

/* ── Moon distance factor regression ──────────────────────────── */

test("moon at 2 AU home orbit \u2192 correct magnitude (distance bug regression)", () => {
  const at1 = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384748,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });
  const at2 = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 2,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384748,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });
  // At 2 AU, less starlight reaches the moon: dimmer by 5·log₁₀(2) ≈ 1.505 mag
  const diff = at2.apparentMagnitude - at1.apparentMagnitude;
  approxEqual(diff, 5 * Math.log10(2), 0.01, "magnitude difference at 2 AU vs 1 AU");
});

/* ── Angular size fields ─────────────────────────────────────── */

test("star angular diameter at 1 AU matches Sun reference (~31.6 arcmin)", () => {
  const result = calcStarApparentAtOrbit({
    starAbsoluteMagnitude: calcStarAbsoluteMagnitude(1),
    starRadiusRsol: 1,
    orbitAu: 1,
  });
  approxEqual(result.angularDiameterArcsec / 60, 31.6, 0.5, "Sun angular diameter in arcminutes");
  assert.equal(typeof result.angularDiameterLabel, "string");
});

test("body angular diameter scales inversely with distance", () => {
  const near = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 2,
    radiusKm: 69911,
    geometricAlbedo: 0.5,
    hasAtmosphere: true,
    currentDistanceAu: 1,
  });
  const far = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5,
    radiusKm: 69911,
    geometricAlbedo: 0.5,
    hasAtmosphere: true,
    currentDistanceAu: 4,
  });
  approxEqual(
    near.angularDiameterArcsec / far.angularDiameterArcsec,
    4,
    0.01,
    "angular size inverse distance scaling",
  );
});

test("Moon angular diameter at 384748 km \u2248 31 arcmin", () => {
  const moon = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384748,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });
  approxEqual(moon.angularDiameterArcsec / 60, 31.0, 0.5, "Moon angular diameter in arcminutes");
});

/* ── Multi-moon support ──────────────────────────────────────── */

test("calcApparentModel with moonSamples returns multiple moons", () => {
  const model = calcApparentModel({
    starMassMsol: 1,
    homeOrbitAu: 1,
    moonSamples: [
      { name: "Io", radiusMoon: 1.05, semiMajorAxisKm: 421700, geometricAlbedo: 0.63, phaseDeg: 0 },
      {
        name: "Europa",
        radiusMoon: 0.9,
        semiMajorAxisKm: 671034,
        geometricAlbedo: 0.67,
        phaseDeg: 0,
      },
    ],
  });
  assert.equal(model.moons.length, 2);
  assert.equal(model.moons[0].name, "Io");
  assert.equal(model.moons[1].name, "Europa");
  assert.equal(model.moon.name, "Io");
  assert.ok(Number.isFinite(model.moons[0].angularDiameterArcsec));
  assert.ok(Number.isFinite(model.moons[1].angularDiameterArcsec));
});

/* ── Sol references ──────────────────────────────────────────── */

test("SOL_REFERENCES contains expected entries", () => {
  assert.ok(Array.isArray(SOL_REFERENCES));
  assert.ok(SOL_REFERENCES.length >= 6);
  const sun = SOL_REFERENCES.find((r) => r.name === "Sun");
  assert.ok(sun);
  approxEqual(sun.appMag, -26.74, 0.01);
});

test("formatAngularLabel formats degrees, arcmin, arcsec correctly", () => {
  assert.ok(formatAngularLabel({ arcsec: 7200, arcmin: 120, degrees: 2 }).includes("\u00b0"));
  assert.ok(formatAngularLabel({ arcsec: 1800, arcmin: 30, degrees: 0.5 }).includes("\u2032"));
  assert.ok(formatAngularLabel({ arcsec: 45, arcmin: 0.75, degrees: 0.0125 }).includes("\u2033"));
  assert.equal(formatAngularLabel({ arcsec: NaN, arcmin: NaN, degrees: NaN }), "NA");
});
