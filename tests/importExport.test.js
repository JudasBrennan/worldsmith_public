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

const store = await import("../ui/store.js");
const solPreset = await import("../ui/solPreset.js");
const {
  GAS_GIANT_RADIUS_MIN_RJ,
  GAS_GIANT_RADIUS_MAX_RJ,
  exportEnvelope,
  clearAllSavedData,
  getSchemaVersion,
  hasSavedWorldInLocalStorage,
  importWorld,
  listMoons,
  listPlanets,
  listBackups,
  listSystemGasGiants,
  loadWorld,
  validateEnvelope,
  createBackup,
} = store;
const { createSolPresetEnvelope } = solPreset;
const realmPreset = await import("../ui/realmspacePreset.js");
const { createRealmspacePresetEnvelope } = realmPreset;

beforeEach(() => {
  globalThis.localStorage.clear();
});

function assertRadiusInRange(radiusRj) {
  assert.equal(Number.isFinite(radiusRj), true, "radiusRj must be numeric");
  assert.ok(
    radiusRj >= GAS_GIANT_RADIUS_MIN_RJ && radiusRj <= GAS_GIANT_RADIUS_MAX_RJ,
    `radiusRj ${radiusRj} is outside ${GAS_GIANT_RADIUS_MIN_RJ}-${GAS_GIANT_RADIUS_MAX_RJ}`,
  );
}

function makeLegacyRawWorld() {
  return {
    version: 12,
    star: { name: "Legacy Star", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.33,
      orbit1Au: 1,
      outermostGasGiantAu: 9.5,
    },
    planet: {
      name: "Legacy Planet",
      semiMajorAxisAu: 1,
      massEarth: 1,
      cmfPct: 32,
      albedoBond: 0.3,
      greenhouseEffect: 1.65,
      pressureAtm: 1,
      o2Pct: 20.95,
      co2Pct: 0.04,
      arPct: 0.93,
    },
    moon: {
      name: "Legacy Moon",
      semiMajorAxisKm: 350000,
      eccentricity: 0.04,
      inclinationDeg: 5,
      massMoon: 1,
      densityGcm3: 3.3,
      albedo: 0.12,
    },
  };
}

test("validateEnvelope → legacy raw world → accepted", () => {
  const legacy = makeLegacyRawWorld();
  const result = validateEnvelope(legacy);

  assert.equal(result.ok, true);
  assert.equal(result.isEnvelope, false);
  assert.equal(result.world.star.name, "Legacy Star");
});

test("importWorld → old gas giants → migrated with bounded radiusRj", () => {
  const legacy = makeLegacyRawWorld();
  legacy.system.gasGiants = {
    order: ["ga", "gb"],
    byId: {
      ga: { id: "ga", name: "A", semiMajorAxisAu: 5.0, style: "jupiter", moonCount: 2 },
      gb: { id: "gb", name: "B", au: 8.0, style: "ice", moonCount: 1 },
    },
  };
  const migrated = importWorld(legacy);
  const gas = listSystemGasGiants(migrated);

  assert.equal(migrated.version, getSchemaVersion());
  assert.equal(gas.length, 2);
  for (const g of gas) assertRadiusInRange(g.radiusRj);

  const byId = Object.fromEntries(gas.map((g) => [g.id, g]));
  assert.equal(byId.ga.au, 5);
  assert.equal(byId.gb.style, "neptune"); // legacy "ice" normalised to "neptune"
});

test("importWorld → gas giant radius aliases → mapped to radiusRj", () => {
  const world = {
    star: { name: "Alias Star", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.33,
      orbit1Au: 1,
      gasGiants: {
        order: ["ga", "gb"],
        byId: {
          ga: { id: "ga", name: "Alias A", au: 5.2, radiusJupiter: 1.2 },
          gb: { id: "gb", name: "Alias B", au: 8.7, sizeRj: 0.7 },
        },
      },
    },
  };
  const migrated = importWorld(world);
  const gas = Object.fromEntries(listSystemGasGiants(migrated).map((g) => [g.id, g]));

  assert.equal(gas.ga.radiusRj, 1.2);
  assert.equal(gas.gb.radiusRj, 0.7);
});

