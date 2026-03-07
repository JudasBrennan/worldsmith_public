import { clamp } from "../../engine/utils.js";

export function computePlanetPlacement(planetNode, metrics, options) {
  const {
    applyRepresentativeBodyRadiusConstraints,
    earthRadiusKm,
    hashUnit,
    mapAuToPx,
    physicalRadiusToPx,
    representativePlanetBaseRadiusPx,
    simTime,
    solveKeplerEquation,
    useEccentric,
    usePhysicalScale,
  } = options;
  const r = mapAuToPx(planetNode.au, metrics.minAu, metrics.maxAu, metrics.maxR);
  const baseAngle = hashUnit(planetNode.id) * Math.PI * 2;
  const auSafe = Math.max(planetNode.au, 0.05);
  const period =
    Number.isFinite(planetNode.periodDays) && planetNode.periodDays > 0
      ? planetNode.periodDays
      : null;
  const meanMotion = period
    ? (2 * Math.PI) / period
    : (2 * Math.PI) / (40 * Math.pow(auSafe, 1.35));

  const ecc =
    useEccentric && Number.isFinite(planetNode.eccentricity)
      ? clamp(planetNode.eccentricity, 0, 0.99)
      : 0;

  let ox;
  let oy;
  let angle;
  if (useEccentric && ecc > 0) {
    const M = baseAngle + meanMotion * simTime;
    const E = solveKeplerEquation(M, ecc);
    const a = r;
    const b = a * Math.sqrt(1 - ecc * ecc);
    const cFocus = a * ecc;
    const argW = ((Number(planetNode.longitudeOfPeriapsisDeg) || 0) * Math.PI) / 180;
    const cosW = Math.cos(argW);
    const sinW = Math.sin(argW);
    const xf = a * Math.cos(E) - cFocus;
    const zf = b * Math.sin(E);
    ox = xf * cosW - zf * sinW;
    oy = xf * sinW + zf * cosW;
    angle = Math.atan2(oy, ox);
  } else {
    angle = baseAngle + meanMotion * simTime;
    ox = Math.cos(angle) * r;
    oy = Math.sin(angle) * r;
  }

  const incDeg = useEccentric ? Number(planetNode.inclinationDeg) || 0 : 0;
  const incRad = (incDeg * Math.PI) / 180;
  const cosI = Math.cos(incRad);
  const sinI = Math.sin(incRad);
  const oyVert = oy * sinI;
  const oyFlat = oy * cosI;

  const planetRadiusKm =
    Number.isFinite(planetNode.radiusEarth) && planetNode.radiusEarth > 0
      ? planetNode.radiusEarth * earthRadiusKm
      : null;
  const pr = usePhysicalScale
    ? physicalRadiusToPx(planetRadiusKm, metrics.starR, metrics.starRadiusKm, 0, Infinity)
    : applyRepresentativeBodyRadiusConstraints(
        representativePlanetBaseRadiusPx(planetNode, metrics.bodyZoom),
        metrics,
      );
  return { r, baseAngle, angle, ox, oy: oyFlat, oyVert, pr };
}

export function computeGasGiantPlacement(
  gasGiant,
  idx,
  metrics,
  starMassMsol,
  { mapAuToPx, simTime },
) {
  const r = mapAuToPx(gasGiant.au, metrics.minAu, metrics.maxAu, metrics.maxR);
  const baseAngle = (0.15 + idx * 0.13) * Math.PI * 2;
  const ggPeriod =
    gasGiant.au && starMassMsol ? Math.sqrt(gasGiant.au ** 3 / starMassMsol) * 365.256 : 220;
  const omega = (2 * Math.PI) / ggPeriod;
  const angle = baseAngle + omega * simTime;
  const ox = Math.cos(angle) * r;
  const oy = Math.sin(angle) * r;
  return { r, baseAngle, angle, ox, oy };
}

export function estimateMoonOrbitMaxPx(moons, parentRadiusPx) {
  const parentR = Math.max(0, Number(parentRadiusPx) || 0);
  const list = Array.isArray(moons) ? moons : [];
  if (!list.length) return parentR;

  const axes = list
    .map((m) => Number(m?.semiMajorAxisKm))
    .filter((v) => Number.isFinite(v) && v > 0);
  const minAxis = axes.length ? Math.min(...axes) : null;
  const maxAxis = axes.length ? Math.max(...axes) : null;
  const moonBand = Math.max(parentR * 0.6, 8 * (list.length - 1), 12);
  const orbitInner = parentR + Math.max(10, parentR * 0.2);

  let maxOrbit = parentR;
  for (let i = 0; i < list.length; i += 1) {
    const axisKm = Number(list[i]?.semiMajorAxisKm);
    let orbitR = orbitInner + i * 8;
    if (
      Number.isFinite(axisKm) &&
      Number.isFinite(minAxis) &&
      Number.isFinite(maxAxis) &&
      maxAxis > minAxis
    ) {
      const t =
        (Math.log10(axisKm) - Math.log10(minAxis)) / (Math.log10(maxAxis) - Math.log10(minAxis));
      orbitR = orbitInner + t * moonBand;
    }
    if (orbitR > maxOrbit) maxOrbit = orbitR;
  }
  return maxOrbit;
}

