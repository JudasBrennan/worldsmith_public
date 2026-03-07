import { fmt } from "../../engine/utils.js";
import { createElement, replaceChildren, replaceSelectOptions } from "../domHelpers.js";
import { buildBodySelectorOptions } from "./bodySelector.js";

function tipIconNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function hintNode(text) {
  return createElement("div", { className: "hint", text });
}

function tagNode(text, className = "veg-info-tag") {
  return createElement("span", { className, text });
}

function paragraphNode(children) {
  return createElement("p", {}, children);
}

function vegetationSection(title, children = [], className = "", attrs = {}) {
  return createElement("div", { className: `veg-info-section ${className}`.trim(), attrs }, [
    createElement("div", { className: "veg-info-heading", text: title }),
    ...children,
  ]);
}

function createVegetationGridTable(headers = [], rows = []) {
  return createElement("table", { className: "veg-grid-table" }, [
    createElement("thead", {}, [
      createElement("tr", {}, [
        createElement("th", { text: "Star" }),
        ...(headers || []).map((header) =>
          createElement("th", {}, [
            header?.label || "",
            header?.extrapolated ? " " : "",
            header?.extrapolated ? tagNode("E", "veg-info-tag veg-info-tag--extrap") : null,
          ]),
        ),
      ]),
    ]),
    createElement(
      "tbody",
      {},
      (rows || []).map((row) =>
        createElement("tr", {}, [
          createElement("td", { className: "veg-grid-star", text: row?.starLabel || "" }),
          ...(row?.cells || []).map((cell) =>
            createElement("td", { className: "veg-grid-cell" }, [
              cell?.stops?.length
                ? createElement("div", {
                    className: "veg-grid-swatch",
                    attrs: {
                      style: `background:linear-gradient(to right,${cell.stops.join(",")});`,
                    },
                  })
                : null,
              createElement("div", { className: "veg-grid-hex", text: cell?.label || "-" }),
            ]),
          ),
        ]),
      ),
    ),
  ]);
}

export function renderBodySelector(selectEl, entries, selectedValue) {
  replaceSelectOptions(selectEl, buildBodySelectorOptions(entries));
  const nextValue = String(selectedValue || "");
  selectEl.value = [...selectEl.options].some((option) => option.value === nextValue)
    ? nextValue
    : "";
  return selectEl;
}

export function buildPlanetSlotOptions({ orbitsAu, planets, gasGiants, debrisDisks, planet } = {}) {
  const assigned = new Map();
  for (const entry of planets || []) {
    const slotIndex = Number(entry?.slotIndex);
    if (Number.isFinite(slotIndex) && slotIndex > 0) assigned.set(slotIndex, entry);
  }

  const gasBySlot = new Map();
  const usedSlots = new Set();
  for (const giant of gasGiants || []) {
    let bestSlot = null;
    let bestDiff = Infinity;
    for (let index = 0; index < (orbitsAu || []).length; index += 1) {
      const slot = index + 1;
      if (usedSlots.has(slot)) continue;
      const diff = Math.abs((Number(orbitsAu[index]) || 0) - (Number(giant?.au) || 0));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSlot = slot;
      }
    }
    if (bestSlot != null) {
      gasBySlot.set(bestSlot, giant);
      usedSlots.add(bestSlot);
    }
  }

  const maxGasAu = (gasGiants || []).length
    ? Math.max(...gasGiants.map((giant) => Number(giant?.au) || 0))
    : 0;
  const maxDebrisAu = (debrisDisks || []).length
    ? Math.max(
        ...(debrisDisks || []).map((disk) =>
          Math.max(Number(disk?.innerAu) || 0, Number(disk?.outerAu) || 0),
        ),
      )
    : 0;
  const cutoffAu = Math.max(maxGasAu, maxDebrisAu, 0);
  const visible = (orbitsAu || [])
    .map((au, index) => ({ au, index }))
    .filter((entry) => cutoffAu <= 0 || entry.au <= cutoffAu);

  return [{ value: "", label: "Unassigned" }].concat(
    visible.map(({ au, index }) => {
      const slot = index + 1;
      const holder = assigned.get(slot);
      const giant = gasBySlot.get(slot);
      const isGas = Boolean(giant);
      const taken = holder && holder.id !== planet?.id;
      const suffix = holder ? ` - ${holder.name || holder.inputs?.name || holder.id}` : "";
      const gasSuffix = isGas ? ` - ${giant.name || "Gas giant"}` : "";
      return {
        value: String(slot),
        label: `Slot ${String(slot).padStart(2, "0")} (${fmt(au, 3)} AU)${suffix}${gasSuffix}`,
        disabled: Boolean(taken || isGas),
      };
    }),
  );
}

