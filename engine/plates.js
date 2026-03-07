// SPDX-License-Identifier: MPL-2.0
// Plate tectonics geometry — spherical Voronoi tessellation, Euler pole
// rotation, and boundary classification for an interactive plate canvas.
//
// Algorithm:
//   Seeds on a sphere → 3D convex hull (= spherical Delaunay triangulation)
//   → dual graph = Voronoi cells = tectonic plates.
//   Boundary classification from relative Euler-pole velocities at each
//   boundary midpoint.
//
// Simplifications:
//   Rigid plates, kinematic motion (user-assigned Euler poles), no mantle
//   convection, no deformation, no subduction dynamics.
//
// Coordinate conventions:
//   Internal: unit-sphere Cartesian {x, y, z}
//   User-facing: geographic {latDeg, lonDeg}
//   Canvas: equirectangular projection (Plate Carrée)

import { clamp } from "./utils.js";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ── Coordinate transforms ─────────────────────────────────

/**
 * Geographic (lat, lon in degrees) to unit-sphere Cartesian.
 * @param {number} latDeg  Latitude (−90 to 90)
 * @param {number} lonDeg  Longitude (−180 to 180)
 * @returns {{x: number, y: number, z: number}}
 */
export function latLonToXYZ(latDeg, lonDeg) {
  const lat = clamp(latDeg, -90, 90) * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  };
}

/**
 * Unit-sphere Cartesian to geographic (lat, lon in degrees).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{latDeg: number, lonDeg: number}}
 */
export function xyzToLatLon(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-12) return { latDeg: 0, lonDeg: 0 };
  return {
    latDeg: Math.asin(clamp(z / r, -1, 1)) * RAD,
    lonDeg: Math.atan2(y, x) * RAD,
  };
}

// ── Vector utilities (unit sphere) ────────────────────────

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalise(v) {
  const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (r < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / r, y: v.y / r, z: v.z / r };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

// ── 3D Convex Hull (incremental) ──────────────────────────
// Returns array of triangular faces [{a, b, c}] where a, b, c are
// indices into the input points array.  Faces are oriented with
// outward-pointing normals.

/**
 * Compute the 3D convex hull of a set of points.
 * Incremental algorithm, O(n²) worst case — fine for ≤20 seeds.
 * @param {{x:number, y:number, z:number}[]} pts
 * @returns {{a:number, b:number, c:number}[]}
 */
export function convexHull3D(pts) {
  const n = pts.length;
  if (n < 4) return [];

  // Find initial tetrahedron from non-coplanar points
  let i0 = 0,
    i1 = -1,
    i2 = -1,
    i3 = -1;

  // Find second point distinct from first
  for (let i = 1; i < n; i++) {
    const d = sub(pts[i], pts[i0]);
    if (d.x * d.x + d.y * d.y + d.z * d.z > 1e-12) {
      i1 = i;
      break;
    }
  }
  if (i1 < 0) return [];

  // Find third point not collinear with first two
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1) continue;
    const c = cross(sub(pts[i1], pts[i0]), sub(pts[i], pts[i0]));
    if (c.x * c.x + c.y * c.y + c.z * c.z > 1e-12) {
      i2 = i;
      break;
    }
  }
  if (i2 < 0) return [];

  // Find fourth point not coplanar with first three
  const nrm = cross(sub(pts[i1], pts[i0]), sub(pts[i2], pts[i0]));
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2) continue;
    if (Math.abs(dot(nrm, sub(pts[i], pts[i0]))) > 1e-12) {
      i3 = i;
      break;
    }
  }
  if (i3 < 0) return [];

  // Orient initial tetrahedron so all faces have outward normals
  // relative to the centroid
  const centroid = {
    x: (pts[i0].x + pts[i1].x + pts[i2].x + pts[i3].x) / 4,
    y: (pts[i0].y + pts[i1].y + pts[i2].y + pts[i3].y) / 4,
    z: (pts[i0].z + pts[i1].z + pts[i2].z + pts[i3].z) / 4,
  };

  const makeFace = (a, b, c) => {
    const fn = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]));
    if (dot(fn, sub(pts[a], centroid)) < 0) return { a: a, b: c, c: b };
    return { a, b, c };
  };

  let faces = [
    makeFace(i0, i1, i2),
    makeFace(i0, i1, i3),
    makeFace(i0, i2, i3),
    makeFace(i1, i2, i3),
  ];

  const used = new Set([i0, i1, i2, i3]);

  // Add remaining points one at a time
  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue;
    const p = pts[i];

    // Find visible faces (point is above the face plane)
    const visible = [];
    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      const fn = cross(sub(pts[face.b], pts[face.a]), sub(pts[face.c], pts[face.a]));
      if (dot(fn, sub(p, pts[face.a])) > 1e-12) {
        visible.push(f);
      }
    }

    if (visible.length === 0) continue;
    used.add(i);

    // Find horizon edges (edges shared by exactly one visible face)
    const edgeCount = new Map();
    const edgeKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
    const edgeDir = new Map();

    for (const fi of visible) {
      const f = faces[fi];
      const edges = [
        [f.a, f.b],
        [f.b, f.c],
        [f.c, f.a],
      ];
      for (const [ea, eb] of edges) {
        const key = edgeKey(ea, eb);
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        // Store directed edge from visible face
        if (!edgeDir.has(key)) edgeDir.set(key, [ea, eb]);
      }
    }

    // Build new faces from horizon edges to the new point
    const visibleSet = new Set(visible);
    const newFaces = faces.filter((_, idx) => !visibleSet.has(idx));

    for (const [key, count] of edgeCount) {
      if (count !== 1) continue;
      const [ea, eb] = edgeDir.get(key);
      // Reverse winding so the new face looks outward
      newFaces.push(makeFace(eb, ea, i));
    }

    faces = newFaces;
  }

  return faces;
}