export function desiredFocusZoom({
  currentZoom,
  defaultZoom,
  focusMinZoom,
  getFocusMaxZoom,
  kind,
  id,
  metrics,
  snapshot,
  zoomMin,
  computeGasGiantPlacement,
  computePlanetPlacement,
  getGasGiantRadiusPx,
}) {
  const minDim = Math.min(metrics.W, metrics.H);
  const safeCurrentZoom = Math.max(zoomMin, Number(currentZoom) || defaultZoom);

  let currentExtentPx = 0;
  let targetExtentPx = 0;

  if (kind === "star") {
    currentExtentPx = Math.max(1, metrics.starR);
    targetExtentPx = minDim * 0.22;
  } else if (kind === "planet") {
    const p = snapshot.planetNodes?.find((node) => node.id === id);
    if (!p) {
      return clamp(Math.max(safeCurrentZoom * 1.28, focusMinZoom), focusMinZoom, getFocusMaxZoom());
    }
    const placement = computePlanetPlacement(p, metrics);
    const planetR = Math.max(1, Number(placement?.pr) || 1);
    const moonOrbitMax = estimateMoonOrbitMaxPx(p.moons, planetR);
    currentExtentPx = Math.max(planetR, moonOrbitMax);
    targetExtentPx = (Array.isArray(p.moons) && p.moons.length ? 0.34 : 0.18) * minDim;
  } else if (kind === "gasGiant") {
    const gasGiants = snapshot.gasGiants || [];
    const idx = gasGiants.findIndex((g) => g.id === id);
    if (idx < 0) {
      return clamp(Math.max(safeCurrentZoom * 1.28, focusMinZoom), focusMinZoom, getFocusMaxZoom());
    }
    const g = gasGiants[idx];
    const placement = computeGasGiantPlacement(g, idx, metrics, snapshot.starMassMsol);
    const gasR = Math.max(1, Number(getGasGiantRadiusPx(g, metrics)) || 1);
    const moonOrbitMax = estimateMoonOrbitMaxPx(g.moons, gasR);
    currentExtentPx = Math.max(
      gasR,
      moonOrbitMax,
      Number(placement?.r) ? Math.min(placement.r, gasR * 3) : 0,
    );
    targetExtentPx = (Array.isArray(g.moons) && g.moons.length ? 0.3 : 0.2) * minDim;
  } else {
    return clamp(Math.max(safeCurrentZoom * 1.28, focusMinZoom), focusMinZoom, getFocusMaxZoom());
  }

  if (!(currentExtentPx > 0) || !(targetExtentPx > 0)) {
    return clamp(Math.max(safeCurrentZoom * 1.28, focusMinZoom), focusMinZoom, getFocusMaxZoom());
  }

  const zoomRatio = targetExtentPx / currentExtentPx;
  const desired = safeCurrentZoom * zoomRatio;
  return clamp(Math.max(desired, safeCurrentZoom), focusMinZoom, getFocusMaxZoom());
}

export function hitTestBody(bodyHitRegions, x, y) {
  let best = null;
  let bestDist2 = Infinity;
  for (const hit of bodyHitRegions || []) {
    const dx = x - hit.x;
    const dy = y - hit.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > hit.r * hit.r) continue;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = hit;
    }
  }
  return best;
}

export function hitTestLabelUi(labelHitRegions, x, y) {
  for (let i = (labelHitRegions?.length || 0) - 1; i >= 0; i -= 1) {
    const hit = labelHitRegions[i];
    if (!hit) continue;
    if (x < hit.x || x > hit.x + hit.w || y < hit.y || y > hit.y + hit.h) continue;
    return hit;
  }
  return null;
}

export function syncFocusPan({
  clearFocusTarget,
  computeGasGiantPlacement,
  computePlanetPlacement,
  metrics,
  projectOrbitOffset,
  snapshot,
  state,
}) {
  if (!state.focusTargetId || !state.focusTargetKind) return;

  if (state.focusTargetKind === "star") {
    state.panX = 0;
    state.panY = 0;
    return;
  }

  let placement = null;
  if (state.focusTargetKind === "planet") {
    const p = snapshot.planetNodes?.find((node) => node.id === state.focusTargetId);
    if (!p) {
      clearFocusTarget();
      return;
    }
    placement = computePlanetPlacement(p, metrics);
  } else if (state.focusTargetKind === "gasGiant") {
    const gasGiants = snapshot.gasGiants || [];
    const idx = gasGiants.findIndex((g) => g.id === state.focusTargetId);
    if (idx < 0) {
      clearFocusTarget();
      return;
    }
    placement = computeGasGiantPlacement(gasGiants[idx], idx, metrics, snapshot.starMassMsol);
  } else {
    clearFocusTarget();
    return;
  }

  const projected = projectOrbitOffset(placement.ox, placement.oy, placement.oyVert || 0);
  state.panX = -projected.x;
  state.panY = projected.y;
}

