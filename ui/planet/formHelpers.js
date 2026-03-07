// SPDX-License-Identifier: MPL-2.0
export function clampGasGiantRadiusRj(value, min, max, step) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return min;
  const clamped = Math.max(min, Math.min(max, raw));
  const inv = 1 / step;
  return Math.round(clamped * inv) / inv;
}

export function findNearestSlot(targetAu, orbitsAu, occupiedSlots) {
  let bestSlot = null;
  let bestDist = Infinity;
  for (let i = 0; i < orbitsAu.length; i++) {
    const slot = i + 1;
    if (occupiedSlots.has(slot)) continue;
    const dist = Math.abs(orbitsAu[i] - targetAu);
    if (dist < bestDist) {
      bestDist = dist;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

export function numWithSlider(id, label, unit, hint, min, max, step, tipHtml = "") {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  const hintHtml = hint ? `<div class="hint">${hint}</div>` : "";
  return `
  <div class="form-row">
    <div>
      <div class="label">${label}${unitHtml} ${tipHtml}</div>
      ${hintHtml}
    </div>
    <div class="input-pair">
      <input id="${id}" type="number" step="${step}" aria-label="${label}" />
      <input id="${id}_slider" type="range" aria-label="${label} slider" />
      <div class="range-meta"><span id="${id}_min">${min}</span><span id="${id}_max">${max}</span></div>
    </div>
  </div>`;
}
