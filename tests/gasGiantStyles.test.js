import test from "node:test";
import assert from "node:assert/strict";

import {
  GAS_GIANT_STYLES,
  getStyleById,
  styleLabel,
  gasStylePalette,
  normalizeStyleId,
} from "../ui/gasGiantStyles.js";

/* ── Style count & categories ──────────────────────────────────────── */

test("GAS_GIANT_STYLES has 24 entries", () => {
  assert.equal(GAS_GIANT_STYLES.length, 24);
});

test("17 Realistic + 7 Fantastical", () => {
  const realistic = GAS_GIANT_STYLES.filter((s) => s.category === "Realistic");
  const fantastical = GAS_GIANT_STYLES.filter((s) => s.category === "Fantastical");
  assert.equal(realistic.length, 17);
  assert.equal(fantastical.length, 7);
});

test("all style IDs are unique", () => {
  const ids = GAS_GIANT_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ── getStyleById ──────────────────────────────────────────────────── */

test("getStyleById returns jupiter for known id", () => {
  const s = getStyleById("jupiter");
  assert.equal(s.id, "jupiter");
  assert.equal(s.label, "Jupiter-like");
});

test("getStyleById falls back to jupiter for unknown id", () => {
  const s = getStyleById("nonexistent");
  assert.equal(s.id, "jupiter");
});

test("getStyleById resolves legacy alias: ice → neptune", () => {
  const s = getStyleById("ice");
  assert.equal(s.id, "neptune");
});

test("getStyleById resolves legacy alias: hot → hot-jupiter", () => {
  const s = getStyleById("hot");
  assert.equal(s.id, "hot-jupiter");
});

test("getStyleById resolves legacy alias: exotic → crystal", () => {
  const s = getStyleById("exotic");
  assert.equal(s.id, "crystal");
});

/* ── styleLabel ────────────────────────────────────────────────────── */

test("styleLabel returns string for every style", () => {
  for (const s of GAS_GIANT_STYLES) {
    const label = styleLabel(s.id);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `Label for ${s.id} should be non-empty`);
  }
});

/* ── gasStylePalette ───────────────────────────────────────────────── */

test("gasStylePalette returns required keys for every style", () => {
  for (const s of GAS_GIANT_STYLES) {
    const p = gasStylePalette(s.id);
    assert.ok(typeof p.size === "number" && p.size > 0, `${s.id} size > 0`);
    assert.ok(typeof p.c1 === "string" && p.c1.startsWith("rgba"), `${s.id} c1 is rgba`);
    assert.ok(typeof p.c2 === "string" && p.c2.startsWith("rgba"), `${s.id} c2 is rgba`);
    assert.ok(typeof p.c3 === "string" && p.c3.startsWith("rgba"), `${s.id} c3 is rgba`);
    assert.ok(typeof p.ring === "string", `${s.id} ring is string`);
  }
});

test("every style has a ringStyle with colour, gap, and width", () => {
  for (const s of GAS_GIANT_STYLES) {
    const def = getStyleById(s.id);
    assert.ok(def.ringStyle, `${s.id} should have ringStyle`);
    assert.ok(
      typeof def.ringStyle.colour === "string" && def.ringStyle.colour.length > 0,
      `${s.id} ringStyle.colour`,
    );
    assert.ok(typeof def.ringStyle.gap === "number", `${s.id} ringStyle.gap`);
    assert.ok(typeof def.ringStyle.width === "number", `${s.id} ringStyle.width`);
  }
});

/* ── normalizeStyleId ──────────────────────────────────────────────── */

test("normalizeStyleId resolves aliases", () => {
  assert.equal(normalizeStyleId("ice"), "neptune");
  assert.equal(normalizeStyleId("hot"), "hot-jupiter");
  assert.equal(normalizeStyleId("exotic"), "crystal");
});

test("normalizeStyleId passes through known styles", () => {
  assert.equal(normalizeStyleId("jupiter"), "jupiter");
  assert.equal(normalizeStyleId("saturn"), "saturn");
  assert.equal(normalizeStyleId("storm"), "storm");
});

test("normalizeStyleId defaults to jupiter for null/undefined", () => {
  assert.equal(normalizeStyleId(null), "jupiter");
  assert.equal(normalizeStyleId(undefined), "jupiter");
});