export function renderPlanetSlotSelector(selectEl, params = {}) {
  replaceSelectOptions(selectEl, buildPlanetSlotOptions(params));
  const selectedSlot = params?.planet?.slotIndex ? String(params.planet.slotIndex) : "";
  selectEl.value = [...selectEl.options].some((option) => option.value === selectedSlot)
    ? selectedSlot
    : "";
  return selectEl;
}

export function renderMoonSection(
  container,
  { bodyType = "planet", bodyId = "", moons = [], moonsTip = "" } = {},
) {
  const bodyLabel = bodyType === "gasGiant" ? "gas giant" : "planet";
  replaceChildren(container, [
    createElement("div", { className: "label" }, ["Moons ", tipIconNode(moonsTip)]),
    hintNode(`Moons belonging to this ${bodyLabel}.`),
    createElement(
      "div",
      { attrs: { id: "moonsList" } },
      moons.length
        ? moons.map((moon) =>
            createElement(
              "div",
              {
                className: "planet-card",
                attrs: { style: "cursor:pointer" },
                dataset: { moonId: moon?.id || "" },
              },
              [
                createElement("div", {}, [
                  createElement("div", {}, [
                    createElement("b", {
                      text: moon?.name || moon?.inputs?.name || moon?.id || "Moon",
                    }),
                  ]),
                  createElement("div", { className: "planet-card__meta", text: "Moon" }),
                ]),
                createElement("button", {
                  className: "small",
                  attrs: { type: "button" },
                  dataset: { action: "edit-moon", moonId: moon?.id || "" },
                  text: "Edit",
                }),
              ],
            ),
          )
        : [hintNode("No moons yet.")],
    ),
    createElement("div", { className: "button-row", attrs: { style: "margin-top:10px" } }, [
      createElement("button", {
        attrs: { id: "addMoonToBody", type: "button" },
        dataset: { bodyType, bodyId },
        text: `Add moon to this ${bodyLabel}`,
      }),
    ]),
  ]);
  return container;
}

export function renderBodyActionButtons(container, actions = []) {
  const normalizedActions = (actions || []).filter(Boolean);
  if (!normalizedActions.length) {
    replaceChildren(container, []);
    return container;
  }

  replaceChildren(container, [
    createElement(
      "div",
      { className: "button-row" },
      normalizedActions.map((action) =>
        createElement("button", {
          className: action?.className || "",
          attrs: {
            id: action?.id || null,
            type: action?.type || "button",
          },
          text: action?.label || "",
        }),
      ),
    ),
  ]);
  return container;
}

export function createRecipePickerOverlay({
  title = "Recipes",
  categories = [],
  recipes = [],
  showHints = false,
} = {}) {
  const normalizedRecipes = Array.isArray(recipes) ? recipes : [];
  const orderedCategories =
    categories && categories.length
      ? categories
      : [...new Set(normalizedRecipes.map((recipe) => recipe?.category).filter(Boolean))];

  return createElement("div", { className: "rp-picker-overlay" }, [
    createElement("div", { className: "rp-picker-dialog panel" }, [
      createElement("div", { className: "panel__header" }, [
        createElement("h2", { text: title }),
        createElement("button", {
          className: "small rp-picker-close",
          attrs: { type: "button" },
          text: "Close",
        }),
      ]),
      createElement("div", { className: "rp-picker-progress" }, [createElement("span")]),
      createElement(
        "div",
        { className: "panel__body" },
        orderedCategories.flatMap((category) => [
          createElement("div", { className: "rp-picker-category", text: category }),
          createElement(
            "div",
            { className: "rp-picker-grid" },
            normalizedRecipes
              .filter((recipe) => recipe?.category === category)
              .map((recipe) =>
                createElement(
                  "div",
                  {
                    className: "rp-picker-card",
                    dataset: { recipe: recipe?.id || "" },
                  },
                  [
                    createElement("canvas", { attrs: { width: "90", height: "90" } }),
                    createElement("div", {
                      className: "rp-picker-card__label",
                      text: recipe?.label || recipe?.id || "Recipe",
                    }),
                    showHints && recipe?.hint
                      ? createElement("div", {
                          className: "rp-picker-card__hint",
                          text: recipe.hint,
                        })
                      : null,
                  ],
                ),
              ),
          ),
        ]),
      ),
    ]),
  ]);
}

