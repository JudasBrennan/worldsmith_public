import test from "node:test";
import assert from "node:assert/strict";
import {
  latLonToXYZ,
  xyzToLatLon,
  convexHull3D,
  sphericalVoronoi,
  rotateAroundPole,
  classifyBoundaryWithSeeds,
  calcPlates,
} from "../engine/plates.js";

function approxEqual(actual, expected, tol = 0.05) {
  const diff = Math.abs(actual - expected);
  const ref = Math.abs(expected) || 1;
  assert.ok(diff <= tol * ref, `${actual} not within ${tol * 100}% of ${expected}`);
}

// ── Coordinate transforms ─────────────────────────────────

test("latLonToXYZ → north pole returns (0,0,1)", () => {
  const p = latLonToXYZ(90, 0);
  approxEqual(p.x, 0, 0.01);
  approxEqual(p.y, 0, 0.01);
  approxEqual(p.z, 1, 0.01);
});

test("latLonToXYZ → equator 0°E returns (1,0,0)", () => {
  const p = latLonToXYZ(0, 0);
  approxEqual(p.x, 1, 0.01);
  approxEqual(p.y, 0, 0.01);
  approxEqual(p.z, 0, 0.01);
});

test("latLonToXYZ → equator 90°E returns (0,1,0)", () => {
  const p = latLonToXYZ(0, 90);
  approxEqual(p.x, 0, 0.01);
  approxEqual(p.y, 1, 0.01);
  approxEqual(p.z, 0, 0.01);
});

test("xyzToLatLon → round-trip preserves coordinates", () => {
  const cases = [
    [45, 120],
    [-30, -60],
    [0, 180],
    [89, 0],
    [-89, -179],
  ];
  for (const [lat, lon] of cases) {
    const xyz = latLonToXYZ(lat, lon);
    const ll = xyzToLatLon(xyz.x, xyz.y, xyz.z);
    approxEqual(ll.latDeg, lat, 0.01);
    // Longitude wrapping near ±180 can differ; check modular equivalence
    const lonDiff = Math.abs(ll.lonDeg - lon) % 360;
    assert.ok(lonDiff < 0.1 || lonDiff > 359.9, `lon ${ll.lonDeg} != ${lon}`);
  }
});

// ── Convex hull ───────────────────────────────────────────

test("convexHull3D → tetrahedron has 4 faces", () => {
  const pts = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: -1, y: -1, z: -1 },
  ];
  const faces = convexHull3D(pts);
  assert.equal(faces.length, 4);
});

test("convexHull3D → cube vertices produce 12 triangular faces (6 quads)", () => {
  // 8 cube vertices → convex hull = 12 triangles
  const pts = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) pts.push({ x, y, z });
  const faces = convexHull3D(pts);
  assert.equal(faces.length, 12);
});

test("convexHull3D → fewer than 4 points returns empty", () => {
  assert.deepEqual(convexHull3D([{ x: 1, y: 0, z: 0 }]), []);
  assert.deepEqual(
    convexHull3D([
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]),
    [],
  );
});

// ── Spherical Voronoi ─────────────────────────────────────

test("sphericalVoronoi → 6 axis-aligned seeds produce 6 cells", () => {
  const seeds = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];
  const { cells, edges } = sphericalVoronoi(seeds);
  assert.equal(cells.length, 6);
  assert.ok(edges.length > 0, "should have edges");
  // Each cell should have 4 vertices (cube faces on the dual)
  for (const c of cells) {
    assert.equal(c.vertices.length, 4, `cell ${c.seedIdx} has ${c.vertices.length} vertices`);
  }
});

test("sphericalVoronoi → fewer than 4 seeds returns empty", () => {
  const { cells, edges } = sphericalVoronoi([
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ]);
  assert.equal(cells.length, 0);
  assert.equal(edges.length, 0);
});

test("sphericalVoronoi → cells cover all seeds", () => {
  const seeds = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 0.577, y: 0.577, z: 0.577 },
  ];
  const { cells } = sphericalVoronoi(seeds);
  assert.equal(cells.length, seeds.length);
});

// ── Euler pole rotation ───────────────────────────────────

test("rotateAroundPole → 90° around z-axis rotates x to y", () => {
  const p = { x: 1, y: 0, z: 0 };
  const pole = { x: 0, y: 0, z: 1 };
  const r = rotateAroundPole(p, pole, 90);
  approxEqual(r.x, 0, 0.01);
  approxEqual(r.y, 1, 0.01);
  approxEqual(r.z, 0, 0.01);
});

test("rotateAroundPole → 360° returns to original position", () => {
  const p = { x: 0.5, y: 0.5, z: 0.707 };
  const pole = { x: 0, y: 0, z: 1 };
  const r = rotateAroundPole(p, pole, 360);
  approxEqual(r.x, p.x, 0.01);
  approxEqual(r.y, p.y, 0.01);
  approxEqual(r.z, p.z, 0.01);
});

test("rotateAroundPole → 0° returns identical point", () => {
  const p = { x: 0.3, y: 0.6, z: 0.742 };
  const pole = { x: 1, y: 0, z: 0 };
  const r = rotateAroundPole(p, pole, 0);
  approxEqual(r.x, p.x, 0.001);
  approxEqual(r.y, p.y, 0.001);
  approxEqual(r.z, p.z, 0.001);
});

// ── Boundary classification ───────────────────────────────

