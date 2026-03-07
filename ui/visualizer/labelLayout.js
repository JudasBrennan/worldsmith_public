// SPDX-License-Identifier: MPL-2.0
export function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function placeLabel8(placed, anchorX, anchorY, defaultX, defaultY, boxW, boxH, bodyR) {
  const gap = Math.max(4, bodyR * 0.15);
  const r = Math.max(8, bodyR + gap);
  const ax = Number.isFinite(anchorX) ? anchorX : defaultX;
  const ay = Number.isFinite(anchorY) ? anchorY : defaultY;
  const candidates = [
    { x: defaultX, y: defaultY },
    { x: ax + r, y: ay - boxH * 0.5 },
    { x: ax + r, y: ay + gap },
    { x: ax - boxW - gap, y: ay - boxH - gap },
    { x: ax - boxW - gap, y: ay - boxH * 0.5 },
    { x: ax - boxW * 0.5, y: ay - r - boxH },
    { x: ax - boxW * 0.5, y: ay + r },
    { x: ax - boxW - gap, y: ay + gap },
  ];
  for (const candidate of candidates) {
    const rect = { x: candidate.x, y: candidate.y, w: boxW, h: boxH };
    let hit = false;
    for (const prior of placed) {
      if (rectsOverlap(rect, prior)) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      placed.push(rect);
      return rect;
    }
  }
  return null;
}
