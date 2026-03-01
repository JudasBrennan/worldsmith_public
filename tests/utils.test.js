import test from "node:test";
import assert from "node:assert/strict";

import { clamp, toFinite, round, fmt } from "../engine/utils.js";

// --- clamp ---

test("clamp → NaN input → returns min", () => {
  assert.equal(clamp(NaN, 0, 10), 0);
});

test("clamp → -Infinity input → returns min", () => {
  assert.equal(clamp(-Infinity, 5, 10), 5);
});

test("clamp → value exceeds max → returns max", () => {
  assert.equal(clamp(20, 0, 10), 10);
});

test("clamp → value within range → returns value unchanged", () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test("clamp → identical min and max → returns that value", () => {
  assert.equal(clamp(7, 3, 3), 3);
});

// --- toFinite ---

test("toFinite → numeric value → returns unchanged", () => {
  assert.equal(toFinite(42, 0), 42);
  assert.equal(toFinite(-3.14, 0), -3.14);
});

test("toFinite → numeric string → converts to number", () => {
  assert.equal(toFinite("7.5", 0), 7.5);
});

test("toFinite → NaN → returns fallback", () => {
  assert.equal(toFinite(NaN, 99), 99);
});

test("toFinite → ±Infinity → returns fallback", () => {
  assert.equal(toFinite(Infinity, 99), 99);
  assert.equal(toFinite(-Infinity, 99), 99);
});

test("toFinite → non-numeric string → returns fallback", () => {
  assert.equal(toFinite("hello", 5), 5);
});

test("toFinite → null → returns 0 (Number(null) is finite)", () => {
  assert.equal(toFinite(null, 99), 0);
});

test("toFinite → undefined → returns fallback", () => {
  assert.equal(toFinite(undefined, 2), 2);
});

// --- round ---

test("round → specified decimal places → correct rounding", () => {
  assert.equal(round(3.14159, 2), 3.14);
  assert.equal(round(2.5, 0), 3);
});

test("round → non-finite input → returns NaN", () => {
  assert.ok(Number.isNaN(round(NaN, 2)));
  assert.ok(Number.isNaN(round(Infinity, 2)));
});

test("round → no dp argument → defaults to 3 decimals", () => {
  assert.equal(round(1.23456789), 1.235);
});

// --- fmt ---

test("fmt → non-finite input → returns 'NA'", () => {
  assert.equal(fmt(NaN), "NA");
  assert.equal(fmt(Infinity), "NA");
});

test("fmt → en-US locale → dot decimal separator", () => {
  const result = fmt(1.5, 1);
  assert.equal(result, "1.5");
});

test("fmt → explicit dp → respects decimal places", () => {
  assert.equal(fmt(1.23456, 2), "1.23");
  assert.equal(fmt(1000, 0), "1,000");
});

test("fmt → no dp argument → defaults to 3 decimals", () => {
  assert.equal(fmt(1.23456789), "1.235");
});
