import { fmt } from "../../engine/utils.js";
import { createElement, replaceChildren, replaceSelectOptions } from "../domHelpers.js";

function tipIconNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function textCell(text, attrs = {}) {
  return createElement("td", { attrs, text: text == null ? "" : String(text) });
}

function formatSolReferenceAngularLabel(ref) {
  if (ref?.angDiamArcmin != null) return `${Number(ref.angDiamArcmin).toFixed(1)}′`;
  if (ref?.angDiamArcsec != null) return `${ref.angDiamArcsec}″`;
  return "—";
}

function distanceInputNode(row) {
  const input = createElement("input", {
    className: "cluster-name-input",
    attrs: {
      type: "number",
      min: row?.minDistanceAu,
      max: row?.maxDistanceAu,
      step: "0.001",
      title: `min ${fmt(row?.minDistanceAu, 3)} AU, max ${fmt(row?.maxDistanceAu, 3)} AU`,
    },
    dataset: { distanceId: row?.id || "" },
  });
  input.value = String(row?.currentDistanceAu ?? "");
  return input;
}

export function renderApparentHomeSelector(selectEl, planets = [], selectedPlanetId = "") {
  const normalizedPlanets = Array.isArray(planets) ? planets : [];
  if (!normalizedPlanets.length) {
    replaceSelectOptions(selectEl, [{ value: "", label: "No planets" }]);
    selectEl.value = "";
    return "";
  }

  const availableIds = new Set(
    normalizedPlanets.map((planet) => String(planet?.id || "")).filter(Boolean),
  );
  const nextValue = availableIds.has(String(selectedPlanetId || ""))
    ? String(selectedPlanetId || "")
    : String(normalizedPlanets[0]?.id || "");

  replaceSelectOptions(
    selectEl,
    normalizedPlanets.map((planet) => ({
      value: planet?.id || "",
      label: planet?.name || planet?.id || "Planet",
    })),
  );
  selectEl.value = nextValue;
  return nextValue;
}

export function renderApparentKpis(container, items = [], tipLabels = {}) {
  replaceChildren(
    container,
    (Array.isArray(items) ? items : []).map((item) =>
      createElement("div", { className: "kpi-wrap" }, [
        createElement("div", { className: "kpi" }, [
          createElement("div", { className: "kpi__label" }, [
            item?.label || "",
            tipLabels?.[item?.label] ? " " : "",
            tipIconNode(tipLabels?.[item?.label] || ""),
          ]),
          createElement("div", { className: "kpi__value", text: item?.value ?? "" }),
          createElement("div", { className: "kpi__meta", text: item?.meta ?? "" }),
        ]),
      ]),
    ),
  );
  return container;
}

export function renderApparentStarRows(tbody, rows = []) {
  replaceChildren(
    tbody,
    (Array.isArray(rows) ? rows : []).map((row) =>
      createElement("tr", {}, [
        textCell(row?.name),
        textCell(fmt(row?.orbitAu, 4)),
        textCell(fmt(row?.magnitude, 4)),
        textCell(fmt(row?.brightnessRelativeToEarthSun, 6)),
        textCell(fmt(row?.apparentSizeRelativeToEarthSun, 6)),
        textCell(row?.angularDiameterLabel),
      ]),
    ),
  );
  return tbody;
}

export function renderApparentBodyRows(tbody, rows = []) {
  replaceChildren(
    tbody,
    (Array.isArray(rows) ? rows : []).map((row) =>
      createElement("tr", {}, [
        textCell(row?.name),
        textCell(row?.bodyTypeLabel || row?.classLabel),
        createElement("td", {}, [distanceInputNode(row)]),
        textCell(fmt(row?.phaseAngleDeg, 2)),
        textCell(Number.isFinite(row?.apparentMagnitude) ? fmt(row.apparentMagnitude, 2) : "NA"),
        textCell(row?.angularDiameterLabel),
        textCell(row?.observable),
        textCell(row?.visibility),
      ]),
    ),
  );
  return tbody;
}

export function renderApparentMoonRows(tbody, rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (!normalizedRows.length) {
    replaceChildren(tbody, [
      createElement("tr", {}, [
        textCell("No moons assigned to home world", {
          colspan: "7",
          style: "text-align:center;color:var(--muted)",
        }),
      ]),
    ]);
    return tbody;
  }

  replaceChildren(
    tbody,
    normalizedRows.map((row) =>
      createElement("tr", {}, [
        textCell(row?.name),
        textCell(fmt(row?.absoluteMagnitude, 4)),
        textCell(
          Number.isFinite(row?.apparentMagnitude) ? fmt(row.apparentMagnitude, 2) : "Invisible",
        ),
        textCell(row?.angularDiameterLabel),
        textCell(
          Number.isFinite(row?.brightnessRelativeToFullMoon)
            ? fmt(row.brightnessRelativeToFullMoon, 4)
            : "NA",
        ),
        textCell(fmt(row?.apparentSizeRelativeToReference, 4)),
        textCell(row?.eclipseType),
      ]),
    ),
  );
  return tbody;
}

export function renderApparentSolRefRows(tbody, refs = []) {
  replaceChildren(
    tbody,
    (Array.isArray(refs) ? refs : []).map((ref) =>
      createElement("tr", {}, [
        textCell(ref?.name),
        textCell(fmt(ref?.appMag, 2)),
        textCell(formatSolReferenceAngularLabel(ref)),
        textCell(ref?.note),
      ]),
    ),
  );
  return tbody;
}
