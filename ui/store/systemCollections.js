export function makeCollection(list, idPrefix) {
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

export function listFromCollection(coll) {
  if (!coll || typeof coll !== "object") return [];
  const order = Array.isArray(coll.order) ? coll.order : [];
  const byId = coll.byId && typeof coll.byId === "object" ? coll.byId : {};
  return order.map((id) => byId[id]).filter(Boolean);
}

export function normalizeDebrisDisk(raw, idx = 1) {
  const inner = Number(raw?.innerAu ?? raw?.inner ?? 0);
  const outer = Number(raw?.outerAu ?? raw?.outer ?? 0);
  const innerAu = Number.isFinite(inner) ? Math.max(0, inner) : 0;
  const outerAu = Number.isFinite(outer) ? Math.max(0, outer) : 0;
  const rawEcc = raw?.eccentricity ?? null;
  const parsedEcc = Number(rawEcc);
  const eccentricity =
    rawEcc != null && Number.isFinite(parsedEcc) && parsedEcc >= 0 && parsedEcc <= 0.5
      ? parsedEcc
      : null;
  const rawInc = raw?.inclination ?? raw?.inclinationDeg ?? null;
  const parsedInc = Number(rawInc);
  const inclination =
    rawInc != null && Number.isFinite(parsedInc) && parsedInc >= 0 && parsedInc <= 90
      ? parsedInc
      : null;
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

export function normalizeClusterSystemNames(raw) {
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

export function getGasGiants(world, normalizeGasGiant = defaultNormalizeGasGiant) {
  const gs = world?.system?.gasGiants;
  if (Array.isArray(gs)) {
    return gs.map((g, i) => normalizeGasGiant(g, i + 1)).filter((g) => g.au > 0);
  }
  return listFromCollection(gs)
    .map((g, i) => normalizeGasGiant(g, i + 1))
    .filter((g) => g.au > 0);
}

export function getDebrisDisks(world) {
  const ds = world?.system?.debrisDisks;
  if (Array.isArray(ds)) return ds.map((d, i) => normalizeDebrisDisk(d, i + 1));
  return listFromCollection(ds).map((d, i) => normalizeDebrisDisk(d, i + 1));
}

export function canonicalizeSystemFeatures(
  world,
  { normalizeGasGiant = defaultNormalizeGasGiant } = {},
) {
  if (!world.system || typeof world.system !== "object") world.system = {};

  let gasGiants = getGasGiants(world, normalizeGasGiant)
    .filter((g) => Number.isFinite(g.au) && g.au > 0)
    .sort((a, b) => a.au - b.au);

  const seenAu = new Set();
  gasGiants = gasGiants.filter((g) => {
    const key = g.au.toFixed(2);
    if (seenAu.has(key)) return false;
    seenAu.add(key);
    return true;
  });

  let debrisDisks = getDebrisDisks(world);
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
import { normalizeGasGiant as defaultNormalizeGasGiant } from "./gasGiantModel.js";
