/**
 * Cluster drawing functions extracted from the local-cluster visualiser.
 * All functions are pure — they receive their dependencies as parameters.
 */

import { calcLocalCluster } from "../engine/localCluster.js";
import { getClusterObjectVisual, normalizeClusterObjectKey } from "./clusterObjectVisuals.js";
import { clamp, fmt } from "../engine/utils.js";
import { getClusterAdjustments, getClusterInputs, loadWorld } from "./store.js";

/* ── Constants ───────────────────────────────────────────────── */

const CAMERA_DISTANCE_FACTOR = 3.4;
const RANGE_RING_SEGMENTS = 96;

/* ── 3-D math helpers ────────────────────────────────────────── */

export function rotatePoint(point, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = point.x * cy - point.z * sy;
  const z1 = point.x * sy + point.z * cy;
  const y1 = point.y * cp - z1 * sp;
  const z2 = point.y * sp + z1 * cp;
  return { x: x1, y: y1, z: z2 };
}

export function polarPointOnXZ(radiusLy, angleRadFromNorth) {
  return {
    x: radiusLy * Math.sin(angleRadFromNorth),
    y: 0,
    z: radiusLy * Math.cos(angleRadFromNorth),
  };
}

export function formatLyDistance(ly) {
  const value = Math.max(0, Number(ly) || 0);
  if (value >= 100) return fmt(value, 0);
  if (value >= 10) return fmt(value, 1);
  return fmt(value, 2);
}

/* ── Ring projection helpers ─────────────────────────────────── */

function traceProjectedXZRingPath(
  ctx,
  snapshot,
  W,
  H,
  ringLy,
  projectFn,
  segments = RANGE_RING_SEGMENTS,
) {
  ctx.beginPath();
  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const pt = projectFn(polarPointOnXZ(ringLy, angle), snapshot, W, H);
    if (s === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
}

function projectedXZRingMaxRadius(
  snapshot,
  W,
  H,
  radiusLy,
  projectFn,
  segments = RANGE_RING_SEGMENTS,
) {
  const cx = W * 0.5;
  const cy = H * 0.5;
  let maxR = 0;
  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const pt = projectFn(polarPointOnXZ(radiusLy, angle), snapshot, W, H);
    const dist = Math.hypot(pt.x - cx, pt.y - cy);
    if (dist > maxR) maxR = dist;
  }
  return maxR;
}

