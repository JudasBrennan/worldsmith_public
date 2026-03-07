// SPDX-License-Identifier: MPL-2.0
/**
 * Content helpers for the Lessons page.
 *
 * Extends the Science page helper vocabulary with pedagogical elements:
 * concept cards, analogies, key-idea callouts, and mode-aware wrappers.
 */

/* ── Re-export math / reference helpers (same API as sciencePage) ── */

export function eq(latex) {
  return `<span class="sci-math sci-math--block">${latex}</span>`;
}

export function iq(latex) {
  return `<span class="sci-math">${latex}</span>`;
}

export function vars(rows) {
  return `<table class="sci-vars"><tbody>${rows
    .map(([sym, desc]) => `<tr><td>${iq(sym)}</td><td>${desc}</td></tr>`)
    .join("")}</tbody></table>`;
}

export function cite(text) {
  return `<p class="sci-cite">${text}</p>`;
}

export function dataTable(headers, rows) {
  return `<table class="sci-data"><thead><tr>${headers
    .map((h) => `<th>${h}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

/* ── Lesson-specific helpers ──────────────────────────────────── */

/**
 * Wrap a concept card with a title and body.  The body is chosen from
 * basicHtml / advancedHtml according to the current mode.
 */
export function concept(title, basicHtml, advancedHtml, mode) {
  const body = mode === "advanced" ? advancedHtml : basicHtml;
  return `<div class="les-concept"><h3 class="les-concept__name">${title}</h3><div class="les-concept__body">${body}</div></div>`;
}

/** Analogy callout (accent-coloured, left-bordered). */
export function analogy(text) {
  return `<div class="les-analogy"><span class="les-analogy__icon">&#128161;</span>${text}</div>`;
}

/** Key-idea callout (green, left-bordered). */
export function keyIdea(text) {
  return `<div class="les-key-idea"><span class="les-key-idea__icon">&#9733;</span>${text}</div>`;
}

/** "Experiment" mini-calculator block. Appears in both modes. */
export function tryIt(title, body) {
  return `<div class="sci-try"><div class="sci-try__title">${title}</div>${body}</div>`;
}

/** A single input row inside a tryIt block. */
export function tryRow(labelHtml, inputHtml) {
  return `<div class="sci-try__row">${labelHtml}${inputHtml}</div>`;
}

/** Output display inside a tryIt block. */
export function tryOutput(id, labelHtml) {
  return `<div class="sci-try__output">${labelHtml}<span class="sci-try__value" id="${id}"></span></div>`;
}
