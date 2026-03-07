import { fmt } from "../../engine/utils.js";
import { createElement, replaceChildren } from "../domHelpers.js";
import { styleLabel } from "../gasGiantStyles.js";

function createTipNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function createHint(text) {
  return createElement("div", { className: "hint", text });
}

function createKpiCard(item, tipLabels = {}) {
  const tipText = tipLabels[item.tipLabel] || tipLabels[item.label] || "";
  return createElement("div", { className: "kpi-wrap" }, [
    createElement("div", { className: "kpi" }, [
      createElement("div", { className: "kpi__label" }, [item.label, " ", createTipNode(tipText)]),
      createElement("div", { className: "kpi__value", text: item.value ?? "" }),
      createElement("div", { className: "kpi__meta", text: item.meta ?? "" }),
    ]),
  ]);
}

export function renderSystemKpis(container, items = [], tipLabels = {}) {
  return replaceChildren(
    container,
    (items || []).map((item) => createKpiCard(item, tipLabels)),
  );
}

export function createMoonCard(moon, { showParent = false, planetsById = null } = {}) {
  const moonName = moon.name || moon.inputs?.name || moon.id;
  const orbitKm = Number(moon?.inputs?.semiMajorAxisKm);
  const orbitText =
    Number.isFinite(orbitKm) && orbitKm > 0 ? `${fmt(orbitKm, 0)} km` : "Orbit unknown";
  const parent = moon.planetId ? planetsById?.[moon.planetId] : null;
  const parentText = parent
    ? `Planet: ${parent.name || parent.inputs?.name || parent.id}`
    : "Unassigned";
  const metaText = showParent ? `${orbitText} - ${parentText}` : orbitText;
  const locked = !!moon.locked;
  const canLock = moon.planetId != null;

  return createElement(
    "div",
    {
      className: `moon-mini moon-card${locked ? " is-locked" : ""}`,
      attrs: {
        draggable: locked ? "false" : "true",
        title: locked ? "Locked to planet" : "Drag to reassign",
      },
      dataset: { moonId: moon.id },
    },
    [
      createElement("div", {}, [
        createElement("div", { className: "moon-mini__name", text: moonName }),
        createElement("div", { className: "planet-card__meta", text: metaText }),
      ]),
      createElement("div", { className: "moon-mini__actions" }, [
        createElement("button", {
          className: "small",
          attrs: {
            type: "button",
            "data-action": "lock-moon",
            "data-moon-id": moon.id,
            disabled: canLock ? null : "disabled",
          },
          text: locked ? "Unlock" : "Lock",
        }),
        createElement("button", {
          className: "small",
          attrs: {
            type: "button",
            "data-action": "edit-moon",
            "data-moon-id": moon.id,
          },
          text: "Edit",
        }),
      ]),
    ],
  );
}

export function createPlanetCard(
  planet,
  sysModel,
  { showAu = true, moonCountByPlanet = null } = {},
) {
  let meta = "";
  if (showAu && planet.slotIndex != null) {
    const au = sysModel.orbitsAu[planet.slotIndex - 1];
    if (au != null) meta = `${fmt(au, 3)} AU`;
  }
  const moonCount = Number(moonCountByPlanet?.get(planet.id) || 0);
  const slotText =
    planet.slotIndex != null ? `Slot ${String(planet.slotIndex).padStart(2, "0")}` : "Unassigned";
  const metaTextBase = meta ? `${slotText} - ${meta}` : slotText;
  const metaText = `${metaTextBase} - Moons: ${moonCount}`;
  const name = planet.name || planet.inputs?.name || planet.id;

  return createElement(
    "div",
    {
      className: `planet-card${planet.locked ? " is-locked" : ""} moon-drop-target`,
      attrs: {
        draggable: planet.locked ? "false" : "true",
        title: planet.locked ? "Locked" : "Drag to assign",
        style: "",
      },
      dataset: {
        planetId: planet.id,
        moonDropPlanetId: planet.id,
      },
    },
    [
      createElement("div", {}, [
        createElement("div", {}, [createElement("b", { text: name })]),
        createElement("div", { className: "planet-card__meta", text: metaText }),
      ]),
      createElement("div", { attrs: { style: "display:flex; gap:8px; align-items:center" } }, [
        createElement("button", {
          className: "small",
          attrs: {
            type: "button",
            "data-action": "lock",
            "data-planet-id": planet.id,
          },
          text: planet.locked ? "Unlock" : "Lock",
        }),
        createElement("button", {
          className: "small",
          attrs: {
            type: "button",
            "data-action": "edit",
            "data-planet-id": planet.id,
          },
          text: "Edit",
        }),
      ]),
    ],
  );
}

