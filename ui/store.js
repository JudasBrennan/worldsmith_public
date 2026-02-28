import { clamp } from "../engine/utils.js";
import { LOCAL_CLUSTER_DEFAULTS, normalizeLocalClusterInputs } from "../engine/localCluster.js";

// Shared World Model store (local-only).
// This keeps Star/System/Planet pages consistent (e.g., System & Planet read star mass from Star).
//
// Storage shape:
// {
//   star: { name, massMsol, ageGyr },
//   system: { spacingFactor, orbit1Au, gasGiants, debrisDisks },
//   planet: { ...planet inputs... }
// }

const KEY = "worldsmith.world.v1";
const LEGACY_KEY = "worldsmith.world";
let volatileWorldRaw = null;

// Schema version for migrations
const SCHEMA_VERSION = 46;
// Practical giant-planet radius bounds in Jupiter radii (Rj):
// lower bound ~= Neptune-size (~0.35 Rj), upper bound ~= inflated HAT-P-67 b (2.14 Rj).
export const GAS_GIANT_RADIUS_MIN_RJ = 0.35;
export const GAS_GIANT_RADIUS_MAX_RJ = 2.14;
export const GAS_GIANT_RADIUS_STEP_RJ = 0.01;
// Gas giant mass bounds in Jupiter masses (Mj):
// lower bound ~3 Earth masses, upper bound = deuterium burning limit.
export const GAS_GIANT_MASS_MIN_MJUP = 0.01;
export const GAS_GIANT_MASS_MAX_MJUP = 13.0;
export const GAS_GIANT_MASS_STEP_MJUP = 0.01;
// Gas giant atmospheric metallicity bounds (× solar):
// 0.1× = very metal-poor, 200× = extreme ice-giant enrichment.
export const GAS_GIANT_METALLICITY_MIN = 0.1;
export const GAS_GIANT_METALLICITY_MAX = 200;
export const GAS_GIANT_METALLICITY_STEP = 0.1;

export const TOOL_ID = "WorldSmith Web";
export function getSchemaVersion() {
  return SCHEMA_VERSION;
}

export function hasSavedWorldInLocalStorage() {
  try {
    return !!(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY));
  } catch {
    return false;
  }
}

function roundToStep(v, step = 1) {
  const s = Number(step);
  if (!Number.isFinite(v) || !Number.isFinite(s) || s <= 0) return v;
  const inv = 1 / s;
  return Math.round(v * inv) / inv;
}

function seededUnit(seed) {
  const src = String(seed || "gas-giant-radius");
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clampGasGiantRadiusRj(value) {
  return roundToStep(
    clamp(Number(value), GAS_GIANT_RADIUS_MIN_RJ, GAS_GIANT_RADIUS_MAX_RJ),
    GAS_GIANT_RADIUS_STEP_RJ,
  );
}

function seededGasGiantRadiusRj(seed) {
  const unit = seededUnit(seed);
  const span = GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ;
  return clampGasGiantRadiusRj(GAS_GIANT_RADIUS_MIN_RJ + unit * span);
}

export function randomGasGiantRadiusRj() {
  const span = GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ;
  return clampGasGiantRadiusRj(GAS_GIANT_RADIUS_MIN_RJ + Math.random() * span);
}

function makeCollection(list, idPrefix) {
  const order = [];
  const byId = Object.create(null);
  let idx = 1;
  for (const item of list || []) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || `${idPrefix}${idx++}`);
    if (id === "__proto__" || id === "constructor" || id === "prototype") continue;
    byId[id] = { ...item, id };
    order.push(id);
  }
  return { order, byId };
}

function listFromCollection(coll) {
  if (!coll || typeof coll !== "object") return [];
  const order = Array.isArray(coll.order) ? coll.order : [];
  const byId = coll.byId && typeof coll.byId === "object" ? coll.byId : {};
  return order.map((id) => byId[id]).filter(Boolean);
}

// Legacy style alias map — old id → canonical id
const GAS_GIANT_STYLE_ALIASES = { ice: "neptune", hot: "hot-jupiter" };

function normalizeGasGiantStyle(style) {
  const s = String(style || "jupiter").toLowerCase();
  return GAS_GIANT_STYLE_ALIASES[s] || s;
}