export function easeFocusZoom({ state, dt, zoomMin, getZoomMax, cameraZoomRate }) {
  if (!state.focusTargetId) return false;
  const targetZoom = clamp(
    Number.isFinite(state.focusZoomTarget) ? state.focusZoomTarget : state.zoom,
    zoomMin,
    getZoomMax(),
  );
  if (Math.abs(targetZoom - state.zoom) < 0.002) return false;
  const alpha = 1 - Math.exp(-cameraZoomRate * Math.max(1 / 240, Math.min(0.2, dt)));
  state.zoom += (targetZoom - state.zoom) * alpha;
  state.zoomTarget = state.zoom;
  return true;
}

export function applyInertia({
  state,
  dt,
  inertiaDecayRate,
  inertiaMinVelPx,
  inertiaMinVelRad,
  systemPitchMin,
  systemPitchMax,
  clusterPitchMin = -1.45,
  clusterPitchMax = 1.45,
}) {
  const alpha = 1 - Math.exp(-inertiaDecayRate * dt);
  let moving = false;
  if (Math.abs(state.panVelX) > inertiaMinVelPx || Math.abs(state.panVelY) > inertiaMinVelPx) {
    state.panX += state.panVelX * dt;
    state.panY += state.panVelY * dt;
    state.panVelX *= 1 - alpha;
    state.panVelY *= 1 - alpha;
    moving = true;
  } else {
    state.panVelX = 0;
    state.panVelY = 0;
  }
  if (Math.abs(state.yawVel) > inertiaMinVelRad || Math.abs(state.pitchVel) > inertiaMinVelRad) {
    state.yaw += state.yawVel * dt;
    const pitchMin = state.mode === "cluster" ? clusterPitchMin : systemPitchMin;
    const pitchMax = state.mode === "cluster" ? clusterPitchMax : systemPitchMax;
    state.pitch = clamp(state.pitch + state.pitchVel * dt, pitchMin, pitchMax);
    state.yawVel *= 1 - alpha;
    state.pitchVel *= 1 - alpha;
    moving = true;
  } else {
    state.yawVel = 0;
    state.pitchVel = 0;
  }
  return moving;
}

export function applyZoomInterpolation({
  state,
  dt,
  cameraZoomRate,
  canvasWidth,
  canvasHeight,
  devicePixelRatio,
}) {
  if (!Number.isFinite(state.zoomTarget)) {
    state.zoomTarget = state.zoom;
    return false;
  }
  const diff = Math.abs(state.zoomTarget - state.zoom);
  if (diff < 0.001 * Math.max(0.01, Math.abs(state.zoom))) {
    state.zoom = state.zoomTarget;
    return false;
  }
  const alpha = 1 - Math.exp(-cameraZoomRate * dt);
  const oldZoom = state.zoom;
  state.zoom += (state.zoomTarget - state.zoom) * alpha;
  if (!state.focusTargetId && state.zoomCursorX != null) {
    const dpr = devicePixelRatio || 1;
    const cx = canvasWidth / dpr / 2 + state.panX;
    const cy = canvasHeight / dpr / 2 + state.panY;
    const factor = state.zoom / oldZoom;
    state.panX += (state.zoomCursorX - cx) * (1 - factor);
    state.panY += (state.zoomCursorY - cy) * (1 - factor);
  }
  return true;
}

export function applyResetEasing({ state, dt, resetRate }) {
  if (!state.resetting || !state.resetTargets) return false;
  const t = state.resetTargets;
  const alpha = 1 - Math.exp(-resetRate * dt);
  state.panX += (t.panX - state.panX) * alpha;
  state.panY += (t.panY - state.panY) * alpha;
  state.yaw += (t.yaw - state.yaw) * alpha;
  state.pitch += (t.pitch - state.pitch) * alpha;
  state.zoom += (t.zoom - state.zoom) * alpha;
  state.zoomTarget = state.zoom;
  const moving =
    Math.abs(t.panX - state.panX) > 0.3 ||
    Math.abs(t.panY - state.panY) > 0.3 ||
    Math.abs(t.yaw - state.yaw) > 0.002 ||
    Math.abs(t.pitch - state.pitch) > 0.002 ||
    Math.abs(t.zoom - state.zoom) > 0.002;
  if (!moving) {
    state.panX = t.panX;
    state.panY = t.panY;
    state.yaw = t.yaw;
    state.pitch = t.pitch;
    state.zoom = t.zoom;
    state.zoomTarget = t.zoom;
    state.resetting = false;
    state.resetTargets = null;
  }
  return moving;
}

export function killInertia(state) {
  state.panVelX = 0;
  state.panVelY = 0;
  state.yawVel = 0;
  state.pitchVel = 0;
}
