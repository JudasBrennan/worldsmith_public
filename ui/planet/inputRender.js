// SPDX-License-Identifier: MPL-2.0
import { createElement, replaceChildren, replaceSelectOptions } from "../domHelpers.js";
import { createTipIconNode } from "./outputRender.js";

function createSpacer(heightPx) {
  return createElement("div", { attrs: { style: `height:${heightPx}px` } });
}

function createLabelChildren(label, unit, tip, extras = []) {
  const children = [label];
  if (unit) {
    children.push(" ");
    children.push(createElement("span", { className: "unit", text: unit }));
  }
  if (tip) {
    children.push(" ");
    children.push(createTipIconNode(tip));
  }
  if (extras.length) {
    children.push(" ");
    children.push(...extras);
  }
  return children;
}

function createLabelBlock({ label, unit = "", tip = "", hint = "", extras = [] } = {}) {
  return createElement("div", {}, [
    createElement("div", { className: "label" }, createLabelChildren(label, unit, tip, extras)),
    hint ? createElement("div", { className: "hint", text: hint }) : null,
  ]);
}

function createFormRow(leftChildren, rightChildren, { className = "", style = "" } = {}) {
  return createElement(
    "div",
    {
      className: ["form-row", className].filter(Boolean).join(" "),
      attrs: style ? { style } : {},
    },
    [createElement("div", {}, leftChildren), rightChildren],
  );
}

function createNumberInput({
  id,
  label,
  step,
  value = "",
  placeholder = null,
  type = "number",
} = {}) {
  const attrs = {
    id,
    type,
    "aria-label": label,
  };
  if (step != null) attrs.step = step;
  if (value != null) attrs.value = value;
  if (placeholder != null) attrs.placeholder = placeholder;
  return createElement("input", { attrs });
}

function createRangeInput({ id, label }) {
  return createElement("input", {
    attrs: { id, type: "range", "aria-label": `${label} slider` },
  });
}

function createRangeMeta({ id, min, max, withIds = false }) {
  return createElement("div", { className: "range-meta" }, [
    createElement("span", {
      attrs: withIds ? { id: `${id}_min` } : {},
      text: String(min),
    }),
    createElement("span", {
      attrs: withIds ? { id: `${id}_max` } : {},
      text: String(max),
    }),
  ]);
}

function createSliderRow({
  id,
  label,
  unit = "",
  hint = "",
  min,
  max,
  step,
  tip = "",
  value = "",
  placeholder = null,
  style = "",
  className = "",
  withMetaIds = false,
} = {}) {
  return createFormRow(
    createLabelBlock({ label, unit, tip, hint }),
    createElement("div", { className: "input-pair" }, [
      createNumberInput({ id, label, step, value, placeholder }),
      createRangeInput({ id: `${id}_slider`, label }),
      createRangeMeta({ id, min, max, withIds: withMetaIds }),
    ]),
    { style, className },
  );
}

function createTextRow({ id, label, tip = "", hint = "", value = "", style = "" } = {}) {
  return createFormRow(
    createLabelBlock({ label, tip, hint }),
    createElement("input", {
      attrs: { id, type: "text", value },
    }),
    { style },
  );
}

function createSelectNode(id, options = []) {
  const select = createElement("select", { attrs: { id } });
  replaceSelectOptions(select, options);
  return select;
}

function createSelectRow({
  id,
  label,
  unit = "",
  tip = "",
  hint = "",
  options = [],
  style = "",
} = {}) {
  return createFormRow(
    createLabelBlock({ label, unit, tip, hint }),
    createSelectNode(id, options),
    { style },
  );
}

function createToggle({ className, id = "", name, options = [], style = "" } = {}) {
  return createElement(
    "div",
    {
      className,
      attrs: {
        ...(id ? { id } : {}),
        ...(style ? { style } : {}),
      },
    },
    [
      ...options.flatMap((option) => [
        createElement("input", {
          attrs: {
            type: "radio",
            name,
            id: option.id,
            value: option.value,
          },
          checked: !!option.checked,
        }),
        createElement("label", {
          attrs: { for: option.id },
          text: option.label,
        }),
      ]),
      createElement("span"),
    ],
  );
}

function createSectionLabel(label, tip = "", style = "") {
  return createElement(
    "div",
    {
      className: "label",
      attrs: style ? { style } : {},
    },
    createLabelChildren(label, "", tip),
  );
}

