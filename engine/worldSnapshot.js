import { calcStar } from "./star.js";
import { calcSystem } from "./system.js";
import { calcPlanetExact } from "./planet.js";
import { calcGasGiant } from "./gasGiant.js";
import { calcMoonExact } from "./moon.js";
import { resolveWorldStarConfig } from "./worldStarConfig.js";

function orderedItems(section) {
  if (!section || typeof section !== "object") return [];
  const byId = section.byId && typeof section.byId === "object" ? section.byId : {};
  const order = Array.isArray(section.order) ? section.order : Object.keys(byId);
  return order.map((id) => byId[id]).filter(Boolean);
}

function sanitizeMode(mode) {
  return mode === "summary" ? "summary" : "full";
}

function sanitizeDetailLevel(detailLevel) {
  return detailLevel === "summary" ? "summary" : "full";
}

function shallowCloneRaw(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    ...raw,
    inputs:
      raw.inputs && typeof raw.inputs === "object"
        ? {
            ...raw.inputs,
          }
        : raw.inputs,
  };
}

function sortByOrbit(items) {
  return [...items].sort((left, right) => left.orbitAu - right.orbitAu);
}

function groupMoonInputsByParentId(moonEntries) {
  const moonInputsByParentId = new Map();
  for (const raw of moonEntries) {
    if (!raw?.planetId) continue;
    if (!moonInputsByParentId.has(raw.planetId)) {
      moonInputsByParentId.set(raw.planetId, []);
    }
    moonInputsByParentId.get(raw.planetId).push(raw.inputs || {});
  }
  return moonInputsByParentId;
}

function groupMoonIdsByParentId(moonEntries) {
  const moonsByParentId = {};
  for (const raw of moonEntries) {
    if (!raw?.planetId) continue;
    if (!moonsByParentId[raw.planetId]) moonsByParentId[raw.planetId] = [];
    moonsByParentId[raw.planetId].push(raw.id);
  }
  return moonsByParentId;
}

function buildOtherGiantsById(gasGiantEntries) {
  const byId = new Map();
  for (const entry of gasGiantEntries) {
    byId.set(
      entry.id,
      gasGiantEntries.filter((other) => other.id !== entry.id),
    );
  }
  return byId;
}

function buildRockyMoonParentOverride(model, { includeRadiation = true } = {}) {
  return {
    inputs: {
      massEarth: model.inputs.massEarth,
      semiMajorAxisAu: model.inputs.semiMajorAxisAu,
      eccentricity: model.inputs.eccentricity,
      rotationPeriodHours: model.inputs.rotationPeriodHours,
      cmfPct: model.inputs.cmfPct,
    },
    derived: {
      densityGcm3: model.derived.densityGcm3,
      radiusEarth: model.derived.radiusEarth,
      gravityG: model.derived.gravityG,
      radioisotopeAbundance: model.inputs.radioisotopeAbundance ?? 1,
      ...(includeRadiation
        ? {
            surfaceFieldEarths: model.derived?.surfaceFieldEarths ?? 0,
            magnetopauseRp: model.derived?.magnetopauseRp ?? null,
          }
        : {}),
    },
  };
}

function buildGasGiantMoonParentOverride(model, { includeRadiation = true } = {}) {
  return {
    inputs: {
      massEarth: model.physical.massEarth,
      semiMajorAxisAu: model.inputs.orbitAu,
      eccentricity: model.inputs.eccentricity,
      rotationPeriodHours: model.inputs.rotationPeriodHours,
      cmfPct: 0,
    },
    derived: {
      densityGcm3: model.physical.densityGcm3,
      radiusEarth: model.physical.radiusEarth,
      gravityG: model.physical.gravityG,
      radioisotopeAbundance: 1,
      ...(includeRadiation
        ? {
            surfaceFieldEarths: model.magnetic?.surfaceFieldEarths ?? 0,
            magnetopauseRp: model.magnetic?.magnetopauseRp ?? null,
          }
        : {}),
    },
  };
}

function toPlanetEntry(raw, model, moonIds, mode) {
  const base = {
    id: raw.id,
    kind: "planet",
    name: raw.name || raw.inputs?.name || raw.id,
    orbitAu: model.inputs.semiMajorAxisAu,
    moonIds,
  };

  if (mode === "summary") {
    return {
      ...base,
      radiusEarth: model.derived.radiusEarth,
      surfaceTempK: model.derived.surfaceTempK,
      orbitalPeriodEarthDays: model.derived.orbitalPeriodEarthDays,
      localDaysPerYear: model.derived.localDaysPerYear,
    };
  }

  return {
    ...base,
    source: shallowCloneRaw(raw),
    model,
  };
}

