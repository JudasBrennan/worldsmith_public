export const RESERVED_IMPORT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObjectLike(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeImportedValue(value, errors = null, path = "") {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeImportedValue(item, errors, `${path}[${index}]`));
  }

  if (!isPlainObjectLike(value)) {
    return value;
  }

  const out = {};
  for (const [key, rawChild] of Object.entries(value)) {
    if (RESERVED_IMPORT_KEYS.has(key)) {
      if (Array.isArray(errors)) {
        const location = path || "root";
        errors.push(`Import JSON contains reserved key "${key}" at ${location}.`);
      }
      continue;
    }
    const childPath = path ? `${path}.${key}` : key;
    out[key] = sanitizeImportedValue(rawChild, errors, childPath);
  }
  return out;
}

export function stripLegacyKeys(world) {
  if (!world || typeof world !== "object") return world;
  const stripped = JSON.parse(JSON.stringify(world));
  delete stripped.planet;
  delete stripped.moon;
  delete stripped.planetsSingle;
  delete stripped.moonsSingle;
  return stripped;
}

export function validateEnvelope(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Import data is not an object."] };
  }

  const sanitized = sanitizeImportedValue(obj, errors);
  const isEnvelope = !!(
    sanitized.world &&
    typeof sanitized.world === "object" &&
    !Array.isArray(sanitized.world)
  );
  const world = isEnvelope ? sanitized.world : sanitized;

  if (!world || typeof world !== "object" || Array.isArray(world)) {
    errors.push("Missing import world object.");
  }
  const normalizedWorld = world || {};

  const hasKnownWorldSection =
    (normalizedWorld.star && typeof normalizedWorld.star === "object") ||
    (normalizedWorld.system && typeof normalizedWorld.system === "object") ||
    (normalizedWorld.planets && typeof normalizedWorld.planets === "object") ||
    (normalizedWorld.planet && typeof normalizedWorld.planet === "object") ||
    (normalizedWorld.moons && typeof normalizedWorld.moons === "object") ||
    (normalizedWorld.moon && typeof normalizedWorld.moon === "object") ||
    Number.isFinite(Number(normalizedWorld.version));
  if (!hasKnownWorldSection) {
    errors.push("Import JSON is not a recognised WorldSmith world format.");
  }

  if (
    normalizedWorld.star != null &&
    (typeof normalizedWorld.star !== "object" || Array.isArray(normalizedWorld.star))
  ) {
    errors.push("'star' must be an object.");
  }
  if (
    normalizedWorld.system != null &&
    (typeof normalizedWorld.system !== "object" || Array.isArray(normalizedWorld.system))
  ) {
    errors.push("'system' must be an object.");
  }
  if (
    normalizedWorld.planets != null &&
    (typeof normalizedWorld.planets !== "object" || Array.isArray(normalizedWorld.planets))
  ) {
    errors.push("'planets' must be an object.");
  }
  if (
    normalizedWorld.planet != null &&
    (typeof normalizedWorld.planet !== "object" || Array.isArray(normalizedWorld.planet))
  ) {
    errors.push("'planet' must be an object.");
  }
  if (
    normalizedWorld.moons != null &&
    (typeof normalizedWorld.moons !== "object" || Array.isArray(normalizedWorld.moons))
  ) {
    errors.push("'moons' must be an object.");
  }
  if (
    normalizedWorld.moon != null &&
    (typeof normalizedWorld.moon !== "object" || Array.isArray(normalizedWorld.moon))
  ) {
    errors.push("'moon' must be an object.");
  }

  const planetsById = normalizedWorld.planets?.byId;
  if (planetsById && (typeof planetsById !== "object" || Array.isArray(planetsById))) {
    errors.push("'planets.byId' must be an object.");
  }
  const moonsById = normalizedWorld.moons?.byId;
  if (moonsById && (typeof moonsById !== "object" || Array.isArray(moonsById))) {
    errors.push("'moons.byId' must be an object.");
  }

  return { ok: errors.length === 0, errors, isEnvelope, world };
}
