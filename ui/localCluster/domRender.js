import { giantPlanetProbability } from "../../engine/star.js";
import { fmt } from "../../engine/utils.js";
import { getClusterObjectVisual, normalizeClusterObjectKey } from "../clusterObjectVisuals.js";
import { createElement, replaceChildren } from "../domHelpers.js";

function createTipNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function createKpiCard(item) {
  return createElement("div", { className: "kpi-wrap" }, [
    createElement("div", { className: "kpi" }, [
      createElement("div", { className: "kpi__label" }, [item.label, " ", createTipNode(item.tip)]),
      createElement("div", { className: "kpi__value", text: item.value ?? "" }),
      createElement("div", { className: "kpi__meta", text: item.meta ?? "" }),
    ]),
  ]);
}

export function renderClusterKpis(container, kpis = []) {
  return replaceChildren(
    container,
    (kpis || []).map((item) => createKpiCard(item)),
  );
}

export function renderClusterObjectsBody(container, stellarRows = [], countDeltas = {}) {
  return replaceChildren(
    container,
    (stellarRows || []).map((row) => {
      const key = normalizeClusterObjectKey(row.objectClassKey ?? row.spectralClass);
      const visual = getClusterObjectVisual(key);
      const adjustedCount = Math.max(0, row.count + (countDeltas[row.objectClassKey] || 0));
      const canRemove = adjustedCount > 0;
      return createElement("tr", {}, [
        createElement("td", {}, [
          createElement("span", { className: "cluster-object-cell" }, [
            createElement("img", {
              className: "cluster-object-icon",
              attrs: { src: visual.icon, alt: "", "aria-hidden": "true" },
            }),
            createElement("span", { text: row.label }),
          ]),
        ]),
        createElement("td", { text: row.spectralClass }),
        createElement("td", { className: "cluster-adjust-cell" }, [
          createElement("button", {
            className: "cluster-adjust-btn",
            attrs: {
              "data-class": row.objectClassKey,
              "data-action": "add",
              title: `Add ${row.label}`,
            },
            text: "+",
          }),
          createElement("button", {
            className: "cluster-adjust-btn",
            attrs: {
              "data-class": row.objectClassKey,
              "data-action": "remove",
              title: `Remove ${row.label}`,
              disabled: canRemove ? null : "disabled",
            },
            text: "\u2212",
          }),
        ]),
        createElement("td", { text: fmt(adjustedCount, 0) }),
      ]);
    }),
  );
}

export function renderClusterSystemsBody(
  container,
  finalSystems = [],
  { homeDefaultName, resolveSystemDisplayName, formatSystemLabel, formatLy, fmtFeH },
) {
  return replaceChildren(
    container,
    (finalSystems || []).map((system) => {
      const key = normalizeClusterObjectKey(system.objectClassKey, { isHome: system.isHome });
      const visual = getClusterObjectVisual(key, { isHome: system.isHome });
      const classLabel = formatSystemLabel(system);
      const systemName = resolveSystemDisplayName(system, homeDefaultName);
      return createElement("tr", { dataset: { systemId: system.id } }, [
        createElement("td", {}, [
          createElement("span", { className: "cluster-object-cell" }, [
            createElement("img", {
              className: "cluster-object-icon",
              attrs: { src: visual.icon, alt: "", "aria-hidden": "true" },
            }),
            createElement("span", { className: "cluster-object-tag", text: classLabel }),
          ]),
        ]),
        createElement("td", {}, [
          createElement("input", {
            className: "cluster-name-input",
            attrs: {
              type: "text",
              maxlength: "80",
              value: systemName,
              placeholder: system.name || "Star System",
              "aria-label": `System name for ${system.id}`,
            },
            dataset: { systemId: system.id },
          }),
        ]),
        createElement("td", { text: fmt(system.x, 2) }),
        createElement("td", { text: fmt(system.y, 2) }),
        createElement("td", { text: fmt(system.z, 2) }),
        createElement("td", { text: formatLy(system.distanceLy, 2) }),
        createElement("td", { text: fmtFeH(system.metallicityFeH) }),
        createElement("td", {
          text: `${fmt(giantPlanetProbability(system.metallicityFeH) * 100, 1)}%`,
        }),
      ]);
    }),
  );
}

function createContextMenuItem({
  action,
  systemId,
  classKey = null,
  compIndex = null,
  label,
  visual,
  danger = false,
}) {
  return createElement(
    "div",
    {
      className: `cluster-context-menu__item${danger ? " danger" : ""}`,
      dataset: {
        action,
        systemId,
        class: classKey,
        compIndex,
      },
    },
    [
      createElement("img", {
        className: "cluster-object-icon",
        attrs: { src: visual.icon, alt: "", "aria-hidden": "true" },
      }),
      label,
    ],
  );
}

export function renderClusterContextMenuItems(
  container,
  { systemId, components = [], companionClasses = [] },
) {
  const children = [];
  const count = components.length;

  if (count < 4) {
    children.push(createElement("div", { className: "cluster-context-menu__sep" }));
    for (const cls of companionClasses) {
      const visual = getClusterObjectVisual(normalizeClusterObjectKey(cls.key));
      children.push(
        createContextMenuItem({
          action: "add-companion",
          systemId,
          classKey: cls.key,
          label: `Add ${cls.label}`,
          visual,
        }),
      );
    }
  }

  if (count > 1) {
    children.push(createElement("div", { className: "cluster-context-menu__sep" }));
    for (let i = 1; i < components.length; i++) {
      const component = components[i];
      const compKey = normalizeClusterObjectKey(component.objectClassKey);
      const visual = getClusterObjectVisual(compKey);
      const label = compKey === "LTY" ? "L/T/Y" : compKey;
      children.push(
        createContextMenuItem({
          action: "remove-companion",
          systemId,
          compIndex: i,
          label: `Remove ${label} companion`,
          visual,
          danger: true,
        }),
      );
    }
  }

  if (!children.length) {
    children.push(
      createElement("div", {
        className: "cluster-context-menu__item",
        attrs: { style: "opacity:0.5;cursor:default" },
        text: "No actions available",
      }),
    );
  }

  return replaceChildren(container, children);
}
