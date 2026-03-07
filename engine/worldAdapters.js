import { buildWorldSnapshot, buildWorldStarSystemContext } from "./worldSnapshot.js";
import { bondToGeometricAlbedo, classifyBodyType } from "./apparent.js";

const MOON_PHASE_INTEGRAL = 0.9;
export const SNAPSHOT_MODE_BUDGETS = Object.freeze({
  importPreview: "summary",
  systemPoster: "full",
  apparentPage: "full",
  apparentSelectors: "summary",
});

function gasGiantAlbedo(style) {
  switch (String(style || "").toLowerCase()) {
    case "jupiter":
      return 0.538;
    case "saturn":
      return 0.499;
    case "ice":
      return 0.45;
    case "hot":
    case "hot-jupiter":
      return 0.4;
    default:
      return 0.45;
  }
}

function requireFullEntry(entry, label) {
  if (!entry?.model || !entry?.source) {
    throw new Error(`${label} requires a full world snapshot entry.`);
  }
  return entry;
}

function orderedCollectionValues(section) {
  if (!section || typeof section !== "object") return [];
  const byId = section.byId && typeof section.byId === "object" ? section.byId : {};
  const order = Array.isArray(section.order) ? section.order : Object.keys(byId);
  return order.map((id) => byId[id]).filter(Boolean);
}

function toFiniteOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildDebrisRanges(world, rawWorld) {
  const normalizedRanges = orderedCollectionValues(world?.system?.debrisDisks)
    .map((disk) => ({
      name: disk?.name || "Debris disk",
      inner: Number(disk?.innerAu ?? disk?.inner),
      outer: Number(disk?.outerAu ?? disk?.outer),
    }))
    .filter((disk) => Number.isFinite(disk.inner) && Number.isFinite(disk.outer))
    .map((disk) => ({
      ...disk,
      inner: Math.min(disk.inner, disk.outer),
      outer: Math.max(disk.inner, disk.outer),
    }));

  if (normalizedRanges.length) return normalizedRanges;

  const legacyOuter = Number(
    rawWorld?.system?.debrisDiskOuterAu ?? rawWorld?.system?.debrisOuterAu,
  );
  if (!Number.isFinite(legacyOuter)) return [];

  const legacyInner = Number(
    rawWorld?.system?.debrisDiskInnerAu ?? rawWorld?.system?.debrisInnerAu ?? legacyOuter,
  );
  if (!Number.isFinite(legacyInner)) return [];

  return [
    {
      name: "Debris disk",
      inner: Math.min(legacyInner, legacyOuter),
      outer: Math.max(legacyInner, legacyOuter),
    },
  ];
}

/**
 * Build the Import/Export preview summary from a normalized world using the
 * engine snapshot layer. `rawWorld` can be provided to preserve legacy preview
 * fields that are display-only, such as old star class aliases or scalar debris
 * disk values accepted by import validation.
 *
 * @param {object} world
 * @param {{rawWorld?: object}} [options]
 * @returns {object}
 */