function createMoonDropZone(planetId, moons, planetsById) {
  return createElement(
    "div",
    {
      className: "moon-list moon-drop-target",
      dataset: { moonDropPlanetId: planetId },
    },
    moons.length
      ? moons.map((moon) => createMoonCard(moon, { planetsById }))
      : createHint("No moons. Drop moons here."),
  );
}

function createSlotPlanetWithMoons(planet, sysModel, renderCtx) {
  const moons = (renderCtx?.moonsByPlanet?.get(planet.id) || []).slice();
  return [
    createPlanetCard(planet, sysModel, {
      showAu: false,
      moonCountByPlanet: renderCtx?.moonCountByPlanet,
    }),
    createMoonDropZone(planet.id, moons, renderCtx?.planetsById),
  ];
}

function createSlotRow(title, body, options = {}) {
  return createElement("div", { className: "slot-row" }, [
    createElement("div", { className: "slot-title", text: title }),
    createElement(
      "div",
      {
        className: options.dropzoneClass || "dropzone",
        attrs: options.dropzoneStyle ? { style: options.dropzoneStyle } : {},
        dataset: options.dataset || {},
      },
      body,
    ),
  ]);
}

export function renderUnassignedPlanets(
  container,
  planets,
  sysModel,
  { moonCountByPlanet = null } = {},
) {
  return replaceChildren(
    container,
    planets.length
      ? planets.map((planet) => createPlanetCard(planet, sysModel, { moonCountByPlanet }))
      : createHint("No unassigned planets."),
  );
}

export function renderUnassignedMoons(container, moons, { planetsById = null } = {}) {
  return replaceChildren(
    container,
    moons.length
      ? createElement(
          "div",
          { className: "moon-list moon-list--unassigned" },
          moons.map((moon) => createMoonCard(moon, { showParent: false, planetsById })),
        )
      : createHint("No unassigned moons."),
  );
}

export function renderOrbitSlots(
  container,
  { starMassMsol, orbitItems, planets, sysModel, renderCtx },
) {
  const rows = [
    createSlotRow("Star", createHint(`${fmt(starMassMsol, 4)} Msol primary`), {
      dropzoneStyle: "cursor:default",
    }),
  ];

  for (const item of orbitItems) {
    if (item.type === "slot") {
      const occupant = planets.find((planet) => planet.slotIndex === item.slot);
      rows.push(
        createSlotRow(
          `Slot ${String(item.slot).padStart(2, "0")} (${fmt(item.au, 3)} AU)`,
          occupant
            ? createSlotPlanetWithMoons(occupant, sysModel, renderCtx)
            : createHint("Drop a planet here."),
          {
            dropzoneClass: "dropzone slot-drop",
            dataset: { slot: item.slot },
          },
        ),
      );
      continue;
    }

    if (item.type === "gas") {
      const giant = item.giant;
      rows.push(
        createSlotRow(
          `${giant.name || "Gas giant"} (Slot ${String(item.slot).padStart(2, "0")} - ${fmt(Number(giant.au) || item.au, 3)} AU)`,
          createHint(`Gas giant marker (${styleLabel(giant.style || "jupiter")}).`),
          { dropzoneStyle: "cursor:default" },
        ),
      );
      continue;
    }

    rows.push(
      createSlotRow(
        `${item.name || "Debris disk"} (${fmt(item.inner, 2)} - ${fmt(item.outer, 2)} AU)`,
        createHint("Asteroid belt / debris disk region."),
        { dropzoneStyle: "cursor:default" },
      ),
    );
  }

  return replaceChildren(container, rows);
}

export function renderManualBodyList(container, bodies = []) {
  return replaceChildren(
    container,
    bodies.length
      ? bodies.map((body) =>
          createSlotRow(`${body.name} (${body.auLabel})`, createHint(body.kind), {
            dropzoneStyle: "cursor:default",
          }),
        )
      : createHint("No bodies created yet."),
  );
}