test("classifyBoundaryWithSeeds → divergent when plates move apart", () => {
  const bp = { x: 1, y: 0, z: 0 };
  const seedA = { x: 0.7, y: 0.7, z: 0 };
  const seedB = { x: 0.7, y: -0.7, z: 0 };
  // Plate A rotates CW around z, plate B rotates CCW → they move apart at bp
  const motionA = { eulerPole: { x: 0, y: 0, z: 1 }, angularVelDegMyr: 1 };
  const motionB = { eulerPole: { x: 0, y: 0, z: 1 }, angularVelDegMyr: -1 };
  const result = classifyBoundaryWithSeeds(bp, seedA, seedB, motionA, motionB);
  // At x=1,y=0, plate A moves in +y direction, plate B in -y → divergent
  assert.equal(result, "divergent");
});

test("classifyBoundaryWithSeeds → convergent when plates move together", () => {
  const bp = { x: 1, y: 0, z: 0 };
  const seedA = { x: 0.7, y: 0.7, z: 0 };
  const seedB = { x: 0.7, y: -0.7, z: 0 };
  // Reverse: plate A rotates CCW, plate B CW → they converge at bp
  const motionA = { eulerPole: { x: 0, y: 0, z: 1 }, angularVelDegMyr: -1 };
  const motionB = { eulerPole: { x: 0, y: 0, z: 1 }, angularVelDegMyr: 1 };
  const result = classifyBoundaryWithSeeds(bp, seedA, seedB, motionA, motionB);
  assert.equal(result, "convergent");
});

test("classifyBoundaryWithSeeds → transform when no relative velocity", () => {
  const bp = { x: 1, y: 0, z: 0 };
  const seedA = { x: 0.7, y: 0.7, z: 0 };
  const seedB = { x: 0.7, y: -0.7, z: 0 };
  const motion = { eulerPole: { x: 0, y: 0, z: 1 }, angularVelDegMyr: 1 };
  const result = classifyBoundaryWithSeeds(bp, seedA, seedB, motion, motion);
  assert.equal(result, "transform");
});

// ── calcPlates integration ────────────────────────────────

test("calcPlates → fewer than 4 plates returns empty", () => {
  const result = calcPlates({
    plates: [
      {
        id: "p1",
        latDeg: 0,
        lonDeg: 0,
        type: "continental",
        eulerPoleLat: 0,
        eulerPoleLon: 0,
        angularVelDegMyr: 0,
      },
    ],
    timeMyr: 0,
  });
  assert.equal(result.cells.length, 0);
  assert.equal(result.boundaries.length, 0);
});

test("calcPlates → 6 plates produce 6 cells with boundaries", () => {
  const plates = [
    { id: "p1", latDeg: 0, lonDeg: 0, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 1 },
    { id: "p2", latDeg: 0, lonDeg: 180, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: -1 },
    { id: "p3", latDeg: 0, lonDeg: 90, type: "continental", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0.5 },
    { id: "p4", latDeg: 0, lonDeg: -90, type: "continental", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: -0.5 },
    { id: "p5", latDeg: 90, lonDeg: 0, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 90, angularVelDegMyr: 0.3 },
    { id: "p6", latDeg: -90, lonDeg: 0, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 90, angularVelDegMyr: -0.3 },
  ];
  const result = calcPlates({ plates, timeMyr: 0 });
  assert.equal(result.cells.length, 6);
  assert.ok(result.boundaries.length > 0);
  assert.equal(result.seeds.length, 6);
  // Check that boundary types are valid
  for (const b of result.boundaries) {
    assert.ok(["convergent", "divergent", "transform"].includes(b.type));
  }
});

test("calcPlates → timeMyr > 0 rotates seeds via Euler poles", () => {
  const plates = [
    { id: "p1", latDeg: 0, lonDeg: 0, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 10 },
    { id: "p2", latDeg: 0, lonDeg: 90, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p3", latDeg: 0, lonDeg: 180, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p4", latDeg: 0, lonDeg: -90, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p5", latDeg: 90, lonDeg: 0, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p6", latDeg: -90, lonDeg: 0, type: "oceanic", eulerPoleLat: 90, eulerPoleLon: 0, angularVelDegMyr: 0 },
  ];
  const r0 = calcPlates({ plates, timeMyr: 0 });
  const r1 = calcPlates({ plates, timeMyr: 9 }); // 90° rotation for p1
  // p1 at t=0 is (0,0), at t=9 should be rotated 90° around north pole → (0,90)
  const seed0 = r0.seeds.find((s) => s.id === "p1");
  const seed1 = r1.seeds.find((s) => s.id === "p1");
  approxEqual(seed0.lonDeg, 0, 0.1);
  approxEqual(seed1.lonDeg, 90, 0.1);
});

test("calcPlates → cells include type from input plates", () => {
  const plates = [
    { id: "p1", latDeg: 0, lonDeg: 0, type: "continental", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p2", latDeg: 0, lonDeg: 180, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p3", latDeg: 90, lonDeg: 0, type: "continental", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p4", latDeg: -90, lonDeg: 0, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p5", latDeg: 0, lonDeg: 90, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
    { id: "p6", latDeg: 0, lonDeg: -90, type: "oceanic", eulerPoleLat: 0, eulerPoleLon: 0, angularVelDegMyr: 0 },
  ];
  const result = calcPlates({ plates, timeMyr: 0 });
  const continental = result.cells.filter((c) => c.type === "continental");
  const oceanic = result.cells.filter((c) => c.type === "oceanic");
  assert.equal(continental.length, 2);
  assert.equal(oceanic.length, 4);
});