function toGasGiantEntry(raw, model, moonIds, mode) {
  const base = {
    id: raw.id,
    kind: "gasGiant",
    name: raw.name || raw.id,
    orbitAu: model.inputs.orbitAu,
    moonIds,
  };

  if (mode === "summary") {
    return {
      ...base,
      radiusRj: model.physical.radiusRj,
      effectiveTempK: model.thermal.effectiveTempK,
      orbitalPeriodYears: model.orbital.orbitalPeriodYears,
      ringType: model.ringProperties.ringType,
    };
  }

  return {
    ...base,
    source: shallowCloneRaw(raw),
    model,
  };
}

function toMoonEntry(raw, model, parentKind, mode) {
  const base = {
    id: raw.id,
    kind: "moon",
    parentId: raw.planetId,
    parentKind,
    name: raw.name || raw.inputs?.name || raw.id,
    orbitKm: model.inputs.semiMajorAxisKm,
  };

  if (mode === "summary") {
    return {
      ...base,
      radiusMoon: model.physical.radiusMoon,
      surfaceK: model.temperature.surfaceK,
      orbitalPeriodSiderealDays: model.orbit.orbitalPeriodSiderealDays,
    };
  }

  return {
    ...base,
    source: shallowCloneRaw(raw),
    model,
  };
}

export function buildWorldStarSystemContext(world) {
  const starConfig = resolveWorldStarConfig(world);
  const star = calcStar({
    massMsol: starConfig.massMsol,
    ageGyr: starConfig.ageGyr,
    metallicityFeH: starConfig.metallicityFeH,
    radiusRsolOverride: starConfig.radiusRsolOverride,
    luminosityLsolOverride: starConfig.luminosityLsolOverride,
    tempKOverride: starConfig.tempKOverride,
    evolutionMode: starConfig.evolutionMode,
  });

  const system = calcSystem({
    starMassMsol: starConfig.massMsol,
    spacingFactor: Number(world?.system?.spacingFactor ?? 0.33),
    orbit1Au: Number(world?.system?.orbit1Au ?? 0.39),
    luminosityLsolOverride: star.luminosityLsol,
    radiusRsolOverride: star.radiusRsol,
  });

  return { starConfig, star, system };
}

/**
 * Build a normalized engine-level snapshot for a stored world.
 *
 * `summary` mode now derives lighter body-model projections directly rather
 * than computing full per-body outputs and trimming them afterward.
 *
 * @param {object} world
 * @param {{mode?: "summary"|"full"}} [options]
 * @returns {object}
 */
