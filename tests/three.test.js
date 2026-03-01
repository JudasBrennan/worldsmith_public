/**
 * Three.js module tests — verify the npm `three` package is usable and that
 * the math/colour utilities we rely on in threeNativePreview behave correctly.
 *
 * These tests do NOT need WebGL (headless-gl) — they exercise the CPU-side
 * utilities that Three.js provides.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

/* ───── module availability ───── */

test("THREE → import → exposes core constructors", () => {
  assert.equal(typeof THREE.Vector3, "function");
  assert.equal(typeof THREE.Color, "function");
  assert.equal(typeof THREE.Matrix4, "function");
  assert.equal(typeof THREE.Quaternion, "function");
  assert.equal(typeof THREE.Euler, "function");
  assert.equal(typeof THREE.MathUtils, "object");
  assert.equal(typeof THREE.SphereGeometry, "function");
  assert.equal(typeof THREE.PlaneGeometry, "function");
  assert.equal(typeof THREE.ShaderMaterial, "function");
});

/* ───── Vector3 ───── */

test("Vector3 → (3,4,0) → length 5 and normalize to unit", () => {
  const v = new THREE.Vector3(3, 4, 0);
  assert.equal(v.length(), 5);

  v.normalize();
  assert.ok(Math.abs(v.length() - 1) < 1e-10);
  assert.ok(Math.abs(v.x - 0.6) < 1e-10);
  assert.ok(Math.abs(v.y - 0.8) < 1e-10);
});

test("Vector3 → orthogonal vectors → dot product is 0", () => {
  const a = new THREE.Vector3(1, 0, 0);
  const b = new THREE.Vector3(0, 1, 0);
  assert.equal(a.dot(b), 0);

  const c = new THREE.Vector3(1, 0, 0);
  assert.equal(a.dot(c), 1);
});

test("Vector3 → X cross Y → produces Z", () => {
  const a = new THREE.Vector3(1, 0, 0);
  const b = new THREE.Vector3(0, 1, 0);
  const cross = new THREE.Vector3().crossVectors(a, b);
  assert.equal(cross.x, 0);
  assert.equal(cross.y, 0);
  assert.equal(cross.z, 1);
});

/* ───── light direction used in threeNativePreview ───── */

test("Vector3 → light direction normalised → unit vector from left/above/front", () => {
  // threeNativePreview.js uses: lightDir = new Vector3(-0.6, 0.45, 0.7).normalize()
  const light = new THREE.Vector3(-0.6, 0.45, 0.7).normalize();
  assert.ok(Math.abs(light.length() - 1) < 1e-10, "light must be unit vector");
  assert.ok(light.x < 0, "light comes from the left");
  assert.ok(light.y > 0, "light comes from above");
  assert.ok(light.z > 0, "light comes from the front");
});

/* ───── Color ───── */

test("Color → hex string → parses to linear RGB", () => {
  const c = new THREE.Color("#ff8800");
  assert.ok(Math.abs(c.r - 1.0) < 0.01);
  // Three.js stores in linear space: sRGB 0x88/0xff ≈ 0.246 linear
  assert.ok(Math.abs(c.g - 0.246) < 0.01);
  assert.ok(Math.abs(c.b - 0.0) < 0.01);
});

test("Color → CSS name 'white' → (1,1,1)", () => {
  const c = new THREE.Color("white");
  assert.equal(c.r, 1);
  assert.equal(c.g, 1);
  assert.equal(c.b, 1);
});

test("Color → lerp black to white at 0.5 → mid-grey", () => {
  const black = new THREE.Color(0, 0, 0);
  const white = new THREE.Color(1, 1, 1);
  const mid = black.clone().lerp(white, 0.5);
  assert.ok(Math.abs(mid.r - 0.5) < 1e-6);
  assert.ok(Math.abs(mid.g - 0.5) < 1e-6);
  assert.ok(Math.abs(mid.b - 0.5) < 1e-6);
});