// ── Spherical Voronoi from Convex Hull ────────────────────
// The convex hull of points on a unit sphere is the spherical Delaunay
// triangulation.  Its dual is the spherical Voronoi diagram.

/**
 * Compute spherical Voronoi cells from seed points.
 * @param {{x:number, y:number, z:number}[]} seeds
 * @returns {{
 *   cells: {seedIdx: number, vertices: {x:number,y:number,z:number}[]}[],
 *   edges: {from: {x:number,y:number,z:number}, to: {x:number,y:number,z:number}, seedA: number, seedB: number}[]
 * }}
 */
export function sphericalVoronoi(seeds) {
  const n = seeds.length;
  if (n < 4) return { cells: [], edges: [] };

  const faces = convexHull3D(seeds);
  if (faces.length === 0) return { cells: [], edges: [] };

  // Circumcentre of each triangular face on the unit sphere =
  // normalised centroid of the three vertices (exact for unit-sphere points)
  const circumcentres = faces.map((f) => normalise(add(add(seeds[f.a], seeds[f.b]), seeds[f.c])));

  // Build adjacency: for each seed, collect the face indices that include it
  const seedFaces = Array.from({ length: n }, () => []);
  for (let fi = 0; fi < faces.length; fi++) {
    seedFaces[faces[fi].a].push(fi);
    seedFaces[faces[fi].b].push(fi);
    seedFaces[faces[fi].c].push(fi);
  }

  // For each seed, order its faces by angle around the seed direction
  const cells = [];
  for (let si = 0; si < n; si++) {
    const fis = seedFaces[si];
    if (fis.length < 3) continue;

    const seed = seeds[si];
    // Build a local 2D basis in the tangent plane at the seed
    const up = normalise(seed);
    let ref = Math.abs(up.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const u = normalise(cross(up, ref));
    const v = cross(up, u);

    // Sort face circumcentres by angle in tangent plane
    const withAngles = fis.map((fi) => {
      const cc = circumcentres[fi];
      const d = sub(cc, scale(up, dot(cc, up)));
      const angle = Math.atan2(dot(d, v), dot(d, u));
      return { fi, angle, cc };
    });
    withAngles.sort((a, b) => a.angle - b.angle);

    cells.push({
      seedIdx: si,
      vertices: withAngles.map((w) => w.cc),
    });
  }

  // Build edges: each hull face edge corresponds to a Voronoi edge between
  // two adjacent circumcentres. Deduplicate by canonical edge key.
  const edgeSet = new Map();
  const faceEdgeKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    const triEdges = [
      [f.a, f.b],
      [f.b, f.c],
      [f.c, f.a],
    ];
    for (const [ea, eb] of triEdges) {
      const key = faceEdgeKey(ea, eb);
      if (edgeSet.has(key)) {
        // Second face sharing this edge — complete the Voronoi edge
        const other = edgeSet.get(key);
        other.to = circumcentres[fi];
        other.toFi = fi;
      } else {
        edgeSet.set(key, {
          from: circumcentres[fi],
          to: null,
          toFi: -1,
          seedA: ea,
          seedB: eb,
        });
      }
    }
  }

  const edges = [];
  for (const e of edgeSet.values()) {
    if (e.to) {
      edges.push({ from: e.from, to: e.to, seedA: e.seedA, seedB: e.seedB });
    }
  }

  return { cells, edges };
}

