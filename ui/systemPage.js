import { calcSystem } from "../engine/system.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import {
  loadWorld,
  updateWorld,
  listPlanets,
  listMoons,
  assignPlanetToSlot,
  assignMoonToPlanet,
  selectPlanet,
  selectMoon,
  togglePlanetLock,
  toggleMoonLock,
  listSystemGasGiants,
  listSystemDebrisDisks,
} from "./store.js";
import { styleLabel } from "./gasGiantStyles.js";

const TIP_LABEL = {
  "Star Mass": "Input your star's mass, in solar masses, here. Our sun = 1 Msol.",
  "Habitable Zone":
    "A planet orbiting within this region receives Earth-like stellar heating.\n\nWorldSmith Web uses an updated temperature-dependent habitable-zone model (S_in/S_out vary with effective temperature), based on Chromant's Desmos correction.\n\nThis intentionally deviates from the spreadsheet's fixed sqrt(L/1.1) and sqrt(L/0.53) approach, which generally places the outer edge too close in.",
  "Star Luminosity": "The amount of light your star emits in solar luminosities. Our sun = 1 Lsol.",
  "Star Radius": "How big your star is. Our sun = 1 Rsol",
  "Star Density": "The density of your star. Our sun = 1 Dsol",
  "Habitable Zone (Inner)":
    "The inner boundary, in AU, of your system's habitable zone using the updated temperature-dependent HZ model (not the spreadsheet's fixed constants).\n\n1 AU = ~150,000,000 km.",
  "Habitable Zone (Outer)":
    "The outer boundary, in AU, of your system's habitable zone using the updated temperature-dependent HZ model (not the spreadsheet's fixed constants).\n\nThis boundary is typically farther out than the spreadsheet result.\n\n1 AU = ~150,000,000 km.",
  "H2O Frost Line":
    "The distance from your star where is it cold enough for volatile compounds like water, ammonia, methane, carbon dioxide etc to exist as ices.\n\nGas planets may only be placed beyond the frost line.",
  "Spacing Factor":
    "The spreadsheet uses Bode's Law to logarithmically space potential planetary orbits. The value you input here modifies the logarithmic spacing.\n\nFor our solar system the value is 0.3.",
  "System Inner Limit":
    "The inner limit of your planetary system, given by the Roche limit. Planets cannot orbit closer to your star than this.",
  "Orbit 1":
    "Enter in the orbit of your first planet out from your star, in AU, here. It must orbit beyond the System Inner Limit.",
  "Orbit 2":
    "The spreadsheet then computes a list of additional stable orbits for your planetary system.\n\nGreen orbit slots represent stable orbits that fall within your habitable zone. Grey orbit slots represent orbits beyond your system's H2O frost line.\n\nHabitable Earth-like planets may be placed on green orbits.\n\nGas giants may only be placed on grey orbits. The first grey orbit will be home to your system's largest gas giant. The orbit immediately inwards of this orbit will likely be either empty or an asteroid belt.\n\nIf any orbit falls within 0.15 AU of an adjacent orbit, a planet cannot be placed in that orbit. In all other cases, orbits may be filled or left empty at your discretion.",
  "Debris Disk": "Debris disk regions in your system. Managed on the Other Objects tab.",
  "Planets in system":
    "Assign created inner planets to valid orbital slots. Each slot can hold at most one planet.",
  "Orbit slots":
    "These are the currently available orbital slots for inner planets after gas giant and debris constraints are applied.",
  "Orbit Slots (AU)": "List of generated orbit distances in astronomical units.",
  Name: "Name used in system lists, visualiser labels, and exports.",
  Orbit: "Orbital distance from the star in astronomical units (AU).",
  "Visual style": "Visualiser-only appearance preset for gas giant markers.",
  "Outer debris disk name": "Name used for the computed outer debris disk.",
  "Inner debris disk name": "Name used for the optional inner debris disk.",
  "Inner edge": "Inner boundary of the debris disk in astronomical units (AU).",
  "Outer edge": "Outer boundary of the debris disk in astronomical units (AU).",
};

