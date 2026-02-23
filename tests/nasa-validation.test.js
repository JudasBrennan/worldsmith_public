import test from "node:test";
import assert from "node:assert/strict";

import {
  calcStarAbsoluteMagnitude,
  calcStarApparentAtOrbit,
  calcBodyAbsoluteMagnitude,
  calcBodyApparentFromHome,
  calcMoonApparentFromHome,
} from "../engine/apparent.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} ±${tolerance}, got ${actual} (Δ=${(actual - expected).toFixed(4)})`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

const pad = (s, n) => String(s).padStart(n);
const padEnd = (s, n) => String(s).padEnd(n);

// ── NASA / JPL reference data (all from factsheets in references/) ──

// JPL V(1,0) absolute magnitudes — the standard brightness at r=1, Δ=1, phase=0°
// Source: JPL Solar System Dynamics, Mallama & Hilton (2018)
const JPL_ABS_MAG = {
  Mercury: { H: -0.613, radiusKm: 2440.5, geoAlbedo: 0.142 },
  Venus: { H: -4.384, radiusKm: 6051.8, geoAlbedo: 0.689 },
  Mars: { H: -1.601, radiusKm: 3396.2, geoAlbedo: 0.17 },
  Jupiter: { H: -9.395, radiusKm: 71492, geoAlbedo: 0.52 },
  Saturn: { H: -8.95, radiusKm: 60268, geoAlbedo: 0.47 },
  Uranus: { H: -7.11, radiusKm: 25559, geoAlbedo: 0.51 },
  Neptune: { H: -6.94, radiusKm: 24764, geoAlbedo: 0.41 },
};

// Observed apparent magnitudes at opposition (outer planets)
// Source: NASA factsheets, US Naval Observatory, BAA
const OPPOSITION_DATA = [
  {
    name: "Jupiter",
    orbitAu: 5.2026,
    radiusKm: 71492,
    geoAlbedo: 0.52,
    hasAtmo: true,
    expectedMag: -2.7,
    tolMag: 0.3,
    expectedAngArcsec: 46.9,
    tolAng: 3,
    note: "mean opposition",
  },
  {
    name: "Mars",
    orbitAu: 1.5237,
    radiusKm: 3396.2,
    geoAlbedo: 0.17,
    hasAtmo: true,
    expectedMag: -2.0,
    tolMag: 0.3,
    expectedAngArcsec: 17.9,
    tolAng: 2,
    note: "mean opposition",
  },
  {
    name: "Saturn",
    orbitAu: 9.5549,
    radiusKm: 60268,
    geoAlbedo: 0.47,
    hasAtmo: true,
    expectedMag: 0.7,
    tolMag: 0.5,
    expectedAngArcsec: 18.5,
    tolAng: 2,
    note: "disk only (rings add ~1 mag)",
  },
];

/* ── Absolute magnitude: engine H vs JPL V(1,0) ─────────────── */

test("absolute magnitude (H) matches JPL V(1,0) for Solar System planets", () => {
  console.log("\n  Absolute magnitude (H) vs JPL V(1,0):");
  console.log(`  ${padEnd("Planet", 10)} ${pad("Engine", 8)} ${pad("JPL", 8)} ${pad("\u0394", 8)}`);
  console.log(`  ${"-".repeat(36)}`);

  for (const [name, ref] of Object.entries(JPL_ABS_MAG)) {
    const H = calcBodyAbsoluteMagnitude({
      radiusKm: ref.radiusKm,
      geometricAlbedo: ref.geoAlbedo,
    });
    console.log(
      `  ${padEnd(name, 10)} ${pad(H.toFixed(3), 8)} ${pad(ref.H.toFixed(3), 8)} ${pad((H - ref.H).toFixed(3), 8)}`,
    );
    approxEqual(H, ref.H, 0.15, `${name} V(1,0)`);
  }
});

/* ── Sun at 1 AU ─────────────────────────────────────────────── */

test("Sun from Earth: magnitude \u2248 \u221226.74, angular diameter \u2248 31.8 arcmin", () => {
  const abs = calcStarAbsoluteMagnitude(1);
  const result = calcStarApparentAtOrbit({
    starAbsoluteMagnitude: abs,
    starRadiusRsol: 1,
    orbitAu: 1,
  });

  console.log(
    `\n  Sun at 1 AU: mag = ${result.magnitude.toFixed(2)} (NASA \u221226.74), ang = ${(result.angularDiameterArcsec / 60).toFixed(2)}\u2032 (NASA ~31.6\u2032)`,
  );

  approxEqual(result.magnitude, -26.74, 0.05, "Sun apparent magnitude");
  approxEqual(result.angularDiameterArcsec / 60, 31.8, 0.5, "Sun angular diameter");
});