export function buildImportPreviewSummary(world, { rawWorld = world } = {}) {
  const snapshot = buildWorldSnapshot(world, { mode: SNAPSHOT_MODE_BUDGETS.importPreview });
  const planets = orderedCollectionValues(world?.planets);
  const gasGiants = Object.values(snapshot.gasGiantsById || {});
  const debrisRanges = buildDebrisRanges(world, rawWorld);
  const tectonics =
    world?.tectonics && typeof world.tectonics === "object" ? world.tectonics : null;
  const population =
    world?.population && typeof world.population === "object" ? world.population : null;
  const climate = world?.climate && typeof world.climate === "object" ? world.climate : null;
  const calendar = world?.calendar && typeof world.calendar === "object" ? world.calendar : null;
  const assigned = planets.filter((planet) => planet?.slotIndex != null).length;
  const gasAuList = gasGiants
    .map((entry) => Number(entry?.orbitAu))
    .filter((orbitAu) => Number.isFinite(orbitAu) && orbitAu > 0);

  return {
    spec: String(
      rawWorld?.star?.spectralClass || rawWorld?.star?.class || snapshot.star?.spectralClass || "",
    ).trim(),
    starMass: toFiniteOrNull(
      rawWorld?.star?.massMsol ?? rawWorld?.star?.mass ?? snapshot.star?.inputs?.massMsol,
    ),
    starAge: toFiniteOrNull(
      rawWorld?.star?.ageGyr ?? rawWorld?.star?.age ?? snapshot.star?.inputs?.ageGyr,
    ),
    planets: snapshot.meta?.counts?.planets ?? planets.length,
    moons: snapshot.meta?.counts?.moons ?? Object.keys(snapshot.moonsById || {}).length,
    assigned,
    unassigned: (snapshot.meta?.counts?.planets ?? planets.length) - assigned,
    gasCount: snapshot.meta?.counts?.gasGiants ?? gasGiants.length,
    gas: gasAuList.length ? Math.max(...gasAuList) : null,
    debrisCount: debrisRanges.length,
    debrisRanges,
    hasTectonics: !!tectonics,
    tecRanges: Array.isArray(tectonics?.mountainRanges) ? tectonics.mountainRanges.length : 0,
    tecVolcanoes: Array.isArray(tectonics?.shieldVolcanoes) ? tectonics.shieldVolcanoes.length : 0,
    tecRifts: Array.isArray(tectonics?.riftValleys) ? tectonics.riftValleys.length : 0,
    tecInactive: Array.isArray(tectonics?.inactiveRanges) ? tectonics.inactiveRanges.length : 0,
    hasPopulation: !!population,
    popTechEra: population?.techEra || null,
    hasClimate: !!climate,
    climAltitude: climate ? Number(climate.altitudeM) || 0 : 0,
    hasCalendar: !!calendar,
  };
}

function buildGuidedPosterWorld(world, systemModel) {
  const planets = world?.planets;
  const planetsById = planets?.byId && typeof planets.byId === "object" ? planets.byId : {};
  const orbitSlots = Array.isArray(systemModel?.orbitsAu) ? systemModel.orbitsAu : [];
  let nextPlanetsById = null;

  for (const planet of orderedCollectionValues(planets)) {
    if (planet?.slotIndex == null) continue;
    const slotAu = Number(orbitSlots[planet.slotIndex - 1]);
    if (!(Number.isFinite(slotAu) && slotAu > 0)) continue;
    const current = planetsById[planet.id];
    if (!current) continue;
    if (Number(current.inputs?.semiMajorAxisAu) === slotAu) continue;
    if (!nextPlanetsById) nextPlanetsById = { ...planetsById };
    nextPlanetsById[planet.id] = {
      ...current,
      inputs: {
        ...(current.inputs || {}),
        semiMajorAxisAu: slotAu,
      },
    };
  }

  if (!nextPlanetsById) return world;

  return {
    ...world,
    planets: {
      ...(planets || {}),
      byId: nextPlanetsById,
    },
  };
}

/**
 * Build System-page poster inputs from the engine snapshot layer.
 *
 * Guided mode projects assigned rocky planets onto their active slot AU values
 * before deriving the full snapshot so rocky-body and moon models stay aligned
 * with the poster layout.
 *
 * @param {object} world
 * @param {{orbitMode?: "guided"|"manual"}} [options]
 * @returns {{snapshot: object, effectiveWorld: object, posterData: object}}
 */
