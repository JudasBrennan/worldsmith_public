import { appendChildren, createElement, replaceChildren } from "../domHelpers.js";

export function createTipIconNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function setInlineStyles(node, styles = {}) {
  for (const [key, value] of Object.entries(styles || {})) {
    if (value == null || value === "") continue;
    if (key.startsWith("--")) {
      node.style.setProperty(key, String(value));
      continue;
    }
    node.style[key] = String(value);
  }
  return node;
}

function normalizeContent(content) {
  if (content == null || content === false) return [];
  if (Array.isArray(content)) return content.flatMap((entry) => normalizeContent(entry));
  return [content];
}

function createKpiMeta(item) {
  const children =
    item.metaChildren != null ? normalizeContent(item.metaChildren) : normalizeContent(item.meta);
  if (!children.length) return null;
  return createElement("div", { className: "kpi__meta" }, children);
}

function createKpiCard(item) {
  if (item.kind === "preview") {
    const labelChildren = [item.label, " ", createTipIconNode(item.tip || "")];
    for (const action of item.actions || []) {
      labelChildren.push(" ");
      labelChildren.push(
        createElement("button", {
          className: action.className || "small",
          attrs: { type: "button", id: action.id || null },
          text: action.text || "",
        }),
      );
    }
    const canvas = createElement("canvas", {
      className: item.canvasClass || "",
      attrs: {
        width: item.canvasWidth || 180,
        height: item.canvasHeight || 180,
      },
      dataset: item.canvasDataset || {},
    });
    return createElement("div", { className: "kpi-wrap" }, [
      createElement("div", { className: "kpi kpi--preview" }, [
        createElement("div", { className: "kpi__label" }, labelChildren),
        canvas,
        createKpiMeta(item),
      ]),
    ]);
  }

  const kpiNode = createElement(
    "div",
    {
      className: `kpi ${item.kpiClass || ""}`.trim(),
      dataset: item.kpiDataset || {},
    },
    [
      createElement("div", { className: "kpi__label" }, [
        item.label,
        " ",
        createTipIconNode(item.tip || ""),
      ]),
      createElement("div", { className: "kpi__value" }, normalizeContent(item.value)),
      createKpiMeta(item),
    ],
  );
  setInlineStyles(kpiNode, item.kpiStyle || {});
  return createElement("div", { className: "kpi-wrap" }, [kpiNode]);
}

export function createKpiGrid(items = []) {
  return createElement(
    "div",
    { className: "kpi-grid" },
    (items || []).filter(Boolean).map((item) => createKpiCard(item)),
  );
}

function expandLines(lines = []) {
  const expanded = [];
  for (const line of lines) {
    if (line == null || line === false) continue;
    if (typeof line === "string") {
      for (const part of String(line).split("\n")) {
        if (!part) continue;
        expanded.push(part);
      }
      continue;
    }
    expanded.push(line);
  }
  return expanded;
}

function createReadoutBlock(lines = []) {
  return createElement(
    "div",
    { className: "derived-readout" },
    expandLines(lines).map((line) => {
      const row = createElement("div");
      appendChildren(row, normalizeContent(line));
      return row;
    }),
  );
}

export function createReadoutSections(sections = []) {
  return (sections || []).map((section) =>
    createElement("div", { attrs: { style: section.style || "margin-top:14px" } }, [
      createElement("div", { className: "label" }, [
        section.title || "",
        " ",
        createTipIconNode(section.tip || ""),
      ]),
      createReadoutBlock(section.lines || []),
    ]),
  );
}

export function renderTectonicProbabilityBar(node, probabilities = null) {
  if (!node) return node;
  if (!probabilities) {
    replaceChildren(node, []);
    return node;
  }
  const colors = {
    stagnant: "#ff7c97",
    mobile: "#7cffb2",
    episodic: "#ffd37c",
    plutonicSquishy: "#a6abcc",
  };
  const labels = {
    stagnant: "Stagnant",
    mobile: "Mobile",
    episodic: "Episodic",
    plutonicSquishy: "Plut.-squishy",
  };
  const keys = ["stagnant", "mobile", "episodic", "plutonicSquishy"];
  const trackKeys = keys.filter((key) => Number(probabilities?.[key]) >= 0.01);
  const legendKeys = keys.filter((key) => Number(probabilities?.[key]) >= 0.05);
  replaceChildren(node, [
    createElement(
      "div",
      { className: "tec-prob-bar__track" },
      trackKeys.map((key) =>
        createElement("div", {
          className: "tec-prob-bar__seg",
          attrs: {
            title: `${labels[key]}: ${Math.round(Number(probabilities[key]) * 100)}%`,
          },
        }),
      ),
    ),
    createElement(
      "div",
      { className: "tec-prob-bar__legend" },
      legendKeys.map((key) =>
        createElement("span", { className: "tec-prob-bar__label" }, [
          createElement("span", { className: "tec-prob-bar__dot" }),
          `${labels[key]} ${Math.round(Number(probabilities[key]) * 100)}%`,
        ]),
      ),
    ),
  ]);
  node.querySelectorAll(".tec-prob-bar__seg").forEach((segment, index) => {
    const key = trackKeys[index];
    segment.style.width = `${Number(probabilities[key]) * 100}%`;
    segment.style.background = colors[key];
  });
  node.querySelectorAll(".tec-prob-bar__dot").forEach((dot, index) => {
    const key = legendKeys[index];
    dot.style.background = colors[key];
  });
  return node;
}
