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

test("GAS_GIANT_STYLES → all entries → category is Realistic", () => {
  assert.ok(
    GAS_GIANT_STYLES.length >= 17,
    `expected at least 17 styles, got ${GAS_GIANT_STYLES.length}`,
  );
  for (const s of GAS_GIANT_STYLES) {
    assert.equal(s.category, "Realistic");
  }
});

test("GAS_GIANT_STYLES → all IDs → unique", () => {
  const ids = GAS_GIANT_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ── getStyleById ──────────────────────────────────────────────────── */

test("getStyleById → known id 'jupiter' → returns jupiter style", () => {
  const s = getStyleById("jupiter");
  assert.equal(s.id, "jupiter");
  assert.equal(s.label, "Jupiter-like");
});

test("getStyleById → unknown id → falls back to jupiter", () => {
  const s = getStyleById("nonexistent");
  assert.equal(s.id, "jupiter");
});

test("getStyleById → legacy aliases → resolves correctly", () => {
  assert.equal(getStyleById("ice").id, "neptune");
  assert.equal(getStyleById("hot").id, "hot-jupiter");
});

/* ── styleLabel ────────────────────────────────────────────────────── */

test("styleLabel → every style → non-empty string", () => {
  for (const s of GAS_GIANT_STYLES) {
    const label = styleLabel(s.id);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `Label for ${s.id} should be non-empty`);
  }
});

/* ── gasStylePalette ───────────────────────────────────────────────── */

test("gasStylePalette → every style → has size, c1, c2, c3, ring", () => {
  for (const s of GAS_GIANT_STYLES) {
    const p = gasStylePalette(s.id);
    assert.ok(typeof p.size === "number" && p.size > 0, `${s.id} size > 0`);
    assert.ok(typeof p.c1 === "string" && p.c1.startsWith("rgba"), `${s.id} c1 is rgba`);
    assert.ok(typeof p.c2 === "string" && p.c2.startsWith("rgba"), `${s.id} c2 is rgba`);
    assert.ok(typeof p.c3 === "string" && p.c3.startsWith("rgba"), `${s.id} c3 is rgba`);
    assert.ok(typeof p.ring === "string", `${s.id} ring is string`);
  }
});

test("ringStyle → every style → has colour, gap, and width", () => {
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

test("normalizeStyleId → known styles → passes through unchanged", () => {
  assert.equal(normalizeStyleId("jupiter"), "jupiter");
  assert.equal(normalizeStyleId("saturn"), "saturn");
  assert.equal(normalizeStyleId("neptune"), "neptune");
});

test("normalizeStyleId → null/undefined → defaults to jupiter", () => {
  assert.equal(normalizeStyleId(null), "jupiter");
  assert.equal(normalizeStyleId(undefined), "jupiter");
});

/* ── computeGasGiantVisualProfile ──────────────────────────────────── */

test("computeGasGiantVisualProfile → valid input → returns bodyType and styleId", () => {
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

test("computeGasGiantVisualProfile → Class IV input → matches suggestStyles primary", () => {
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

test("GAS_GIANT_RECIPES → count → at least 15 entries", () => {
  assert.ok(
    GAS_GIANT_RECIPES.length >= 15,
    `expected at least 15 recipes, got ${GAS_GIANT_RECIPES.length}`,
  );
});

test("GAS_GIANT_RECIPES → all IDs → unique", () => {
  const ids = GAS_GIANT_RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("GAS_GIANT_RECIPES → every recipe → has required fields", () => {
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

test("GAS_GIANT_RECIPES → preview.styleId → all valid style IDs", () => {
  const validIds = new Set(GAS_GIANT_STYLES.map((s) => s.id));
  for (const r of GAS_GIANT_RECIPES) {
    assert.ok(validIds.has(r.preview.styleId), `${r.id}: "${r.preview.styleId}" is a valid style`);
  }
});

test("GAS_GIANT_RECIPES → categories → at least 4 distinct", () => {
  const cats = new Set(GAS_GIANT_RECIPES.map((r) => r.category));
  assert.ok(cats.size >= 4, `expected at least 4 categories, got ${cats.size}`);
  assert.ok(cats.has("Cold Giants"));
  assert.ok(cats.has("Ice Giants"));
  assert.ok(cats.has("Warm Giants"));
  assert.ok(cats.has("Hot Giants"));
});