function normalizeGasGiant(raw, idx = 1) {
  const au = Number(raw?.au ?? raw?.semiMajorAxisAu);
  const fixedAu = Number.isFinite(au) && au > 0 ? au : 0;
  const rawRadius =
    raw?.radiusRj ?? raw?.radiusJupiter ?? raw?.sizeRj ?? raw?.radiusRadiiJupiter ?? null;
  const parsedRadius = Number(rawRadius);
  const radiusRj = Number.isFinite(parsedRadius)
    ? clampGasGiantRadiusRj(parsedRadius)
    : seededGasGiantRadiusRj(raw?.id || raw?.name || `gg${idx}`);
  // Mass (Mjup) — optional, aliases supported
  const rawMass = raw?.massMjup ?? raw?.massJupiter ?? raw?.massMj ?? null;
  const parsedMass = Number(rawMass);
  const massMjup =
    rawMass != null && Number.isFinite(parsedMass) && parsedMass > 0 ? parsedMass : null;
  // Rotation period (hours) — optional
  const rawRot = raw?.rotationPeriodHours ?? raw?.rotationHours ?? raw?.rotPeriodH ?? null;
  const parsedRot = Number(rawRot);
  const rotationPeriodHours =
    rawRot != null && Number.isFinite(parsedRot) && parsedRot > 0 ? parsedRot : null;
  // Slot index (1–20) — optional, for orbital slot assignment
  const rawSlot = Number(raw?.slotIndex);
  const slotIndex =
    Number.isFinite(rawSlot) && rawSlot >= 1 && rawSlot <= 20 ? Math.round(rawSlot) : null;
  // Atmospheric metallicity (× solar) — optional
  const rawMet = raw?.metallicity ?? raw?.metallicitySolar ?? null;
  const parsedMet = Number(rawMet);
  const metallicity =
    rawMet != null && Number.isFinite(parsedMet) && parsedMet > 0 ? parsedMet : null;
  const appearanceRecipeId = String(raw?.appearanceRecipeId || raw?.recipeId || "").trim();
  return {
    id: String(raw?.id || `gg${idx}`),
    name: String(raw?.name || `Gas giant ${idx}`),
    au: fixedAu,
    slotIndex,
    style: normalizeGasGiantStyle(raw?.style),
    rings: raw?.rings === true,
    radiusRj,
    massMjup,
    rotationPeriodHours,
    metallicity,
    appearanceRecipeId: appearanceRecipeId || "",
  };
}

function normalizeDebrisDisk(raw, idx = 1) {
  const inner = Number(raw?.innerAu ?? raw?.inner ?? 0);
  const outer = Number(raw?.outerAu ?? raw?.outer ?? 0);
  const innerAu = Number.isFinite(inner) ? Math.max(0, inner) : 0;
  const outerAu = Number.isFinite(outer) ? Math.max(0, outer) : 0;
  // Eccentricity (0–0.5) — optional
  const rawEcc = raw?.eccentricity ?? null;
  const parsedEcc = Number(rawEcc);
  const eccentricity =
    rawEcc != null && Number.isFinite(parsedEcc) && parsedEcc >= 0 && parsedEcc <= 0.5
      ? parsedEcc
      : null;
  // Inclination (0–90°) — optional
  const rawInc = raw?.inclination ?? raw?.inclinationDeg ?? null;
  const parsedInc = Number(rawInc);
  const inclination =
    rawInc != null && Number.isFinite(parsedInc) && parsedInc >= 0 && parsedInc <= 90
      ? parsedInc
      : null;
  // Total mass override (Earth masses, >0) — optional
  const rawMass = raw?.totalMassMearth ?? raw?.massMearth ?? null;
  const parsedMass = Number(rawMass);
  const totalMassMearth =
    rawMass != null && Number.isFinite(parsedMass) && parsedMass > 0 ? parsedMass : null;
  return {
    id: String(raw?.id || `dd${idx}`),
    name: String(raw?.name || (idx === 1 ? "Debris disk" : `Debris disk ${idx}`)),
    innerAu,
    outerAu,
    suggested: Boolean(raw?.suggested),
    eccentricity,
    inclination,
    totalMassMearth,
  };
}

function normalizeClusterSystemNames(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    const key = String(id || "").trim();
    if (!key) continue;
    const name = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    out[key] = name.slice(0, 80);
  }
  return out;
}

function getGasGiants(world) {
  const gs = world?.system?.gasGiants;
  if (Array.isArray(gs))
    return gs.map((g, i) => normalizeGasGiant(g, i + 1)).filter((g) => g.au > 0);
  return listFromCollection(gs)
    .map((g, i) => normalizeGasGiant(g, i + 1))
    .filter((g) => g.au > 0);
}

function getDebrisDisks(world) {
  const ds = world?.system?.debrisDisks;
  if (Array.isArray(ds)) return ds.map((d, i) => normalizeDebrisDisk(d, i + 1));
  const list = listFromCollection(ds).map((d, i) => normalizeDebrisDisk(d, i + 1));
  return list; // May be empty — 0 debris disks is now allowed
}

function canonicalizeSystemFeatures(world) {
  if (!world.system || typeof world.system !== "object") world.system = {};

  // Gas giants are canonicalized, sorted by AU, and stored as order/byId.
  // 0 gas giants is now allowed.
  let gasGiants = getGasGiants(world)
    .filter((g) => Number.isFinite(g.au) && g.au > 0)
    .sort((a, b) => a.au - b.au);

  // Keep one gas giant per nearest hundredth AU to avoid accidental duplicates.
  const seenAu = new Set();
  gasGiants = gasGiants.filter((g) => {
    const k = g.au.toFixed(2);
    if (seenAu.has(k)) return false;
    seenAu.add(k);
    return true;
  });

  // Debris disks: 0 or more, freely managed by user.
  let debrisDisks = getDebrisDisks(world);

  // Ensure inner<=outer for each disk.
  debrisDisks = debrisDisks.map((d) => {
    const lo = Math.max(0, Math.min(d.innerAu, d.outerAu));
    const hi = Math.max(0, Math.max(d.innerAu, d.outerAu));
    return { ...d, innerAu: lo, outerAu: hi };
  });

  const prevSelectedGg = world.system.gasGiants?.selectedId ?? null;
  world.system.gasGiants = makeCollection(gasGiants, "gg");
  world.system.gasGiants.selectedId =
    prevSelectedGg && world.system.gasGiants.byId[prevSelectedGg]
      ? prevSelectedGg
      : world.system.gasGiants.order[0] || null;
  world.system.debrisDisks = makeCollection(debrisDisks, "dd");
}