/* ── Star rendering ──────────────────────────────────────────── */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function drawStarDot(ctx, cx, cy, radius, color, alpha) {
  const [r, g, b] = hexToRgb(color);
  const cr = Math.min(255, Math.round(r * 0.5 + 255 * 0.5));
  const cg = Math.min(255, Math.round(g * 0.5 + 255 * 0.5));
  const cb = Math.min(255, Math.round(b * 0.5 + 255 * 0.5));
  const outerR = Math.max(radius * 2.6, 2);
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, outerR);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  grad.addColorStop(0.42, `rgba(${r},${g},${b},${(alpha * 0.78).toFixed(2)})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
  ctx.fill();
}

function drawCompanions(ctx, px, py, primaryRadius, components, perspective) {
  const companionCount = components.length - 1;
  if (companionCount <= 0) return;
  const cRadius = clamp(primaryRadius * 0.55, 1.0, 5.5);
  const spacing = cRadius * 2.4;
  const startX = px + primaryRadius * 1.15;
  const startY = py - primaryRadius * 0.85;
  const p = clamp(perspective, 0.35, 2.3);
  const alpha = clamp(0.38 + p * 0.2, 0.28, 0.78);
  for (let i = 0; i < companionCount; i++) {
    const comp = components[i + 1];
    const compVisual = getClusterObjectVisual(comp.objectClassKey);
    drawStarDot(ctx, startX + i * spacing, startY, cRadius, compVisual.color, alpha);
  }
}

export function formatClusterSystemLabel(system) {
  if (!Array.isArray(system.components) || system.components.length <= 1) {
    const k = system.objectClassKey;
    return k === "LTY" ? "L/T/Y" : k === "OTHER" ? "Other" : k;
  }
  return system.components
    .map((c) => {
      const k = normalizeClusterObjectKey(c.objectClassKey);
      return k === "LTY" ? "L/T/Y" : k === "OTHER" ? "Other" : k;
    })
    .join(" + ");
}

/* ── Projection ──────────────────────────────────────────────── */

/**
 * Project a 3-D point to 2-D screen coordinates with perspective.
 */
export function projectClusterPoint(point, snapshot, W, H, yaw, pitch, zoom) {
  const rotated = rotatePoint(point, yaw, pitch);
  const radius = snapshot.radiusLy;
  const cameraDistance = radius * CAMERA_DISTANCE_FACTOR;
  const perspective = cameraDistance / Math.max(0.0001, cameraDistance - rotated.z);
  const baseScale = ((Math.min(W, H) * 0.34) / radius) * zoom;
  return {
    x: W * 0.5 + rotated.x * baseScale * perspective,
    y: H * 0.5 - rotated.y * baseScale * perspective,
    depth: rotated.z,
    perspective,
  };
}

/* ── Axes ────────────────────────────────────────────────────── */

function drawAxes(ctx, snapshot, W, H, projectFn) {
  const axisLength = snapshot.radiusLy * 1.1;
  const axes = [
    {
      label: "X",
      color: "rgba(255,130,130,0.8)",
      from: { x: -axisLength, y: 0, z: 0 },
      to: { x: axisLength, y: 0, z: 0 },
    },
    {
      label: "Y",
      color: "rgba(130,255,180,0.8)",
      from: { x: 0, y: -axisLength, z: 0 },
      to: { x: 0, y: axisLength, z: 0 },
    },
    {
      label: "Z",
      color: "rgba(140,180,255,0.8)",
      from: { x: 0, y: 0, z: -axisLength },
      to: { x: 0, y: 0, z: axisLength },
    },
  ];
  for (const axis of axes) {
    const p0 = projectFn(axis.from, snapshot, W, H);
    const p1 = projectFn(axis.to, snapshot, W, H);
    ctx.strokeStyle = axis.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.fillStyle = axis.color;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(axis.label, p1.x + 5, p1.y + 2);
  }
}

/* ── Range / bearing grid ────────────────────────────────────── */

function drawRangeGrid(ctx, snapshot, W, H, projectFn, useMils) {
  const radiusLy = Math.max(0.001, Number(snapshot?.radiusLy) || 0);
  if (!(radiusLy > 0)) return;

  const ringCount = 4;
  const ringsLy = [];
  for (let i = 1; i <= ringCount; i++) ringsLy.push(radiusLy * (i / ringCount));

  ctx.save();
  for (let i = 0; i < ringsLy.length; i++) {
    const ringLy = ringsLy[i];
    const alpha = i === ringsLy.length - 1 ? 0.2 : 0.12;
    ctx.strokeStyle = `rgba(196,216,255,${alpha})`;
    ctx.lineWidth = 1;
    traceProjectedXZRingPath(ctx, snapshot, W, H, ringLy, projectFn);
    ctx.stroke();

    const labelPoint = projectFn(polarPointOnXZ(ringLy, Math.PI / 2), snapshot, W, H);
    ctx.fillStyle = "rgba(186,208,248,0.82)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${formatLyDistance(ringLy)} ly`, labelPoint.x + 8, labelPoint.y);
  }

  const degreeMarks = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const deg of degreeMarks) {
    const angle = (deg * Math.PI) / 180;
    const innerTick = projectFn(polarPointOnXZ(radiusLy * 0.985, angle), snapshot, W, H);
    const outerTick = projectFn(polarPointOnXZ(radiusLy * 1.03, angle), snapshot, W, H);
    const labelPoint = projectFn(polarPointOnXZ(radiusLy * 1.09, angle), snapshot, W, H);
    ctx.strokeStyle = "rgba(210,226,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerTick.x, innerTick.y);
    ctx.lineTo(outerTick.x, outerTick.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(205,220,248,0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const bearingLabel = useMils ? `${Math.round((deg / 360) * 6400)} mil` : `${deg}\u00B0`;
    ctx.fillText(bearingLabel, labelPoint.x, labelPoint.y);
  }
  ctx.restore();
}

/* ── Snapshot builder ────────────────────────────────────────── */

export function buildClusterSnapshot() {
  const world = loadWorld();
  const model = calcLocalCluster(getClusterInputs(world));
  const adjustments = getClusterAdjustments(world);
  const baseSystems = applyClusterAdjustments(model.systems, adjustments);
  const customNames =
    world?.clusterSystemNames && typeof world.clusterSystemNames === "object"
      ? world.clusterSystemNames
      : {};
  const homeSystemName =
    typeof world?.star?.name === "string" && world.star.name.trim()
      ? world.star.name.trim()
      : "home star system";
  const systems = baseSystems.map((system) => ({
    ...system,
    name: (() => {
      const override = String(customNames?.[system.id] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (override) return override.slice(0, 80);
      return system.isHome ? homeSystemName : system.name;
    })(),
    distanceLy: Number(system.distanceLy) || 0,
    objectClassKey: normalizeClusterObjectKey(system.objectClassKey, { isHome: system.isHome }),
  }));
  return {
    model,
    systems,
    radiusLy: Math.max(1, Number(model.inputs.neighbourhoodRadiusLy) || 1),
    systemCount: systems.length,
    generatedCount: Math.max(0, systems.length - 1),
  };
}

function applyClusterAdjustments(engineSystems, adjustments) {
  const removedSet = new Set(adjustments.removedSystemIds);
  const systems = [];
  for (const sys of engineSystems) {
    if (removedSet.has(sys.id)) continue;
    const override = adjustments.componentOverrides[sys.id];
    if (override) {
      systems.push({
        ...sys,
        components: override.components,
        multiplicity: override.multiplicity,
      });
    } else {
      systems.push(sys);
    }
  }
  for (const sys of adjustments.addedSystems) {
    systems.push(sys);
  }
  return systems;
}

/* ── Main scene renderer ─────────────────────────────────────── */

/**
 * Draw the full cluster scene onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W   canvas CSS width
 * @param {number} H   canvas CSS height
 * @param {{ yaw: number, pitch: number, zoom: number, dragging: boolean }} camState
 * @param {object} snapshot   from buildClusterSnapshot()
 * @param {{ labels: boolean, links: boolean, axes: boolean, rangeGrid: boolean,
 *           useMils: boolean, mouseX: number|null, mouseY: number|null }} opts
 * @returns {{ hoverEntry: object|null }}  info for cursor styling
 */
export function drawClusterScene(ctx, W, H, camState, snapshot, opts) {
  const projectFn = (point, snap, w, h) =>
    projectClusterPoint(point, snap, w, h, camState.yaw, camState.pitch, camState.zoom);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "rgba(4, 7, 20, 1)");
  bgGrad.addColorStop(1, "rgba(2, 5, 16, 1)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Project all systems
  const plotted = snapshot.systems.map((system) => {
    const screen = projectFn(system, snapshot, W, H);
    const visual = getClusterObjectVisual(system.objectClassKey, { isHome: system.isHome });
    const baseRadius = system.isHome ? 5.2 : 2.9;
    const pointRadius = clamp(baseRadius * screen.perspective, 1.6, 9.5);
    return { system, screen, pointRadius, visual };
  });

  // Neighbourhood boundary
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  const centerX = W * 0.5;
  const centerY = H * 0.5;
  const radiusLy = Math.max(0.001, Number(snapshot?.radiusLy) || 0);
  const boundaryR = projectedXZRingMaxRadius(snapshot, W, H, radiusLy, projectFn);
  ctx.beginPath();
  ctx.arc(centerX, centerY, boundaryR, 0, Math.PI * 2);
  ctx.stroke();

  // Grid + axes
  if (opts.rangeGrid) drawRangeGrid(ctx, snapshot, W, H, projectFn, opts.useMils);
  if (opts.axes) drawAxes(ctx, snapshot, W, H, projectFn);

  // Sort by depth (back to front)
  plotted.sort((a, b) => a.screen.depth - b.screen.depth);
  const homeEntry = plotted.find((item) => item.system.isHome);

  // Vertical links
  if (opts.links) {
    for (const item of plotted) {
      if (item.system.isHome) continue;
      const planePoint = { x: item.system.x, y: 0, z: item.system.z };
      const planeScreen = projectFn(planePoint, snapshot, W, H);
      const alpha = clamp(0.08 + item.screen.perspective * 0.08, 0.05, 0.22);
      ctx.strokeStyle = `rgba(140,180,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(planeScreen.x, planeScreen.y);
      ctx.lineTo(item.screen.x, item.screen.y);
      ctx.stroke();
    }
  }

  // Stars
  for (const item of plotted) {
    const { system, screen, visual } = item;
    const radius = item.pointRadius;
    const { x: sx, y: sy } = screen;

    if (system.isHome) {
      const glow = ctx.createRadialGradient(sx, sy, radius * 0.3, sx, sy, radius * 2.4);
      glow.addColorStop(0, "rgba(255,245,185,0.98)");
      glow.addColorStop(0.42, "rgba(255,236,160,0.90)");
      glow.addColorStop(0.72, "rgba(255,188,110,0.55)");
      glow.addColorStop(1, "rgba(255,160,80,0)");
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,200,0.99)";
      ctx.fill();
    } else {
      const p = clamp(screen.perspective, 0.35, 2.3);
      const alpha = clamp(0.45 + p * 0.25, 0.35, 0.9);
      drawStarDot(ctx, sx, sy, radius, visual.color, alpha);
      if (Array.isArray(system.components) && system.components.length > 1) {
        drawCompanions(ctx, sx, sy, radius, system.components, screen.perspective);
      }
    }
  }

  // Labels
  if (opts.labels) {
    const rLy = Math.max(1, Number(snapshot?.radiusLy) || 1);
    const maxLabels = Math.max(4, Math.round(160 / rLy));

    const candidates = [
      homeEntry,
      ...plotted
        .filter((item) => !item.system.isHome)
        .sort((a, b) => b.screen.perspective - a.screen.perspective),
    ];

    const drawnBoxes = [];
    function labelBounds(lx, sy, line1, line2) {
      const w = Math.max(line1.length * 7, line2.length * 6.2) + 6;
      return { x1: lx - 2, y1: sy - 22, x2: lx + w, y2: sy + 5 };
    }
    function collides(box) {
      const m = 3;
      for (const b of drawnBoxes) {
        if (box.x1 < b.x2 + m && box.x2 > b.x1 - m && box.y1 < b.y2 + m && box.y2 > b.y1 - m)
          return true;
      }
      return false;
    }

    let drawn = 0;
    for (const entry of candidates) {
      if (!entry) continue;
      if (!entry.system.isHome && drawn >= maxLabels) break;
      const { system, screen } = entry;
      const classLabel = formatClusterSystemLabel(system);
      const line1 = system.name;
      const line2 = `${classLabel} | ${fmt(system.distanceLy, 2)} ly`;
      let labelX;
      if (system.isHome) {
        labelX = screen.x + Math.max(14, entry.pointRadius * 2.4 + 8);
      } else {
        const companionCount = Array.isArray(system.components) ? system.components.length - 1 : 0;
        if (companionCount > 0) {
          const cRadius = clamp(entry.pointRadius * 0.55, 1.0, 5.5);
          const rightEdge =
            entry.pointRadius * 1.15 + (companionCount - 1) * cRadius * 2.4 + cRadius * 2.6;
          labelX = screen.x + rightEdge + 6;
        } else {
          labelX = screen.x + 8;
        }
      }

      const box = labelBounds(labelX, screen.y, line1, line2);
      if (!system.isHome && collides(box)) continue;
      drawnBoxes.push(box);
      if (!system.isHome) drawn++;

      ctx.fillStyle = system.isHome ? "rgba(255,245,190,0.95)" : "rgba(220,232,255,0.85)";
      ctx.font = system.isHome ? "12px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.fillText(line1, labelX, screen.y - 10);
      ctx.fillStyle = system.isHome ? "rgba(245,228,172,0.88)" : "rgba(185,208,248,0.78)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(line2, labelX, screen.y + 3);
    }
  }

  // Hover label
  let hoverEntry = null;
  if (opts.mouseX != null && opts.mouseY != null) {
    let closestDist = Infinity;
    for (const item of plotted) {
      const hitR = Math.max(item.pointRadius * 2.6, 10);
      const d = Math.hypot(item.screen.x - opts.mouseX, item.screen.y - opts.mouseY);
      if (d < hitR && d < closestDist) {
        closestDist = d;
        hoverEntry = item;
      }
    }
    if (hoverEntry) {
      const { system, screen } = hoverEntry;
      const classLabel = formatClusterSystemLabel(system);
      const hLine1 = system.name;
      const hLine2 = `${classLabel} | ${fmt(system.distanceLy, 2)} ly`;
      const companionCount = Array.isArray(system.components) ? system.components.length - 1 : 0;
      let hLabelX;
      if (system.isHome) {
        hLabelX = screen.x + Math.max(14, hoverEntry.pointRadius * 2.4 + 8);
      } else if (companionCount > 0) {
        const cRadius = clamp(hoverEntry.pointRadius * 0.55, 1.0, 5.5);
        const rightEdge =
          hoverEntry.pointRadius * 1.15 + (companionCount - 1) * cRadius * 2.4 + cRadius * 2.6;
        hLabelX = screen.x + rightEdge + 6;
      } else {
        hLabelX = screen.x + 8;
      }
      ctx.fillStyle = system.isHome ? "rgba(255,255,210,1.0)" : "rgba(245,252,255,1.0)";
      ctx.font = system.isHome
        ? "bold 12px system-ui, sans-serif"
        : "bold 11px system-ui, sans-serif";
      ctx.fillText(hLine1, hLabelX, screen.y - 10);
      ctx.fillStyle = system.isHome ? "rgba(255,240,185,0.98)" : "rgba(205,225,255,0.98)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(hLine2, hLabelX, screen.y + 3);
    }
  }

  return { hoverEntry };
}