test("exportEnvelope → round-trip → stays valid and preserves world data", () => {
  const world = {
    star: { name: "Roundtrip Star", massMsol: 0.92, ageGyr: 5.1 },
    system: {
      spacingFactor: 0.33,
      orbit1Au: 0.88,
      gasGiants: {
        order: ["g1"],
        byId: {
          g1: {
            id: "g1",
            name: "Roundtrip Giant",
            au: 7.3,
            style: "saturn",
            moonCount: 4,
            radiusRj: 1.48,
          },
        },
      },
    },
    clusterSystemNames: { home: "Roundtrip Home" },
  };

  importWorld(world);
  const env = exportEnvelope();
  const valid = validateEnvelope(env);

  assert.equal(valid.ok, true);
  assert.equal(env.schemaVersion, getSchemaVersion());
  assert.equal(env.world.star.name, "Roundtrip Star");
  assert.equal(env.world.clusterSystemNames.home, "Roundtrip Home");
  assert.ok(env.world.planets && env.world.planets.byId, "planets collection should exist");
  assert.ok(env.world.moons && env.world.moons.byId, "moons collection should exist");

  const gas = listSystemGasGiants(env.world);
  assert.equal(gas.length, 1);
  assert.equal(gas[0].id, "g1");
  assert.equal(gas[0].radiusRj, 1.48);
  assertRadiusInRange(gas[0].radiusRj);

  importWorld(valid.world);
  const loaded = loadWorld();
  const loadedGas = listSystemGasGiants(loaded);
  assert.equal(loadedGas[0].radiusRj, 1.48);
  assert.equal(loaded.star.name, "Roundtrip Star");
});

test("Sol preset → validate + import → expected major bodies", () => {
  const solEnvelope = createSolPresetEnvelope();
  const validated = validateEnvelope(solEnvelope);
  assert.equal(validated.ok, true);

  const imported = importWorld(validated.world);
  assert.equal(imported.star.name, "Sol");
  assert.equal(imported.star.massMsol, 1);

  const planets = listPlanets(imported);
  assert.equal(planets.length, 4);
  assert.deepEqual(
    planets.map((p) => p.name),
    ["Mercury", "Venus", "Earth", "Mars"],
  );

  const gas = listSystemGasGiants(imported);
  assert.equal(gas.length, 4);
  assert.deepEqual(
    gas.map((g) => g.name),
    ["Jupiter", "Saturn", "Uranus", "Neptune"],
  );
  for (const giant of gas) assertRadiusInRange(giant.radiusRj);

  const moons = listMoons(imported);
  assert.ok(moons.some((m) => m.name === "Moon" && m.planetId === "p_earth"));
  const earth = planets.find((planet) => planet.id === "p_earth");
  assert.equal(earth?.inputs?.rotationPeriodHours, 23.934);

  const calendar = imported.calendar;
  assert.ok(calendar && typeof calendar === "object", "calendar should be present on Sol preset");
  assert.equal(calendar.activeProfileId, "cal-gregorian-uk");
  assert.ok(Array.isArray(calendar.profiles) && calendar.profiles.length >= 1);

  const profile = calendar.profiles.find((entry) => entry.id === "cal-gregorian-uk");
  assert.ok(profile, "Gregorian UK calendar profile should exist");
  assert.equal(profile.inputs?.sourcePlanetId, "p_earth");
  assert.equal(profile.inputs?.primaryMoonId, "m_luna");
  assert.equal(profile.ui?.calendarName, "Gregorian (UK)");
  assert.equal(profile.ui?.startDayOfYear, 0);
  assert.ok(
    Array.isArray(profile.ui?.leapRules) &&
      profile.ui.leapRules.some((rule) => rule.id === "leap-greg-400"),
    "Gregorian leap correction rules should be present",
  );
  assert.ok(
    Array.isArray(profile.ui?.holidays) &&
      profile.ui.holidays.some((holiday) => holiday.name === "Christmas Day") &&
      profile.ui.holidays.some((holiday) => holiday.name === "Early May Bank Holiday"),
    "UK holiday rules should be present",
  );
  const goodFriday = profile.ui.holidays.find((holiday) => holiday.id === "holiday-good-friday");
  const easterSunday = profile.ui.holidays.find(
    (holiday) => holiday.id === "holiday-easter-sunday",
  );
  const easterMonday = profile.ui.holidays.find(
    (holiday) => holiday.id === "holiday-easter-monday",
  );
  assert.ok(
    goodFriday && easterSunday && easterMonday,
    "Movable Easter holidays should be present",
  );
  assert.equal(goodFriday?.anchor?.type, "algorithmic");
  assert.equal(goodFriday?.anchor?.algorithmKey, "gregorian-easter-western");
  assert.equal(goodFriday?.offsetDays, -2);
  assert.equal(easterSunday?.anchor?.type, "algorithmic");
  assert.equal(easterSunday?.anchor?.algorithmKey, "gregorian-easter-western");
  assert.equal(easterSunday?.offsetDays, 0);
  assert.equal(easterMonday?.anchor?.type, "algorithmic");
  assert.equal(easterMonday?.anchor?.algorithmKey, "gregorian-easter-western");
  assert.equal(easterMonday?.offsetDays, 1);

  const christmasDay = profile.ui.holidays.find(
    (holiday) => holiday.id === "holiday-christmas-day",
  );
  const boxingDay = profile.ui.holidays.find((holiday) => holiday.id === "holiday-boxing-day");
  const newYearsDay = profile.ui.holidays.find((holiday) => holiday.id === "holiday-new-year");
  assert.equal(christmasDay?.observance?.weekendRule, "next-weekday");
  assert.equal(boxingDay?.observance?.weekendRule, "next-weekday");
  assert.equal(newYearsDay?.observance?.weekendRule, "next-weekday");
});