function readWorldRaw() {
  const primary = localStorage.getItem(KEY);
  if (primary) return { raw: primary, sourceKey: KEY };

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) return { raw: legacy, sourceKey: LEGACY_KEY };

  if (volatileWorldRaw) return { raw: volatileWorldRaw, sourceKey: "memory" };

  return { raw: null, sourceKey: null };
}

function defaultWorld() {
  return {
    version: SCHEMA_VERSION,
    star: {
      name: "Star",
      massMsol: 0.8653,
      ageGyr: 6.254,
      radiusRsolOverride: null,
      luminosityLsolOverride: null,
      tempKOverride: null,
      metallicityFeH: 0.0,
      physicsMode: "simple",
      advancedDerivationMode: "rl",
      evolutionMode: "zams",
      activityModelVersion: "v2",
    },
    selectedBodyType: "planet",
    system: {
      spacingFactor: 0.33,
      orbit1Au: 0.62,
      gasGiants: { selectedId: null, order: [], byId: {} },
      debrisDisks: { order: [], byId: {} },
    },
    cluster: {
      galacticRadiusLy: LOCAL_CLUSTER_DEFAULTS.galacticRadiusLy,
      locationLy: LOCAL_CLUSTER_DEFAULTS.locationLy,
      neighbourhoodRadiusLy: LOCAL_CLUSTER_DEFAULTS.neighbourhoodRadiusLy,
      stellarDensityPerLy3: LOCAL_CLUSTER_DEFAULTS.stellarDensityPerLy3,
      randomSeed: LOCAL_CLUSTER_DEFAULTS.randomSeed,
    },
    clusterSystemNames: {},
    clusterAdjustments: {
      addedSystems: [],
      removedSystemIds: [],
      componentOverrides: {},
    },
    planets: {
      selectedId: null,
      order: [],
      byId: {},
    },
    moons: {
      selectedId: null,
      order: [],
      byId: {},
    },
    // Back-compat single-planet view used by older pages (kept in sync)
    planet: {},
    // Back-compat single-moon view used by older pages (kept in sync)
    moon: {},
  };
}

export function loadWorld() {
  try {
    const { raw, sourceKey } = readWorldRaw();
    if (!raw) return defaultWorld();
    const parsed = JSON.parse(raw);
    const merged = mergeDefaults(defaultWorld(), parsed);
    const migrated = migrateWorld(merged);
    // Normalize storage to the current primary key if loaded from legacy key.
    if (sourceKey === LEGACY_KEY) {
      try {
        localStorage.setItem(KEY, JSON.stringify(migrated));
      } catch {}
    }
    return migrated;
  } catch {
    return defaultWorld();
  }
}