export function buildSystemPosterSnapshotInputs(world, { orbitMode = "guided" } = {}) {
  const baseContext = buildWorldStarSystemContext(world);
  const manualMode = orbitMode === "manual";
  const effectiveWorld = manualMode ? world : buildGuidedPosterWorld(world, baseContext.system);
  const snapshot = buildWorldSnapshot(effectiveWorld, {
    mode: SNAPSHOT_MODE_BUDGETS.systemPoster,
    context: baseContext,
  });

  const includedPlanetIds = new Set(
    orderedCollectionValues(effectiveWorld?.planets)
      .filter((planet) => manualMode || planet?.slotIndex != null)
      .map((planet) => planet.id),
  );

  const planets = Object.values(snapshot.planetsById || {})
    .filter((entry) => includedPlanetIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      au: Number(entry.model?.inputs?.semiMajorAxisAu),
      radiusKm: Number(entry.model?.derived?.radiusKm),
      dayHex: entry.model?.derived?.skyColourDayHex || "#9bbbe0",
      horizonHex: entry.model?.derived?.skyColourHorizonHex || "#6a6a6a",
      source: entry.source,
      model: entry.model,
    }))
    .filter((entry) => Number.isFinite(entry.au) && entry.au > 0);

  const gasGiants = Object.values(snapshot.gasGiantsById || {})
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      au: Number(entry.model?.inputs?.orbitAu),
      radiusKm: Number(entry.model?.physical?.radiusKm),
      style: entry.source?.style,
      rings: !!entry.source?.rings,
      gasCalc: entry.model,
      source: entry.source,
    }))
    .filter((entry) => Number.isFinite(entry.au) && entry.au > 0);

  const moons = Object.values(snapshot.moonsById || {})
    .filter((entry) => entry.parentId != null)
    .map((entry) => ({
      parentId: entry.parentId,
      name: entry.name || entry.source?.name || entry.source?.inputs?.name || "",
      radiusMoon: Number(entry.model?.physical?.radiusMoon),
      moonCalc: entry.model,
      source: entry.source,
    }));

  const debrisDisks = orderedCollectionValues(effectiveWorld?.system?.debrisDisks).map((disk) => ({
    innerAu: Math.min(
      Number(disk?.innerAu ?? disk?.inner ?? 0),
      Number(disk?.outerAu ?? disk?.outer ?? 0),
    ),
    outerAu: Math.max(
      Number(disk?.innerAu ?? disk?.inner ?? 0),
      Number(disk?.outerAu ?? disk?.outer ?? 0),
    ),
    name: disk?.name || "Debris disk",
  }));

  return {
    snapshot,
    effectiveWorld,
    meta: {
      snapshotMode: SNAPSHOT_MODE_BUDGETS.systemPoster,
      orbitMode: manualMode ? "manual" : "guided",
      reusedStarSystemContext: true,
      guidedOrbitProjection: !manualMode,
      effectiveWorldReused: effectiveWorld === world,
    },
    posterData: {
      star: snapshot.star,
      system: snapshot.system,
      planets,
      gasGiants,
      moons,
      debrisDisks,
    },
  };
}

/**
 * Adapt a full world snapshot into the apparent-engine inputs used by the
 * Apparent Size page.
 *
 * @param {object} snapshot
 * @param {{homePlanetId?: string, distanceByBodyId?: Record<string, number>, moonPhaseDeg?: number}} [options]
 * @returns {object}
 */