/* ── Full Moon from Earth ────────────────────────────────────── */

test("Full Moon: magnitude \u2248 \u221212.74, angular diameter \u2248 31.1 arcmin", () => {
  const moon = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384400,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });

  console.log(
    `\n  Full Moon: mag = ${moon.apparentMagnitude.toFixed(2)} (NASA \u221212.74), brightness = ${moon.brightnessRelativeToFullMoon.toFixed(4)}, ang = ${(moon.angularDiameterArcsec / 60).toFixed(2)}\u2032 (NASA 31.1\u2032)`,
  );

  approxEqual(moon.apparentMagnitude, -12.74, 0.1, "Full Moon apparent magnitude");
  approxEqual(moon.brightnessRelativeToFullMoon, 1.0, 0.05, "Full Moon brightness ratio");
  approxEqual(moon.angularDiameterArcsec / 60, 31.1, 0.5, "Moon angular diameter");
});

/* ── Planets at opposition ───────────────────────────────────── */

test("planets at opposition match observed magnitudes and angular sizes", () => {
  console.log("\n  Planets at opposition vs observed:");
  console.log(
    `  ${padEnd("Planet", 10)} ${pad("Mag", 7)} ${pad("NASA", 7)} ${pad("\u0394", 6)} \u2502 ${pad("Ang\u2033", 7)} ${pad("NASA\u2033", 7)} ${pad("\u0394\u2033", 6)}  Note`,
  );
  console.log(`  ${"-".repeat(72)}`);

  for (const p of OPPOSITION_DATA) {
    const distanceAu = p.orbitAu - 1;
    const result = calcBodyApparentFromHome({
      homeOrbitAu: 1,
      orbitAu: p.orbitAu,
      radiusKm: p.radiusKm,
      geometricAlbedo: p.geoAlbedo,
      hasAtmosphere: p.hasAtmo,
      currentDistanceAu: distanceAu,
      phaseAngleDeg: 0,
      starLuminosityLsol: 1,
    });

    console.log(
      `  ${padEnd(p.name, 10)} ${pad(result.apparentMagnitude.toFixed(2), 7)} ${pad(p.expectedMag.toFixed(2), 7)} ${pad((result.apparentMagnitude - p.expectedMag).toFixed(2), 6)} \u2502 ${pad(result.angularDiameterArcsec.toFixed(1), 7)} ${pad(p.expectedAngArcsec.toFixed(1), 7)} ${pad((result.angularDiameterArcsec - p.expectedAngArcsec).toFixed(1), 6)}  ${p.note}`,
    );

    approxEqual(result.apparentMagnitude, p.expectedMag, p.tolMag, `${p.name} opposition mag`);
    approxEqual(
      result.angularDiameterArcsec,
      p.expectedAngArcsec,
      p.tolAng,
      `${p.name} opposition angular diameter`,
    );
  }
});

/* ── Galilean moons from Jupiter surface ─────────────────────── */

test("Galilean moons from Jupiter: bright and finite", () => {
  const jupiterOrbitAu = 5.2026;
  const galileans = [
    { name: "Io", radiusMoon: 1.048, smaKm: 421800, geoAlbedo: 0.63 },
    { name: "Europa", radiusMoon: 0.8978, smaKm: 671100, geoAlbedo: 0.67 },
    { name: "Ganymede", radiusMoon: 1.5136, smaKm: 1070400, geoAlbedo: 0.43 },
    { name: "Callisto", radiusMoon: 1.3865, smaKm: 1882700, geoAlbedo: 0.17 },
  ];

  console.log("\n  Galilean moons as seen from Jupiter surface (full phase):");
  console.log(
    `  ${padEnd("Moon", 12)} ${pad("App Mag", 9)} ${pad("Ang (\u2032)", 9)} ${pad("\u00d7 Full Moon", 12)}`,
  );
  console.log(`  ${"-".repeat(44)}`);

  for (const g of galileans) {
    const result = calcMoonApparentFromHome({
      starLuminosityLsol: 1,
      homeOrbitAu: jupiterOrbitAu,
      starRadiusRsol: 1,
      moonSample: {
        name: g.name,
        radiusMoon: g.radiusMoon,
        semiMajorAxisKm: g.smaKm,
        geometricAlbedo: g.geoAlbedo,
        phaseDeg: 0,
      },
    });

    console.log(
      `  ${padEnd(g.name, 12)} ${pad(result.apparentMagnitude.toFixed(2), 9)} ${pad((result.angularDiameterArcsec / 60).toFixed(2), 9)} ${pad(result.brightnessRelativeToFullMoon.toFixed(2), 12)}`,
    );

    assert.ok(Number.isFinite(result.apparentMagnitude), `${g.name} magnitude is finite`);
    assert.ok(
      result.apparentMagnitude < -5,
      `${g.name} should be very bright from Jupiter (got ${result.apparentMagnitude.toFixed(2)})`,
    );
  }
});

