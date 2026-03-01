/**
 * Gas Giant Style Suggestion Tests
 *
 * Tests the suggestStyles() function which maps physics-driven
 * calcGasGiant() results to visually appropriate style candidates.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { suggestStyles, GAS_GIANT_STYLES } from "../ui/gasGiantStyles.js";

// ── Fantastical IDs (must never appear in suggestions) ───────────
const FANTASTICAL_IDS = GAS_GIANT_STYLES.filter((s) => s.category === "Fantastical").map(
  (s) => s.id,
);

// ── Helper factory ───────────────────────────────────────────────

/** Build a mock calcGasGiant() result with sensible defaults and deep merge. */
function makeGgCalc(overrides = {}) {
  const base = {
    classification: { sudarsky: "I" },
    inputs: { massMjup: 1.0 },
    thermal: { equilibriumTempK: 130 },
    atmosphere: { metallicitySolar: 1, hePct: 10 },
    ringProperties: { opticalDepthClass: "Tenuous" },
    physical: { radiusInflationFactor: 1.0, radiusRj: 1.0, suggestedRadiusRj: 1.0 },
  };
  // Deep merge one level: overrides replace whole sub-objects
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (
      typeof overrides[key] === "object" &&
      overrides[key] !== null &&
      typeof base[key] === "object" &&
      base[key] !== null
    ) {
      result[key] = { ...base[key], ...overrides[key] };
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

// ── Sudarsky class mapping ───────────────────────────────────────

test("suggestStyles → Class I-ice Neptune-mass → neptune family candidates", () => {
  const r = suggestStyles(
    makeGgCalc({ classification: { sudarsky: "I-ice" }, inputs: { massMjup: 0.054 } }),
  );
  assert.equal(r.primary, "neptune");
  assert.ok(r.candidates.includes("neptune"), "has neptune");
  assert.ok(r.candidates.includes("uranus"), "has uranus");
  assert.ok(r.candidates.includes("neptune-classic"), "has neptune-classic");
});

test("suggestStyles → Class I heavy (>1.0 Mjup) → super-jupiter primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      inputs: { massMjup: 2.0 },
    }),
  );
  assert.equal(r.primary, "super-jupiter");
  assert.ok(r.candidates.includes("jupiter"), "has jupiter");
});

test("suggestStyles → Class I mid-mass (0.5–1.0 Mjup) → jupiter primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      inputs: { massMjup: 0.7 },
    }),
  );
  assert.equal(r.primary, "jupiter");
  assert.ok(r.candidates.includes("saturn"), "has saturn");
  assert.ok(r.candidates.includes("hazy"), "has hazy");
});

test("suggestStyles → Class I light (<0.5 Mjup) → saturn-like candidates", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      inputs: { massMjup: 0.3 },
    }),
  );
  assert.equal(r.primary, "saturn");
  assert.ok(r.candidates.includes("water-cloud"), "has water-cloud");
  assert.ok(r.candidates.includes("hazy"), "has hazy");
});

test("suggestStyles → Class I Saturn-mass + Dense rings → saturn primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      inputs: { massMjup: 0.3 },
      atmosphere: { metallicitySolar: 15 },
      ringProperties: { opticalDepthClass: "Dense" },
    }),
  );
  assert.equal(r.primary, "saturn");
  assert.ok(r.candidates.includes("hazy"), "elevated metallicity still suggests hazy");
});

test("suggestStyles → Class I high metallicity + Tenuous rings → hazy primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      inputs: { massMjup: 0.3 },
      atmosphere: { metallicitySolar: 15 },
      ringProperties: { opticalDepthClass: "Tenuous" },
    }),
  );
  assert.equal(r.primary, "hazy");
  assert.ok(r.candidates.includes("saturn"), "still keeps saturn as candidate");
});

test("suggestStyles → Class II → water-cloud primary", () => {
  const r = suggestStyles(makeGgCalc({ classification: { sudarsky: "II" } }));
  assert.equal(r.primary, "water-cloud");
  assert.ok(r.candidates.includes("warm-giant"), "has warm-giant");
  assert.ok(r.candidates.includes("saturn"), "has saturn");
  assert.ok(r.candidates.includes("hazy"), "has hazy");
});

test("suggestStyles → Class III cold → warm-giant primary", () => {
  const r = suggestStyles(
    makeGgCalc({ classification: { sudarsky: "III" }, thermal: { equilibriumTempK: 350 } }),
  );
  assert.equal(r.primary, "warm-giant");
  assert.ok(r.candidates.includes("hazy"), "has hazy");
  assert.ok(r.candidates.includes("cloudless"), "has cloudless");
});

test("suggestStyles → Class III hot → cloudless primary", () => {
  const r = suggestStyles(
    makeGgCalc({ classification: { sudarsky: "III" }, thermal: { equilibriumTempK: 600 } }),
  );
  assert.equal(r.primary, "cloudless");
  assert.ok(r.candidates.includes("hazy"), "has hazy");
  assert.ok(r.candidates.includes("warm-giant"), "has warm-giant");
});

test("suggestStyles → Class IV → alkali primary", () => {
  const r = suggestStyles(makeGgCalc({ classification: { sudarsky: "IV" } }));
  assert.equal(r.primary, "alkali");
  assert.ok(r.candidates.includes("hot-jupiter"), "has hot-jupiter");
  assert.ok(r.candidates.includes("cloudless"), "has cloudless");
});

test("suggestStyles → Class V default → silicate primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "V" },
      thermal: { equilibriumTempK: 1500 },
    }),
  );
  assert.equal(r.primary, "silicate");
  assert.ok(r.candidates.includes("hot-jupiter"), "has hot-jupiter");
});