function migrateWorld(world) {
  // Ensure version exists
  if (!world.version) world.version = 1;

  // Star defaults/sanity
  if (!world.star || typeof world.star !== "object") world.star = {};
  const starName = String(world.star.name ?? "").trim();
  world.star.name = starName || "Star";
  if (world.star.metallicityFeH == null) world.star.metallicityFeH = 0.0;
  // v45: add evolutionMode to star (default "zams" for backwards compat)
  if (!world.star.evolutionMode) world.star.evolutionMode = "zams";
  // v46: activity model version flag (v1 legacy / v2 calibrated split-rate model)
  const activityModelVersion = String(world.star.activityModelVersion || "v2").toLowerCase();
  world.star.activityModelVersion = activityModelVersion === "v1" ? "v1" : "v2";

  // Local cluster defaults/sanity
  world.cluster = normalizeLocalClusterInputs(world.cluster || LOCAL_CLUSTER_DEFAULTS);
  world.clusterSystemNames = normalizeClusterSystemNames(world.clusterSystemNames);

  // v18: introduce planets collection; migrate legacy world.planet into planets.p1 if needed
  if (!world.planets || !world.planets.byId) {
    const legacyInputs = world.planet ? { ...world.planet } : null;
    const p1 = {
      id: "p1",
      name: legacyInputs?.name || "New Planet",
      slotIndex: null,
      locked: false,
      inputs: legacyInputs || {
        name: "New Planet",
        semiMajorAxisAu: 1.0,
        eccentricity: 0.0167,
        inclinationDeg: 0.0,
        longitudeOfPeriapsisDeg: 283.0,
        subsolarLongitudeDeg: 0.0,
        rotationPeriodHours: 24.0,
        axialTiltDeg: 23.44,
        massEarth: 1.0,
        cmfPct: -1,
        albedoBond: 0.3,
        greenhouseEffect: 1.65,
        observerHeightM: 1.75,
        pressureAtm: 1.0,
        o2Pct: 20.95,
        co2Pct: 0.04,
        arPct: 0.93,
      },
    };
    world.planets = { selectedId: "p1", order: ["p1"], byId: { p1 } };
    world.version = SCHEMA_VERSION;
  }

  // Ensure selectedId points to something valid
  if (!world.planets.selectedId || !world.planets.byId[world.planets.selectedId]) {
    world.planets.selectedId = world.planets.order[0] || Object.keys(world.planets.byId)[0];
  }

  // Backfill planet names (older saves may have inputs.name only)
  if (world.planets && world.planets.byId) {
    for (const pid of Object.keys(world.planets.byId)) {
      const p = world.planets.byId[pid];
      if (!p) continue;
      if (!p.inputs) p.inputs = {};
      if (!p.name) p.name = p.inputs.name || "New Planet";
      if (!p.inputs.name) p.inputs.name = p.name;
    }
  }

  // v22: introduce moons collection; migrate legacy world.moon into moons.m1 if needed
  if (!world.moons || !world.moons.byId) {
    const legacyMoon = world.moon
      ? { ...world.moon }
      : {
          name: "Luna",
          semiMajorAxisKm: 384748,
          eccentricity: 0.055,
          inclinationDeg: 5.15,
          massMoon: 1.0,
          densityGcm3: 3.34,
          albedo: 0.11,
        };
    const planetId = world.planets?.selectedId || "p1";
    const m1 = {
      id: "m1",
      name: legacyMoon.name || "Luna",
      planetId,
      locked: false,
      inputs: legacyMoon,
    };
    world.moons = { selectedId: "m1", order: ["m1"], byId: { m1 } };
  }

  if (!world.moons.selectedId || !world.moons.byId[world.moons.selectedId]) {
    world.moons.selectedId = world.moons.order[0] || Object.keys(world.moons.byId)[0];
  }

  // Backfill moon names (older saves may have inputs.name only)
  if (world.moons && world.moons.byId) {
    for (const mid of Object.keys(world.moons.byId)) {
      const m = world.moons.byId[mid];
      if (!m) continue;
      if (!m.inputs) m.inputs = {};
      if (!m.name) m.name = m.inputs.name || "Luna";
      if (!m.inputs.name) m.inputs.name = m.name;
      if (typeof m.locked !== "boolean") m.locked = false;
      if (m.planetId === "") m.planetId = null;
      if (
        m.planetId != null &&
        !world.planets.byId[m.planetId] &&
        !world.system?.gasGiants?.byId?.[m.planetId]
      )
        m.planetId = null;
    }
  }

  // Back-compat: keep world.moon synced to selected moon inputs (used by Moon page engine)
  const selMoon = world.moons.byId[world.moons.selectedId];
  if (selMoon && selMoon.inputs) {
    world.moon = { ...selMoon.inputs, name: selMoon.name || selMoon.inputs.name };
  }

  // Back-compat: keep world.planet synced to selected planet inputs (used by Moon page etc.)
  const sel = world.planets.byId[world.planets.selectedId];
  if (sel && sel.inputs) {
    world.planet = { ...sel.inputs, name: sel.name || sel.inputs.name };
  }

  // v37: remove legacy outermostGasGiantAu; migrate to gas giant entry if needed
  if (world.system) {
    const legacyOgg = Number(world.system.outermostGasGiantAu);
    if (Number.isFinite(legacyOgg) && legacyOgg > 0) {
      const existingGas = getGasGiants(world);
      if (!existingGas.length) {
        // Convert legacy scalar to a gas giant entry
        const gg = normalizeGasGiant(
          { id: "gg1", name: "Outermost gas giant", au: legacyOgg, style: "jupiter" },
          1,
        );
        world.system.gasGiants = makeCollection([gg], "gg");
      }
    }
    delete world.system.outermostGasGiantAu;
  }

  // v38: introduce selectedBodyType and gas giant selectedId
  if (!world.selectedBodyType) world.selectedBodyType = "planet";
  if (world.system.gasGiants && world.system.gasGiants.selectedId === undefined) {
    world.system.gasGiants.selectedId = world.system.gasGiants.order?.[0] || null;
  }

  // v39: add greenhouse mode + new gas inputs (H₂O, CH₄, H₂, He, SO₂, NH₃)
  if (world.planets && world.planets.byId) {
    for (const pid of Object.keys(world.planets.byId)) {
      const inp = world.planets.byId[pid]?.inputs;
      if (!inp) continue;
      // Existing saves default to Manual mode (preserves their manual GHE)
      if (!inp.greenhouseMode) inp.greenhouseMode = "manual";
      if (inp.h2oPct == null) inp.h2oPct = 0;
      if (inp.ch4Pct == null) inp.ch4Pct = 0;
      if (inp.h2Pct == null) inp.h2Pct = 0;
      if (inp.hePct == null) inp.hePct = 0;
      if (inp.so2Pct == null) inp.so2Pct = 0;
      if (inp.nh3Pct == null) inp.nh3Pct = 0;
    }
  }

  // v40: add compositionOverride to moon inputs
  if (world.moons && world.moons.byId) {
    for (const mid of Object.keys(world.moons.byId)) {
      const inp = world.moons.byId[mid]?.inputs;
      if (inp && inp.compositionOverride === undefined) inp.compositionOverride = null;
    }
  }
  if (world.moon && world.moon.compositionOverride === undefined) {
    world.moon.compositionOverride = null;
  }

  // v41: add composition overhaul fields to planet inputs
  if (world.planets && world.planets.byId) {
    for (const pid of Object.keys(world.planets.byId)) {
      const inp = world.planets.byId[pid]?.inputs;
      if (!inp) continue;
      if (inp.wmfPct == null) inp.wmfPct = 0;
      if (inp.tectonicRegime == null) inp.tectonicRegime = "unknown";
      if (inp.mantleOxidation == null) inp.mantleOxidation = "earth";
    }
  }

  // v42: migrate tectonic regime to auto (old defaults were "unknown" or "mobile")
  if (world.planets && world.planets.byId) {
    for (const pid of Object.keys(world.planets.byId)) {
      const inp = world.planets.byId[pid]?.inputs;
      if (!inp) continue;
      if (inp.tectonicRegime === "unknown" || inp.tectonicRegime === "mobile")
        inp.tectonicRegime = "auto";
    }
  }

  // v43: migrate CMF to auto (old default was 32.0 — Earth's CMF)
  if (world.planets && world.planets.byId) {
    for (const pid of Object.keys(world.planets.byId)) {
      const inp = world.planets.byId[pid]?.inputs;
      if (!inp) continue;
      if (inp.cmfPct === 32 || inp.cmfPct === 32.0) inp.cmfPct = -1;
    }
  }

  canonicalizeSystemFeatures(world);

  // Ensure version updated
  if (world.version !== SCHEMA_VERSION) world.version = SCHEMA_VERSION;

  return world;
}

