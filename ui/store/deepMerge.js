import { RESERVED_IMPORT_KEYS } from "./importValidation.js";

export function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (typeof a !== "object" || a === null) return b ?? a;
  const out = { ...a };
  for (const [key, value] of Object.entries(b || {})) {
    if (RESERVED_IMPORT_KEYS.has(key)) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof a[key] === "object" &&
      a[key] !== null
    ) {
      out[key] = deepMerge(a[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function mergeDefaults(defaults, value) {
  return deepMerge(defaults, value || {});
}
