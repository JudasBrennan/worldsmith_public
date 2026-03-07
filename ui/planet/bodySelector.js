import { fmt } from "../../engine/utils.js";
import { escapeHtml } from "../uiHelpers.js";

export function buildBodySelectorEntries(planets, gasGiants) {
  const entries = [];
  for (const planet of planets || []) {
    const au = Number(planet?.inputs?.semiMajorAxisAu) || 0;
    const mass = Number(planet?.inputs?.massEarth) || 1;
    entries.push({
      type: "planet",
      id: planet.id,
      name: planet.name || planet.inputs?.name || planet.id,
      au,
      isDwarf: mass < 0.01,
      value: `planet:${planet.id}`,
    });
  }
  for (const giant of gasGiants || []) {
    entries.push({
      type: "gasGiant",
      id: giant.id,
      name: giant.name || giant.id,
      au: Number(giant.au) || 0,
      value: `gasGiant:${giant.id}`,
    });
  }
  return entries.sort((a, b) => a.au - b.au);
}

export function buildBodySelectorOptions(entries) {
  return (entries || []).map((entry) => {
    const bodyTypeLabel = entry.type === "planet" ? (entry.isDwarf ? "D" : "R") : "G";
    return {
      value: entry.value,
      label: `[${bodyTypeLabel}] ${entry.name} (${fmt(entry.au, 3)} AU)`,
    };
  });
}

export function renderBodySelectorOptions(entries, selectedValue) {
  return buildBodySelectorOptions(entries)
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          option.value === selectedValue ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`,
    )
    .join("");
}