/** Resolve effective R/L/T overrides and evolution mode from the star state. */
export function getStarOverrides(star) {
  const ev = star?.evolutionMode || "zams";
  if (star?.physicsMode === "advanced") {
    const m = star.advancedDerivationMode;
    const r = star.radiusRsolOverride;
    const l = star.luminosityLsolOverride;
    const t = star.tempKOverride;
    if (m === "rt") return { r, l: null, t, ev };
    if (m === "lt") return { r: null, l, t, ev };
    return { r, l, t: null, ev }; // "rl" (default)
  }
  return { r: null, l: null, t: null, ev };
}

// Planet helpers (small surface area on purpose)
export function listPlanets(world = loadWorld()) {
  return world.planets.order.map((id) => world.planets.byId[id]).filter(Boolean);
}

export function getSelectedPlanet(world = loadWorld()) {
  const id = world.planets.selectedId;
  return world.planets.byId[id];
}

export function selectPlanet(planetId) {
  const world = loadWorld();
  if (!world.planets.byId[planetId]) return world;
  world.planets.selectedId = planetId;
  // keep back-compat in sync
  world.planet = {
    ...world.planets.byId[planetId].inputs,
    name: world.planets.byId[planetId].name,
  };
  saveWorld(world);
  return world;
}

export function createPlanetFromInputs(inputs, { name = "New Planet" } = {}) {
  const world = loadWorld();
  const id = "p" + Math.random().toString(36).slice(2, 9);
  const planet = {
    id,
    name: name || inputs?.name || "New Planet",
    slotIndex: null,
    locked: false,
    inputs: { ...(inputs || {}) },
  };
  world.planets.byId[id] = planet;
  world.planets.order.push(id);
  world.planets.selectedId = id;
  world.planet = { ...planet.inputs, name: planet.name };
  saveWorld(world);
  return world;
}

export function deletePlanet(planetId) {
  const world = loadWorld();
  if (!world.planets.byId[planetId]) return world;

  delete world.planets.byId[planetId];
  world.planets.order = world.planets.order.filter((x) => x !== planetId);

  const fallbackPlanetId = world.planets.order[0] || Object.keys(world.planets.byId)[0] || null;

  // Keep selected planet valid.
  if (world.planets.selectedId === planetId || !world.planets.byId[world.planets.selectedId]) {
    world.planets.selectedId = fallbackPlanetId || "p1";
  }

  // Moons of a deleted planet become unassigned.
  if (world.moons?.byId && typeof world.moons.byId === "object") {
    for (const mid of Object.keys(world.moons.byId)) {
      const moon = world.moons.byId[mid];
      if (!moon || moon.planetId !== planetId) continue;
      moon.planetId = null;
      moon.locked = false;
    }
    world.moons.order = (world.moons.order || []).filter((mid) => !!world.moons.byId[mid]);
    if (!world.moons.byId[world.moons.selectedId]) {
      world.moons.selectedId = world.moons.order[0] || Object.keys(world.moons.byId)[0] || null;
    }
  }

  const sel = world.planets.byId[world.planets.selectedId];
  if (sel) world.planet = { ...sel.inputs, name: sel.name };
  const selMoon = world.moons?.selectedId ? world.moons.byId?.[world.moons.selectedId] : null;
  if (selMoon) world.moon = { ...selMoon.inputs, name: selMoon.name || selMoon.inputs?.name };

  saveWorld(world);
  return world;
}

export function updatePlanet(planetId, patch) {
  const world = loadWorld();
  const p = world.planets.byId[planetId];
  if (!p) return world;

  if (patch.name != null) p.name = patch.name;
  if (patch.slotIndex !== undefined) p.slotIndex = patch.slotIndex;
  if (patch.inputs) p.inputs = { ...p.inputs, ...patch.inputs };

  // Maintain back-compat if editing selected
  if (world.planets.selectedId === planetId) {
    world.planet = { ...p.inputs, name: p.name };
  }

  saveWorld(world);
  return world;
}

// Moon helpers
export function listMoons(world = loadWorld()) {
  return world.moons.order.map((id) => world.moons.byId[id]).filter(Boolean);
}

export function getSelectedMoon(world = loadWorld()) {
  const id = world.moons.selectedId;
  return world.moons.byId[id];
}

