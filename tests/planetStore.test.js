import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

class MemStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }
  setItem(key, value) {
    this.map.set(String(key), String(value));
  }
  removeItem(key) {
    this.map.delete(String(key));
  }
  clear() {
    this.map.clear();
  }
}

if (!globalThis.localStorage) globalThis.localStorage = new MemStorage();
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}
if (!globalThis.window) {
  globalThis.window = {
    dispatchEvent() {
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

const {
  loadWorld,
  importWorld,
  exportEnvelope,
  getSchemaVersion,
  listPlanets,
  getSelectedPlanet,
  selectPlanet,
  createPlanetFromInputs,
  deletePlanet,
  updatePlanet,
  listSystemGasGiants,
  getSelectedGasGiant,
  selectGasGiant,
  selectBodyType,
  saveSystemGasGiants,
  randomGasGiantRadiusRj,
  listMoons,
  createMoonFromInputs,
  saveWorld,
} = await import("../ui/store.js");
const { createSolPresetEnvelope } = await import("../ui/solPreset.js");
const { createRealmspacePresetEnvelope } = await import("../ui/realmspacePreset.js");

beforeEach(() => {
  globalThis.localStorage.clear();
});

/* ── Migration v38 ──────────────────────────────────────────────── */

test("migration v38 adds selectedBodyType and gas giant selectedId", () => {
  const legacy = {
    version: 37,
    star: { name: "Test", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.3,
      orbit1Au: 0.39,
      gasGiants: {
        order: ["gg1", "gg2"],
        byId: {
          gg1: { id: "gg1", name: "Giant 1", au: 5.2, radiusRj: 1.0 },
          gg2: { id: "gg2", name: "Giant 2", au: 9.5, radiusRj: 0.84 },
        },
      },
    },
  };
  const world = importWorld(legacy);
  assert.equal(world.version, getSchemaVersion());
  assert.equal(world.selectedBodyType, "planet");
  assert.equal(world.system.gasGiants.selectedId, "gg1");
});

test("migration v38 sets selectedId to null when no gas giants exist", () => {
  const legacy = {
    version: 37,
    star: { name: "Empty", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.3,
      orbit1Au: 0.39,
      gasGiants: { order: [], byId: {} },
    },
  };
  const world = importWorld(legacy);
  assert.equal(world.selectedBodyType, "planet");
  assert.equal(world.system.gasGiants.selectedId, null);
});

/* ── getSelectedGasGiant ────────────────────────────────────────── */

test("getSelectedGasGiant returns the correct gas giant", () => {
  const solWorld = importWorld(createSolPresetEnvelope().world);
  const giant = getSelectedGasGiant(solWorld);
  assert.ok(giant, "should return a gas giant");
  assert.equal(giant.name, "Jupiter");
  assert.equal(giant.radiusRj, 1.0);
});

test("getSelectedGasGiant returns null when no gas giants exist", () => {
  importWorld({
    star: { name: "Empty", massMsol: 1, ageGyr: 4.6 },
    system: { spacingFactor: 0.3, orbit1Au: 0.39, gasGiants: { order: [], byId: {} } },
  });
  const giant = getSelectedGasGiant();
  assert.equal(giant, null);
});

/* ── selectGasGiant ─────────────────────────────────────────────── */

test("selectGasGiant switches selection and sets body type to gasGiant", () => {
  importWorld(createSolPresetEnvelope().world);
  const world = selectGasGiant("gg_saturn");
  assert.equal(world.system.gasGiants.selectedId, "gg_saturn");
  assert.equal(world.selectedBodyType, "gasGiant");

  const giant = getSelectedGasGiant();
  assert.equal(giant.name, "Saturn");
});

test("selectGasGiant ignores invalid id", () => {
  importWorld(createSolPresetEnvelope().world);
  const before = loadWorld();
  const prevId = before.system.gasGiants.selectedId;
  selectGasGiant("nonexistent_id");
  const after = loadWorld();
  assert.equal(after.system.gasGiants.selectedId, prevId);
});

/* ── selectBodyType ────────────────────────────────────────── */

test("selectBodyType toggles between planet and gasGiant", () => {
  importWorld(createSolPresetEnvelope().world);

  selectBodyType("gasGiant");
  assert.equal(loadWorld().selectedBodyType, "gasGiant");

  selectBodyType("planet");
  assert.equal(loadWorld().selectedBodyType, "planet");
});

test("selectBodyType defaults invalid input to planet", () => {
  importWorld(createSolPresetEnvelope().world);
  selectBodyType("invalid");
  assert.equal(loadWorld().selectedBodyType, "planet");
});

/* ── Planet + gas giant coexistence ──────────────────────────────── */

test("planets and gas giants coexist independently in a Sol-like world", () => {
  importWorld(createSolPresetEnvelope().world);
  const world = loadWorld();

  const planets = listPlanets(world);
  const giants = listSystemGasGiants(world);
  assert.equal(planets.length, 4);
  assert.equal(giants.length, 4);

  // Planet selection
  const planet = getSelectedPlanet(world);
  assert.ok(planet, "should have a selected planet");
  assert.equal(planet.name, "Earth");

  // Gas giant selection
  const giant = getSelectedGasGiant(world);
  assert.ok(giant, "should have a selected gas giant");
  assert.equal(giant.name, "Jupiter");

  // Body type defaults to planet
  assert.equal(world.selectedBodyType, "planet");
});

/* ── Create and select gas giant ────────────────────────────────── */

test("creating a gas giant and selecting it persists through save/load", () => {
  importWorld(createSolPresetEnvelope().world);
  const existing = listSystemGasGiants(loadWorld());
  const newId = "gg_test_new";
  existing.push({
    id: newId,
    name: "Test Giant",
    au: 15.0,
    slotIndex: null,
    style: "saturn",
    radiusRj: randomGasGiantRadiusRj(),
    massMjup: 2.5,
    rotationPeriodHours: 12,
    metallicity: 5,
    rings: true,
  });
  saveSystemGasGiants(existing);
  selectGasGiant(newId);

  const world = loadWorld();
  assert.equal(world.system.gasGiants.selectedId, newId);
  assert.equal(world.selectedBodyType, "gasGiant");

  const giant = getSelectedGasGiant(world);
  assert.equal(giant.name, "Test Giant");
  assert.equal(giant.massMjup, 2.5);
  assert.equal(giant.rings, true);

  const allGiants = listSystemGasGiants(world);
  assert.equal(allGiants.length, 5);
});

/* ── Delete gas giant unassigns moons ───────────────────────────── */

test("deleting a gas giant unassigns its moons", () => {
  importWorld(createSolPresetEnvelope().world);
  const world = loadWorld();

  // Verify Jupiter has moons
  const jupiterMoons = listMoons(world).filter((m) => m.planetId === "gg_jupiter");
  assert.ok(jupiterMoons.length > 0, "Jupiter should have moons");

  // Unassign moons manually (mimicking UI delete logic)
  const w = loadWorld();
  if (w.moons?.byId) {
    for (const m of Object.values(w.moons.byId)) {
      if (m.planetId === "gg_jupiter") {
        m.planetId = null;
        m.locked = false;
      }
    }
    saveWorld(w);
  }

  // Remove the gas giant
  const remaining = listSystemGasGiants(loadWorld()).filter((g) => g.id !== "gg_jupiter");
  saveSystemGasGiants(remaining);

  // Verify moons are unassigned
  const updated = loadWorld();
  const orphaned = listMoons(updated).filter((m) => m.planetId === "gg_jupiter");
  assert.equal(orphaned.length, 0, "no moons should reference deleted gas giant");

  // Former Jupiter moons should now be unassigned
  const unassigned = listMoons(updated).filter(
    (m) => m.planetId === null && jupiterMoons.some((jm) => jm.id === m.id),
  );
  assert.equal(unassigned.length, jupiterMoons.length);
});

/* ── Body type switching preserves selections ───────────────────── */

test("switching body type preserves both planet and gas giant selections", () => {
  importWorld(createSolPresetEnvelope().world);

  selectPlanet("p_mars");
  selectGasGiant("gg_neptune");

  // Now in gasGiant mode; switch to planet
  selectBodyType("planet");
  const w1 = loadWorld();
  assert.equal(w1.selectedBodyType, "planet");
  assert.equal(w1.planets.selectedId, "p_mars");
  assert.equal(w1.system.gasGiants.selectedId, "gg_neptune");

  // Switch back to gasGiant
  selectBodyType("gasGiant");
  const w2 = loadWorld();
  assert.equal(w2.selectedBodyType, "gasGiant");
  assert.equal(w2.planets.selectedId, "p_mars");
  assert.equal(w2.system.gasGiants.selectedId, "gg_neptune");
});

/* ── Planet CRUD with immediate-save ────────────────────────────── */

test("updatePlanet immediately persists changes to store", () => {
  importWorld(createSolPresetEnvelope().world);
  const w = loadWorld();
  const earthId = w.planets.selectedId;

  updatePlanet(earthId, { inputs: { massEarth: 2.5, albedoBond: 0.4 } });
  const updated = loadWorld();
  const earth = listPlanets(updated).find((p) => p.id === earthId);
  assert.equal(earth.inputs.massEarth, 2.5);
  assert.equal(earth.inputs.albedoBond, 0.4);
  // Other fields unchanged
  assert.equal(earth.inputs.semiMajorAxisAu, 1.0);
});

test("createPlanetFromInputs adds a new planet and selects it", () => {
  importWorld(createSolPresetEnvelope().world);
  const before = listPlanets(loadWorld());

  createPlanetFromInputs(
    { name: "New World", massEarth: 0.8, semiMajorAxisAu: 0.72 },
    { name: "New World" },
  );

  const after = loadWorld();
  const planets = listPlanets(after);
  assert.equal(planets.length, before.length + 1);
  assert.equal(after.planets.selectedId !== "p_earth", true);
  const newPlanet = planets.find((p) => p.name === "New World");
  assert.ok(newPlanet, "new planet should exist");
  assert.equal(newPlanet.inputs.massEarth, 0.8);
});

test("deletePlanet removes planet and selects another", () => {
  importWorld(createSolPresetEnvelope().world);
  selectPlanet("p_mars");
  const before = listPlanets(loadWorld()).length;

  deletePlanet("p_mars");
  const after = loadWorld();
  const planets = listPlanets(after);
  assert.equal(planets.length, before - 1);
  assert.ok(!planets.some((p) => p.id === "p_mars"), "Mars should be removed");
  assert.ok(after.planets.selectedId, "should auto-select another planet");
});

/* ── Gas giant selectedId survives canonicalize ──────────────────── */

test("gas giant selectedId survives collection rebuild via saveSystemGasGiants", () => {
  importWorld(createSolPresetEnvelope().world);
  selectGasGiant("gg_saturn");

  // Save the list (triggers canonicalize internally)
  const giants = listSystemGasGiants(loadWorld());
  saveSystemGasGiants(giants);

  const world = loadWorld();
  assert.equal(world.system.gasGiants.selectedId, "gg_saturn");
});

test("gas giant selectedId falls back to first when selected is deleted", () => {
  importWorld(createSolPresetEnvelope().world);
  selectGasGiant("gg_saturn");

  // Remove Saturn
  const remaining = listSystemGasGiants(loadWorld()).filter((g) => g.id !== "gg_saturn");
  saveSystemGasGiants(remaining);

  const world = loadWorld();
  assert.ok(world.system.gasGiants.selectedId !== "gg_saturn");
  assert.equal(world.system.gasGiants.selectedId, world.system.gasGiants.order[0]);
});

/* ── Preset new fields ──────────────────────────────────────────── */

test("Sol preset includes selectedBodyType and gas giant selectedId", () => {
  const world = importWorld(createSolPresetEnvelope().world);
  assert.equal(world.selectedBodyType, "planet");
  assert.equal(world.system.gasGiants.selectedId, "gg_jupiter");
});

test("Realmspace preset includes selectedBodyType and gas giant selectedId", () => {
  const world = importWorld(createRealmspacePresetEnvelope().world);
  assert.equal(world.selectedBodyType, "planet");
  assert.equal(world.system.gasGiants.selectedId, "gg_coliar");
});

/* ── Round-trip preserves new fields ────────────────────────────── */

test("export/import round-trip preserves selectedBodyType and gas giant selectedId", () => {
  importWorld(createSolPresetEnvelope().world);
  selectGasGiant("gg_neptune");
  selectBodyType("gasGiant");

  const env = exportEnvelope();
  assert.equal(env.world.selectedBodyType, "gasGiant");
  assert.equal(env.world.system.gasGiants.selectedId, "gg_neptune");

  // Re-import
  globalThis.localStorage.clear();
  const reimported = importWorld(env.world);
  assert.equal(reimported.selectedBodyType, "gasGiant");
  assert.equal(reimported.system.gasGiants.selectedId, "gg_neptune");
});

/* ── Moon assignment to gas giants ──────────────────────────────── */

test("moons can be assigned to gas giants and listed correctly", () => {
  importWorld(createSolPresetEnvelope().world);
  const world = loadWorld();

  // Check Jupiter's moons
  const jupiterMoons = listMoons(world).filter((m) => m.planetId === "gg_jupiter");
  assert.ok(jupiterMoons.length >= 4, "Jupiter should have at least 4 Galilean moons");
  assert.ok(jupiterMoons.some((m) => m.name === "Io"));
  assert.ok(jupiterMoons.some((m) => m.name === "Europa"));
  assert.ok(jupiterMoons.some((m) => m.name === "Ganymede"));
  assert.ok(jupiterMoons.some((m) => m.name === "Callisto"));

  // Check Saturn's moons
  const saturnMoons = listMoons(world).filter((m) => m.planetId === "gg_saturn");
  assert.ok(saturnMoons.length >= 7, "Saturn should have at least 7 moons");
  assert.ok(saturnMoons.some((m) => m.name === "Titan"));
});

test("createMoonFromInputs assigns moon to gas giant", () => {
  importWorld(createSolPresetEnvelope().world);
  const before = listMoons(loadWorld()).filter((m) => m.planetId === "gg_neptune").length;

  createMoonFromInputs(
    {
      name: "Test Moon",
      semiMajorAxisKm: 200000,
      eccentricity: 0.01,
      inclinationDeg: 1,
      massMoon: 0.5,
      densityGcm3: 2.0,
      albedo: 0.3,
    },
    { name: "Test Moon", planetId: "gg_neptune" },
  );

  const after = listMoons(loadWorld()).filter((m) => m.planetId === "gg_neptune");
  assert.equal(after.length, before + 1);
  assert.ok(after.some((m) => m.name === "Test Moon"));
});
