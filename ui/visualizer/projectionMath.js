import { clamp } from "../../engine/utils.js";

export function formatAuLabel(au) {
  const num = Number(au);
  if (!Number.isFinite(num)) return "n/a";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAuRangeLabel(innerAu, outerAu) {
  const inner = Number(innerAu);
  const outer = Number(outerAu);
  if (!Number.isFinite(inner) || !Number.isFinite(outer)) return "";
  return `${formatAuLabel(inner)}-${formatAuLabel(outer)}`;
}

export function buildOffscaleZoneInfo(
  snapshot,
  coreMaxAu,
  {
    enabledFrost = true,
    enabledHz = true,
    minZoneAu = 200,
    rangeRatio = 1.3,
    suppressAll = false,
    zoneRatio = 20,
  } = {},
) {
  const info = {
    thresholdAu: Math.max(minZoneAu, coreMaxAu * zoneRatio),
    hideHz: false,
    hideFrost: false,
    lines: [],
  };
  if (suppressAll) return info;
  const hzInnerRaw = Number(snapshot?.sys?.habitableZoneAu?.inner);
  const hzOuterRaw = Number(snapshot?.sys?.habitableZoneAu?.outer);
  if (enabledHz && Number.isFinite(hzInnerRaw) && Number.isFinite(hzOuterRaw) && hzOuterRaw > 0) {
    const hzi = Math.max(0.000001, Math.min(hzInnerRaw, hzOuterRaw));
    const hzo = Math.max(hzi, Math.max(hzInnerRaw, hzOuterRaw));
    if (hzi > info.thresholdAu || hzo > info.thresholdAu * rangeRatio) {
      info.hideHz = true;
      info.lines.push(`Habitable zone: ${formatAuRangeLabel(hzi, hzo)} AU`);
    }
  }
  const frostAu = Number(snapshot?.sys?.frostLineAu);
  if (enabledFrost && Number.isFinite(frostAu) && frostAu > info.thresholdAu) {
    info.hideFrost = true;
    info.lines.push(`H2O frost line: ${formatAuLabel(frostAu)} AU`);
  }
  return info;
}

export function parseHexColorNumber(hex, fallback = 0xfff4dc) {
  const raw = String(hex || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return fallback;
  return Number.parseInt(raw, 16);
}

export function projectOrbitOffset(ox, oz, yaw, pitch, oy = 0) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const xr = ox * cosYaw - oz * sinYaw;
  const zr = ox * sinYaw + oz * cosYaw;
  return {
    x: xr,
    y: oy - zr * sp,
    depth: zr * cp,
  };
}

export function orbitOffsetToScreen(ox, oz, cx, cy, yaw, pitch, oy = 0) {
  const p = projectOrbitOffset(ox, oz, yaw, pitch, oy);
  return {
    x: cx + p.x,
    y: cy - p.y,
    depth: p.depth,
  };
}

export function solveKeplerEquation(Mraw, e) {
  const M = ((Mraw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let E = M;
  for (let i = 0; i < 6; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

export function orbitPointToScreen(
  cx,
  cy,
  semiMajorPx,
  ecc,
  argPeriapsisDeg,
  inclinationDeg,
  trueAnomalyRad,
  yaw,
  pitch,
) {
  const e = clamp(ecc, 0, 0.99);
  const a = semiMajorPx;
  const omega = ((argPeriapsisDeg || 0) * Math.PI) / 180;
  const cosW = Math.cos(omega);
  const sinW = Math.sin(omega);
  const incRad = (inclinationDeg * Math.PI) / 180;
  const cosI = Math.cos(incRad);
  const sinI = Math.sin(incRad);
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));
  const xOrb = r * Math.cos(trueAnomalyRad);
  const zOrb = r * Math.sin(trueAnomalyRad);
  const xr = xOrb * cosW - zOrb * sinW;
  const zr = xOrb * sinW + zOrb * cosW;
  const oy = zr * sinI;
  const zTilted = zr * cosI;
  return orbitOffsetToScreen(xr, zTilted, cx, cy, yaw, pitch, oy);
}

export function projectDirectionToScreen(vx, vz, yaw, pitch, vy = 0) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const xr = vx * cosYaw - vz * sinYaw;
  const zr = vx * sinYaw + vz * cosYaw;
  return {
    x: xr,
    y: vy - zr * sp,
    depth: zr * cp,
  };
}

export function normalizeAxialTiltDeg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return clamp(n, 0, 180);
}

export function normalizeVec3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(len) || len < 1e-9) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function crossVec3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function computeSpinAngleRad(
  bodyId,
  rotationPeriodDays,
  axialTiltDeg,
  simTime,
  hashFn = () => 0,
) {
  const phase = hashFn(`${bodyId}:spin`) * Math.PI * 2;
  const period = Number(rotationPeriodDays);
  if (!Number.isFinite(period) || period <= 0) return phase;
  const dir = normalizeAxialTiltDeg(axialTiltDeg) > 90 ? -1 : 1;
  return phase + dir * simTime * ((2 * Math.PI) / period);
}

export function computeAxisDirection(bodyId, axialTiltDeg, yaw, pitch, hashFn = () => 0) {
  const tilt = normalizeAxialTiltDeg(axialTiltDeg);
  const retrograde = tilt > 90;
  const obliquityRad = ((retrograde ? 180 - tilt : tilt) * Math.PI) / 180;
  const axisAzimuth = hashFn(`${bodyId}:axis`) * Math.PI * 2;
  const horizontal = Math.sin(obliquityRad);
  const vx = horizontal * Math.cos(axisAzimuth);
  const vz = horizontal * Math.sin(axisAzimuth);
  const vy = Math.cos(obliquityRad) * (retrograde ? -1 : 1);
  const projected = projectDirectionToScreen(vx, vz, yaw, pitch, vy);
  const dx = projected.x;
  const dy = -projected.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 1e-6) return null;
  return { dx: dx / len, dy: dy / len, foreshorten: len, retrograde, vx, vy, vz };
}