function orbitSlotToleranceAu(slotAu) {
  return Math.max(0.05, slotAu * 0.02);
}

export function initSystemPage(mountEl) {
  const defaults = {
    spacingFactor: 0.33,
    orbit1Au: 0.62,
  };

  const world = loadWorld();
  const state = {
    starMassMsol: Number(world.star.massMsol),
    spacingFactor: Number.isFinite(world.system.spacingFactor)
      ? Number(world.system.spacingFactor)
      : defaults.spacingFactor,
    orbit1Au: Number.isFinite(world.system.orbit1Au)
      ? Number(world.system.orbit1Au)
      : defaults.orbit1Au,
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--system" aria-hidden="true"></span><span>Planetary System</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Tune Spacing Factor and Orbit 1 to generate slot spacing, then assign inner planets to available orbit slots.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">

          <div class="label">Derived Data ${tipIcon(TIP_LABEL["Star Mass"] || "")}</div>
          <div class="hint">Read-only. Change it on the Star tab.</div>
          <div class="derived-readout" id="massDisplay"></div>

          <div style="height:8px"></div>

          ${numWithSlider("spacing", "Spacing Factor", "", "Controls orbit slot spacing.", 0, 10, 0.01)}
          ${numWithSlider("orbit1", "Orbit 1", "AU", "First orbit slot.", 0.0001, 1000000, 0.01)}

          <div style="height:10px"></div>
          <div class="hint">Gas giants are managed on the <a href="#/planet">Planets</a> tab. Debris disks are managed on the <a href="#/outer">Other Objects</a> tab.</div>

          <div class="button-row">
            <button class="primary" id="btn-apply">Apply</button>
            <button id="btn-sol">Sol-ish Preset</button>
            <button id="btn-reset">Reset to Defaults</button>
          </div>

          <div class="hint" style="margin-top:10px">
            Tip: adjust Orbit 1 and Spacing to get a nice distribution of orbit slots around the habitable zone.
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="kpis"></div>

          <div style="margin-top:14px">
            <div class="label">Planets in system ${tipIcon(TIP_LABEL["Planets in system"] || "")}</div>
            <div class="hint">Drag planets into orbit slots. One planet per slot.</div>
            <div class="dropzone" id="unassignedZone">
              <div class="dropzone-title">Unassigned planets</div>
              <div id="unassignedPlanets"></div>
            </div>

            <div style="height:10px"></div>
            <div class="dropzone" id="unassignedMoonsZone">
              <div class="dropzone-title">Unassigned moons</div>
              <div id="unassignedMoons"></div>
            </div>

            <div style="height:14px"></div>
<div class="label">Orbit slots ${tipIcon(TIP_LABEL["Orbit slots"] || "")}</div>
            <div class="hint">One planet per slot. Manage planets on the Planets tab.</div>
            <div id="slotsUi" style="margin-top:10px"></div>

            <div style="height:10px"></div>
            <div class="label">Derived orbit slots (AU) ${tipIcon(TIP_LABEL["Orbit Slots (AU)"] || "")}</div>
            <div class="hint">Generated orbit positions (1-20).</div>
            <div class="derived-readout" id="orbits"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const massDisplay = wrap.querySelector("#massDisplay");

  const spacingEl = wrap.querySelector("#spacing");
  const orbit1El = wrap.querySelector("#orbit1");

  const kpisEl = wrap.querySelector("#kpis");
  const unassignedEl = wrap.querySelector("#unassignedPlanets");
  const unassignedMoonsEl = wrap.querySelector("#unassignedMoons");
  const slotsUiEl = wrap.querySelector("#slotsUi");
  const orbitsEl = wrap.querySelector("#orbits");

  // Bind sliders
  bindPair("spacing", spacingEl, 0, 10, 0.01, "auto");
  bindPair("orbit1", orbit1El, 0.0001, 1000000, 0.01, "auto");

  function bindPair(id, numberEl, min, max, step, mode) {
    const sliderEl = wrap.querySelector(`#${id}_slider`);
    const minEl = wrap.querySelector(`#${id}_min`);
    const maxEl = wrap.querySelector(`#${id}_max`);
    minEl.textContent = String(min);
    maxEl.textContent = String(max);
    bindNumberAndSlider({ numberEl, sliderEl, min, max, step, mode });
  }

  let isRendering = false;

  function getGasGiants(w) {
    return listSystemGasGiants(w).sort((a, b) => a.au - b.au);
  }

  function getDebrisDisks(w) {
    return listSystemDebrisDisks(w);
  }

  function mapGasGiantsToSlots(orbitsAu, gasGiants) {
    const bySlot = new Map();
    const usedSlots = new Set();
    const sorted = [...gasGiants].sort((a, b) => a.au - b.au);
    for (const giant of sorted) {
      let bestSlot = null;
      let bestDiff = Infinity;
      for (let i = 0; i < orbitsAu.length; i++) {
        const slot = i + 1;
        if (usedSlots.has(slot)) continue;
        const diff = Math.abs(orbitsAu[i] - giant.au);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSlot = slot;
        }
      }
      if (bestSlot == null) continue;
      const slotAu = orbitsAu[bestSlot - 1];
      const tol = orbitSlotToleranceAu(slotAu);
      if (bestDiff <= tol || !Number.isFinite(tol)) {
        bySlot.set(bestSlot, giant);
        usedSlots.add(bestSlot);
        continue;
      }
      // If no slot is close enough, still map to nearest slot so the giant replaces one row.
      bySlot.set(bestSlot, giant);
      usedSlots.add(bestSlot);
    }
    return bySlot;
  }

  function syncFromWorld() {
    const w = loadWorld();
    state.starMassMsol = Number(w.star.massMsol);
    massDisplay.textContent = `Star Mass: ${fmt(state.starMassMsol, 4)} Msol`;
  }

  function render() {
    if (isRendering) return;
    isRendering = true;
    try {
      syncFromWorld();

      const w0 = loadWorld();

      const model = calcSystem({
        starMassMsol: state.starMassMsol,
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      });

      const items = [
        { label: "Habitable Zone", value: model.display.hzAu, meta: "AU" },
        { label: "H2O Frost Line", value: model.display.frostAu, meta: "AU" },
        { label: "System Inner Limit", value: model.display.innerLimitAu, meta: "AU" },
        { label: "Star Luminosity", value: fmt(model.star.luminosityLsol, 3), meta: "Lsol" },
        { label: "Star Radius", value: fmt(model.star.radiusRsol, 3), meta: "Rsol" },
      ];

      kpisEl.innerHTML = items
        .map(
          (x) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.tipLabel] || TIP_LABEL[x.label] || "")}</div>
          <div class="kpi__value">${x.value}</div>
          <div class="kpi__meta">${x.meta}</div>
        </div>
      </div>
    `,
        )
        .join("");
      // Planet assignment UI
      const w = w0;
      const planets = listPlanets(w);

      // Build ordered orbit items with slot replacement by gas giants.
      const gasGiants = getGasGiants(w0);
      const gasBySlot = mapGasGiantsToSlots(model.orbitsAu, gasGiants);
      const debrisRows = getDebrisDisks(w0)
        .filter((d) => d.innerAu > 0 && d.outerAu > 0)
        .map((d) => ({
          id: d.id,
          name: d.name,
          inner: Math.min(d.innerAu, d.outerAu),
          outer: Math.max(d.innerAu, d.outerAu),
        }));

      const maxGasAu = gasGiants.length ? Math.max(...gasGiants.map((g) => Number(g.au) || 0)) : 0;
      const maxDebrisAu = debrisRows.length
        ? Math.max(...debrisRows.map((d) => Number(d.outer) || 0))
        : 0;
      const cutoffAu = Math.max(maxGasAu, maxDebrisAu, 0);

      const orbitItems = [];
      for (let i = 0; i < model.orbitsAu.length; i++) {
        const slotAu = model.orbitsAu[i];
        const slot = i + 1;
        if (cutoffAu > 0 && slotAu > cutoffAu) continue;
        const giant = gasBySlot.get(slot);
        if (giant) {
          orbitItems.push({ type: "gas", slot, au: Number(giant.au) || slotAu, giant });
        } else {
          orbitItems.push({ type: "slot", slot, au: slotAu });
        }
      }
      for (const disk of debrisRows) {
        const mid = (disk.inner + disk.outer) / 2;
        orbitItems.push({ type: "debris", au: mid, ...disk });
      }
      orbitItems.sort((a, b) => a.au - b.au);

      // Keep persisted assignments valid when slots get replaced/cut off.
      const validSlots = new Set(
        orbitItems.filter((it) => it.type === "slot").map((it) => it.slot),
      );
      const invalidAssignments = planets.filter(
        (p) => p.slotIndex != null && !validSlots.has(p.slotIndex),
      );
      if (invalidAssignments.length) {
        for (const p of invalidAssignments) assignPlanetToSlot(p.id, null);
      }
      let worldForUi = w;
      let planetsForUi = planets;
      if (invalidAssignments.length) {
        worldForUi = loadWorld();
        planetsForUi = listPlanets(worldForUi);
      }
      const moonsForUi = listMoons(worldForUi);
      const planetsById = worldForUi?.planets?.byId || {};
      const moonsByPlanet = new Map();
      for (const moon of moonsForUi) {
        const pid = moon?.planetId;
        if (!pid) continue;
        if (!moonsByPlanet.has(pid)) moonsByPlanet.set(pid, []);
        moonsByPlanet.get(pid).push(moon);
      }
      for (const list of moonsByPlanet.values()) list.sort(sortMoonsByOrbitKm);
      const moonCountByPlanet = new Map();
      for (const [pid, list] of moonsByPlanet.entries()) {
        moonCountByPlanet.set(pid, list.length);
      }
      const renderCtx = { planetsById, moonsByPlanet, moonCountByPlanet };

      // Unassigned list
      unassignedEl.innerHTML = "";
      const unassigned = planetsForUi.filter((p) => p.slotIndex == null);
      if (!unassigned.length) {
        unassignedEl.innerHTML = `<div class="hint">No unassigned planets.</div>`;
      } else {
        unassignedEl.innerHTML = unassigned
          .map((p) => planetCardHtml(p, model, { moonCountByPlanet }))
          .join("");
      }

      unassignedMoonsEl.innerHTML = "";
      const unassignedMoons = moonsForUi.filter((m) => m.planetId == null).sort(sortMoonsByOrbitKm);
      if (!unassignedMoons.length) {
        unassignedMoonsEl.innerHTML = `<div class="hint">No unassigned moons.</div>`;
      } else {
        unassignedMoonsEl.innerHTML = `<div class="moon-list moon-list--unassigned">${unassignedMoons.map((m) => moonCardHtml(m, { showParent: false, planetsById })).join("")}</div>`;
      }

      const starRow = `
      <div class="slot-row">
        <div class="slot-title">Star</div>
        <div class="dropzone" style="cursor:default">
          <div class="hint">${fmt(state.starMassMsol, 4)} Msol primary</div>
        </div>
      </div>
    `;
      const orbitRows = orbitItems
        .map((it) => {
          if (it.type === "slot") {
            const slot = it.slot;
            const au = it.au;
            const occupant = planetsForUi.find((p) => p.slotIndex === slot);
            const title = `Slot ${String(slot).padStart(2, "0")} (${fmt(au, 3)} AU)`;
            return `
          <div class="slot-row">
            <div class="slot-title">${title}</div>
            <div class="dropzone slot-drop" data-slot="${slot}">
              ${occupant ? slotPlanetWithMoonsHtml(occupant, model, renderCtx) : `<div class="hint">Drop a planet here.</div>`}
            </div>
          </div>
        `;
          }

          if (it.type === "gas") {
            const g = it.giant;
            const title = `${escapeHtml(g.name || "Gas giant")} (Slot ${String(it.slot).padStart(2, "0")} - ${fmt(Number(g.au) || it.au, 3)} AU)`;
            return `
          <div class="slot-row">
            <div class="slot-title">${title}</div>
            <div class="dropzone" style="cursor:default">
              <div class="hint">Gas giant marker (${escapeHtml(styleLabel(g.style || "jupiter"))}).</div>
            </div>
          </div>
        `;
          }

          const title = `${escapeHtml(it.name || "Debris disk")} (${fmt(it.inner, 2)} - ${fmt(it.outer, 2)} AU)`;
          return `
        <div class="slot-row">
          <div class="slot-title">${title}</div>
          <div class="dropzone" style="cursor:default">
            <div class="hint">Asteroid belt / debris disk region.</div>
          </div>
        </div>
      `;
        })
        .join("");
      slotsUiEl.innerHTML = starRow + orbitRows;
      // Attach DnD handlers
      setupDnD();

      orbitsEl.textContent = model.orbitsAu
        .map((v, i) => `Orbit ${String(i + 1).padStart(2, "0")}: ${fmt(v, 3)} AU`)
        .join("\n");
    } finally {
      isRendering = false;
    }
  }

  function loadIntoInputs() {
    syncFromWorld();
    spacingEl.value = state.spacingFactor;
    orbit1El.value = state.orbit1Au;

    ["spacing", "orbit1"].forEach((id) => {
      const numberEl = wrap.querySelector(`#${id}`);
      numberEl.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function applyFromInputs() {
    state.spacingFactor = Number(spacingEl.value);
    state.orbit1Au = Number(orbit1El.value);

    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });

    render();
  }

  wrap.querySelector("#btn-apply").addEventListener("click", applyFromInputs);

  wrap.querySelector("#btn-sol").addEventListener("click", () => {
    state.spacingFactor = 0.35;
    state.orbit1Au = 0.4;
    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });
    loadIntoInputs();
    render();
  });

  wrap.querySelector("#btn-reset").addEventListener("click", () => {
    Object.assign(state, defaults);
    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });
    loadIntoInputs();
    render();
  });

  function sortMoonsByOrbitKm(a, b) {
    const aa = Number(a?.inputs?.semiMajorAxisKm);
    const bb = Number(b?.inputs?.semiMajorAxisKm);
    const av = Number.isFinite(aa) && aa > 0 ? aa : Infinity;
    const bv = Number.isFinite(bb) && bb > 0 ? bb : Infinity;
    return av - bv;
  }

  function moonCardHtml(m, { showParent = false, planetsById = null } = {}) {
    const moonName = escapeHtml(m.name || m.inputs?.name || m.id);
    const orbitKm = Number(m?.inputs?.semiMajorAxisKm);
    const orbitText =
      Number.isFinite(orbitKm) && orbitKm > 0 ? `${fmt(orbitKm, 0)} km` : "Orbit unknown";
    const parent = m.planetId ? planetsById?.[m.planetId] : null;
    const parentText = parent
      ? `Planet: ${parent.name || parent.inputs?.name || parent.id}`
      : "Unassigned";
    const metaText = showParent ? `${orbitText} � ${parentText}` : orbitText;
    const locked = !!m.locked;
    const canLock = m.planetId != null;

    return `
      <div class="moon-mini moon-card ${locked ? "is-locked" : ""}" draggable="${locked ? "false" : "true"}" data-moon-id="${escapeHtml(m.id)}" title="${locked ? "Locked to planet" : "Drag to reassign"}">
        <div>
          <div class="moon-mini__name">${moonName}</div>
          <div class="planet-card__meta">${escapeHtml(metaText)}</div>
        </div>
        <div class="moon-mini__actions">
          <button class="small" type="button" data-action="lock-moon" data-moon-id="${escapeHtml(m.id)}" ${canLock ? "" : "disabled"}>${locked ? "Unlock" : "Lock"}</button>
          <button class="small" type="button" data-action="edit-moon" data-moon-id="${escapeHtml(m.id)}">Edit</button>
        </div>
      </div>
    `;
  }

  function slotPlanetWithMoonsHtml(p, sysModel, renderCtx) {
    const moons = (renderCtx?.moonsByPlanet?.get(p.id) || []).slice().sort(sortMoonsByOrbitKm);
    const moonRows = moons.length
      ? moons.map((m) => moonCardHtml(m, { planetsById: renderCtx?.planetsById })).join("")
      : `<div class="hint">No moons. Drop moons here.</div>`;
    const moonHtml = `
      <div class="moon-list moon-drop-target" data-moon-drop-planet-id="${escapeHtml(p.id)}">
        ${moonRows}
      </div>
    `;

    return `
      ${planetCardHtml(p, sysModel, { showAu: false, moonCountByPlanet: renderCtx?.moonCountByPlanet })}
      ${moonHtml}
    `;
  }

  function planetCardHtml(p, sysModel, { showAu = true, moonCountByPlanet = null } = {}) {
    // find slot AU for meta
    let meta = "";
    if (showAu && p.slotIndex != null) {
      const au = sysModel.orbitsAu[p.slotIndex - 1];
      if (au != null) meta = `${fmt(au, 3)} AU`;
    }
    const moonCount = Number(moonCountByPlanet?.get(p.id) || 0);
    const slotText =
      p.slotIndex != null ? `Slot ${String(p.slotIndex).padStart(2, "0")}` : "Unassigned";
    const metaTextBase = meta ? `${slotText} � ${meta}` : slotText;
    const metaText = `${metaTextBase} � Moons: ${moonCount}`;
    const safeName = escapeHtml(p.name || p.inputs?.name || p.id);
    return `
      <div class="planet-card ${p.locked ? "is-locked" : ""} moon-drop-target" draggable="${p.locked ? "false" : "true"}" data-planet-id="${escapeHtml(p.id)}" data-moon-drop-planet-id="${escapeHtml(p.id)}" title="${p.locked ? "Locked" : "Drag to assign"}">
        <div>
          <div><b>${safeName}</b></div>
          <div class="planet-card__meta">${escapeHtml(metaText)}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="small" type="button" data-action="lock" data-planet-id="${escapeHtml(p.id)}">${p.locked ? "Unlock" : "Lock"}</button>
          <button class="small" type="button" data-action="edit" data-planet-id="${escapeHtml(p.id)}">Edit</button>
        </div>
      </div>
    `;
  }
  function setupDnD() {
    // Ensure we don't double-bind
    if (wrap.__dndBound) return;
    wrap.__dndBound = true;

    let dragPayload = null;

    function getDropTarget(fromEl, payload) {
      if (!fromEl || !payload) return null;
      if (payload.type === "planet") {
        return fromEl.closest?.(".dropzone.slot-drop, #unassignedZone");
      }
      if (payload.type === "moon") {
        return fromEl.closest?.(".moon-drop-target, #unassignedMoonsZone");
      }
      return null;
    }

    function readDragPayload(e) {
      if (dragPayload?.id) return dragPayload;
      try {
        const json = e.dataTransfer.getData("application/worldsmith-drag");
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed && parsed.type && parsed.id) return parsed;
        }
      } catch {}
      try {
        const id = e.dataTransfer.getData("text/plain");
        if (id) return { type: "planet", id };
      } catch {}
      return null;
    }

    wrap.addEventListener("dragstart", (e) => {
      const moonCard = e.target.closest?.(".moon-card");
      if (moonCard) {
        if (moonCard.classList.contains("is-locked")) {
          e.preventDefault();
          return;
        }
        const mid = moonCard.getAttribute("data-moon-id");
        if (!mid) {
          e.preventDefault();
          return;
        }
        dragPayload = { type: "moon", id: mid };
        try {
          e.dataTransfer.setData("application/worldsmith-drag", JSON.stringify(dragPayload));
        } catch {}
        try {
          e.dataTransfer.setData("text/plain", mid);
        } catch {}
        e.dataTransfer.effectAllowed = "move";
        return;
      }

      const card = e.target.closest?.(".planet-card");
      if (!card) return;
      if (card.classList.contains("is-locked")) {
        e.preventDefault();
        return;
      }
      const pid = card.getAttribute("data-planet-id");
      if (!pid) {
        e.preventDefault();
        return;
      }
      dragPayload = { type: "planet", id: pid };
      try {
        e.dataTransfer.setData("application/worldsmith-drag", JSON.stringify(dragPayload));
      } catch {}
      try {
        e.dataTransfer.setData("text/plain", pid);
      } catch {}
      e.dataTransfer.effectAllowed = "move";
    });

    wrap.addEventListener("dragend", () => {
      dragPayload = null;
      wrap
        .querySelectorAll(
          ".dropzone.is-over, .moon-drop-target.is-over, #unassignedMoonsZone.is-over",
        )
        .forEach((el) => el.classList.remove("is-over"));
    });

    wrap.addEventListener("dragover", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target) return;
      e.preventDefault();
      target.classList.add("is-over");
      e.dataTransfer.dropEffect = "move";
    });

    wrap.addEventListener("dragleave", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target) return;
      if (e.relatedTarget && target.contains(e.relatedTarget)) return;
      target.classList.remove("is-over");
    });

    wrap.addEventListener("drop", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target || !payload?.id) return;
      e.preventDefault();
      target.classList.remove("is-over");

      if (payload.type === "moon") {
        if (target.id === "unassignedMoonsZone") {
          assignMoonToPlanet(payload.id, null);
          render();
          return;
        }
        const targetPlanetId = target.getAttribute("data-moon-drop-planet-id");
        if (!targetPlanetId) return;
        assignMoonToPlanet(payload.id, targetPlanetId);
        render();
        return;
      }

      if (payload.type === "planet") {
        const zone = target;
        if (zone.id === "unassignedZone") {
          assignPlanetToSlot(payload.id, null);
          render();
          return;
        }

        const slotAttr = zone.getAttribute("data-slot");
        if (!slotAttr) return;
        const slot = Number(slotAttr);

        // If the slot is occupied by a locked planet, do not allow replacement
        const wNow = loadWorld();
        const planetsNow = listPlanets(wNow);
        const occ = planetsNow.find((p) => p.slotIndex === slot);
        if (occ && occ.locked && occ.id !== payload.id) {
          return;
        }

        assignPlanetToSlot(payload.id, slot);
        render();
      }
    });

    // Edit button: jump to Planet tab and select planet
    wrap.addEventListener("click", (e) => {
      const lockBtn = e.target.closest?.("button[data-action='lock']");
      if (lockBtn) {
        const pid2 = lockBtn.getAttribute("data-planet-id");
        if (pid2) {
          togglePlanetLock(pid2);
          render();
        }
        return;
      }

      const moonLockBtn = e.target.closest?.("button[data-action='lock-moon']");
      if (moonLockBtn) {
        const mid = moonLockBtn.getAttribute("data-moon-id");
        if (!mid) return;
        toggleMoonLock(mid);
        render();
        return;
      }

      const moonBtn = e.target.closest?.("button[data-action='edit-moon']");
      if (moonBtn) {
        const mid = moonBtn.getAttribute("data-moon-id");
        if (!mid) return;
        selectMoon(mid);
        location.hash = "#/moon";
        return;
      }

      const btn = e.target.closest?.("button[data-action='edit']");
      if (!btn) return;
      const pid = btn.getAttribute("data-planet-id");
      if (!pid) return;
      selectPlanet(pid);
      location.hash = "#/planet";
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Init
  loadIntoInputs();
  render();

  wrap.querySelectorAll('input[type="number"]').forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFromInputs();
    });
  });
}

function numWithSlider(id, label, unit, hint, min, max, step) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  return `
  <div class="form-row">
    <div>
      <div class="label">${label}${unitHtml} ${tipIcon(TIP_LABEL[label] || TIP_LABEL[id] || "")}</div>
      <div class="hint">${hint}</div>
    </div>
    <div class="input-pair">
      <input id="${id}" type="number" step="${step}" aria-label="${label}" />
      <input id="${id}_slider" type="range" aria-label="${label} slider" />
      <div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div>
    </div>
  </div>`;
}
