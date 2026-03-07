// SPDX-License-Identifier: MPL-2.0
import { createElement, replaceChildren } from "../domHelpers.js";

export function renderScienceText(node, text) {
  if (!node) return node;
  node.textContent = text == null ? "" : String(text);
  return node;
}

export function renderScienceFlareResult(
  node,
  { countLabel = "32", countValue = "", alphaValue = "" } = {},
) {
  if (!node) return node;
  replaceChildren(node, [
    "N",
    createElement("sub", { text: countLabel }),
    ` = ${countValue} — α = ${alphaValue}`,
  ]);
  return node;
}

export function renderScienceLeapCycles(node, cycles = [], fallbackText = "") {
  if (!node) return node;
  const normalizedCycles = (cycles || []).filter(Boolean);
  if (!normalizedCycles.length) {
    node.textContent = fallbackText == null ? "" : String(fallbackText);
    return node;
  }

  const children = [];
  normalizedCycles.forEach((cycle, index) => {
    if (index > 0) children.push(createElement("br"));
    children.push(
      createElement("strong", { text: cycle?.fraction || "" }),
      ` — ${cycle?.description || ""}`,
    );
  });
  replaceChildren(node, children);
  return node;
}