test("Realmspace preset → validate + import → expected bodies", () => {
  const envelope = createRealmspacePresetEnvelope();
  const validated = validateEnvelope(envelope);
  assert.equal(validated.ok, true);

  const imported = importWorld(validated.world);
  assert.equal(imported.star.name, "The Sun");

  const planets = listPlanets(imported);
  assert.equal(planets.length, 5);
  assert.deepEqual(
    planets.map((p) => p.name),
    ["Anadia", "Toril", "Karpri", "Chandos", "Glyth"],
  );

  const gas = listSystemGasGiants(imported);
  assert.equal(gas.length, 1);
  assert.deepEqual(
    gas.map((g) => g.name),
    ["Coliar"],
  );
  for (const giant of gas) assertRadiusInRange(giant.radiusRj);

  const moons = listMoons(imported);
  assert.ok(moons.some((m) => m.name === "Selune" && m.planetId === "p_toril"));
});

test("gas giant fields → round-trip → massMjup, rotation, slotIndex, metallicity preserved", () => {
  const world = {
    star: { name: "Field Test Star", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.3,
      orbit1Au: 0.39,
      gasGiants: {
        order: ["g1"],
        byId: {
          g1: {
            id: "g1",
            name: "Test Giant",
            au: 5.2,
            radiusRj: 1.0,
            massMjup: 1.0,
            rotationPeriodHours: 9.925,
            slotIndex: 6,
            metallicity: 4.5,
            rings: true,
          },
        },
      },
    },
  };
  importWorld(world);
  const env = exportEnvelope();
  const gas = listSystemGasGiants(env.world);
  assert.equal(gas.length, 1);
  assert.equal(gas[0].massMjup, 1.0);
  assert.equal(gas[0].rotationPeriodHours, 9.925);
  assert.equal(gas[0].slotIndex, 6);
  assert.equal(gas[0].metallicity, 4.5);
  assert.equal(gas[0].rings, true);
});

test("importWorld → 0 gas giants + 0 debris disks → allowed", () => {
  const world = {
    star: { name: "Empty Star", massMsol: 1, ageGyr: 4.6 },
    system: {
      spacingFactor: 0.3,
      orbit1Au: 0.39,
      gasGiants: { order: [], byId: {} },
      debrisDisks: { order: [], byId: {} },
    },
  };
  const imported = importWorld(world);
  const gas = listSystemGasGiants(imported);
  assert.equal(gas.length, 0);
});

test("clearAllSavedData → after import + backup → removes all data", () => {
  importWorld(makeLegacyRawWorld());
  createBackup(5);
  const backupsBefore = listBackups();

  assert.equal(hasSavedWorldInLocalStorage(), true);
  assert.ok(backupsBefore.length >= 1, "expected at least one backup before clear");
  assert.ok(
    backupsBefore.some((b) => globalThis.localStorage.getItem(b.key) != null),
    "expected backup payload key to exist",
  );

  clearAllSavedData();

  assert.equal(hasSavedWorldInLocalStorage(), false);
  assert.equal(globalThis.localStorage.getItem("worldsmith.world.v1"), null);
  assert.equal(globalThis.localStorage.getItem("worldsmith.world"), null);
  assert.equal(globalThis.localStorage.getItem("worldsmith.world.backups"), null);
  assert.equal(listBackups().length, 0);
  assert.ok(
    backupsBefore.every((b) => globalThis.localStorage.getItem(b.key) == null),
    "expected all indexed backup payload keys to be removed",
  );
});
