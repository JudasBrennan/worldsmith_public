import { LOCAL_CLUSTER_DEFAULTS, normalizeLocalClusterInputs } from "../../engine/localCluster.js";
import { sanitizeImportedValue } from "./importValidation.js";
import { normalizeGasGiant } from "./gasGiantModel.js";
import {
  canonicalizeSystemFeatures,
  getGasGiants,
  makeCollection,
  normalizeClusterSystemNames,
} from "./systemCollections.js";
import { SCHEMA_VERSION, mergeWorldForMigration } from "./worldSchema.js";

export function migrateWorld(world) {
  if (!world.version) world.version = 1;

  if (!world.star || typeof world.star !== "object") world.star = {};
  const starName = String(world.star.name ?? "").trim();
  world.star.name = starName || "Star";
  if (world.star.metallicityFeH == null) world.star.metallicityFeH = 0.0;
  if (!world.star.evolutionMode) world.star.evolutionMode = "zams";
  const activityModelVersion = String(world.star.activityModelVersion || "v2").toLowerCase();
  world.star.activityModelVersion = activityModelVersion === "v1" ? "v1" : "v2";

  world.cluster = normalizeLocalClusterInputs(world.cluster || LOCAL_CLUSTER_DEFAULTS);
  world.clusterSystemNames = normalizeClusterSystemNames(world.clusterSystemNames);

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

  if (!world.planets.selectedId || !world.planets.byId[world.planets.selectedId]) {
    world.planets.selectedId = world.planets.order[0] || Object.keys(world.planets.byId)[0];
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const planet = world.planets.byId[planetId];
      if (!planet) continue;
      if (!planet.inputs) planet.inputs = {};
      if (!planet.name) planet.name = planet.inputs.name || "New Planet";
      if (!planet.inputs.name) planet.inputs.name = planet.name;
    }
  }

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

  if (world.moons && world.moons.byId) {
    for (const moonId of Object.keys(world.moons.byId)) {
      const moon = world.moons.byId[moonId];
      if (!moon) continue;
      if (!moon.inputs) moon.inputs = {};
      if (!moon.name) moon.name = moon.inputs.name || "Luna";
      if (!moon.inputs.name) moon.inputs.name = moon.name;
      if (typeof moon.locked !== "boolean") moon.locked = false;
      if (moon.planetId === "") moon.planetId = null;
      if (
        moon.planetId != null &&
        !world.planets.byId[moon.planetId] &&
        !world.system?.gasGiants?.byId?.[moon.planetId]
      ) {
        moon.planetId = null;
      }
    }
  }

  const selectedMoon = world.moons.byId[world.moons.selectedId];
  if (selectedMoon && selectedMoon.inputs) {
    world.moon = { ...selectedMoon.inputs, name: selectedMoon.name || selectedMoon.inputs.name };
  }

  const selectedPlanet = world.planets.byId[world.planets.selectedId];
  if (selectedPlanet && selectedPlanet.inputs) {
    world.planet = {
      ...selectedPlanet.inputs,
      name: selectedPlanet.name || selectedPlanet.inputs.name,
    };
  }

  if (world.system) {
    const legacyOuterGasGiantAu = Number(world.system.outermostGasGiantAu);
    if (Number.isFinite(legacyOuterGasGiantAu) && legacyOuterGasGiantAu > 0) {
      const existingGasGiants = getGasGiants(world, normalizeGasGiant);
      if (!existingGasGiants.length) {
        const gasGiant = normalizeGasGiant(
          {
            id: "gg1",
            name: "Outermost gas giant",
            au: legacyOuterGasGiantAu,
            style: "jupiter",
          },
          1,
        );
        world.system.gasGiants = makeCollection([gasGiant], "gg");
      }
    }
    delete world.system.outermostGasGiantAu;
  }

  if (!world.selectedBodyType) world.selectedBodyType = "planet";
  if (world.system.gasGiants && world.system.gasGiants.selectedId === undefined) {
    world.system.gasGiants.selectedId = world.system.gasGiants.order?.[0] || null;
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (!inputs) continue;
      if (!inputs.greenhouseMode) inputs.greenhouseMode = "manual";
      if (inputs.h2oPct == null) inputs.h2oPct = 0;
      if (inputs.ch4Pct == null) inputs.ch4Pct = 0;
      if (inputs.h2Pct == null) inputs.h2Pct = 0;
      if (inputs.hePct == null) inputs.hePct = 0;
      if (inputs.so2Pct == null) inputs.so2Pct = 0;
      if (inputs.nh3Pct == null) inputs.nh3Pct = 0;
    }
  }

  if (world.moons && world.moons.byId) {
    for (const moonId of Object.keys(world.moons.byId)) {
      const inputs = world.moons.byId[moonId]?.inputs;
      if (inputs && inputs.compositionOverride === undefined) inputs.compositionOverride = null;
    }
  }
  if (world.moon && world.moon.compositionOverride === undefined) {
    world.moon.compositionOverride = null;
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (!inputs) continue;
      if (inputs.wmfPct == null) inputs.wmfPct = 0;
      if (inputs.tectonicRegime == null) inputs.tectonicRegime = "unknown";
      if (inputs.mantleOxidation == null) inputs.mantleOxidation = "earth";
    }
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (!inputs) continue;
      if (inputs.tectonicRegime === "unknown" || inputs.tectonicRegime === "mobile") {
        inputs.tectonicRegime = "auto";
      }
    }
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (!inputs) continue;
      if (inputs.cmfPct === 32 || inputs.cmfPct === 32.0) inputs.cmfPct = -1;
    }
  }

  if (!world.tectonics || typeof world.tectonics !== "object") {
    world.tectonics = {
      ridgeHeightM: 2600,
      mountainRanges: [
        {
          id: "mr1",
          type: "andean",
          label: "Range 1",
          widths: {},
          heights: {},
          slabAngleDeg: 45,
          convergenceMmYr: 50,
        },
      ],
      inactiveRanges: [],
      spreadingRateFraction: 0.5,
      isostasyMode: "off",
      margin: { shelfWidthKm: 80, shelfDepthM: 130, slopeAngleDeg: 3.5 },
      shieldVolcanoes: [],
      riftValleys: [],
    };
  }

  if (world.tectonics) {
    const tectonics = world.tectonics;
    if (tectonics.spreadingRateFraction == null) tectonics.spreadingRateFraction = 0.5;
    if (!tectonics.isostasyMode) tectonics.isostasyMode = "off";
    if (!tectonics.margin) {
      tectonics.margin = { shelfWidthKm: 80, shelfDepthM: 130, slopeAngleDeg: 3.5 };
    }
    if (!Array.isArray(tectonics.shieldVolcanoes)) tectonics.shieldVolcanoes = [];
    if (!Array.isArray(tectonics.riftValleys)) tectonics.riftValleys = [];
    if (Array.isArray(tectonics.mountainRanges)) {
      for (const mountainRange of tectonics.mountainRanges) {
        if (mountainRange.slabAngleDeg == null) mountainRange.slabAngleDeg = 45;
      }
    }
  }

  if (world.tectonics && Array.isArray(world.tectonics.mountainRanges)) {
    for (const mountainRange of world.tectonics.mountainRanges) {
      if (mountainRange.convergenceMmYr == null) mountainRange.convergenceMmYr = 50;
    }
  }

  if (!world.population || typeof world.population !== "object") {
    world.population = {
      techEra: "Medieval",
      initialPopulation: 1000,
      growthRate: null,
      timeElapsedYears: 500,
      continentCount: 6,
      regionCount: 10,
      zipfExponent: 1.0,
      oceanPctOverride: null,
      habitablePctOverride: null,
      productivePctOverride: null,
      cropPctOverride: null,
    };
  }

  if (!world.climate || typeof world.climate !== "object") {
    world.climate = { altitudeM: 0 };
  }

  if (!world.system.orbitMode) world.system.orbitMode = "guided";

  if (world.moons && world.moons.byId) {
    for (const moonId of Object.keys(world.moons.byId)) {
      const inputs = world.moons.byId[moonId]?.inputs;
      if (inputs && inputs.initialRotationPeriodHours === undefined) {
        inputs.initialRotationPeriodHours = null;
      }
    }
  }
  if (world.moon && world.moon.initialRotationPeriodHours === undefined) {
    world.moon.initialRotationPeriodHours = null;
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (inputs && inputs.radioisotopeAbundance === undefined) {
        inputs.radioisotopeAbundance = null;
      }
    }
  }
  if (world.planet && world.planet.radioisotopeAbundance === undefined) {
    world.planet.radioisotopeAbundance = null;
  }

  if (world.planets && world.planets.byId) {
    for (const planetId of Object.keys(world.planets.byId)) {
      const inputs = world.planets.byId[planetId]?.inputs;
      if (!inputs) continue;
      if (inputs.radioisotopeMode === undefined) inputs.radioisotopeMode = "simple";
      if (inputs.u238Abundance === undefined) inputs.u238Abundance = null;
      if (inputs.u235Abundance === undefined) inputs.u235Abundance = null;
      if (inputs.th232Abundance === undefined) inputs.th232Abundance = null;
      if (inputs.k40Abundance === undefined) inputs.k40Abundance = null;
    }
  }
  if (world.planet) {
    if (world.planet.radioisotopeMode === undefined) world.planet.radioisotopeMode = "simple";
    if (world.planet.u238Abundance === undefined) world.planet.u238Abundance = null;
    if (world.planet.u235Abundance === undefined) world.planet.u235Abundance = null;
    if (world.planet.th232Abundance === undefined) world.planet.th232Abundance = null;
    if (world.planet.k40Abundance === undefined) world.planet.k40Abundance = null;
  }

  canonicalizeSystemFeatures(world, { normalizeGasGiant });

  if (world.version !== SCHEMA_VERSION) world.version = SCHEMA_VERSION;

  return world;
}

export function normalizeWorld(worldLike) {
  const merged = mergeWorldForMigration(sanitizeImportedValue(worldLike));
  return migrateWorld(merged);
}
