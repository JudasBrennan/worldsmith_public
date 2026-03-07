// SPDX-License-Identifier: MPL-2.0
import { clamp } from "../../engine/utils.js";
import { placeLabel8 } from "./labelLayout.js";

export function createNativeLabelLayer({
  addScreenLine,
  addToGroup,
  getNativeTextTexture,
  labelHitRegions,
  labelOverrides,
  labelsEnabled,
  leadersEnabled,
  screenToGroup,
  threeText,
}) {
  const pendingLabels = [];

  function addTextSprite(text, x, y, z, options) {
    const pos = screenToGroup(x, y);
    return threeText(text, pos.x, pos.y, z, options);
  }

  function addDraggableLabelNative({
    key = null,
    line1 = "",
    line2 = "",
    anchorX = null,
    anchorY = null,
    defaultX = 0,
    defaultY = 0,
    z = 9,
    leaderRadius = 0,
    font1 = "12px system-ui, sans-serif",
    color1 = "rgba(255,255,255,0.82)",
    font2 = "11px system-ui, sans-serif",
    color2 = "rgba(255,255,255,0.58)",
    priority = 50,
    opacity = 1,
  } = {}) {
    if (!labelsEnabled) return null;
    const text1 = String(line1 || "").trim();
    const text2 = String(line2 || "").trim();
    if (!text1) return null;
    const tex1 = getNativeTextTexture(text1, { font: font1, color: color1 });
    if (!tex1?.image) return null;
    const w1 = Math.max(8, Number(tex1.image.width) || 8);
    const h1 = Math.max(8, Number(tex1.image.height) || 8);
    let w2 = 0;
    let h2 = 0;
    if (text2) {
      const tex2 = getNativeTextTexture(text2, { font: font2, color: color2 });
      w2 = Math.max(8, Number(tex2?.image?.width) || 8);
      h2 = Math.max(8, Number(tex2?.image?.height) || 8);
    }
    const showDist = !!text2;
    const boxW = (showDist ? Math.max(w1, w2) : w1) + 14;
    const boxH = showDist ? 34 : 22;
    pendingLabels.push({
      anchorX,
      anchorY,
      boxH,
      boxW,
      color1,
      color2,
      defaultX,
      defaultY,
      font1,
      font2,
      h1,
      h2,
      key,
      leaderRadius,
      opacity,
      priority,
      showDist,
      text1,
      text2,
      w1,
      w2,
      z,
    });
    return null;
  }

  function flushPendingLabels() {
    pendingLabels.sort((a, b) => b.priority - a.priority);
    const placed = [];
    for (const entry of pendingLabels) {
      const {
        anchorX,
        anchorY,
        boxH,
        boxW,
        color1,
        color2,
        defaultX,
        defaultY,
        font1,
        font2,
        h1,
        h2,
        key,
        leaderRadius,
        opacity,
        priority,
        showDist,
        text1,
        text2,
        w1,
        w2,
        z,
      } = entry;
      const userOffset = key ? labelOverrides.get(key) : null;
      let rect;
      let movedByUser = false;
      if (userOffset && Number.isFinite(userOffset.dx) && Number.isFinite(userOffset.dy)) {
        const ax = Number.isFinite(anchorX) ? anchorX : defaultX;
        const ay = Number.isFinite(anchorY) ? anchorY : defaultY;
        rect = { x: ax + userOffset.dx, y: ay + userOffset.dy, w: boxW, h: boxH };
        placed.push(rect);
        movedByUser = true;
      } else {
        rect = placeLabel8(placed, anchorX, anchorY, defaultX, defaultY, boxW, boxH, leaderRadius);
        if (!rect && priority >= 60) {
          rect = { x: defaultX, y: defaultY, w: boxW, h: boxH };
          placed.push(rect);
        }
        if (!rect) continue;
      }

      if (key) {
        labelHitRegions.push({
          kind: "label",
          key,
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          bodyX: Number.isFinite(anchorX) ? anchorX : null,
          bodyY: Number.isFinite(anchorY) ? anchorY : null,
        });
      }

      const op = Number.isFinite(opacity) ? opacity : 1;
      if (leadersEnabled && Number.isFinite(anchorX) && Number.isFinite(anchorY)) {
        const pinX = clamp(anchorX, rect.x, rect.x + rect.w);
        const pinY = clamp(anchorY, rect.y, rect.y + rect.h);
        const vx = pinX - anchorX;
        const vy = pinY - anchorY;
        const vlen = Math.hypot(vx, vy) || 1;
        const ux = vx / vlen;
        const uy = vy / vlen;
        const lineStartX = anchorX + ux * Math.max(2, Number(leaderRadius) * 0.75);
        const lineStartY = anchorY + uy * Math.max(2, Number(leaderRadius) * 0.75);
        const lineEndX = pinX - ux * 1.5;
        const lineEndY = pinY - uy * 1.5;
        if (Math.hypot(lineEndX - lineStartX, lineEndY - lineStartY) > 3) {
          addScreenLine(lineStartX, lineStartY, lineEndX, lineEndY, 0xb9c5df, 0.42 * op, z - 0.04);
        }
      }

      const lbl1 = addTextSprite(
        text1,
        rect.x + 8 + w1 * 0.5,
        rect.y + (showDist ? 6 : 4) + h1 * 0.5,
        z,
        { font: font1, color: color1, opacity: op },
      );
      if (lbl1) addToGroup(lbl1);

      if (showDist) {
        const lbl2 = addTextSprite(text2, rect.x + 8 + w2 * 0.5, rect.y + 18 + h2 * 0.5, z, {
          font: font2,
          color: color2,
          opacity: op,
        });
        if (lbl2) addToGroup(lbl2);
      }

      if (movedByUser && key) {
        const resetW = 12;
        const resetH = 12;
        const resetX = rect.x + rect.w + 2;
        const resetY = rect.y - 8;
        const resetLabel = addTextSprite(
          "x",
          resetX + resetW * 0.5,
          resetY + resetH * 0.5,
          z + 0.03,
          {
            font: "bold 12px system-ui, sans-serif",
            color: "rgba(255,170,170,0.95)",
          },
        );
        if (resetLabel) addToGroup(resetLabel);
        labelHitRegions.push({
          kind: "label-reset",
          key,
          x: resetX,
          y: resetY,
          w: resetW,
          h: resetH,
        });
      }
    }
  }

  return { addDraggableLabelNative, flushPendingLabels };
}
