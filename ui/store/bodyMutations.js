// SPDX-License-Identifier: MPL-2.0
function makeEntityId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function syncSelectedPlanetSnapshot(world) {
  const selectedPlanet = world.planets.byId[world.planets.selectedId];
  if (selectedPlanet) {
    world.planet = { ...selectedPlanet.inputs, name: selectedPlanet.name };
  }
}

function syncSelectedMoonSnapshot(world) {
  const selectedMoon = world.moons?.selectedId ? world.moons.byId?.[world.moons.selectedId] : null;
  if (selectedMoon) {
    world.moon = { ...selectedMoon.inputs, name: selectedMoon.name || selectedMoon.inputs?.name };
  }
}

export function selectPlanetInWorld(world, planetId) {
  if (!world.planets.byId[planetId]) return world;
  world.planets.selectedId = planetId;
  syncSelectedPlanetSnapshot(world);
  return world;
}

export function createPlanetInWorld(world, inputs, { name = "New Planet" } = {}) {
  const id = makeEntityId("p");
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
  return world;
}

export function deletePlanetInWorld(world, planetId) {
  if (!world.planets.byId[planetId]) return world;

  delete world.planets.byId[planetId];
  world.planets.order = world.planets.order.filter((id) => id !== planetId);

  const fallbackPlanetId = world.planets.order[0] || Object.keys(world.planets.byId)[0] || null;
  if (world.planets.selectedId === planetId || !world.planets.byId[world.planets.selectedId]) {
    world.planets.selectedId = fallbackPlanetId || "p1";
  }

  if (world.moons?.byId && typeof world.moons.byId === "object") {
    for (const moonId of Object.keys(world.moons.byId)) {
      const moon = world.moons.byId[moonId];
      if (!moon || moon.planetId !== planetId) continue;
      moon.planetId = null;
      moon.locked = false;
    }
    world.moons.order = (world.moons.order || []).filter((moonId) => !!world.moons.byId[moonId]);
    if (!world.moons.byId[world.moons.selectedId]) {
      world.moons.selectedId = world.moons.order[0] || Object.keys(world.moons.byId)[0] || null;
    }
  }

  syncSelectedPlanetSnapshot(world);
  syncSelectedMoonSnapshot(world);
  return world;
}

export function updatePlanetInWorld(world, planetId, patch) {
  const planet = world.planets.byId[planetId];
  if (!planet) return world;

  if (patch.name != null) planet.name = patch.name;
  if (patch.slotIndex !== undefined) planet.slotIndex = patch.slotIndex;
  if (patch.inputs) planet.inputs = { ...planet.inputs, ...patch.inputs };

  if (world.planets.selectedId === planetId) syncSelectedPlanetSnapshot(world);
  return world;
}

export function selectMoonInWorld(world, moonId) {
  if (!world.moons.byId[moonId]) return world;
  world.moons.selectedId = moonId;
  syncSelectedMoonSnapshot(world);
  return world;
}

export function createMoonInWorld(world, inputs, { name = "New Moon", planetId } = {}) {
  const id = makeEntityId("m");
  const parentId = planetId === undefined ? world.planets.selectedId || null : planetId || null;
  const moon = {
    id,
    name: name || inputs?.name || "New Moon",
    planetId: parentId,
    locked: false,
    inputs: { ...(inputs || {}) },
  };
  world.moons.byId[id] = moon;
  world.moons.order.push(id);
  world.moons.selectedId = id;
  world.moon = { ...moon.inputs, name: moon.name };
  return world;
}

export function deleteMoonInWorld(world, moonId) {
  if (!world.moons.byId[moonId]) return world;
  delete world.moons.byId[moonId];
  world.moons.order = world.moons.order.filter((id) => id !== moonId);
  if (world.moons.selectedId === moonId) {
    world.moons.selectedId = world.moons.order[0] || Object.keys(world.moons.byId)[0];
  }
  syncSelectedMoonSnapshot(world);
  return world;
}

export function updateMoonInWorld(world, moonId, patch) {
  const moon = world.moons.byId[moonId];
  if (!moon) return world;

  if (patch.name != null) moon.name = patch.name;
  if (Object.prototype.hasOwnProperty.call(patch, "locked")) {
    const nextLocked = !!patch.locked;
    moon.locked = moon.planetId == null ? false : nextLocked;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "planetId")) {
    const nextPlanetId =
      patch.planetId == null || patch.planetId === "" ? null : String(patch.planetId);
    if (
      (nextPlanetId == null || world.planets.byId[nextPlanetId]) &&
      (!moon.locked || nextPlanetId === moon.planetId)
    ) {
      moon.planetId = nextPlanetId;
      if (nextPlanetId == null) moon.locked = false;
    }
  }
  if (patch.inputs) moon.inputs = { ...moon.inputs, ...patch.inputs };

  if (world.moons.selectedId === moonId) syncSelectedMoonSnapshot(world);
  return world;
}

export function toggleMoonLockInWorld(world, moonId) {
  const moon = world.moons.byId[moonId];
  if (!moon) return world;
  if (moon.planetId == null) {
    moon.locked = false;
    return world;
  }
  moon.locked = !moon.locked;
  return world;
}

export function assignMoonToPlanetInWorld(world, moonId, planetIdOrNull, { force = false } = {}) {
  const moon = world.moons.byId[moonId];
  if (!moon) return world;

  const nextPlanetId =
    planetIdOrNull == null || planetIdOrNull === "" ? null : String(planetIdOrNull);
  const isValidParent =
    world.planets.byId[nextPlanetId] || world.system?.gasGiants?.byId?.[nextPlanetId];
  if (nextPlanetId != null && !isValidParent) return world;
  if (!force && moon.locked && nextPlanetId !== moon.planetId) return world;

  moon.planetId = nextPlanetId;
  if (nextPlanetId == null) moon.locked = false;
  if (world.moons.selectedId === moonId) syncSelectedMoonSnapshot(world);
  return world;
}

export function togglePlanetLockInWorld(world, planetId) {
  const planet = world.planets.byId[planetId];
  if (!planet) return world;
  planet.locked = !planet.locked;
  return world;
}

export function assignPlanetToSlotInWorld(world, planetId, slotIndexOrNull) {
  const planet = world.planets.byId[planetId];
  if (!planet) return world;

  if (slotIndexOrNull != null) {
    for (const otherId of world.planets.order) {
      if (otherId === planetId) continue;
      const other = world.planets.byId[otherId];
      if (other && other.slotIndex === slotIndexOrNull) other.slotIndex = null;
    }
  }

  planet.slotIndex = slotIndexOrNull;
  if (world.planets.selectedId === planetId) syncSelectedPlanetSnapshot(world);
  return world;
}
