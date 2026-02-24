import test from "node:test";
import assert from "node:assert/strict";
import { calcLagrangePoints } from "../engine/lagrange.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

// ── Earth-Sun system ──────────────────────────────────────────────

test("Earth-Sun L1/L2 distance ≈ 0.01 AU (Hill radius)", () => {
  const lp = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 1, // Earth masses
    starMass: 332946, // EARTH_PER_MSOL
    bodyAngleRad: 0,
  });
  assert.ok(lp);
  // Hill radius ≈ 1.0 × (1/(3×332946))^(1/3) ≈ 0.01 AU
  approxEqual(lp.hill.au, 0.01, 0.002, "Hill AU");
  approxEqual(lp.points.L1.au, 1.0 - lp.hill.au, 1e-10, "L1 AU");
  approxEqual(lp.points.L2.au, 1.0 + lp.hill.au, 1e-10, "L2 AU");
});

test("Earth-Sun L4/L5 at ±60° and same AU as body", () => {
  const angle = 1.2; // arbitrary
  const lp = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 1,
    starMass: 332946,
    bodyAngleRad: angle,
  });
  assert.ok(lp);
  assert.strictEqual(lp.points.L4.au, 1.0);
  assert.strictEqual(lp.points.L5.au, 1.0);
  approxEqual(lp.points.L4.angleRad, angle + Math.PI / 3, 1e-12, "L4 angle");
  approxEqual(lp.points.L5.angleRad, angle - Math.PI / 3, 1e-12, "L5 angle");
});

test("Earth-Sun L3 on opposite side with tiny mass correction", () => {
  const lp = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 1,
    starMass: 332946,
    bodyAngleRad: 0,
  });
  assert.ok(lp);
  // L3 AU = 1.0 × (1 + 5/12 × 1/332946) ≈ 1.000001
  assert.ok(lp.points.L3.au > 1.0, "L3 AU slightly > body AU");
  assert.ok(lp.points.L3.au < 1.001, "L3 correction tiny for Earth");
  approxEqual(lp.points.L3.angleRad, Math.PI, 1e-12, "L3 angle");
});

// ── Jupiter-Sun system ────────────────────────────────────────────

test("Jupiter-Sun Hill radius ≈ 0.35 AU", () => {
  const lp = calcLagrangePoints({
    bodyAu: 5.2,
    bodyMass: 1, // Jupiter masses
    starMass: 1047.35, // MJUP_PER_MSOL
    bodyAngleRad: 0,
  });
  assert.ok(lp);
  // Hill ≈ 5.2 × (1/(3×1047.35))^(1/3) ≈ 0.355 AU
  approxEqual(lp.hill.au, 0.355, 0.02, "Jupiter Hill AU");
  approxEqual(lp.points.L1.au, 5.2 - lp.hill.au, 1e-10, "Jupiter L1");
  approxEqual(lp.points.L2.au, 5.2 + lp.hill.au, 1e-10, "Jupiter L2");
});

test("Jupiter-Sun L3 mass correction is larger than Earth", () => {
  const lpJ = calcLagrangePoints({
    bodyAu: 5.2,
    bodyMass: 1,
    starMass: 1047.35,
    bodyAngleRad: 0,
  });
  const lpE = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 1,
    starMass: 332946,
    bodyAngleRad: 0,
  });
  assert.ok(lpJ);
  assert.ok(lpE);
  const corrJ = lpJ.points.L3.au - 5.2;
  const corrE = lpE.points.L3.au - 1.0;
  assert.ok(corrJ > corrE, "Jupiter L3 correction > Earth L3 correction");
});

// ── L4/L5 symmetry ───────────────────────────────────────────────

test("L4 and L5 are symmetric about body angle", () => {
  const angle = 2.5;
  const lp = calcLagrangePoints({
    bodyAu: 3.0,
    bodyMass: 0.5,
    starMass: 1000,
    bodyAngleRad: angle,
  });
  assert.ok(lp);
  const d4 = lp.points.L4.angleRad - angle;
  const d5 = angle - lp.points.L5.angleRad;
  approxEqual(d4, d5, 1e-12, "L4/L5 angular symmetry");
  approxEqual(d4, Math.PI / 3, 1e-12, "offset is 60°");
});

// ── Monotonicity ──────────────────────────────────────────────────

test("larger body mass → larger Hill radius → wider L1/L2 spread", () => {
  const small = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 1,
    starMass: 100000,
    bodyAngleRad: 0,
  });
  const large = calcLagrangePoints({
    bodyAu: 1.0,
    bodyMass: 10,
    starMass: 100000,
    bodyAngleRad: 0,
  });
  assert.ok(small);
  assert.ok(large);
  assert.ok(large.hill.au > small.hill.au, "larger mass → larger Hill");
  assert.ok(large.points.L1.au < small.points.L1.au, "L1 moves sunward");
  assert.ok(large.points.L2.au > small.points.L2.au, "L2 moves outward");
});

// ── Invalid inputs ────────────────────────────────────────────────

test("returns null for zero or negative inputs", () => {
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: 0, bodyMass: 1, starMass: 1, bodyAngleRad: 0 }),
    null,
  );
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: 1, bodyMass: 0, starMass: 1, bodyAngleRad: 0 }),
    null,
  );
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: 1, bodyMass: 1, starMass: -1, bodyAngleRad: 0 }),
    null,
  );
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: -5, bodyMass: 1, starMass: 1, bodyAngleRad: 0 }),
    null,
  );
});

test("returns null for NaN inputs", () => {
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: NaN, bodyMass: 1, starMass: 1, bodyAngleRad: 0 }),
    null,
  );
  assert.strictEqual(
    calcLagrangePoints({ bodyAu: 1, bodyMass: NaN, starMass: 1, bodyAngleRad: 0 }),
    null,
  );
});
