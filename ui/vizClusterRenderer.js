/**
 * Cluster snapshot builder for the local-cluster visualiser.
 */

import { calcLocalCluster } from "../engine/localCluster.js";
import { normalizeClusterObjectKey } from "./clusterObjectVisuals.js";
import { getClusterAdjustments, getClusterInputs, loadWorld } from "./store.js";

/* ── Snapshot builder ────────────────────────────────────────── */

export function buildClusterSnapshot() {
  const world = loadWorld();
  const model = calcLocalCluster(getClusterInputs(world));
  const adjustments = getClusterAdjustments(world);
  const baseSystems = applyClusterAdjustments(model.systems, adjustments);
  const customNames =
    world?.clusterSystemNames && typeof world.clusterSystemNames === "object"
      ? world.clusterSystemNames
      : {};
  const homeSystemName =
    typeof world?.star?.name === "string" && world.star.name.trim()
      ? world.star.name.trim()
      : "home star system";
  const systems = baseSystems.map((system) => ({
    ...system,
    name: (() => {
      const override = String(customNames?.[system.id] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (override) return override.slice(0, 80);
      return system.isHome ? homeSystemName : system.name;
    })(),
    distanceLy: Number(system.distanceLy) || 0,
    objectClassKey: normalizeClusterObjectKey(system.objectClassKey, { isHome: system.isHome }),
  }));
  return {
    model,
    systems,
    radiusLy: Math.max(1, Number(model.inputs.neighbourhoodRadiusLy) || 1),
    systemCount: systems.length,
    generatedCount: Math.max(0, systems.length - 1),
  };
}

function applyClusterAdjustments(engineSystems, adjustments) {
  const removedSet = new Set(adjustments.removedSystemIds);
  const systems = [];
  for (const sys of engineSystems) {
    if (removedSet.has(sys.id)) continue;
    const override = adjustments.componentOverrides[sys.id];
    if (override) {
      systems.push({
        ...sys,
        components: override.components,
        multiplicity: override.multiplicity,
      });
    } else {
      systems.push(sys);
    }
  }
  for (const sys of adjustments.addedSystems) {
    systems.push(sys);
  }
  return systems;
}