export function selectMoon(moonId) {
  const world = loadWorld();
  if (!world.moons.byId[moonId]) return world;
  world.moons.selectedId = moonId;
  const m = world.moons.byId[moonId];
  world.moon = { ...m.inputs, name: m.name || m.inputs?.name };
  saveWorld(world);
  return world;
}

export function createMoonFromInputs(inputs, { name = "New Moon", planetId } = {}) {
  const world = loadWorld();
  const id = "m" + Math.random().toString(36).slice(2, 9);
  const pid = planetId === undefined ? world.planets.selectedId || null : planetId || null;
  const moon = {
    id,
    name: name || inputs?.name || "New Moon",
    planetId: pid,
    locked: false,
    inputs: { ...(inputs || {}) },
  };
  world.moons.byId[id] = moon;
  world.moons.order.push(id);
  world.moons.selectedId = id;
  world.moon = { ...moon.inputs, name: moon.name };
  saveWorld(world);
  return world;
}

export function deleteMoon(moonId) {
  const world = loadWorld();
  if (!world.moons.byId[moonId]) return world;
  delete world.moons.byId[moonId];
  world.moons.order = world.moons.order.filter((x) => x !== moonId);
  if (world.moons.selectedId === moonId) {
    world.moons.selectedId = world.moons.order[0] || Object.keys(world.moons.byId)[0];
  }
  const sel = world.moons.byId[world.moons.selectedId];
  if (sel) world.moon = { ...sel.inputs, name: sel.name };
  saveWorld(world);
  return world;
}

export function updateMoon(moonId, patch) {
  const world = loadWorld();
  const m = world.moons.byId[moonId];
  if (!m) return world;

  if (patch.name != null) m.name = patch.name;
  if (Object.prototype.hasOwnProperty.call(patch, "locked")) {
    const nextLocked = !!patch.locked;
    m.locked = m.planetId == null ? false : nextLocked;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "planetId")) {
    const nextPlanetId =
      patch.planetId == null || patch.planetId === "" ? null : String(patch.planetId);
    if (
      (nextPlanetId == null || world.planets.byId[nextPlanetId]) &&
      (!m.locked || nextPlanetId === m.planetId)
    ) {
      m.planetId = nextPlanetId;
      if (nextPlanetId == null) m.locked = false;
    }
  }
  if (patch.inputs) m.inputs = { ...m.inputs, ...patch.inputs };

  if (world.moons.selectedId === moonId) {
    world.moon = { ...m.inputs, name: m.name };
  }

  saveWorld(world);
  return world;
}

export function toggleMoonLock(moonId) {
  const world = loadWorld();
  const m = world.moons.byId[moonId];
  if (!m) return world;
  if (m.planetId == null) {
    m.locked = false;
    saveWorld(world);
    return world;
  }
  m.locked = !m.locked;
  saveWorld(world);
  return world;
}

export function assignMoonToPlanet(moonId, planetIdOrNull, { force = false } = {}) {
  const world = loadWorld();
  const m = world.moons.byId[moonId];
  if (!m) return world;

  const nextPlanetId =
    planetIdOrNull == null || planetIdOrNull === "" ? null : String(planetIdOrNull);
  const isValidParent =
    world.planets.byId[nextPlanetId] || world.system?.gasGiants?.byId?.[nextPlanetId];
  if (nextPlanetId != null && !isValidParent) return world;

  if (!force && m.locked && nextPlanetId !== m.planetId) {
    return world;
  }

  m.planetId = nextPlanetId;
  if (nextPlanetId == null) m.locked = false;
  if (world.moons.selectedId === moonId) {
    world.moon = { ...m.inputs, name: m.name };
  }
  saveWorld(world);
  return world;
}

export function togglePlanetLock(planetId) {
  const world = loadWorld();
  const p = world.planets.byId[planetId];
  if (!p) return world;
  p.locked = !p.locked;
  saveWorld(world);
  return world;
}

export function assignPlanetToSlot(planetId, slotIndexOrNull) {
  const world = loadWorld();
  const p = world.planets.byId[planetId];
  if (!p) return world;

  // Enforce one-planet-per-slot
  if (slotIndexOrNull != null) {
    for (const otherId of world.planets.order) {
      if (otherId === planetId) continue;
      const other = world.planets.byId[otherId];
      if (other && other.slotIndex === slotIndexOrNull) other.slotIndex = null;
    }
  }

  p.slotIndex = slotIndexOrNull;
  if (world.planets.selectedId === planetId) world.planet = { ...p.inputs, name: p.name };
  saveWorld(world);
  return world;
}

export function saveWorld(world) {
  const raw = JSON.stringify(world);
  let wrotePrimary = false;
  let wroteLegacy = false;
  let primaryErr = null;
  try {
    localStorage.setItem(KEY, raw);
    wrotePrimary = true;
  } catch (err) {
    primaryErr = err;
  }
  // Keep legacy mirror for backwards compatibility with older exports/tools.
  try {
    localStorage.setItem(LEGACY_KEY, raw);
    wroteLegacy = true;
  } catch {}

  if (wrotePrimary || wroteLegacy) {
    volatileWorldRaw = null;
  } else {
    volatileWorldRaw = raw;
    try {
      window.dispatchEvent(
        new CustomEvent("worldsmith:storageError", {
          detail: {
            message:
              "Storage quota exceeded or unavailable. Changes are only kept for this session.",
            cause: primaryErr?.message || null,
          },
        }),
      );
    } catch {}
  }

  try {
    window.dispatchEvent(new CustomEvent("worldsmith:worldChanged"));
  } catch {}
  return wrotePrimary || wroteLegacy;
}

