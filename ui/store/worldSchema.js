// SPDX-License-Identifier: MPL-2.0
import { LOCAL_CLUSTER_DEFAULTS } from "../../engine/localCluster.js";
import { mergeDefaults } from "./deepMerge.js";

export const SCHEMA_VERSION = 56;

function hasNonEmptyPlainObject(value) {
  return (
    !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
  );
}

function hasExplicitCollectionShape(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Array.isArray(value.order) ||
      (value.byId && typeof value.byId === "object" && !Array.isArray(value.byId)))
  );
}

export function defaultWorld() {
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
      orbitMode: "guided",
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
    // Tectonics page inputs (mountain ranges, ocean depth config)
    tectonics: {
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
    },
    // Population page inputs (civilization parameters)
    population: {
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
    },
    // Climate page inputs
    climate: { altitudeM: 0 },
  };
}

export function mergeWorldForMigration(worldLike) {
  const source =
    worldLike && typeof worldLike === "object" && !Array.isArray(worldLike) ? worldLike : {};
  const preserveLegacyPlanet =
    !hasExplicitCollectionShape(source.planets) && hasNonEmptyPlainObject(source.planet);
  const preserveLegacyMoon =
    !hasExplicitCollectionShape(source.moons) && hasNonEmptyPlainObject(source.moon);
  const merged = mergeDefaults(defaultWorld(), source);

  if (preserveLegacyPlanet) delete merged.planets;
  if (preserveLegacyMoon) delete merged.moons;

  return merged;
}