export function buildApparentSnapshotInputs(
  snapshot,
  { homePlanetId = "", distanceByBodyId = {}, moonPhaseDeg = 0 } = {},
) {
  const fullSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const planetEntries = Object.values(fullSnapshot.planetsById || {}).map((entry) =>
    requireFullEntry(entry, "Planet adapter"),
  );
  const gasGiantEntries = Object.values(fullSnapshot.gasGiantsById || {}).map((entry) =>
    requireFullEntry(entry, "Gas giant adapter"),
  );

  const planets = planetEntries
    .map((entry) => {
      const raw = entry.source?.inputs || {};
      const derived = entry.model?.derived || {};
      const radiusKm = Number(derived.radiusKm);
      const orbitAu = Number(entry.model?.inputs?.semiMajorAxisAu);
      const hasAtmosphere = Number(raw.pressureAtm ?? 0) > 0.01;
      const bodyType = classifyBodyType(radiusKm, hasAtmosphere);
      const bondAlbedo = Number(raw.albedoBond ?? 0.3);

      return {
        id: `planet:${entry.id}`,
        kind: "planet",
        name: entry.name,
        classLabel: "Planet",
        orbitAu,
        radiusKm,
        geometricAlbedo: bondToGeometricAlbedo(bondAlbedo, bodyType),
        hasAtmosphere,
        skyDayHex: derived.skyColourDayHex || null,
        skyDayEdgeHex: derived.skyColourDayEdgeHex || null,
        skyHorizonHex: derived.skyColourHorizonHex || null,
        _derived: derived,
        _planetInputs: raw,
      };
    })
    .filter((entry) => Number.isFinite(entry.orbitAu) && entry.orbitAu > 0);

  const gasGiants = gasGiantEntries
    .map((entry) => {
      const raw = entry.source || {};
      return {
        id: `gas:${entry.id}`,
        kind: "gas",
        name: entry.name,
        classLabel: "Gas giant",
        orbitAu: Number(entry.model?.inputs?.orbitAu),
        radiusKm: Number(entry.model?.physical?.radiusKm),
        geometricAlbedo: gasGiantAlbedo(raw.style),
        hasAtmosphere: true,
        _styleId: raw.style || "jupiter",
      };
    })
    .filter((entry) => Number.isFinite(entry.orbitAu) && entry.orbitAu > 0);

  const allBodies = [...planets, ...gasGiants].sort((left, right) => left.orbitAu - right.orbitAu);
  const selectedHomePlanet = planets.find((entry) => entry.id === `planet:${homePlanetId}`) || null;
  const homeOrbitAu = selectedHomePlanet?.orbitAu || 1;

  const orbitSamples = allBodies
    .filter((entry) => entry.id !== selectedHomePlanet?.id)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      orbitAu: entry.orbitAu,
    }));

  const bodySamples = allBodies
    .filter((entry) => entry.id !== selectedHomePlanet?.id)
    .map((entry) => {
      const currentDistanceAu = Number(distanceByBodyId?.[entry.id]);
      return {
        ...entry,
        currentDistanceAu: Number.isFinite(currentDistanceAu) ? currentDistanceAu : undefined,
      };
    });

  const moonIds = Array.isArray(fullSnapshot.moonsByParentId?.[homePlanetId])
    ? fullSnapshot.moonsByParentId[homePlanetId]
    : [];

  const moonSamples = moonIds
    .map((moonId) => requireFullEntry(fullSnapshot.moonsById?.[moonId], "Moon adapter"))
    .map((entry) => {
      const raw = entry.source?.inputs || {};
      return {
        name: entry.name,
        semiMajorAxisKm: Number(entry.model?.inputs?.semiMajorAxisKm) || 384748,
        radiusMoon: Number(entry.model?.physical?.radiusMoon) || 1,
        geometricAlbedo: (Number(raw.albedo) || 0.11) / MOON_PHASE_INTEGRAL,
        phaseDeg: moonPhaseDeg,
        moonCalc: entry.model,
      };
    });

  return {
    starMassMsol: Number(fullSnapshot.star?.inputs?.massMsol ?? 1),
    starAgeGyr: Number(fullSnapshot.star?.inputs?.ageGyr ?? 4.6),
    starModel: fullSnapshot.star || null,
    homeOrbitAu,
    selectedHomePlanet,
    planets,
    allBodies,
    orbitSamples,
    bodySamples,
    moonSamples,
    homeSkyDayHex: selectedHomePlanet?.skyDayHex || null,
    homeSkyDayEdgeHex: selectedHomePlanet?.skyDayEdgeHex || null,
    homeSkyHorizonHex: selectedHomePlanet?.skyHorizonHex || null,
  };
}
