// SPDX-License-Identifier: MPL-2.0
const ICON_BASE = "./assets/icons";

export const CLUSTER_OBJECT_VISUALS = Object.freeze({
  HOME: Object.freeze({
    key: "HOME",
    label: "Home System",
    icon: `${ICON_BASE}/cluster-home.svg`,
    color: "#ffd68f",
  }),
  O: Object.freeze({
    key: "O",
    label: "O-Type Star",
    icon: `${ICON_BASE}/cluster-o.svg`,
    color: "#9bb0ff",
  }),
  B: Object.freeze({
    key: "B",
    label: "B-Type Star",
    icon: `${ICON_BASE}/cluster-b.svg`,
    color: "#aabfff",
  }),
  A: Object.freeze({
    key: "A",
    label: "A-Type Star",
    icon: `${ICON_BASE}/cluster-a.svg`,
    color: "#cad7ff",
  }),
  F: Object.freeze({
    key: "F",
    label: "F-Type Star",
    icon: `${ICON_BASE}/cluster-f.svg`,
    color: "#f8f7ff",
  }),
  G: Object.freeze({
    key: "G",
    label: "G-Type Star",
    icon: `${ICON_BASE}/cluster-g.svg`,
    color: "#fff4ea",
  }),
  K: Object.freeze({
    key: "K",
    label: "K-Type Star",
    icon: `${ICON_BASE}/cluster-k.svg`,
    color: "#ffd2a1",
  }),
  M: Object.freeze({
    key: "M",
    label: "M-Type Star",
    icon: `${ICON_BASE}/cluster-m.svg`,
    color: "#ffcc6f",
  }),
  D: Object.freeze({
    key: "D",
    label: "White Dwarf",
    icon: `${ICON_BASE}/cluster-d.svg`,
    color: "#e9f2ff",
  }),
  LTY: Object.freeze({
    key: "LTY",
    label: "Brown Dwarf (L/T/Y)",
    icon: `${ICON_BASE}/cluster-lty.svg`,
    color: "#c58b54",
  }),
  OTHER: Object.freeze({
    key: "OTHER",
    label: "Other Stellar-Mass Object",
    icon: `${ICON_BASE}/cluster-other.svg`,
    color: "#8e9bb4",
  }),
});

const DEFAULT_KEY = "OTHER";

export function normalizeClusterObjectKey(key, { isHome = false } = {}) {
  if (isHome) return "HOME";
  const raw = String(key || "")
    .trim()
    .toUpperCase();
  if (!raw) return DEFAULT_KEY;
  if (raw === "L/T/Y") return "LTY";
  if (raw === "-") return "OTHER";
  if (Object.prototype.hasOwnProperty.call(CLUSTER_OBJECT_VISUALS, raw)) return raw;
  return DEFAULT_KEY;
}

export function clusterObjectKeyFromSpectralClass(spectralClass, options) {
  return normalizeClusterObjectKey(spectralClass, options);
}

export function getClusterObjectVisual(key, options) {
  const resolved = normalizeClusterObjectKey(key, options);
  return CLUSTER_OBJECT_VISUALS[resolved] || CLUSTER_OBJECT_VISUALS[DEFAULT_KEY];
}