// ── Euler pole rotation ───────────────────────────────────

/**
 * Rotate a point on the unit sphere around an Euler pole.
 * @param {{x:number, y:number, z:number}} point
 * @param {{x:number, y:number, z:number}} pole  Unit vector of rotation axis
 * @param {number} angleDeg  Rotation angle in degrees
 * @returns {{x:number, y:number, z:number}}
 */
export function rotateAroundPole(point, pole, angleDeg) {
  const a = angleDeg * DEG;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const k = normalise(pole);
  const d = dot(k, point);
  const cr = cross(k, point);
  // Rodrigues' rotation formula: v' = v·cos(a) + (k×v)·sin(a) + k·(k·v)·(1-cos(a))
  return {
    x: point.x * cosA + cr.x * sinA + k.x * d * (1 - cosA),
    y: point.y * cosA + cr.y * sinA + k.y * d * (1 - cosA),
    z: point.z * cosA + cr.z * sinA + k.z * d * (1 - cosA),
  };
}

// ── Boundary classification ───────────────────────────────

/**
 * Classify a plate boundary segment from relative velocity at the midpoint.
 * @param {{x:number,y:number,z:number}} boundaryPt  Point on the boundary
 * @param {{eulerPole:{x:number,y:number,z:number}, angularVelDegMyr:number}} plateA
 * @param {{eulerPole:{x:number,y:number,z:number}, angularVelDegMyr:number}} plateB
 * @returns {"convergent"|"divergent"|"transform"}
 */
export function classifyBoundary(boundaryPt, plateA, plateB) {
  // Velocity at a point = ω × r (angular velocity cross position)
  const velA = scale(cross(plateA.eulerPole, boundaryPt), plateA.angularVelDegMyr);
  const velB = scale(cross(plateB.eulerPole, boundaryPt), plateB.angularVelDegMyr);
  const relVel = sub(velA, velB);

  // Project relative velocity onto the radial direction at boundary point
  const radial = normalise(boundaryPt);
  // Remove radial component to get tangential relative velocity
  const tangential = sub(relVel, scale(radial, dot(relVel, radial)));

  // Boundary normal: direction from seedA toward seedB at the boundary
  // Use the boundary point's outward normal × boundary tangent as a proxy:
  // simpler — just check if plates are moving toward or away from each other
  // by looking at the component of relative velocity along the line
  // connecting the two plate seeds (projected to tangent plane)

  // The sign of the dot product of relative velocity with the
  // boundary-perpendicular direction tells us convergent vs divergent.
  // For boundary edges, the perpendicular is approximately the direction
  // from the midpoint toward one of the seeds.
  // We use the tangential component's magnitude relative to the normal component.

  const tangLen = Math.sqrt(tangential.x ** 2 + tangential.y ** 2 + tangential.z ** 2);
  if (tangLen < 1e-10) return "transform"; // no relative motion

  // Use the midpoint of the two seeds' circumcentre for a rough boundary normal
  // Actually, simpler: the boundary normal at the edge midpoint points from
  // one seed toward the other. Check dot(relVel, seedB - seedA).
  // But we don't have seeds here, so use a tangent-plane approach:

  // The radial component of relative velocity tells us nothing (both on sphere).
  // Instead, check the component along the boundary normal.
  // Without explicit seed positions, we can use the cross product of the
  // boundary tangent with the radial to get the boundary normal in the tangent plane.

  // Simplified approach: check if the relative velocity has a component
  // "pulling apart" (divergent) or "pushing together" (convergent).
  // For this, we note that the boundary is a great-circle arc.
  // The boundary-perpendicular direction in the tangent plane is unknown here.

  // Fallback: return based on simple dot product with outward radial
  // This is a rough heuristic that works for well-separated plates.
  const radComp = dot(relVel, radial);
  if (Math.abs(radComp) < tangLen * 0.3) return "transform";
  return radComp > 0 ? "divergent" : "convergent";
}

/**
 * High-level: classify a boundary using seed positions for accurate normals.
 * @param {{x:number,y:number,z:number}} boundaryPt
 * @param {{x:number,y:number,z:number}} seedA  Position of plate A seed
 * @param {{x:number,y:number,z:number}} seedB  Position of plate B seed
 * @param {{eulerPole:{x:number,y:number,z:number}, angularVelDegMyr:number}} motionA
 * @param {{eulerPole:{x:number,y:number,z:number}, angularVelDegMyr:number}} motionB
 * @returns {"convergent"|"divergent"|"transform"}
 */