test("suggestStyles → Class V ultra-hot (>1800 K) → hot-jupiter primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "V" },
      thermal: { equilibriumTempK: 2200 },
    }),
  );
  assert.equal(r.primary, "hot-jupiter");
  assert.ok(r.candidates.includes("silicate"), "has silicate");
});

// ── Structural invariants ────────────────────────────────────────

test("suggestStyles → any class → primary is first in candidates", () => {
  const classes = ["I-ice", "I", "II", "III", "IV", "V"];
  for (const cls of classes) {
    const r = suggestStyles(makeGgCalc({ classification: { sudarsky: cls } }));
    assert.equal(r.candidates[0], r.primary, `${cls}: primary is first`);
  }
});

test("suggestStyles → any class → candidates length 2–5", () => {
  const classes = ["I-ice", "I", "II", "III", "IV", "V"];
  for (const cls of classes) {
    const r = suggestStyles(makeGgCalc({ classification: { sudarsky: cls } }));
    assert.ok(
      r.candidates.length >= 2,
      `${cls}: at least 2 candidates (got ${r.candidates.length})`,
    );
    assert.ok(
      r.candidates.length <= 5,
      `${cls}: at most 5 candidates (got ${r.candidates.length})`,
    );
  }
});

test("suggestStyles → any class → no fantastical styles in candidates", () => {
  const classes = ["I-ice", "I", "II", "III", "IV", "V"];
  for (const cls of classes) {
    const r = suggestStyles(makeGgCalc({ classification: { sudarsky: cls } }));
    for (const id of r.candidates) {
      assert.ok(!FANTASTICAL_IDS.includes(id), `${cls}: "${id}" is fantastical`);
    }
  }
});

test("suggestStyles → any class → no duplicate candidates", () => {
  const classes = ["I-ice", "I", "II", "III", "IV", "V"];
  for (const cls of classes) {
    const r = suggestStyles(makeGgCalc({ classification: { sudarsky: cls } }));
    assert.equal(new Set(r.candidates).size, r.candidates.length, `${cls}: no duplicates`);
  }
});

// ── Modifiers ────────────────────────────────────────────────────

test("suggestStyles → inflated giant → puffy primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      physical: { radiusRj: 1.5, suggestedRadiusRj: 1.0 },
    }),
  );
  assert.equal(r.primary, "puffy", "inflated giant has puffy primary");
  assert.ok(r.candidates.includes("puffy"), "inflated giant includes puffy");
});

test("suggestStyles → non-inflated giant → omits puffy", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      physical: { radiusRj: 1.0, suggestedRadiusRj: 1.0 },
    }),
  );
  assert.ok(!r.candidates.includes("puffy"), "normal giant omits puffy");
});

test("suggestStyles → Class I + high metallicity → adds sub-neptune", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      atmosphere: { metallicitySolar: 15 },
    }),
  );
  assert.ok(r.candidates.includes("sub-neptune"), "high metallicity adds sub-neptune");
});

test("suggestStyles → Class I-ice very small mass → sub-neptune primary", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I-ice" },
      inputs: { massMjup: 0.03 },
    }),
  );
  assert.equal(r.primary, "sub-neptune");
  assert.ok(r.candidates.includes("sub-neptune"), "has sub-neptune");
});

test("suggestStyles → Class I + low metallicity → omits sub-neptune", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      atmosphere: { metallicitySolar: 3 },
    }),
  );
  assert.ok(!r.candidates.includes("sub-neptune"), "low metallicity omits sub-neptune");
});

test("suggestStyles → ice giant + Dense rings → adds ringed-ice", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I-ice" },
      ringProperties: { opticalDepthClass: "Dense" },
    }),
  );
  assert.ok(r.candidates.includes("ringed-ice"), "Dense rings add ringed-ice");
});

test("suggestStyles → ice giant + Moderate rings → adds ringed-ice", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I-ice" },
      ringProperties: { opticalDepthClass: "Moderate" },
    }),
  );
  assert.ok(r.candidates.includes("ringed-ice"), "Moderate rings add ringed-ice");
});

test("suggestStyles → Tenuous rings + small mass → omits ringed-ice", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I-ice" },
      inputs: { massMjup: 0.054 },
      ringProperties: { opticalDepthClass: "Tenuous" },
    }),
  );
  assert.ok(
    !r.candidates.includes("ringed-ice"),
    "Neptune-mass with Tenuous rings omits ringed-ice",
  );
});

// ── Helium giant modifier ────────────────────────────────────────

test("suggestStyles → He >50% → adds helium candidate", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      atmosphere: { metallicitySolar: 1, hePct: 60 },
    }),
  );
  assert.ok(r.candidates.includes("helium"), "He >50% adds helium");
});

test("suggestStyles → He <50% → omits helium candidate", () => {
  const r = suggestStyles(
    makeGgCalc({
      classification: { sudarsky: "I" },
      atmosphere: { metallicitySolar: 1, hePct: 10 },
    }),
  );
  assert.ok(!r.candidates.includes("helium"), "He <50% omits helium");
});

// ── Null/missing input fallback ──────────────────────────────────

test("suggestStyles → null input → safe fallback to jupiter", () => {
  const r = suggestStyles(null);
  assert.equal(r.primary, "jupiter");
  assert.deepStrictEqual(r.candidates, ["jupiter", "saturn"]);
});

test("suggestStyles → missing classification → safe fallback to jupiter", () => {
  const r = suggestStyles({});
  assert.equal(r.primary, "jupiter");
  assert.deepStrictEqual(r.candidates, ["jupiter", "saturn"]);
});
