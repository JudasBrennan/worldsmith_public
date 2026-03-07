// SPDX-License-Identifier: MPL-2.0
import { createElement, replaceChildren } from "../domHelpers.js";
import { createKpiGrid, createReadoutSections } from "../planet/outputRender.js";

function createOptionNode(value, label) {
  return createElement("option", {
    attrs: { value: value == null ? "" : String(value) },
    text: label == null ? "" : String(label),
  });
}

function createOptgroupNode(label, entries = []) {
  if (!entries.length) return null;
  return createElement(
    "optgroup",
    { attrs: { label } },
    entries.map((entry) => createOptionNode(entry?.value, entry?.label)),
  );
}

export function renderMoonParentSelector(
  selectEl,
  { planets = [], gasGiants = [], selectedValue = "", disabled = false, title = "" } = {},
) {
  replaceChildren(selectEl, [
    createOptionNode("", "Unassigned"),
    createOptgroupNode(
      "Planets",
      (planets || []).map((planet) => ({
        value: planet?.id || "",
        label: planet?.name || planet?.inputs?.name || planet?.id || "Planet",
      })),
    ),
    createOptgroupNode(
      "Gas Giants",
      (gasGiants || []).map((gasGiant) => ({
        value: gasGiant?.id || "",
        label: gasGiant?.name || gasGiant?.id || "Gas Giant",
      })),
    ),
  ]);

  const rawSelectedValue = selectedValue == null ? "" : String(selectedValue);
  selectEl.value = [...selectEl.options].some((option) => option.value === rawSelectedValue)
    ? rawSelectedValue
    : "";
  selectEl.disabled = Boolean(disabled);
  selectEl.title = title || "";
  return selectEl;
}

export function renderMoonSelector(selectEl, moons = [], selectedValue = "") {
  const normalizedMoons = Array.isArray(moons) ? moons : [];
  replaceChildren(
    selectEl,
    normalizedMoons.map((moon) =>
      createOptionNode(moon?.id || "", moon?.name || moon?.inputs?.name || moon?.id || "Moon"),
    ),
  );

  if (!normalizedMoons.length) {
    selectEl.value = "";
    return selectEl;
  }

  const rawSelectedValue = String(selectedValue || "");
  const fallbackValue = String(normalizedMoons[0]?.id || "");
  selectEl.value = [...selectEl.options].some((option) => option.value === rawSelectedValue)
    ? rawSelectedValue
    : fallbackValue;
  return selectEl;
}

export function renderMoonKpis(container, items = []) {
  const grid = createKpiGrid(items);
  replaceChildren(container, [...grid.childNodes]);
  return container;
}

export function renderMoonLimits(container, sections = []) {
  replaceChildren(container, createReadoutSections(sections));
  return container;
}

export function createMoonRecipePickerOverlay(recipes = []) {
  const categories = [
    ...new Set((recipes || []).map((recipe) => recipe?.category).filter(Boolean)),
  ];
  return createElement("div", { className: "rp-picker-overlay" }, [
    createElement("div", { className: "rp-picker-dialog panel" }, [
      createElement("div", { className: "panel__header" }, [
        createElement("h2", { text: "Select Moon Recipe" }),
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
        categories.flatMap((category) => [
          createElement("div", { className: "rp-picker-category", text: category }),
          createElement(
            "div",
            { className: "rp-picker-grid" },
            (recipes || [])
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
                      text: recipe?.label || recipe?.id || "Moon recipe",
                    }),
                  ],
                ),
              ),
          ),
        ]),
      ),
    ]),
  ]);
}