function createHintNode(id, text, style = "") {
  return createElement("div", {
    className: "hint",
    attrs: {
      ...(id ? { id } : {}),
      ...(style ? { style } : {}),
    },
    text,
  });
}

function createColorRow(id, label, value) {
  return createElement("div", { className: "form-row" }, [
    createElement("span", { text: label }),
    createElement("input", {
      attrs: { type: "color", id, value },
    }),
  ]);
}

function createRockyFieldRows(fields, tipLabels) {
  return fields.map((field) =>
    createSliderRow({
      ...field,
      tip: tipLabels[field.tipKey || field.label] || "",
      withMetaIds: true,
    }),
  );
}

export function renderRockyInputForm(container, { planet, tipLabels } = {}) {
  const p = planet?.inputs || {};
  const greenhouseMode = p.greenhouseMode || "core";
  const radioisotopeMode = p.radioisotopeMode || "simple";
  const mantleOxidation = p.mantleOxidation || "earth";

  const primaryPhysicalField = {
    id: "mass",
    label: "Mass",
    unit: "MEarth",
    min: 0.0001,
    max: 1000,
    step: 0.0001,
  };
  const secondaryPhysicalFields = [
    { id: "wmf", label: "WMF", unit: "%", min: 0, max: 50, step: 0.1 },
    { id: "tilt", label: "Axial Tilt", unit: "\u00b0", min: 0, max: 180, step: 0.1 },
    { id: "albedo", label: "Albedo (Bond)", min: 0, max: 0.95, step: 0.01 },
    {
      id: "observer",
      label: "Height of Observer",
      unit: "m",
      min: 0,
      max: 10000,
      step: 0.05,
    },
  ];
  const orbitFields = [
    {
      id: "rot",
      label: "Rotation Period",
      unit: "Earth hrs",
      min: 0.1,
      max: 1000000,
      step: 0.1,
    },
    {
      id: "a",
      label: "Semi-Major axis",
      unit: "AU",
      min: 0.01,
      max: 1000000,
      step: 0.01,
    },
    { id: "e", label: "Eccentricity", min: 0, max: 0.99, step: 0.001 },
    { id: "inc", label: "Inclination", unit: "\u00b0", min: 0, max: 180, step: 0.1 },
    {
      id: "lop",
      label: "Longitude of Periapsis",
      unit: "\u00b0",
      min: 0,
      max: 360,
      step: 1,
    },
    {
      id: "ssl",
      label: "Subsolar Longitude",
      unit: "\u00b0",
      min: 0,
      max: 360,
      step: 1,
    },
  ];
  const atmosphereFields = [
    {
      id: "patm",
      label: "Atmospheric Pressure",
      unit: "atm",
      min: 0,
      max: 100,
      step: 0.01,
    },
    { id: "o2", label: "Oxygen (O2)", unit: "%", min: 0, max: 100, step: 0.01 },
    {
      id: "co2",
      label: "Carbon Dioxide (CO2)",
      unit: "%",
      min: 0,
      max: 100,
      step: 0.01,
    },
    { id: "ar", label: "Argon (Ar)", unit: "%", min: 0, max: 100, step: 0.01 },
    {
      id: "h2o",
      label: "Water Vapor (H\u2082O)",
      unit: "%",
      min: 0,
      max: 5,
      step: 0.01,
    },
    {
      id: "ch4",
      label: "Methane (CH\u2084)",
      unit: "%",
      min: 0,
      max: 10,
      step: 0.001,
    },
  ];
  const expertGasFields = [
    {
      id: "h2",
      label: "Hydrogen (H\u2082)",
      unit: "%",
      min: 0,
      max: 50,
      step: 0.1,
    },
    { id: "he", label: "Helium (He)", unit: "%", min: 0, max: 50, step: 0.1 },
    {
      id: "so2",
      label: "Sulfur Dioxide (SO\u2082)",
      unit: "%",
      min: 0,
      max: 1,
      step: 0.001,
    },
    {
      id: "nh3",
      label: "Ammonia (NH\u2083)",
      unit: "%",
      min: 0,
      max: 1,
      step: 0.001,
    },
  ];
  const isotopeFields = [
    {
      id: "isoAbundance",
      label: "Radioisotope Abundance",
      unit: "\u00d7 Earth",
      min: 0.1,
      max: 3,
      step: 0.01,
      tipKey: "Radioisotope Abundance",
    },
  ];
  const isotopeAdvancedFields = [
    { id: "isoU238", label: "U-238", unit: "\u00d7", min: 0, max: 5, step: 0.01 },
    { id: "isoU235", label: "U-235", unit: "\u00d7", min: 0, max: 5, step: 0.01 },
    { id: "isoTh232", label: "Th-232", unit: "\u00d7", min: 0, max: 5, step: 0.01 },
    { id: "isoK40", label: "K-40", unit: "\u00d7", min: 0, max: 5, step: 0.01 },
  ];
  const mantleOptions = [
    { value: "highly-reduced", label: "Highly reduced (H\u2082+CO)" },
    { value: "reduced", label: "Moderately reduced" },
    { value: "earth", label: "Earth-like (CO\u2082+H\u2082O)" },
    { value: "oxidized", label: "Oxidized (CO\u2082+H\u2082O+SO\u2082)" },
  ].map((option) => ({ ...option, selected: option.value === mantleOxidation }));

  const greenhouseValue =
    greenhouseMode === "full" || greenhouseMode === "manual" ? greenhouseMode : "core";
  const tectonicValue =
    !p.tectonicRegime || p.tectonicRegime === "auto" ? "mobile" : p.tectonicRegime;

  replaceChildren(container, [
    createSelectRow({
      id: "slotSelect",
      label: "Orbital slot",
      tip: tipLabels["Orbital slot"] || "",
      hint: "One body per slot.",
      style: "margin-top:8px",
    }),
    createSpacer(10),
    createTextRow({
      id: "planetName",
      label: "Name",
      tip: tipLabels.Name || "",
      hint: "Used in exports and print view.",
      value: planet?.name || "New Planet",
    }),
    createSpacer(8),
    createSectionLabel("Physical", tipLabels.Physical || ""),
    ...createRockyFieldRows([primaryPhysicalField], tipLabels),
    createFormRow(
      createLabelBlock({
        label: "CMF",
        unit: "%",
        tip: tipLabels.CMF || "",
        extras: [
          createElement("button", {
            attrs: {
              id: "cmfAutoBtn",
              class: "auto-btn",
              title: "Reset to star-derived CMF",
              type: "button",
            },
            text: "auto",
          }),
        ],
      }),
      createElement("div", { className: "input-pair" }, [
        createNumberInput({ id: "cmf", label: "CMF", step: 0.1 }),
        createRangeInput({ id: "cmf_slider", label: "CMF" }),
        createRangeMeta({ id: "cmf", min: 0, max: 100, withIds: true }),
      ]),
    ),
    ...createRockyFieldRows(secondaryPhysicalFields, tipLabels),
    createSpacer(8),
    createSectionLabel("Orbit & Rotation", tipLabels["Orbit & Rotation"] || ""),
    ...createRockyFieldRows(orbitFields, tipLabels),
    createSpacer(8),
    createSectionLabel("Atmosphere", tipLabels.Atmosphere || ""),
    ...createRockyFieldRows(atmosphereFields.slice(0, 1), tipLabels),
    createSectionLabel("Greenhouse Mode", tipLabels["Greenhouse Mode"] || "", "margin:8px 0 6px"),
    createToggle({
      className: "physics-trio-toggle",
      name: "ghMode",
      options: [
        { id: "ghModeCore", value: "core", label: "Core", checked: greenhouseValue === "core" },
        { id: "ghModeFull", value: "full", label: "Full", checked: greenhouseValue === "full" },
        {
          id: "ghModeManual",
          value: "manual",
          label: "Manual",
          checked: greenhouseValue === "manual",
        },
      ],
    }),
    createHintNode("ghModeHint", "", "margin-top:5px"),
    createElement(
      "div",
      {
        attrs:
          greenhouseValue === "manual"
            ? { id: "ghManualRow" }
            : { id: "ghManualRow", style: "display:none" },
      },
      [
        createSliderRow({
          id: "gh",
          label: "Greenhouse Effect",
          min: 0,
          max: 500,
          step: 0.1,
          tip: tipLabels["Greenhouse Effect"] || "",
          withMetaIds: true,
        }),
      ],
    ),
    createElement(
      "div",
      {
        className: "hint",
        attrs:
          greenhouseValue === "manual"
            ? { id: "ghComputedRow", style: "display:none" }
            : { id: "ghComputedRow" },
      },
      [
        "Computed greenhouse effect: ",
        createElement("b", { attrs: { id: "ghComputedValue" }, text: "\u2014" }),
      ],
    ),
    ...createRockyFieldRows(atmosphereFields.slice(1), tipLabels),
    createElement(
      "div",
      {
        attrs:
          greenhouseValue === "full"
            ? { id: "expertGasRow" }
            : { id: "expertGasRow", style: "display:none" },
      },
      createRockyFieldRows(expertGasFields, tipLabels),
    ),
    createSpacer(8),
    createSectionLabel("Atmospheric Escape", tipLabels["Atmospheric Escape"] || ""),
    createToggle({
      className: "physics-duo-toggle",
      id: "atmEscapePills",
      name: "atmEscape",
      style: "margin:4px 0 6px",
      options: [
        { id: "atmEscapeOff", value: "off", label: "Off", checked: !p.atmosphericEscape },
        { id: "atmEscapeOn", value: "on", label: "On", checked: !!p.atmosphericEscape },
      ],
    }),
    createSpacer(8),
    createSectionLabel("Vegetation", tipLabels["Vegetation override"] || ""),
    createToggle({
      className: "physics-duo-toggle",
      id: "vegModePills",
      name: "vegMode",
      style: "margin:4px 0 6px",
      options: [
        { id: "vegModeAuto", value: "auto", label: "Auto", checked: !p.vegOverride },
        { id: "vegModeManual", value: "manual", label: "Manual", checked: !!p.vegOverride },
      ],
    }),
    createElement(
      "div",
      {
        className: "veg-manual-inputs",
        attrs: p.vegOverride
          ? { id: "vegManualInputs" }
          : { id: "vegManualInputs", style: "display:none" },
      },
      [
        createColorRow(
          "vegPaleColour",
          "Pale (low concentration)",
          p.vegPaleHexOverride || "#4a7c32",
        ),
        createColorRow(
          "vegDeepColour",
          "Deep (high concentration)",
          p.vegDeepHexOverride || "#1a3d0c",
        ),
        createElement("div", {
          className: "veg-override-preview",
          attrs: {
            id: "vegOverridePreview",
            style: `background:linear-gradient(to right, ${p.vegPaleHexOverride || "#4a7c32"}, ${p.vegDeepHexOverride || "#1a3d0c"})`,
          },
        }),
      ],
    ),
    createSpacer(8),
    createSectionLabel("Internal Heat", tipLabels["Internal Heat"] || ""),
    createToggle({
      className: "physics-duo-toggle",
      id: "isoModePills",
      name: "isoMode",
      style: "margin:4px 0 6px",
      options: [
        {
          id: "isoSimple",
          value: "simple",
          label: "Simple",
          checked: radioisotopeMode !== "advanced",
        },
        {
          id: "isoAdvanced",
          value: "advanced",
          label: "Per-Isotope",
          checked: radioisotopeMode === "advanced",
        },
      ],
    }),
    createElement(
      "div",
      {
        attrs:
          radioisotopeMode === "advanced"
            ? { id: "isoSimpleInputs", style: "display:none" }
            : { id: "isoSimpleInputs" },
      },
      createRockyFieldRows(isotopeFields, tipLabels),
    ),
    createElement(
      "div",
      {
        attrs:
          radioisotopeMode === "advanced"
            ? { id: "isoAdvancedInputs" }
            : { id: "isoAdvancedInputs", style: "display:none" },
      },
      [
        ...createRockyFieldRows(isotopeAdvancedFields, tipLabels),
        createElement("div", { className: "derived-readout", attrs: { id: "isoEffective" } }),
      ],
    ),
    createSpacer(8),
    createSectionLabel("Tectonic Regime", tipLabels["Tectonic Regime"] || ""),
    createToggle({
      className: "physics-quad-toggle",
      id: "tectonicRegimePills",
      name: "tecRegime",
      options: [
        {
          id: "tecStagnant",
          value: "stagnant",
          label: "Stagnant",
          checked: tectonicValue === "stagnant",
        },
        { id: "tecMobile", value: "mobile", label: "Mobile", checked: tectonicValue === "mobile" },
        {
          id: "tecEpisodic",
          value: "episodic",
          label: "Episodic",
          checked: tectonicValue === "episodic",
        },
        {
          id: "tecPlutonic",
          value: "plutonic-squishy",
          label: "Plutonic",
          checked: tectonicValue === "plutonic-squishy",
        },
      ],
    }),
    createElement("div", { className: "tec-prob-bar", attrs: { id: "tecProbBar" } }),
    createSelectRow({
      id: "mantleOxidation",
      label: "Mantle Oxidation",
      tip: tipLabels["Mantle Oxidation"] || "",
      options: mantleOptions,
    }),
  ]);

  return container;
}