export function buildWorldSnapshot(world, options = {}) {
  const mode = sanitizeMode(options.mode);
  const detailLevel = sanitizeDetailLevel(mode);
  const includeMoonRadiation = detailLevel === "full";
  const context =
    options.context &&
    typeof options.context === "object" &&
    options.context.starConfig &&
    options.context.star &&
    options.context.system
      ? options.context
      : buildWorldStarSystemContext(world);
  const { starConfig, star, system } = context;

  const planetEntries = orderedItems(world?.planets);
  const gasGiantEntries = orderedItems(world?.system?.gasGiants);
  const moonEntries = orderedItems(world?.moons);
  const moonInputsByParentId = groupMoonInputsByParentId(moonEntries);
  const moonsByParentId = groupMoonIdsByParentId(moonEntries);
  const otherGiantsById = buildOtherGiantsById(gasGiantEntries);
  const rockyMoonParentOverridesById = new Map();
  const gasGiantMoonParentOverridesById = new Map();

  const gasGiantModels = gasGiantEntries.map((raw) => ({
    raw,
    model: calcGasGiant({
      ...raw,
      orbitAu: Number(raw.au ?? 5.2),
      starMassMsol: starConfig.massMsol,
      starLuminosityLsol: star.luminosityLsol,
      starAgeGyr: starConfig.ageGyr,
      starRadiusRsol: star.radiusRsol,
      stellarMetallicityFeH: starConfig.metallicityFeH,
      otherGiants: otherGiantsById.get(raw.id) || [],
      moons: moonInputsByParentId.get(raw.id) || [],
      detailLevel,
    }),
  }));
  const gasGiantModelsById = new Map(gasGiantModels.map((entry) => [entry.raw.id, entry.model]));

  const planetModels = planetEntries.map((raw) => ({
    raw,
    model: calcPlanetExact({
      starMassMsol: starConfig.massMsol,
      starAgeGyr: starConfig.ageGyr,
      starRadiusRsolOverride: starConfig.radiusRsolOverride,
      starLuminosityLsolOverride: starConfig.luminosityLsolOverride,
      starTempKOverride: starConfig.tempKOverride,
      starEvolutionMode: starConfig.evolutionMode,
      planet: raw.inputs || {},
      moons: moonInputsByParentId.get(raw.id) || [],
      gasGiants: gasGiantEntries,
      detailLevel,
    }),
  }));
  const planetModelsById = new Map(planetModels.map((entry) => [entry.raw.id, entry.model]));

  const moonModels = moonEntries.map((raw) => {
    const rockyParentModel = planetModelsById.get(raw.planetId);
    if (rockyParentModel) {
      if (!rockyMoonParentOverridesById.has(raw.planetId)) {
        rockyMoonParentOverridesById.set(
          raw.planetId,
          buildRockyMoonParentOverride(rockyParentModel, {
            includeRadiation: includeMoonRadiation,
          }),
        );
      }
      return {
        raw,
        parentKind: "planet",
        model: calcMoonExact({
          starMassMsol: starConfig.massMsol,
          starAgeGyr: starConfig.ageGyr,
          starRadiusRsolOverride: starConfig.radiusRsolOverride,
          starLuminosityLsolOverride: starConfig.luminosityLsolOverride,
          starTempKOverride: starConfig.tempKOverride,
          starEvolutionMode: starConfig.evolutionMode,
          moon: raw.inputs || {},
          parentOverride: rockyMoonParentOverridesById.get(raw.planetId),
          detailLevel,
        }),
      };
    }

    const gasParentModel = gasGiantModelsById.get(raw.planetId);
    if (gasParentModel) {
      if (!gasGiantMoonParentOverridesById.has(raw.planetId)) {
        gasGiantMoonParentOverridesById.set(
          raw.planetId,
          buildGasGiantMoonParentOverride(gasParentModel, {
            includeRadiation: includeMoonRadiation,
          }),
        );
      }
      return {
        raw,
        parentKind: "gasGiant",
        model: calcMoonExact({
          starMassMsol: starConfig.massMsol,
          starAgeGyr: starConfig.ageGyr,
          starRadiusRsolOverride: starConfig.radiusRsolOverride,
          starLuminosityLsolOverride: starConfig.luminosityLsolOverride,
          starTempKOverride: starConfig.tempKOverride,
          starEvolutionMode: starConfig.evolutionMode,
          moon: raw.inputs || {},
          parentOverride: gasGiantMoonParentOverridesById.get(raw.planetId),
          detailLevel,
        }),
      };
    }

    throw new Error(`Moon "${raw.id}" references unknown parent "${raw.planetId}".`);
  });

  const planetsById = Object.fromEntries(
    planetModels.map((entry) => [
      entry.raw.id,
      toPlanetEntry(entry.raw, entry.model, moonsByParentId[entry.raw.id] || [], mode),
    ]),
  );

  const gasGiantsById = Object.fromEntries(
    gasGiantModels.map((entry) => [
      entry.raw.id,
      toGasGiantEntry(entry.raw, entry.model, moonsByParentId[entry.raw.id] || [], mode),
    ]),
  );

  const moonsById = Object.fromEntries(
    moonModels.map((entry) => [
      entry.raw.id,
      toMoonEntry(entry.raw, entry.model, entry.parentKind, mode),
    ]),
  );

  const bodiesInOrbitOrder = sortByOrbit([
    ...Object.values(planetsById).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      orbitAu: entry.orbitAu,
    })),
    ...Object.values(gasGiantsById).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      orbitAu: entry.orbitAu,
    })),
  ]);

  return {
    star,
    system,
    planetsById,
    gasGiantsById,
    moonsById,
    bodiesInOrbitOrder,
    moonsByParentId,
    meta: {
      mode,
      worldVersion: Number.isFinite(Number(world?.version)) ? Number(world.version) : null,
      selectedBodyType: world?.selectedBodyType || null,
      counts: {
        planets: planetModels.length,
        gasGiants: gasGiantModels.length,
        moons: moonModels.length,
      },
      evaluation: {
        detailLevel,
        groupedMoonInputs: true,
        reusedParentModels: true,
        reusedParentOverrides: true,
        reusedStarSystemContext: context === options.context,
      },
    },
  };
}