export function updateWorld(patch) {
  const world = loadWorld();
  const merged = deepMerge(world, patch);
  const next = migrateWorld(merged);
  saveWorld(next);
  return next;
}

export function getClusterInputs(world = loadWorld()) {
  return normalizeLocalClusterInputs(world.cluster || LOCAL_CLUSTER_DEFAULTS);
}

export function updateClusterInputs(patch) {
  return updateWorld({ cluster: { ...(patch || {}) } });
}

export function getClusterSystemNames(world = loadWorld()) {
  return normalizeClusterSystemNames(world.clusterSystemNames);
}

export function updateClusterSystemNames(nextNames) {
  const world = loadWorld();
  world.clusterSystemNames = normalizeClusterSystemNames(nextNames);
  saveWorld(world);
  return world;
}

const DEFAULT_CLUSTER_ADJUSTMENTS = Object.freeze({
  addedSystems: [],
  removedSystemIds: [],
  componentOverrides: {},
});

export function getClusterAdjustments(world = loadWorld()) {
  const raw = world.clusterAdjustments;
  if (!raw || typeof raw !== "object")
    return {
      ...DEFAULT_CLUSTER_ADJUSTMENTS,
      addedSystems: [],
      removedSystemIds: [],
      componentOverrides: {},
    };
  return {
    addedSystems: Array.isArray(raw.addedSystems) ? raw.addedSystems : [],
    removedSystemIds: Array.isArray(raw.removedSystemIds) ? raw.removedSystemIds : [],
    componentOverrides:
      raw.componentOverrides && typeof raw.componentOverrides === "object"
        ? raw.componentOverrides
        : {},
  };
}

export function updateClusterAdjustments(adj) {
  const world = loadWorld();
  world.clusterAdjustments = adj;
  saveWorld(world);
  return world;
}

export function listSystemGasGiants(world = loadWorld()) {
  return listFromCollection(world.system?.gasGiants).map((g, i) => normalizeGasGiant(g, i + 1));
}

export function listSystemDebrisDisks(world = loadWorld()) {
  return listFromCollection(world.system?.debrisDisks).map((d, i) => normalizeDebrisDisk(d, i + 1));
}

export function saveSystemGasGiants(list) {
  const world = loadWorld();
  const prevSelectedGg = world.system.gasGiants?.selectedId ?? null;
  const giants = (list || []).map((g, i) => normalizeGasGiant(g, i + 1));
  world.system.gasGiants = makeCollection(giants, "gg");
  world.system.gasGiants.selectedId =
    prevSelectedGg && world.system.gasGiants.byId[prevSelectedGg]
      ? prevSelectedGg
      : world.system.gasGiants.order[0] || null;
  const next = migrateWorld(world);
  saveWorld(next);
  return next;
}

export function getSelectedGasGiant(world = loadWorld()) {
  const id = world.system?.gasGiants?.selectedId;
  if (!id) return null;
  const raw = world.system.gasGiants.byId?.[id];
  return raw ? normalizeGasGiant(raw, 1) : null;
}

export function selectGasGiant(gasGiantId) {
  const world = loadWorld();
  if (!world.system?.gasGiants?.byId?.[gasGiantId]) return world;
  world.system.gasGiants.selectedId = gasGiantId;
  world.selectedBodyType = "gasGiant";
  saveWorld(world);
  return world;
}

export function selectBodyType(type) {
  const world = loadWorld();
  world.selectedBodyType = type === "gasGiant" ? "gasGiant" : "planet";
  saveWorld(world);
  return world;
}

export function saveSystemDebrisDisks(list) {
  const world = loadWorld();
  world.system.debrisDisks = makeCollection(
    (list || []).map((d, i) => normalizeDebrisDisk(d, i + 1)),
    "dd",
  );
  const next = migrateWorld(world);
  saveWorld(next);
  return next;
}

