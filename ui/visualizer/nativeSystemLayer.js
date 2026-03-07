import { clamp } from "../../engine/utils.js";

export function createNativeSystemLayer({
  THREE,
  addScreenLine,
  addToGroup,
  addTextAtScreen,
  circleFactory,
  computeAxisDirection,
  crossVec3,
  labelsEnabled,
  normalizeVec3,
  orbitOffsetToScreen,
  orbitPointToScreen,
  projectDirectionToScreen,
  screenToThree,
  centerScreenX,
  centerScreenY,
}) {
  function addPositionIndicatorNative(sx, sy, color = 0x9ec4ff, z = 3.8) {
    const arm = 4;
    addScreenLine(sx - arm, sy, sx + arm, sy, color, 0.82, z);
    addScreenLine(sx, sy - arm, sx, sy + arm, color, 0.82, z);
    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    const point = screenToThree(sx, sy, z + 0.01);
    circle.position.set(point.x, point.y, z + 0.01);
    addToGroup(circle);
  }

  function addAxialTiltOverlayNative(sx, sy, r, bodyId, axialTiltDeg, z = 4.6) {
    if (!(Number.isFinite(r) && r >= 3.5)) return;
    const axis = computeAxisDirection(bodyId, axialTiltDeg);
    if (!axis) return;
    const axisHalf = r * 0.95 * axis.foreshorten;
    const poleOffset = r * 0.72 * axis.foreshorten;
    const poleR = Math.max(0.75, r * 0.09);
    const tint = axis.retrograde ? 0xffaa82 : 0xa0dcff;
    addScreenLine(
      sx - axis.dx * axisHalf,
      sy - axis.dy * axisHalf,
      sx + axis.dx * axisHalf,
      sy + axis.dy * axisHalf,
      tint,
      0.55,
      z,
    );
    const front = new THREE.Mesh(
      new THREE.CircleGeometry(poleR, 16),
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    const frontPos = screenToThree(sx + axis.dx * poleOffset, sy + axis.dy * poleOffset, z + 0.02);
    front.position.set(frontPos.x, frontPos.y, z + 0.02);
    addToGroup(front);
    const back = new THREE.Mesh(
      new THREE.CircleGeometry(poleR * 0.85, 16),
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    const backPos = screenToThree(sx - axis.dx * poleOffset, sy - axis.dy * poleOffset, z + 0.01);
    back.position.set(backPos.x, backPos.y, z + 0.01);
    addToGroup(back);
  }

  function addRotationOverlayNative(sx, sy, r, bodyId, axialTiltDeg, spinAngleRad, z = 4.7) {
    if (!(Number.isFinite(r) && r >= 4.5)) return;
    const axis = computeAxisDirection(bodyId, axialTiltDeg);
    if (!axis) return;
    const a = normalizeVec3({ x: axis.vx, y: axis.vy, z: axis.vz });
    if (!a) return;
    const refUp = Math.abs(a.y) < 0.92 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const u = normalizeVec3(crossVec3(a, refUp));
    if (!u) return;
    const v = normalizeVec3(crossVec3(a, u));
    if (!v) return;
    const tint = axis.retrograde ? 0xffaa82 : 0xa0dcff;
    const markerCount = 3;
    for (let i = 0; i < markerCount; i += 1) {
      const t = spinAngleRad + (i / markerCount) * Math.PI * 2;
      const px3 = {
        x: u.x * Math.cos(t) + v.x * Math.sin(t),
        y: u.y * Math.cos(t) + v.y * Math.sin(t),
        z: u.z * Math.cos(t) + v.z * Math.sin(t),
      };
      const proj = projectDirectionToScreen(px3.x, px3.z, px3.y);
      const alpha = clamp(0.2 + 0.32 * (proj.depth + 1) * 0.5, 0.14, 0.58);
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(0.75, r * (0.07 + 0.01 * i)), 16),
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: alpha,
          depthWrite: false,
        }),
      );
      const mpos = screenToThree(sx + proj.x * r * 0.82, sy - proj.y * r * 0.82, z + 0.01 * i);
      marker.position.set(mpos.x, mpos.y, z + 0.01 * i);
      addToGroup(marker);
    }
  }

  function projectedOrbitLine(
    radiusPx,
    color,
    opacity = 1,
    segments = 220,
    inclinationDeg = 0,
    z = -6,
    orbitCenterX = centerScreenX,
    orbitCenterY = centerScreenY,
  ) {
    const points = [];
    const incRad = (Number(inclinationDeg) * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const ox = Math.cos(a) * radiusPx;
      const oy = Math.sin(a) * radiusPx;
      const proj = orbitOffsetToScreen(ox, oy * cosI, orbitCenterX, orbitCenterY, oy * sinI);
      points.push(screenToThree(proj.x, proj.y, z));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      }),
    );
  }

  function projectedDashedOrbitLine(
    radiusPx,
    color,
    opacity = 1,
    segments = 240,
    inclinationDeg = 0,
    z = -6,
    dashSteps = 6,
    gapSteps = 6,
    orbitCenterX = centerScreenX,
    orbitCenterY = centerScreenY,
  ) {
    const points = [];
    const incRad = (Number(inclinationDeg) * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    const cycle = Math.max(1, dashSteps + gapSteps);
    for (let i = 0; i < segments; i += 1) {
      if (i % cycle >= dashSteps) continue;
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0 = orbitOffsetToScreen(
        Math.cos(a0) * radiusPx,
        Math.sin(a0) * radiusPx * cosI,
        orbitCenterX,
        orbitCenterY,
        Math.sin(a0) * radiusPx * sinI,
      );
      const p1 = orbitOffsetToScreen(
        Math.cos(a1) * radiusPx,
        Math.sin(a1) * radiusPx * cosI,
        orbitCenterX,
        orbitCenterY,
        Math.sin(a1) * radiusPx * sinI,
      );
      points.push(screenToThree(p0.x, p0.y, z), screenToThree(p1.x, p1.y, z));
    }
    if (!points.length) return null;
    return new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      }),
    );
  }

  function projectedEllipseOrbitLine(
    semiMajorPx,
    eccentricity,
    argPeriapsisDeg,
    inclinationDeg = 0,
    color = 0x5f6c8a,
    opacity = 0.34,
    segments = 220,
    z = -6,
    orbitCenterX = centerScreenX,
    orbitCenterY = centerScreenY,
  ) {
    const e = clamp(eccentricity, 0, 0.99);
    const a = semiMajorPx;
    const b = a * Math.sqrt(1 - e * e);
    const cFocus = a * e;
    const omega = ((argPeriapsisDeg || 0) * Math.PI) / 180;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const incRad = (Number(inclinationDeg) * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
      const E = (i / segments) * Math.PI * 2;
      const xf = a * Math.cos(E) - cFocus;
      const zf = b * Math.sin(E);
      const xr = xf * cosW - zf * sinW;
      const zr = xf * sinW + zf * cosW;
      const pt = orbitOffsetToScreen(xr, zr * cosI, orbitCenterX, orbitCenterY, zr * sinI);
      points.push(screenToThree(pt.x, pt.y, z));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      }),
    );
  }

  function addApsisMarkersNative(
    semiMajorPx,
    eccentricity,
    argPeriapsisDeg,
    inclinationDeg,
    showLabels,
    orbitCenterX = centerScreenX,
    orbitCenterY = centerScreenY,
  ) {
    const e = clamp(eccentricity, 0, 0.99);
    if (e < 0.01) return;
    const markers = [
      {
        color: 0xffb43c,
        label: "Pe",
        pt: orbitPointToScreen(
          orbitCenterX,
          orbitCenterY,
          semiMajorPx,
          e,
          argPeriapsisDeg,
          inclinationDeg,
          0,
        ),
      },
      {
        color: 0x64b4ff,
        label: "Ap",
        pt: orbitPointToScreen(
          orbitCenterX,
          orbitCenterY,
          semiMajorPx,
          e,
          argPeriapsisDeg,
          inclinationDeg,
          Math.PI,
        ),
      },
    ];
    for (const marker of markers) {
      const stemH = 18;
      const triW = 7;
      const triH = 5;
      const topY = marker.pt.y - stemH;
      addScreenLine(marker.pt.x, marker.pt.y, marker.pt.x, topY + triH, marker.color, 0.6, 9);
      addToGroup(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            screenToThree(marker.pt.x, topY + triH, 9.2),
            screenToThree(marker.pt.x - triW / 2, topY, 9.2),
            screenToThree(marker.pt.x + triW / 2, topY, 9.2),
            screenToThree(marker.pt.x, topY + triH, 9.2),
          ]),
          new THREE.LineBasicMaterial({
            color: marker.color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
          }),
        ),
      );
      if (showLabels) {
        const label = addTextAtScreen(marker.label, marker.pt.x, topY - 5, 10, {
          font: "bold 10px system-ui, sans-serif",
          color: marker.color === 0xffb43c ? "rgba(255,180,60,0.95)" : "rgba(100,180,255,0.95)",
        });
        if (label) addToGroup(label);
      }
    }
  }

  function addHillSphereMarkerNative(sx, sy, hillPx, showLabels, showDistances, hillAu) {
    const radius = Math.max(6, hillPx);
    const ring = circleFactory(radius, 0xb48cff, 0.35, 120);
    const point = screenToThree(sx, sy, 8);
    ring.position.set(point.x, point.y, 8);
    addToGroup(ring);
    if (!showLabels) return;
    const hillLabel = addTextAtScreen("Hill", sx, sy - radius - 18, 10, {
      font: "bold 10px system-ui, sans-serif",
      color: "rgba(180,140,255,0.9)",
    });
    if (hillLabel) addToGroup(hillLabel);
    if (showDistances && Number.isFinite(hillAu)) {
      const distanceLabel = addTextAtScreen(`${hillAu.toFixed(3)} AU`, sx, sy - radius - 30, 10, {
        font: "9px system-ui, sans-serif",
        color: "rgba(180,140,255,0.72)",
      });
      if (distanceLabel) addToGroup(distanceLabel);
    }
  }

  function addLagrangeMarkerNative(screenX, screenY, label, mode) {
    const point = screenToThree(screenX, screenY, 9.5);
    if (mode === "trojan-unstable" || mode === "trojan") {
      const s = 4;
      addToGroup(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(point.x, point.y - s, 9.5),
            new THREE.Vector3(point.x + s, point.y, 9.5),
            new THREE.Vector3(point.x, point.y + s, 9.5),
            new THREE.Vector3(point.x - s, point.y, 9.5),
            new THREE.Vector3(point.x, point.y - s, 9.5),
          ]),
          new THREE.LineBasicMaterial({
            color: mode === "trojan" ? 0x50c8c8 : 0xffd37c,
            transparent: true,
            opacity: mode === "trojan" ? 0.72 : 0.3,
            depthWrite: false,
          }),
        ),
      );
      return;
    }
    const s = 6;
    addScreenLine(screenX - s, screenY, screenX + s, screenY, 0x50c8c8, 0.75, 9.5);
    addScreenLine(screenX, screenY - s, screenX, screenY + s, 0x50c8c8, 0.75, 9.5);
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 20),
      new THREE.MeshBasicMaterial({
        color: 0x50c8c8,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    dot.position.set(point.x, point.y, 9.6);
    addToGroup(dot);
    if (labelsEnabled) {
      const text = addTextAtScreen(label, screenX + 10, screenY - 6, 10, {
        font: "bold 10px system-ui, sans-serif",
        color: "rgba(80,200,200,0.92)",
      });
      if (text) addToGroup(text);
    }
  }

  function projectedOrbitBand(
    innerPx,
    outerPx,
    color,
    opacity = 0.12,
    segments = 220,
    inclinationDeg = 0,
    z = -8,
  ) {
    const incRad = (Number(inclinationDeg) * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    const vertexCount = (segments + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const outerProj = orbitOffsetToScreen(
        c * outerPx,
        s * outerPx * cosI,
        centerScreenX,
        centerScreenY,
        s * outerPx * sinI,
      );
      const innerProj = orbitOffsetToScreen(
        c * innerPx,
        s * innerPx * cosI,
        centerScreenX,
        centerScreenY,
        s * innerPx * sinI,
      );
      const outerPoint = screenToThree(outerProj.x, outerProj.y, z);
      const innerPoint = screenToThree(innerProj.x, innerProj.y, z);
      const base = i * 2;
      positions[(base + 0) * 3 + 0] = outerPoint.x;
      positions[(base + 0) * 3 + 1] = outerPoint.y;
      positions[(base + 0) * 3 + 2] = z;
      positions[(base + 1) * 3 + 0] = innerPoint.x;
      positions[(base + 1) * 3 + 1] = innerPoint.y;
      positions[(base + 1) * 3 + 2] = z;
      if (i < segments) {
        const next = base + 2;
        indices.push(base, base + 1, next);
        indices.push(base + 1, next + 1, next);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
  }

  return {
    addApsisMarkersNative,
    addAxialTiltOverlayNative,
    addHillSphereMarkerNative,
    addLagrangeMarkerNative,
    addPositionIndicatorNative,
    addRotationOverlayNative,
    projectedDashedOrbitLine,
    projectedEllipseOrbitLine,
    projectedOrbitBand,
    projectedOrbitLine,
  };
}