test("Color → getHSL then setHSL → round-trips correctly", () => {
  const c = new THREE.Color("#3388ff");
  const hsl = {};
  c.getHSL(hsl);
  assert.ok(hsl.h >= 0 && hsl.h <= 1);
  assert.ok(hsl.s >= 0 && hsl.s <= 1);
  assert.ok(hsl.l >= 0 && hsl.l <= 1);

  const c2 = new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
  assert.ok(Math.abs(c.r - c2.r) < 0.01);
  assert.ok(Math.abs(c.g - c2.g) < 0.01);
  assert.ok(Math.abs(c.b - c2.b) < 0.01);
});

/* ───── Matrix4 ───── */

test("Matrix4 → identity → preserves vector unchanged", () => {
  const m = new THREE.Matrix4(); // identity by default
  const v = new THREE.Vector3(5, 10, 15);
  v.applyMatrix4(m);
  assert.equal(v.x, 5);
  assert.equal(v.y, 10);
  assert.equal(v.z, 15);
});

test("Matrix4 → 90° Z rotation → X-axis maps to Y-axis", () => {
  const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const v = new THREE.Vector3(1, 0, 0);
  v.applyMatrix4(m);
  assert.ok(Math.abs(v.x) < 1e-10);
  assert.ok(Math.abs(v.y - 1) < 1e-10);
});

/* ───── MathUtils ───── */

test("MathUtils.clamp → in/below/above range → correct clamping", () => {
  assert.equal(THREE.MathUtils.clamp(5, 0, 10), 5);
  assert.equal(THREE.MathUtils.clamp(-1, 0, 10), 0);
  assert.equal(THREE.MathUtils.clamp(15, 0, 10), 10);
});

test("MathUtils.lerp → 0/0.5/1 → correct interpolation", () => {
  assert.equal(THREE.MathUtils.lerp(0, 100, 0.5), 50);
  assert.equal(THREE.MathUtils.lerp(0, 100, 0), 0);
  assert.equal(THREE.MathUtils.lerp(0, 100, 1), 100);
});

test("MathUtils → degToRad then radToDeg → round-trips 45°", () => {
  const deg = 45;
  const rad = THREE.MathUtils.degToRad(deg);
  assert.ok(Math.abs(rad - Math.PI / 4) < 1e-10);
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(rad) - deg) < 1e-10);
});

/* ───── Quaternion & Euler ───── */

test("Quaternion → from Euler XYZ → round-trips to same angles", () => {
  const euler = new THREE.Euler(Math.PI / 4, Math.PI / 3, Math.PI / 6, "XYZ");
  const q = new THREE.Quaternion().setFromEuler(euler);
  assert.ok(Math.abs(q.length() - 1) < 1e-10, "quaternion must be unit");

  const euler2 = new THREE.Euler().setFromQuaternion(q, "XYZ");
  assert.ok(Math.abs(euler.x - euler2.x) < 1e-6);
  assert.ok(Math.abs(euler.y - euler2.y) < 1e-6);
  assert.ok(Math.abs(euler.z - euler2.z) < 1e-6);
});

/* ───── Geometry ───── */

test("SphereGeometry → 16x12 segments → 221 vertices", () => {
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const pos = geo.getAttribute("position");
  // (widthSegments + 1) * (heightSegments + 1) = 17 * 13 = 221
  assert.equal(pos.count, 221);
  geo.dispose();
});

test("PlaneGeometry → 2x2 default → 4 vertices", () => {
  const geo = new THREE.PlaneGeometry(2, 2);
  const pos = geo.getAttribute("position");
  assert.equal(pos.count, 4); // 2 triangles, 4 vertices
  geo.dispose();
});

/* ───── colour space constants used in threeBridge2d ───── */

test("THREE.SRGBColorSpace → exists → equals 'srgb'", () => {
  assert.equal(typeof THREE.SRGBColorSpace, "string");
  assert.equal(THREE.SRGBColorSpace, "srgb");
});

test("THREE.LinearFilter → exists → is a number", () => {
  assert.equal(typeof THREE.LinearFilter, "number");
});