function mergeDefaults(defs, obj) {
  return deepMerge(defs, obj || {});
}

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (typeof a !== "object" || a === null) return b ?? a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof a[k] === "object" &&
      a[k] !== null
    ) {
      out[k] = deepMerge(a[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Import/export helpers

const BACKUPS_INDEX_KEY = "worldsmith.world.backups";

function _loadBackupsIndex() {
  try {
    const raw = localStorage.getItem(BACKUPS_INDEX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _saveBackupsIndex(arr) {
  try {
    localStorage.setItem(BACKUPS_INDEX_KEY, JSON.stringify(arr));
  } catch {}
}

export function listBackups() {
  return _loadBackupsIndex();
}

export function createBackup(maxKeep = 5) {
  try {
    const { raw: currentRaw } = readWorldRaw();
    if (!currentRaw) return null;
    const id = "b" + Date.now();
    const key = "worldsmith.world.backup." + id;
    localStorage.setItem(key, currentRaw);

    const idx = _loadBackupsIndex();
    idx.unshift({ id, key, createdUtc: new Date().toISOString() });
    const keep = idx.slice(0, Math.max(1, maxKeep));
    _saveBackupsIndex(keep);

    for (const extra of idx.slice(keep.length)) {
      try {
        localStorage.removeItem(extra.key);
      } catch {}
    }
    return keep[0];
  } catch {
    return null;
  }
}

export function restoreBackup(id) {
  const idx = _loadBackupsIndex();
  const item = idx.find((x) => x.id === id);
  if (!item) return false;
  try {
    const raw = localStorage.getItem(item.key);
    if (!raw) return false;
    localStorage.setItem(KEY, raw);
    try {
      localStorage.setItem(LEGACY_KEY, raw);
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("worldsmith:worldChanged"));
    } catch {}
    return true;
  } catch {
    return false;
  }
}

export function clearAllSavedData() {
  let removed = 0;
  try {
    for (const item of _loadBackupsIndex()) {
      if (!item?.key) continue;
      try {
        localStorage.removeItem(item.key);
        removed += 1;
      } catch {}
    }

    try {
      localStorage.removeItem(BACKUPS_INDEX_KEY);
      removed += 1;
    } catch {}
    try {
      localStorage.removeItem(KEY);
      removed += 1;
    } catch {}
    try {
      localStorage.removeItem(LEGACY_KEY);
      removed += 1;
    } catch {}

    // Best-effort cleanup for any remaining worldsmith.* keys (orphaned
    // backups, theme, splash preference, visualizer flags, etc.).
    if (typeof localStorage?.length === "number" && typeof localStorage?.key === "function") {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && String(k).startsWith("worldsmith.")) toRemove.push(k);
      }
      for (const k of toRemove) {
        try {
          localStorage.removeItem(k);
          removed += 1;
        } catch {}
      }
    }

    volatileWorldRaw = null;
    try {
      window.dispatchEvent(new CustomEvent("worldsmith:worldChanged"));
    } catch {}
    return removed;
  } catch {
    return removed;
  }
}

function stripLegacyKeys(world) {
  if (!world || typeof world !== "object") return world;
  const w = JSON.parse(JSON.stringify(world));
  // Remove deprecated single-instance mirrors
  delete w.planet;
  delete w.moon;
  // If any other legacy keys exist, remove here
  delete w.planetsSingle;
  delete w.moonsSingle;
  return w;
}
export function exportEnvelope() {
  const world = stripLegacyKeys(exportWorld());
  return {
    tool: TOOL_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedUtc: new Date().toISOString(),
    world,
  };
}

export function validateEnvelope(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Import data is not an object."] };
  }

  // Accept either envelope or raw world for backwards compatibility.
  // Treat any object with a plain-object "world" key as an envelope (older exports may omit metadata keys).
  const isEnvelope = !!(obj.world && typeof obj.world === "object" && !Array.isArray(obj.world));
  const world = isEnvelope ? obj.world : obj;

  if (!world || typeof world !== "object" || Array.isArray(world)) {
    errors.push("Missing import world object.");
  }
  const w = world || {};

  // Backwards-compatible shape check: allow legacy worlds that only include
  // single-entity keys (e.g. world.planet / world.moon) and let migrateWorld() normalize.
  const hasKnownWorldSection =
    (w.star && typeof w.star === "object") ||
    (w.system && typeof w.system === "object") ||
    (w.planets && typeof w.planets === "object") ||
    (w.planet && typeof w.planet === "object") ||
    (w.moons && typeof w.moons === "object") ||
    (w.moon && typeof w.moon === "object") ||
    Number.isFinite(Number(w.version));
  if (!hasKnownWorldSection) {
    errors.push("Import JSON is not a recognised WorldSmith world format.");
  }

  // Optional section type checks (only when present).
  if (w.star != null && (typeof w.star !== "object" || Array.isArray(w.star)))
    errors.push("'star' must be an object.");
  if (w.system != null && (typeof w.system !== "object" || Array.isArray(w.system)))
    errors.push("'system' must be an object.");
  if (w.planets != null && (typeof w.planets !== "object" || Array.isArray(w.planets)))
    errors.push("'planets' must be an object.");
  if (w.planet != null && (typeof w.planet !== "object" || Array.isArray(w.planet)))
    errors.push("'planet' must be an object.");
  if (w.moons != null && (typeof w.moons !== "object" || Array.isArray(w.moons)))
    errors.push("'moons' must be an object.");
  if (w.moon != null && (typeof w.moon !== "object" || Array.isArray(w.moon)))
    errors.push("'moon' must be an object.");

  // If present, ensure planets/moons containers have expected basic shape
  const pb = w.planets?.byId;
  if (pb && (typeof pb !== "object" || Array.isArray(pb)))
    errors.push("'planets.byId' must be an object.");
  const mb = w.moons?.byId;
  if (mb && (typeof mb !== "object" || Array.isArray(mb)))
    errors.push("'moons.byId' must be an object.");

  return { ok: errors.length === 0, errors, isEnvelope, world };
}
function exportWorld() {
  // Always return the latest shape (defaults + migrations applied)
  return loadWorld();
}

export function normalizeWorld(worldLike) {
  const merged = mergeDefaults(defaultWorld(), worldLike || {});
  return migrateWorld(merged);
}

export function importWorld(worldLike) {
  const normalised = normalizeWorld(worldLike);
  saveWorld(normalised);
  return normalised;
}