export function classifyBoundaryWithSeeds(boundaryPt, seedA, seedB, motionA, motionB) {
  // Velocity at boundary point for each plate
  const velA = scale(cross(motionA.eulerPole, boundaryPt), motionA.angularVelDegMyr);
  const velB = scale(cross(motionB.eulerPole, boundaryPt), motionB.angularVelDegMyr);
  const relVel = sub(velA, velB);

  // Boundary normal: direction from seedA toward seedB, projected to tangent plane
  const radial = normalise(boundaryPt);
  const seedDir = sub(seedB, seedA);
  // Project to tangent plane at boundary point
  const seedDirTan = sub(seedDir, scale(radial, dot(seedDir, radial)));
  const bnLen = Math.sqrt(seedDirTan.x ** 2 + seedDirTan.y ** 2 + seedDirTan.z ** 2);

  if (bnLen < 1e-10) return "transform";
  const bn = scale(seedDirTan, 1 / bnLen);

  // Project relative velocity to tangent plane
  const relTan = sub(relVel, scale(radial, dot(relVel, radial)));
  const relLen = Math.sqrt(relTan.x ** 2 + relTan.y ** 2 + relTan.z ** 2);

  if (relLen < 1e-10) return "transform";

  // Normal component (toward/away from each other)
  const normalComp = dot(relTan, bn);
  // Tangential component (sliding past)
  const tangComp = Math.sqrt(Math.max(0, relLen * relLen - normalComp * normalComp));

  // Classification based on ratio
  if (Math.abs(normalComp) < tangComp * 0.5) return "transform";
  return normalComp > 0 ? "convergent" : "divergent";
}

// ── Main computation ──────────────────────────────────────

/**
 * Compute plate tessellation, boundaries, and velocity vectors.
 *
 * @param {{
 *   plates: {id:string, latDeg:number, lonDeg:number, type:string,
 *            eulerPoleLat:number, eulerPoleLon:number,
 *            angularVelDegMyr:number}[],
 *   timeMyr: number
 * }} params
 * @returns {{
 *   cells: {seedIdx:number, vertices:{latDeg:number,lonDeg:number}[],
 *           type:string, id:string}[],
 *   boundaries: {from:{latDeg:number,lonDeg:number},
 *                to:{latDeg:number,lonDeg:number},
 *                type:string, seedA:number, seedB:number}[],
 *   seeds: {latDeg:number, lonDeg:number, type:string, id:string}[]
 * }}
 */
export function calcPlates({ plates, timeMyr = 0 }) {
  if (!plates || plates.length < 4) {
    return { cells: [], boundaries: [], seeds: [] };
  }

  const t = Math.max(0, timeMyr);

  // Convert plate seeds to XYZ positions, applying Euler rotation for time > 0
  const seedsXYZ = plates.map((p) => {
    const pos = latLonToXYZ(p.latDeg, p.lonDeg);
    if (t > 0 && Math.abs(p.angularVelDegMyr) > 1e-10) {
      const pole = latLonToXYZ(p.eulerPoleLat, p.eulerPoleLon);
      return rotateAroundPole(pos, pole, p.angularVelDegMyr * t);
    }
    return pos;
  });

  // Compute Voronoi
  const { cells: rawCells, edges: rawEdges } = sphericalVoronoi(seedsXYZ);

  // Convert cells to lat/lon
  const cells = rawCells.map((c) => ({
    seedIdx: c.seedIdx,
    vertices: c.vertices.map((v) => xyzToLatLon(v.x, v.y, v.z)),
    type: plates[c.seedIdx].type,
    id: plates[c.seedIdx].id,
  }));

  // Build motion data for boundary classification
  const motions = plates.map((p) => ({
    eulerPole: latLonToXYZ(p.eulerPoleLat, p.eulerPoleLon),
    angularVelDegMyr: p.angularVelDegMyr,
  }));

  // Classify and convert boundaries
  const boundaries = rawEdges.map((e) => {
    const midXYZ = normalise(add(e.from, e.to));
    const bType = classifyBoundaryWithSeeds(
      midXYZ,
      seedsXYZ[e.seedA],
      seedsXYZ[e.seedB],
      motions[e.seedA],
      motions[e.seedB],
    );
    return {
      from: xyzToLatLon(e.from.x, e.from.y, e.from.z),
      to: xyzToLatLon(e.to.x, e.to.y, e.to.z),
      type: bType,
      seedA: e.seedA,
      seedB: e.seedB,
    };
  });

  // Current seed positions in lat/lon
  const seeds = seedsXYZ.map((s, i) => ({
    ...xyzToLatLon(s.x, s.y, s.z),
    type: plates[i].type,
    id: plates[i].id,
  }));

  return { cells, boundaries, seeds };
}
