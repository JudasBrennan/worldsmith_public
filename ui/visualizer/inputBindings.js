import { captureCanvasGif, downloadCanvasPng } from "../canvasExport.js";

function mapTouches(touches) {
  return Array.from(touches).map((touch) => ({
    id: touch.identifier,
    x: touch.clientX,
    y: touch.clientY,
  }));
}

export function bindVisualizerInputBindings({
  addCleanup,
  addDisposableListener,
  root,
  canvas,
  overlayCanvas,
  vizLayout,
  offscaleNoteEl,
  state,
  elements,
  constants,
  helpers,
  animation,
}) {
  const {
    chkLabels,
    chkLabelLeaders,
    chkMoons,
    chkOrbits,
    chkHz,
    chkDebris,
    chkEccentric,
    chkPeAp,
    chkHill,
    chkLagrange,
    chkFrost,
    chkDistances,
    chkGrid,
    chkRotation,
    chkAxialTilt,
    chkClickFocusBodies,
    chkClickFocusStar,
    chkDebug,
    btnRefresh,
    btnPlay,
    btnResetView,
    btnControls,
    vizDropdown,
    btnFullscreen,
    btnExportImage,
    btnExportGif,
    rngSpeed,
    rngBodyScale,
    txtBodyScale,
    bodyScaleRow,
    helpOverlay,
    helpSystemSection,
    helpClusterSection,
    btnHelp,
    btnHelpClose,
    chkClusterLabels,
    chkClusterLinks,
    chkClusterAxes,
    chkClusterGrid,
    chkClusterStars,
    btnClusterRefresh,
    btnClusterPlay,
    rngClusterSpeed,
    vizToastClose,
  } = elements;
  const {
    defaultYaw,
    defaultPitch,
    defaultZoom,
    pitchMin,
    pitchMax,
    zoomMin,
    clusterDefaultYaw,
    clusterDefaultPitch,
    clusterDefaultZoom,
    clusterZoomMin,
    clusterZoomMax,
    inertiaMinVelPx,
    inertiaMinVelRad,
    controlsTipHtml,
  } = constants;
  const {
    clamp,
    clearFocusTarget,
    draw,
    easeFocusZoom,
    exportFileName,
    getFocusMaxZoom,
    getOffscaleNoticeTopPx,
    getSnapshot,
    getZoomMax,
    hideToast,
    hitTestBody,
    hitTestLabelUi,
    invalidateSnapshot,
    isLive,
    isPhysicalScale,
    killInertia,
    refreshClusterSnapshot,
    setFocusTarget,
    startCameraLoop,
    syncExportButtons,
    updateClusterSpeedUI,
    updateSpeedUI,
    updateStarBursts,
  } = helpers;

  let dragMode = null;
  let draggedLabel = null;
  let lastX = 0;
  let lastY = 0;
  let lastMoveTime = 0;
  let draggedDuringPointer = false;
  let suppressPlanetClickUntilMs = 0;
  let clickTimer = null;
  let lastClickHit = null;
  let activeTouches = [];
  let touchMode = null;
  let lastTouchDist = 0;
  let lastTouchMidX = 0;
  let lastTouchMidY = 0;
  let helpOverlayVisible = false;

  addCleanup(() => {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = null;
    lastClickHit = null;
  });

  function setDropdownOpen(open) {
    if (!vizDropdown || !btnControls) return;
    vizDropdown.style.display = open ? "" : "none";
    btnControls.innerHTML = `${controlsTipHtml || ""} Controls ${open ? "\u25B4" : "\u25BE"}`;
    if (offscaleNoteEl?.style.display !== "none") {
      offscaleNoteEl.style.top = `${getOffscaleNoticeTopPx()}px`;
    }
  }

  function syncHelpSections() {
    if (helpSystemSection) helpSystemSection.style.display = state.mode === "system" ? "" : "none";
    if (helpClusterSection)
      helpClusterSection.style.display = state.mode === "cluster" ? "" : "none";
  }

  function showHelpOverlay() {
    if (!helpOverlay) return;
    helpOverlayVisible = true;
    helpOverlay.style.display = "";
    helpOverlay.setAttribute("aria-hidden", "false");
    syncHelpSections();
  }

  function hideHelpOverlay() {
    if (!helpOverlay) return;
    helpOverlayVisible = false;
    helpOverlay.style.display = "none";
    helpOverlay.setAttribute("aria-hidden", "true");
  }

  function handleSingleClickBody(hit) {
    state.focusTargetKind = hit.kind;
    state.focusTargetId = hit.id;
    state.focusZoomTarget = state.zoom;
    draw();
  }

  function handleDoubleClickBody(hit) {
    const snapshot = getSnapshot();
    setFocusTarget(hit.kind, hit.id, snapshot);
    draw();
    startCameraLoop();
  }

  addDisposableListener(canvas, "contextmenu", (event) => {
    event.preventDefault();
  });

  addDisposableListener(canvas, "mousedown", (event) => {
    killInertia();
    state.resetting = false;
    state.resetTargets = null;
    if (state.mode === "system" && event.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const labelHit = hitTestLabelUi(x, y);
      if (labelHit?.kind === "label-reset" && labelHit.key) {
        state.labelOverrides.delete(labelHit.key);
        draw();
        event.preventDefault();
        return;
      }
      if (labelHit?.kind === "label" && labelHit.key) {
        dragMode = "label";
        state.dragging = true;
        canvas.style.cursor = "grabbing";
        draggedLabel = {
          key: labelHit.key,
          pointerDx: x - labelHit.x,
          pointerDy: y - labelHit.y,
          bodyX: labelHit.bodyX ?? labelHit.x,
          bodyY: labelHit.bodyY ?? labelHit.y,
        };
        draggedDuringPointer = false;
        lastX = event.clientX;
        lastY = event.clientY;
        lastMoveTime = performance.now() / 1000;
        event.preventDefault();
        return;
      }
    }
    if (state.mode === "cluster") {
      dragMode = "rotate";
      state.dragging = true;
    } else if (event.button === 0) {
      dragMode = state.focusTargetId ? "rotate" : "pan";
    } else if (event.button === 2) {
      dragMode = "rotate";
    } else {
      return;
    }
    if (event.button === 2) event.preventDefault();
    draggedDuringPointer = false;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveTime = performance.now() / 1000;
  });

  addDisposableListener(window, "mouseup", () => {
    if (!dragMode) return;
    const wasDrag = dragMode;
    dragMode = null;
    draggedLabel = null;
    state.dragging = false;
    if (state.mode === "system") canvas.style.cursor = "grab";
    if (draggedDuringPointer) suppressPlanetClickUntilMs = performance.now() + 140;
    if (wasDrag === "pan" || wasDrag === "rotate") {
      const hasPanInertia =
        Math.abs(state.panVelX) > inertiaMinVelPx || Math.abs(state.panVelY) > inertiaMinVelPx;
      const hasRotInertia =
        Math.abs(state.yawVel) > inertiaMinVelRad || Math.abs(state.pitchVel) > inertiaMinVelRad;
      if (hasPanInertia || hasRotInertia) startCameraLoop();
    }
  });

  addDisposableListener(window, "mousemove", (event) => {
    if (!isLive() || !dragMode) return;
    if (dragMode === "label") {
      if (!draggedLabel?.key) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const nextRectX = x - draggedLabel.pointerDx;
      const nextRectY = y - draggedLabel.pointerDy;
      state.labelOverrides.set(draggedLabel.key, {
        dx: nextRectX - draggedLabel.bodyX,
        dy: nextRectY - draggedLabel.bodyY,
      });
      draggedDuringPointer = true;
      lastX = event.clientX;
      lastY = event.clientY;
      draw();
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const now = performance.now() / 1000;
    const moveDt = now - lastMoveTime;
    lastMoveTime = now;
    if (!draggedDuringPointer && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      draggedDuringPointer = true;
      if (state.mode === "system" && state.focusTargetId && dragMode === "pan") {
        dragMode = "rotate";
      }
    }
    if (state.mode === "cluster") {
      state.yaw -= dx * 0.006;
      state.pitch = clamp(state.pitch + dy * 0.004, -1.45, 1.45);
      if (moveDt > 0 && moveDt < 0.2) {
        state.yawVel = (-dx * 0.006) / moveDt;
        state.pitchVel = (dy * 0.004) / moveDt;
      }
    } else if (dragMode === "pan") {
      state.panX += dx;
      state.panY += dy;
      if (moveDt > 0 && moveDt < 0.2) {
        state.panVelX = dx / moveDt;
        state.panVelY = dy / moveDt;
      }
    } else if (dragMode === "rotate") {
      state.yaw -= dx * 0.006;
      state.pitch = clamp(state.pitch + dy * 0.004, pitchMin, pitchMax);
      if (moveDt > 0 && moveDt < 0.2) {
        state.yawVel = (-dx * 0.006) / moveDt;
        state.pitchVel = (dy * 0.004) / moveDt;
      }
    }
    lastX = event.clientX;
    lastY = event.clientY;
    draw();
  });

  addDisposableListener(canvas, "click", (event) => {
    if (!isLive() || state.mode === "cluster") return;
    if (performance.now() < suppressPlanetClickUntilMs) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const labelHit = hitTestLabelUi(x, y);
    if (labelHit?.kind === "label-reset" && labelHit.key) {
      state.labelOverrides.delete(labelHit.key);
      draw();
      return;
    }
    if (labelHit) return;
    const hit = hitTestBody(x, y);
    if (!hit?.id || !hit?.kind) {
      if (state.focusTargetId) {
        clearFocusTarget();
        draw();
      }
      return;
    }
    const allowBodyFocus = chkClickFocusBodies?.checked !== false;
    const allowStarFocus = chkClickFocusStar?.checked !== false;
    if (hit.kind === "star" && !allowStarFocus) return;
    if ((hit.kind === "planet" || hit.kind === "gasGiant") && !allowBodyFocus) return;
    if (clickTimer && lastClickHit?.id === hit.id && lastClickHit?.kind === hit.kind) {
      clearTimeout(clickTimer);
      clickTimer = null;
      lastClickHit = null;
      handleDoubleClickBody(hit);
      return;
    }
    if (clickTimer) clearTimeout(clickTimer);
    lastClickHit = { id: hit.id, kind: hit.kind };
    clickTimer = setTimeout(() => {
      clickTimer = null;
      if (lastClickHit) handleSingleClickBody(lastClickHit);
      lastClickHit = null;
    }, 250);
  });

  addDisposableListener(window, "keydown", (event) => {
    if (event.key !== "Escape") return;
    if (helpOverlayVisible) {
      hideHelpOverlay();
      return;
    }
    if (state.focusTargetId) {
      clearFocusTarget();
      draw();
    }
  });

  const wheelOptions = { passive: false };
  addDisposableListener(
    canvas,
    "wheel",
    (event) => {
      if (!isLive() || state.transitioning) return;
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      if (state.mode === "cluster") {
        const base = Number.isFinite(state.zoomTarget) ? state.zoomTarget : state.zoom;
        state.zoomTarget = clamp(base * (delta > 0 ? 0.92 : 1.08), clusterZoomMin, clusterZoomMax);
        startCameraLoop();
        return;
      }
      if (state.focusTargetId) {
        const focusBase = Number.isFinite(state.focusZoomTarget)
          ? state.focusZoomTarget
          : state.zoom;
        state.focusZoomTarget = clamp(focusBase * (delta > 0 ? 0.9 : 1.1), zoomMin, getZoomMax());
        state.zoomTarget = state.focusZoomTarget;
        startCameraLoop();
        return;
      }
      const base = Number.isFinite(state.zoomTarget) ? state.zoomTarget : state.zoom;
      const nextTarget = clamp(base * (delta > 0 ? 0.9 : 1.1), zoomMin, getZoomMax());
      const rect = canvas.getBoundingClientRect();
      state.zoomCursorX = event.clientX - rect.left;
      state.zoomCursorY = event.clientY - rect.top;
      state.zoomTarget = nextTarget;
      startCameraLoop();
    },
    wheelOptions,
  );

  addDisposableListener(
    canvas,
    "touchstart",
    (event) => {
      event.preventDefault();
      killInertia();
      state.resetting = false;
      state.resetTargets = null;
      activeTouches = mapTouches(event.touches);
      lastMoveTime = performance.now() / 1000;
      if (activeTouches.length === 1) {
        touchMode = "rotate";
      } else if (activeTouches.length >= 2) {
        touchMode = "pinch-pan";
        const [touch0, touch1] = activeTouches;
        lastTouchDist = Math.hypot(touch1.x - touch0.x, touch1.y - touch0.y);
        lastTouchMidX = (touch0.x + touch1.x) / 2;
        lastTouchMidY = (touch0.y + touch1.y) / 2;
      }
    },
    { passive: false },
  );

  addDisposableListener(
    canvas,
    "touchmove",
    (event) => {
      event.preventDefault();
      const touches = Array.from(event.touches);
      const now = performance.now() / 1000;
      const moveDt = now - lastMoveTime;
      lastMoveTime = now;

      if (touchMode === "rotate" && touches.length === 1) {
        const prev = activeTouches[0];
        const curr = touches[0];
        if (!prev) {
          activeTouches = mapTouches(touches);
          return;
        }
        const dx = curr.clientX - prev.x;
        const dy = curr.clientY - prev.y;
        state.yaw -= dx * 0.006;
        const nextPitchMin = state.mode === "cluster" ? -1.45 : pitchMin;
        const nextPitchMax = state.mode === "cluster" ? 1.45 : pitchMax;
        state.pitch = clamp(state.pitch + dy * 0.004, nextPitchMin, nextPitchMax);
        if (moveDt > 0 && moveDt < 0.2) {
          state.yawVel = (-dx * 0.006) / moveDt;
          state.pitchVel = (dy * 0.004) / moveDt;
        }
        draw();
      }

      if (touchMode === "pinch-pan" && touches.length >= 2) {
        const [touch0, touch1] = touches;
        const dist = Math.hypot(touch1.clientX - touch0.clientX, touch1.clientY - touch0.clientY);
        const midX = (touch0.clientX + touch1.clientX) / 2;
        const midY = (touch0.clientY + touch1.clientY) / 2;
        if (lastTouchDist > 0 && dist > 0) {
          const scale = dist / lastTouchDist;
          const zoomFloor = state.mode === "cluster" ? clusterZoomMin : zoomMin;
          const zoomCeiling = state.mode === "cluster" ? clusterZoomMax : getZoomMax();
          state.zoom = clamp(state.zoom * scale, zoomFloor, zoomCeiling);
          state.zoomTarget = state.zoom;
        }
        if (state.mode === "system" && !state.focusTargetId) {
          state.panX += midX - lastTouchMidX;
          state.panY += midY - lastTouchMidY;
        }
        if (state.focusTargetId) state.focusZoomTarget = state.zoom;
        lastTouchDist = dist;
        lastTouchMidX = midX;
        lastTouchMidY = midY;
        draw();
      }

      activeTouches = mapTouches(touches);
    },
    { passive: false },
  );

  addDisposableListener(
    canvas,
    "touchend",
    (event) => {
      const remaining = event.touches.length;
      if (remaining === 0) {
        const hasInertia =
          Math.abs(state.yawVel) > inertiaMinVelRad || Math.abs(state.pitchVel) > inertiaMinVelRad;
        if (hasInertia) startCameraLoop();
        touchMode = null;
        activeTouches = [];
        return;
      }
      activeTouches = mapTouches(event.touches);
      if (remaining === 1) {
        touchMode = "rotate";
        return;
      }
      if (activeTouches.length >= 2) {
        lastTouchDist = Math.hypot(
          activeTouches[1].x - activeTouches[0].x,
          activeTouches[1].y - activeTouches[0].y,
        );
        lastTouchMidX = (activeTouches[0].x + activeTouches[1].x) / 2;
        lastTouchMidY = (activeTouches[0].y + activeTouches[1].y) / 2;
      }
    },
    { passive: false },
  );

  addDisposableListener(btnRefresh, "click", () => {
    invalidateSnapshot();
    draw();
  });

  updateSpeedUI();
  syncExportButtons();
  addDisposableListener(rngSpeed, "input", () => {
    updateSpeedUI();
    if (!state.isPlaying) draw();
  });

  addDisposableListener(rngBodyScale, "input", () => {
    state.bodyScale = Number(rngBodyScale.value) / 100;
    txtBodyScale.textContent = `${rngBodyScale.value}%`;
    if (!state.isPlaying) draw();
  });

  addDisposableListener(btnExportImage, "click", async () => {
    if (state.exportingGif) return;
    try {
      draw();
      const target = state.mode === "cluster" ? overlayCanvas : canvas;
      await downloadCanvasPng(target, exportFileName("png"));
    } catch (err) {
      console.error("[viz] Could not export PNG image.", err);
    }
  });

  addDisposableListener(btnExportGif, "click", async () => {
    const playing = state.mode === "cluster" ? state.clusterIsPlaying : state.isPlaying;
    if (!playing || state.exportingGif) return;
    state.exportingGif = true;
    syncExportButtons();
    const originalLabel = btnExportGif?.textContent || "Download GIF";
    if (btnExportGif) btnExportGif.textContent = "Recording GIF...";
    animation.stopTickLoop();
    const gifTarget = state.mode === "cluster" ? overlayCanvas : canvas;
    try {
      await captureCanvasGif({
        canvas: gifTarget,
        filename: exportFileName("gif"),
        fps: 12,
        seconds: 4,
        renderFrame: ({ frameIndex, deltaTimeSec }) => {
          if (state.mode === "cluster") {
            if (frameIndex > 0) state.yaw += deltaTimeSec * 0.2 * state.clusterSpinSpeed;
            draw();
            return;
          }
          if (frameIndex > 0) {
            state.simTime += deltaTimeSec * state.speed;
            state.activityTime += deltaTimeSec * state.speed;
            const snapshot = getSnapshot();
            updateStarBursts(deltaTimeSec, snapshot, state.activityTime * 86400);
          }
          if (state.focusTargetId) easeFocusZoom(deltaTimeSec);
          const snapshot = getSnapshot();
          draw(snapshot);
        },
        onStatus: (status) => {
          if (!btnExportGif) return;
          if (status === "loading") btnExportGif.textContent = "Loading encoder...";
          else if (status === "recording") btnExportGif.textContent = "Recording GIF...";
          else if (status === "encoding") btnExportGif.textContent = "Encoding GIF...";
        },
      });
    } catch (err) {
      console.error("[viz] Could not export GIF animation.", err);
    } finally {
      state.exportingGif = false;
      if (btnExportGif) btnExportGif.textContent = originalLabel;
      syncExportButtons();
      if (isLive()) {
        const isPlaying = state.mode === "cluster" ? state.clusterIsPlaying : state.isPlaying;
        if (isPlaying && !animation.isTickScheduled()) {
          if (state.mode === "cluster") state.clusterLastTick = 0;
          else state.lastTick = 0;
          animation.startTickLoop();
        }
      }
      draw();
    }
  });

  addDisposableListener(btnPlay, "click", () => {
    state.isPlaying = !state.isPlaying;
    btnPlay.textContent = state.isPlaying ? "Pause" : "Play";
    state.lastTick = 0;
    if (state.isPlaying) {
      animation.stopCameraLoop();
      animation.startTickLoop();
    } else {
      animation.stopTickLoop();
    }
    syncExportButtons();
  });

  addDisposableListener(btnResetView, "click", () => {
    if (state.focusTargetId) clearFocusTarget();
    killInertia();
    state.resetting = true;
    state.resetTargets =
      state.mode === "cluster"
        ? {
            yaw: clusterDefaultYaw,
            pitch: clusterDefaultPitch,
            zoom: clusterDefaultZoom,
            panX: 0,
            panY: 0,
          }
        : {
            yaw: defaultYaw,
            pitch: defaultPitch,
            zoom: defaultZoom,
            panX: 0,
            panY: 0,
          };
    state.zoomTarget = state.resetTargets.zoom;
    startCameraLoop();
  });

  addDisposableListener(btnControls, "click", (event) => {
    event.stopPropagation();
    const isOpen = vizDropdown.style.display !== "none";
    setDropdownOpen(!isOpen);
  });

  addDisposableListener(document, "mousedown", (event) => {
    if (
      vizDropdown.style.display !== "none" &&
      !vizDropdown.contains(event.target) &&
      event.target !== btnControls &&
      !btnControls.contains(event.target)
    ) {
      setDropdownOpen(false);
    }
  });

  addDisposableListener(btnFullscreen, "click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (vizLayout.requestFullscreen) {
      vizLayout.requestFullscreen();
    } else if (vizLayout.webkitRequestFullscreen) {
      vizLayout.webkitRequestFullscreen();
    }
  });

  function onFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;
    btnFullscreen.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  }

  addDisposableListener(document, "fullscreenchange", onFullscreenChange);
  addDisposableListener(document, "webkitfullscreenchange", onFullscreenChange);

  addDisposableListener(btnHelp, "click", (event) => {
    event.stopPropagation();
    if (helpOverlayVisible) hideHelpOverlay();
    else showHelpOverlay();
  });
  addDisposableListener(btnHelpClose, "click", hideHelpOverlay);
  addDisposableListener(helpOverlay, "click", (event) => {
    if (event.target === helpOverlay) hideHelpOverlay();
  });

  [
    chkLabels,
    chkLabelLeaders,
    chkMoons,
    chkOrbits,
    chkHz,
    chkDebris,
    chkEccentric,
    chkPeAp,
    chkHill,
    chkLagrange,
    chkFrost,
    chkDistances,
    chkGrid,
    chkRotation,
    chkAxialTilt,
    chkClickFocusBodies,
    chkClickFocusStar,
    chkDebug,
  ].forEach((element) => {
    addDisposableListener(element, "change", draw);
  });

  root.querySelectorAll('[name="vizDistanceScale"]').forEach((element) => {
    addDisposableListener(element, "change", draw);
  });

  root.querySelectorAll('[name="vizSizeScale"]').forEach((element) => {
    addDisposableListener(element, "change", () => {
      state.zoom = clamp(state.zoom, zoomMin, getZoomMax());
      if (Number.isFinite(state.focusZoomTarget)) {
        state.focusZoomTarget = clamp(state.focusZoomTarget, zoomMin, getFocusMaxZoom());
      }
      if (bodyScaleRow) bodyScaleRow.style.display = isPhysicalScale() ? "none" : "";
      draw();
    });
  });

  addDisposableListener(canvas, "mousemove", (event) => {
    if (state.mode !== "cluster") return;
    const rect = canvas.getBoundingClientRect();
    state.clusterMouseX = event.clientX - rect.left;
    state.clusterMouseY = event.clientY - rect.top;
    if (!state.clusterIsPlaying && !state.transitioning) draw();
  });

  addDisposableListener(canvas, "mouseleave", () => {
    state.clusterMouseX = null;
    state.clusterMouseY = null;
    if (state.mode === "cluster" && !state.clusterIsPlaying && !state.transitioning) draw();
  });

  addDisposableListener(btnClusterRefresh, "click", () => {
    refreshClusterSnapshot();
    draw();
  });

  addDisposableListener(btnClusterPlay, "click", () => {
    state.clusterIsPlaying = !state.clusterIsPlaying;
    if (btnClusterPlay) btnClusterPlay.textContent = state.clusterIsPlaying ? "Pause" : "Play";
    if (state.clusterIsPlaying) {
      state.clusterLastTick = 0;
      animation.startTickLoop();
    } else {
      animation.stopTickLoop();
    }
    syncExportButtons();
  });

  addDisposableListener(rngClusterSpeed, "input", () => {
    updateClusterSpeedUI();
  });

  [chkClusterLabels, chkClusterLinks, chkClusterAxes, chkClusterGrid, chkClusterStars]
    .filter(Boolean)
    .forEach((element) => addDisposableListener(element, "change", draw));

  root.querySelectorAll('[name="clusterBearingUnit"]').forEach((element) => {
    addDisposableListener(element, "change", draw);
  });

  addDisposableListener(vizToastClose, "click", hideToast);

  addDisposableListener(window, "worldsmith:worldChanged", () => {
    invalidateSnapshot();
    state.clusterSnapshot = null;
    draw();
    if (state.mode === "system") startCameraLoop();
  });

  addDisposableListener(window, "storage", (event) => {
    if (event.key && event.key.includes("worldsmith")) {
      invalidateSnapshot();
      state.clusterSnapshot = null;
      draw();
      if (state.mode === "system") startCameraLoop();
    }
  });

  return {
    syncModeUi() {
      if (helpOverlayVisible) syncHelpSections();
    },
  };
}
