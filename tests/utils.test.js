import test from "node:test";
import assert from "node:assert/strict";

import { clamp, toFinite, round, fmt } from "../engine/utils.js";

// --- clamp ---

test("clamp returns min for NaN input", () => {
  assert.equal(clamp(NaN, 0, 10), 0);
});

test("clamp returns min for -Infinity input", () => {
  assert.equal(clamp(-Infinity, 5, 10), 5);
});

test("clamp returns max when value exceeds max", () => {
  assert.equal(clamp(20, 0, 10), 10);
});

test("clamp returns value when within range", () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test("clamp works with identical min and max", () => {
  assert.equal(clamp(7, 3, 3), 3);
});

// --- toFinite ---

test("toFinite returns numeric value unchanged", () => {
  assert.equal(toFinite(42, 0), 42);
  assert.equal(toFinite(-3.14, 0), -3.14);
});

test("toFinite converts numeric strings", () => {
  assert.equal(toFinite("7.5", 0), 7.5);
});

test("toFinite returns fallback for NaN", () => {
  assert.equal(toFinite(NaN, 99), 99);
});

test("toFinite returns fallback for Infinity", () => {
  assert.equal(toFinite(Infinity, 99), 99);
  assert.equal(toFinite(-Infinity, 99), 99);
});

test("toFinite returns fallback for non-numeric strings", () => {
  assert.equal(toFinite("hello", 5), 5);
});

test("toFinite returns 0 for null (Number(null) === 0, which is finite)", () => {
  assert.equal(toFinite(null, 99), 0);
});

test("toFinite returns fallback for undefined", () => {
  assert.equal(toFinite(undefined, 2), 2);
});

// --- round ---

test("round rounds to specified decimal places", () => {
  assert.equal(round(3.14159, 2), 3.14);
  assert.equal(round(2.5, 0), 3);
});

test("round returns NaN for non-finite input", () => {
  assert.ok(Number.isNaN(round(NaN, 2)));
  assert.ok(Number.isNaN(round(Infinity, 2)));
});

test("round defaults to 3 decimal places", () => {
  assert.equal(round(1.23456789), 1.235);
});

// --- fmt ---

test("fmt returns NA for non-finite input", () => {
  assert.equal(fmt(NaN), "NA");
  assert.equal(fmt(Infinity), "NA");
});

test("fmt formats with en-US locale (dot decimal separator)", () => {
  const result = fmt(1.5, 1);
  assert.equal(result, "1.5");
});

test("fmt respects dp parameter", () => {
  assert.equal(fmt(1.23456, 2), "1.23");
  assert.equal(fmt(1000, 0), "1,000");
});

test("fmt uses three decimal places by default", () => {
  assert.equal(fmt(1.23456789), "1.235");
});
