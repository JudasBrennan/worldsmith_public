import test from "node:test";
import assert from "node:assert/strict";

import {
  GAS_GIANT_STYLES,
  GAS_GIANT_RECIPES,
  getStyleById,
  styleLabel,
  gasStylePalette,
  normalizeStyleId,
  computeGasGiantVisualProfile,
} from "../ui/gasGiantStyles.js";

/* ── Style count & categories ──────────────────────────────────────── */

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

test("getStyleById resolves all legacy aliases", () => {
  assert.equal(getStyleById("ice").id, "neptune");
  assert.equal(getStyleById("hot").id, "hot-jupiter");
  assert.equal(getStyleById("exotic").id, "crystal");
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

test("normalizeStyleId passes through known styles", () => {
  assert.equal(normalizeStyleId("jupiter"), "jupiter");
  assert.equal(normalizeStyleId("saturn"), "saturn");
  assert.equal(normalizeStyleId("storm"), "storm");
});

test("normalizeStyleId defaults to jupiter for null/undefined", () => {
  assert.equal(normalizeStyleId(null), "jupiter");
  assert.equal(normalizeStyleId(undefined), "jupiter");
});

/* ── computeGasGiantVisualProfile ──────────────────────────────────── */

test("computeGasGiantVisualProfile returns bodyType and styleId", () => {
  const profile = computeGasGiantVisualProfile({
    classification: { sudarsky: "I" },
    inputs: { massMjup: 1.0 },
    thermal: { equilibriumTempK: 130 },
    atmosphere: { metallicitySolar: 1, hePct: 10 },
    ringProperties: { opticalDepthClass: "Tenuous" },
    physical: { radiusRj: 1.0, suggestedRadiusRj: 1.0 },
  });
  assert.equal(profile.bodyType, "gasGiant");
  assert.equal(typeof profile.styleId, "string");
  assert.ok(profile.styleId.length > 0);
});

test("computeGasGiantVisualProfile styleId matches suggestStyles primary", () => {
  const ggCalc = {
    classification: { sudarsky: "IV" },
    inputs: { massMjup: 1.0 },
    thermal: { equilibriumTempK: 1000 },
    atmosphere: { metallicitySolar: 1, hePct: 10 },
    ringProperties: { opticalDepthClass: "Tenuous" },
    physical: { radiusRj: 1.0, suggestedRadiusRj: 1.0 },
  };
  const profile = computeGasGiantVisualProfile(ggCalc);
  assert.equal(profile.styleId, "alkali");
});

/* ── GAS_GIANT_RECIPES structural validation ───────────────────────── */

test("GAS_GIANT_RECIPES has 15 entries", () => {
  assert.equal(GAS_GIANT_RECIPES.length, 15);
});

test("all recipe IDs are unique", () => {
  const ids = GAS_GIANT_RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every recipe has required fields", () => {
  for (const r of GAS_GIANT_RECIPES) {
    assert.ok(typeof r.id === "string" && r.id.length > 0, `${r.id}: id`);
    assert.ok(typeof r.label === "string" && r.label.length > 0, `${r.id}: label`);
    assert.ok(typeof r.category === "string" && r.category.length > 0, `${r.id}: category`);
    assert.ok(typeof r.hint === "string" && r.hint.length > 0, `${r.id}: hint`);
    assert.ok(typeof r.preview === "object" && r.preview !== null, `${r.id}: preview`);
    assert.ok(typeof r.preview.styleId === "string", `${r.id}: preview.styleId`);
    assert.ok(typeof r.preview.rings === "boolean", `${r.id}: preview.rings`);
    assert.ok(typeof r.apply === "object" && r.apply !== null, `${r.id}: apply`);
    assert.ok(typeof r.apply.massMjup === "number", `${r.id}: apply.massMjup`);
    assert.ok(
      typeof r.apply.rotationPeriodHours === "number",
      `${r.id}: apply.rotationPeriodHours`,
    );
    assert.ok(typeof r.apply.rings === "boolean", `${r.id}: apply.rings`);
  }
});

test("all recipe preview.styleId values are valid style IDs", () => {
  const validIds = new Set(GAS_GIANT_STYLES.map((s) => s.id));
  for (const r of GAS_GIANT_RECIPES) {
    assert.ok(validIds.has(r.preview.styleId), `${r.id}: "${r.preview.styleId}" is a valid style`);
  }
});

test("recipes span 4 categories", () => {
  const cats = new Set(GAS_GIANT_RECIPES.map((r) => r.category));
  assert.equal(cats.size, 4);
  assert.ok(cats.has("Cold Giants"));
  assert.ok(cats.has("Ice Giants"));
  assert.ok(cats.has("Warm Giants"));
  assert.ok(cats.has("Hot Giants"));
});