export function renderGasGiantInputForm(
  container,
  { giant, slotHint = "", slotOptions = [], tipLabels, ranges } = {},
) {
  replaceChildren(container, [
    createSelectRow({
      id: "ggSlot",
      label: "Orbital slot",
      tip: tipLabels["GG Slot"] || "",
      hint: slotHint,
      options: slotOptions,
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggAu",
      label: "Orbit",
      unit: "AU",
      tip: tipLabels["Custom orbit"] || "",
      hint: "Manual orbit distance.",
      min: 0.01,
      max: 1000,
      step: 0.01,
      value: Number(giant?.au || 0),
      className: "gg-custom-au-row",
      style: `margin-top:8px;${giant?.slotIndex ? "display:none" : ""}`,
    }),
    createSpacer(10),
    createTextRow({
      id: "ggName",
      label: "Name",
      tip: tipLabels.Name || "",
      value: giant?.name || "Gas giant",
    }),
    createSliderRow({
      id: "ggRadius",
      label: "Radius",
      unit: "Rj",
      tip: tipLabels["GG Size"] || "",
      hint: "1.00 Rj = Jupiter-size.",
      min: ranges.radius.min,
      max: ranges.radius.max,
      step: ranges.radius.step,
      value: giant?.radiusRj ?? "",
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggMass",
      label: "Mass",
      unit: "Mj",
      tip: tipLabels["GG Mass"] || "",
      hint: "Blank = derived from radius.",
      min: ranges.mass.min,
      max: ranges.mass.max,
      step: ranges.mass.step,
      value: giant?.massMjup != null ? giant.massMjup : "",
      placeholder: "auto",
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggRotation",
      label: "Rotation",
      unit: "hours",
      tip: tipLabels["GG Rotation"] || "",
      hint: "Blank = default 10 h.",
      min: 1,
      max: 100,
      step: 0.1,
      value: giant?.rotationPeriodHours != null ? giant.rotationPeriodHours : "",
      placeholder: "10",
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggMetallicity",
      label: "Metallicity",
      unit: "\u00d7 solar",
      tip: tipLabels["GG Metallicity"] || "",
      hint: "Blank = derived from mass.",
      min: ranges.metallicity.min,
      max: ranges.metallicity.max,
      step: ranges.metallicity.step,
      value: giant?.metallicity != null ? giant.metallicity : "",
      placeholder: "auto",
      style: "margin-top:8px",
    }),
    createSpacer(10),
    createSectionLabel("Orbit & Orientation"),
    createSliderRow({
      id: "ggEcc",
      label: "Eccentricity",
      tip: tipLabels["GG Eccentricity"] || "",
      hint: "0 = circular. Jupiter 0.048.",
      min: 0,
      max: 0.99,
      step: 0.001,
      value: giant?.eccentricity != null ? giant.eccentricity : "",
      placeholder: "0",
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggInc",
      label: "Inclination",
      unit: "\u00b0",
      tip: tipLabels["GG Inclination"] || "",
      hint: "0\u00b0 = coplanar. >90\u00b0 = retrograde.",
      min: 0,
      max: 180,
      step: 0.1,
      value: giant?.inclinationDeg != null ? giant.inclinationDeg : "",
      placeholder: "0",
      style: "margin-top:8px",
    }),
    createSliderRow({
      id: "ggTilt",
      label: "Axial Tilt",
      unit: "\u00b0",
      tip: tipLabels["GG Axial Tilt"] || "",
      hint: "Jupiter 3.1\u00b0, Saturn 26.7\u00b0, Uranus 97.8\u00b0.",
      min: 0,
      max: 180,
      step: 0.1,
      value: giant?.axialTiltDeg != null ? giant.axialTiltDeg : "",
      placeholder: "0",
      style: "margin-top:8px",
    }),
  ]);

  return container;
}