export function renderVegetationGrid(container, gridModel = {}) {
  if (!container) return container;
  const headers = gridModel?.headers || [];
  const rows = gridModel?.rows || [];
  const twilightRows = gridModel?.twilightRows || [];

  replaceChildren(container, [
    createVegetationGridTable(headers, rows),
    twilightRows.length
      ? createElement(
          "div",
          { className: "veg-info-heading", attrs: { style: "margin-top:16px;" } },
          ["Twilight-adapted (tidally locked K/M worlds)"],
        )
      : null,
    twilightRows.length ? createVegetationGridTable(headers, twilightRows) : null,
  ]);
  return container;
}

export function createVegetationInfoOverlay({
  paleHex = "",
  deepHex = "",
  note = "",
  pressureAtm = 1,
  isExtrapolated = false,
  stops = [],
  twilight = null,
} = {}) {
  const backgroundStops = stops?.length ? stops : [paleHex, deepHex].filter(Boolean);
  const twilightStops = twilight?.stops?.length
    ? twilight.stops
    : [twilight?.paleHex, twilight?.deepHex].filter(Boolean);

  return createElement("div", { className: "veg-info-overlay" }, [
    createElement("div", { className: "veg-info-dialog panel" }, [
      createElement("div", { className: "panel__header" }, [
        createElement("h2", { text: "Vegetation Colour Details" }),
        createElement("button", {
          className: "small veg-info-close",
          attrs: { type: "button" },
          text: "Close",
        }),
      ]),
      createElement("div", { className: "panel__body" }, [
        createElement("div", {
          className: "veg-info-gradient",
          attrs: {
            style: `background: ${backgroundStops.length ? `linear-gradient(to right, ${backgroundStops.join(", ")})` : "transparent"};`,
          },
        }),
        createElement("div", { className: "veg-info-hex", text: `${paleHex} → ${deepHex}` }),
        createElement("div", { className: "veg-info-note", text: note }),
        vegetationSection("Current pressure", [
          paragraphNode([
            `${pressureAtm} atm — `,
            tagNode(
              isExtrapolated ? "Extrapolated" : "Empirical",
              `veg-info-tag ${isExtrapolated ? "veg-info-tag--extrap" : "veg-info-tag--empirical"}`,
            ),
          ]),
        ]),
        vegetationSection("Data source", [
          paragraphNode([
            "Vegetation colours are derived from the ",
            createElement("strong", { text: "PanoptesV" }),
            " radiative-transfer model (O'Malley-James & Kaltenegger, 2019), which simulates how atmospheric Rayleigh scattering filters starlight reaching the surface and how photosynthetic pigments would adapt.",
          ]),
          paragraphNode([
            "The model provides empirical colour data at three atmospheric pressures (",
            createElement("strong", { text: "1, 3, and 10 atm" }),
            ") across ten spectral classes (A0 through M9). These serve as anchor points in a 2D look-up table.",
          ]),
        ]),
        vegetationSection("Interpolation", [
          paragraphNode([
            "Between the anchor points, colours are blended using ",
            createElement("strong", { text: "bilinear OKLab interpolation" }),
            ":",
          ]),
          createElement("ol", {}, [
            createElement("li", {}, [
              createElement("strong", { text: "Pressure axis" }),
              " — log-pressure interpolation between the 1, 3, and 10 atm anchors (log20 spacing gives perceptually even steps).",
            ]),
            createElement("li", {}, [
              createElement("strong", { text: "Spectral axis" }),
              " — linear interpolation between the two nearest spectral-class anchors based on stellar effective temperature.",
            ]),
          ]),
          paragraphNode([
            "OKLab colour space ensures perceptually uniform blending (no muddy mid-tones).",
          ]),
        ]),
        vegetationSection(
          "Extrapolation above 10 atm",
          [
            paragraphNode([
              "PanoptesV does not provide data above 10 atm. For pressures from ",
              createElement("strong", { text: "10 to 100 atm" }),
              ", WorldSmith continues the 3→10 atm colour trend in OKLab space with ",
              createElement("strong", { text: "50% dampening" }),
              ".",
            ]),
            paragraphNode([
              "This reflects the physical expectation that Rayleigh scattering effects saturate at extreme optical depths — additional atmosphere continues to shift the surface spectrum, but with diminishing returns.",
            ]),
            paragraphNode([
              "Colours in this range are plausible but speculative and should be treated as estimates.",
            ]),
          ],
          "",
          {},
        ),
        vegetationSection("Extrapolation below 1 atm", [
          paragraphNode([
            "PanoptesV does not provide data below 1 atm. For pressures from ",
            createElement("strong", { text: "0.01 to 1 atm" }),
            ", WorldSmith reverses the 1→3 atm colour trend in OKLab space with ",
            createElement("strong", { text: "50% dampening" }),
            ".",
          ]),
          paragraphNode([
            "The physical basis: thinner atmospheres produce less Rayleigh scattering, so more of the star's raw spectrum reaches the surface. Pigments adapt to this less-filtered light.",
          ]),
          paragraphNode([
            "No published model has specifically computed vegetation colours at sub-1-atm pressures, so these values should be treated as plausible estimates.",
          ]),
        ]),
        vegetationSection("Additional corrections", [
          createElement("ul", {}, [
            createElement("li", {}, [
              createElement("strong", { text: "Insolation" }),
              " — low-light environments darken pigments (broader absorption needed to capture scarce photons).",
            ]),
            createElement("li", {}, [
              createElement("strong", { text: "Tidal lock" }),
              " — tidally locked K/M worlds get a separate twilight-adapted palette for the terminator zone.",
            ]),
          ]),
        ]),
        twilight?.paleHex
          ? vegetationSection("Twilight-adapted variant", [
              createElement("div", {
                className: "veg-info-gradient",
                attrs: {
                  style: `background: ${twilightStops.length ? `linear-gradient(to right, ${twilightStops.join(", ")})` : "transparent"};`,
                },
              }),
              createElement("div", {
                className: "veg-info-hex",
                text: `${twilight.paleHex} → ${twilight.deepHex}`,
              }),
              paragraphNode([
                "Organisms at the terminator of tidally locked worlds receive only scattered and refracted starlight, producing paler, more desaturated pigments.",
              ]),
            ])
          : null,
        vegetationSection("Full reference grid", [
          createElement("div", { className: "veg-info-heading" }, [
            "Full reference grid ",
            createElement("button", {
              className: "small veg-grid-toggle",
              attrs: { type: "button", id: "btn-veg-grid-toggle" },
              text: "Show grid",
            }),
          ]),
          paragraphNode([
            "Computed colours for 12 spectral types across 8 pressures (Earth-like planet in the habitable zone). Columns marked ",
            tagNode("E", "veg-info-tag veg-info-tag--extrap"),
            " are extrapolated beyond the PanoptesV empirical range (1–10 atm).",
          ]),
          createElement("div", {
            attrs: { id: "veg-grid-container", hidden: "" },
            className: "veg-grid-container",
          }),
        ]),
        vegetationSection(
          "References",
          [
            createElement("ul", {}, [
              createElement("li", {
                text: "O'Malley-James & Kaltenegger (2019) — PanoptesV spectral model",
              }),
              createElement("li", {
                text: "Kiang et al. (2007) — photosynthetic pigment adaptation",
              }),
              createElement("li", {
                text: "Lehmer et al. (2021) — atmospheric scattering effects",
              }),
              createElement("li", { text: "Arp et al. (2020) — biosignature spectral analysis" }),
            ]),
          ],
          "veg-info-refs",
        ),
      ]),
    ]),
  ]);
}