/* ── Combined summary table ──────────────────────────────────── */

test("combined NASA validation summary", () => {
  const abs = calcStarAbsoluteMagnitude(1);
  const sun = calcStarApparentAtOrbit({
    starAbsoluteMagnitude: abs,
    starRadiusRsol: 1,
    orbitAu: 1,
  });

  const fullMoon = calcMoonApparentFromHome({
    starLuminosityLsol: 1,
    homeOrbitAu: 1,
    starRadiusRsol: 1,
    moonSample: {
      name: "Moon",
      radiusMoon: 1,
      semiMajorAxisKm: 384400,
      geometricAlbedo: 0.12,
      phaseDeg: 0,
    },
  });

  const jupiter = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 5.2026,
    radiusKm: 71492,
    geometricAlbedo: 0.52,
    hasAtmosphere: true,
    currentDistanceAu: 4.2026,
    phaseAngleDeg: 0,
    starLuminosityLsol: 1,
  });

  const mars = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 1.5237,
    radiusKm: 3396.2,
    geometricAlbedo: 0.17,
    hasAtmosphere: true,
    currentDistanceAu: 0.5237,
    phaseAngleDeg: 0,
    starLuminosityLsol: 1,
  });

  const saturn = calcBodyApparentFromHome({
    homeOrbitAu: 1,
    orbitAu: 9.5549,
    radiusKm: 60268,
    geometricAlbedo: 0.47,
    hasAtmosphere: true,
    currentDistanceAu: 8.5549,
    phaseAngleDeg: 0,
    starLuminosityLsol: 1,
  });

  const rows = [
    {
      name: "Sun (1 AU)",
      eMag: sun.magnitude,
      nMag: -26.74,
      eAng: sun.angularDiameterArcsec,
      nAng: 1896,
    },
    {
      name: "Full Moon",
      eMag: fullMoon.apparentMagnitude,
      nMag: -12.74,
      eAng: fullMoon.angularDiameterArcsec,
      nAng: 1866,
    },
    {
      name: "Jupiter (opp)",
      eMag: jupiter.apparentMagnitude,
      nMag: -2.7,
      eAng: jupiter.angularDiameterArcsec,
      nAng: 46.9,
    },
    {
      name: "Mars (opp)",
      eMag: mars.apparentMagnitude,
      nMag: -2.0,
      eAng: mars.angularDiameterArcsec,
      nAng: 17.9,
    },
    {
      name: "Saturn (opp)",
      eMag: saturn.apparentMagnitude,
      nMag: 0.7,
      eAng: saturn.angularDiameterArcsec,
      nAng: 18.5,
    },
  ];

  console.log(
    "\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557",
  );
  console.log("  \u2551          NASA REFERENCE VALIDATION SUMMARY               \u2551");
  console.log(
    "  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2564\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2564\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2564\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2564\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2564\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563",
  );
  console.log(
    `  \u2551 ${padEnd("Object", 14)}\u2502${pad("Engine", 9)} \u2502${pad("NASA", 8)} \u2502${pad("\u0394 Mag", 6)} \u2502${pad("Ang\u2033", 8)} \u2502${pad("NASA\u2033", 7)} \u2551`,
  );
  console.log(
    "  \u255f\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2562",
  );
  for (const r of rows) {
    console.log(
      `  \u2551 ${padEnd(r.name, 14)}\u2502${pad(r.eMag.toFixed(2), 9)} \u2502${pad(r.nMag.toFixed(2), 8)} \u2502${pad((r.eMag - r.nMag).toFixed(2), 6)} \u2502${pad(r.eAng.toFixed(1), 8)} \u2502${pad(r.nAng.toFixed(1), 7)} \u2551`,
    );
  }
  console.log(
    "  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2567\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2567\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2567\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2567\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2567\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d",
  );

  approxEqual(sun.magnitude, -26.74, 0.05, "Sun magnitude");
  approxEqual(fullMoon.apparentMagnitude, -12.74, 0.1, "Full Moon magnitude");
  approxEqual(jupiter.apparentMagnitude, -2.7, 0.3, "Jupiter opposition");
  approxEqual(mars.apparentMagnitude, -2.0, 0.3, "Mars opposition");
  approxEqual(saturn.apparentMagnitude, 0.7, 0.5, "Saturn opposition (disk only)");
});
