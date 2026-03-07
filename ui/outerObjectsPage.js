import { calcStar } from "../engine/star.js";
import { calcSystem } from "../engine/system.js";
import { calcDebrisDisk, calcDebrisDiskSuggestions } from "../engine/debrisDisk.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { createElement, replaceChildren } from "./domHelpers.js";
import { attachTooltips } from "./tooltip.js";
import { createTutorial } from "./tutorial.js";
import {
  loadWorld,
  getStarOverrides,
  listSystemGasGiants,
  listSystemDebrisDisks,
  saveSystemDebrisDisks,
} from "./store.js";

const TIP_LABEL = {
  // ── Debris disk inputs ──
  "Debris disks":
    "Debris regions (asteroid/Kuiper-belt-like zones) of planetesimals, dust, and ice. In mature systems these are sculpted by gravitational resonances with gas giants, similar to the asteroid belt and Kuiper belt.",
  "Disk name": "Name of this debris disk zone.",
  "Inner edge":
    "Inner boundary of the debris disk in AU. In resonance-sculpted disks, this is set by interior mean-motion resonances (e.g. 4:1, 2:1) with the nearest gas giant.",
  "Outer edge":
    "Outer boundary of the debris disk in AU. Exterior resonances (3:2, 2:1) with the nearest gas giant define the outer edge, analogous to the Kuiper cliff at Neptune\u2019s 2:1 resonance.",
  "Disk center":
    "Semi-major axis of the disk midpoint in AU. The disk extends symmetrically around this point by half the width in each direction.",
  "Disk width":
    "Radial width (depth) of the debris disk in AU. The inner edge is center \u2212 width/2, the outer edge is center + width/2.",
  Suggest:
    "Possible debris disk zones ranked by priority:\n\nP1 \u2014 Outer disk: outermost giant\u2019s 3:2 \u2192 2:1 exterior MMR (Kuiper belt analog).\nP2 \u2014 Inner disk: innermost giant\u2019s 4:1 \u2192 2:1 interior MMR (asteroid belt analog).\nP3 \u2014 Gap disk: inter-giant gap between adjacent giants\u2019 2:1 resonances. Only viable when giants are ~4\u00d7 apart in AU.\nP4 \u2014 Extended outer disk: outermost giant\u2019s 2:1 \u2192 5:2 exterior MMR (scattered disk analog). Shares boundary with P1.\nP5 \u2014 Warm inner disk: innermost giant\u2019s 8:1 \u2192 4:1 interior MMR (exozodiacal dust analog). Shares boundary with P2.\n\nP4/P5 are not recommended by default because they are contiguous with P1/P2, forming a single mega-belt. With no gas giants, zones are scaled from the frost line instead.",

  // ── Debris disk outputs ──
  "Disk Range":
    "Radial extent of the debris disk in AU. Wider disks contain more material and are more likely to be detected via infrared excess.",
  "Disk Temperature":
    "Blackbody equilibrium temperature at the disk midpoint. Determines which ices and minerals condense: water ice below ~170 K, CO\u2082 ice below ~80 K, CO/N\u2082 ice below ~25 K.",
  "Disk Composition":
    "Dominant grain materials based on temperature and stellar metallicity. Inside the frost line (~170 K): rocky silicates and metals. Outside: water ice, organics, and at the coldest distances, volatile ices. Higher [Fe/H] biases solids modestly toward refractory content.",
  Resonance:
    "Debris disk edges sculpted by mean-motion resonances (MMR) with gas giants. 3:2 and 2:1 exterior MMRs define the outer disk; 4:1 and 2:1 interior MMRs define the inner disk.",
  "Estimated Mass":
    "Wyatt (2007) steady-state maximum mass from optical depth and Dohnanyi (1969) collisional cascade (q = 3.5). Represents the upper bound for a disk of this age and location. Actual mass depends on collision history and the largest surviving body.",
  "Disk Orbital Period":
    "Orbital period at the disk midpoint, from Kepler\u2019s third law. Bodies at the inner and outer edges orbit faster and slower respectively.",
  "Disk Derived":
    "Fractional luminosity (L_disk/L\u2605) measures dust brightness. Optical depth (\u03c4) is the fraction of starlight intercepted. Grain blowout size is the minimum grain surviving radiation pressure. PR drag and collisional timescales determine whether the disk is collision- or drag-dominated.",

  // ── New disk inputs ──
  "Disk Eccentricity":
    "Mean orbital eccentricity of disk particles (0\u20130.5). Higher eccentricity increases collision speeds and widens the pericenter\u2013apocenter range. Default 0.05 is typical for a dynamically cool belt.",
  "Disk Inclination":
    "Mean inclination of disk particle orbits (0\u201390\u00b0). Affects the vertical thickness of the disk. 0\u00b0 = face-on; higher values reduce projected area for observers.",
  "Disk Mass Override":
    "Total disk mass in Earth masses. When set, this overrides the Wyatt steady-state mass estimate and reverse-derives optical depth from the given mass. Leave empty to use the default age-based estimate.",

  // ── New disk outputs ──
  "Collision Velocity":
    "Mean collision speed between disk particles: v_coll = e \u00d7 v_Kepler \u00d7 \u221A2. Gentle (<10 m/s) allows accretion, erosive (10\u2013100 m/s) grinds grains, catastrophic (>100 m/s) shatters bodies.",
  "Surface Density":
    "Mass per unit area (\u03A3) of the disk annulus, compared to the Minimum Mass Solar Nebula (MMSN). Values near 100% of MMSN suggest a primordial-mass disk.",
  "IR Excess":
    "Ratio of disk thermal emission to stellar flux at 24 \u03BCm. >10% is easily detectable, 1\u201310% is marginal, <1% is below current instrument thresholds (Spitzer/JWST).",
  "Disk Stability":
    "Checks whether any gas giant\u2019s chaotic zone (Wisdom 1980: \u0394a = 1.3 a (M_p/M\u2605)^(2/7)) overlaps the disk. Overlap means the disk would be cleared on ~Myr timescales.",
  "Dust Production":
    "Rate at which collisional grinding converts planetesimal mass into small dust grains. Equal to M_disk / t_collisional.",
  "Zodiacal Delivery":
    "Poynting\u2013Robertson drag slowly spirals small grains inward. This estimates the mass inflow rate toward the inner system, analogous to the zodiacal dust cloud.",
  "Ice-to-Rock Ratio":
    "Mass ratio of condensed ices to refractory minerals at the disk midpoint. Beyond the frost line this exceeds ~1; inside, the disk is rock-dominated.",
  "Condensation Species":
    "Species present at each disk location based on the Lodders (2003) condensation sequence. A species condenses (is solid) when the local temperature is below its condensation temperature.",

  // ── Summary KPIs ──
  "Debris disks count": "Total number of debris disk zones in this system.",
};

const TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Other Objects page models debris disks \u2014 asteroid belts, " +
      "Kuiper-belt analogs, and other non-planetary material orbiting your star.",
  },
  {
    title: "Disk Geometry",
    body:
      "Set the inner and outer edges of each disk in AU. The centre and width " +
      "are derived automatically. Composition and temperature depend on " +
      "distance from the star.",
  },
  {
    title: "Suggest Feature",
    body:
      "Click Suggest to auto-generate debris disk positions based on " +
      "mean-motion resonances with your gas giants. This produces realistic " +
      "belt structures like the asteroid and Kuiper belts.",
  },
  {
    title: "Derived Properties",
    body:
      "Review collision velocities, ice-to-rock ratios, and infrared " +
      "detectability. These help determine whether a disk is visible and " +
      "how it interacts with planet formation.",
  },
];

export function initOuterObjectsPage(mountEl) {
  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--outer-objects" aria-hidden="true"></span><span>Other Objects</span></h1>
        <button id="outerTutorials" type="button" class="ws-tutorial-trigger">Tutorials</button>
      </div>
      <div class="panel__body">
        <div class="hint">Configure debris disks and other non-planetary system components. Derived physical properties are computed from orbit and host-star data.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div id="debrisDisksEditor"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div id="outerSummary"></div>
        </div>
      </div>
    </div>
  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.outer.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#outerTutorials"),
  });

  const summaryEl = wrap.querySelector("#outerSummary");
  const debrisEditorEl = wrap.querySelector("#debrisDisksEditor");

  let isRendering = false;
  let renderQueued = false;

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      render();
    }, 0);
  }

  function getGasGiants(world) {
    return listSystemGasGiants(world).sort((a, b) => Number(a.au) - Number(b.au));
  }

  function getDebrisDisks(world) {
    return listSystemDebrisDisks(world);
  }

  /* ── Debris Disks Editor ────────────────────────────────────────── */

  // Per-disk input mode state: "edges" (inner/outer) or "center" (center/width).
  // Persisted across re-renders but not saved to the world model.
  const ddInputModes = new Map();

  function tipIconNode(text) {
    if (!text) return null;
    return createElement("span", {
      className: "tip-icon",
      attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
      dataset: { tip: text },
      text: "i",
    });
  }

  function labelWithTipNode(text, tipText, { unit = null, className = "label" } = {}) {
    return createElement("div", { className }, [
      text,
      unit ? " " : "",
      unit ? createElement("span", { className: "unit", text: unit }) : null,
      tipText ? " " : "",
      tipIconNode(tipText),
    ]);
  }

  function rangeMetaNode(minLabel, maxLabel) {
    return createElement("div", { className: "range-meta" }, [
      createElement("span", { text: minLabel }),
      createElement("span", { text: maxLabel }),
    ]);
  }

  function numberSliderPairNode({
    inputClass,
    sliderClass,
    value,
    step,
    min,
    max,
    placeholder = null,
    rangeMinLabel,
    rangeMaxLabel,
  }) {
    const normalizedValue = value == null ? "" : String(value);
    return createElement("div", { className: "input-pair" }, [
      createElement("input", {
        className: inputClass,
        attrs: {
          type: "number",
          step,
          min,
          max,
          placeholder,
          value: normalizedValue,
        },
      }),
      createElement("input", {
        className: sliderClass,
        attrs: { type: "range", value: normalizedValue },
      }),
      rangeMetaNode(rangeMinLabel, rangeMaxLabel),
    ]);
  }

  function setInputValue(node, value) {
    if (!node) return node;
    node.value = value == null ? "" : String(value);
    return node;
  }

  function debrisRowNode(disk, index) {
    const inner = Number(disk.innerAu || 0);
    const outer = Number(disk.outerAu || 0);
    const center = Math.round(((inner + outer) / 2) * 100) / 100;
    const width = Math.round((outer - inner) * 100) / 100;
    const mode = ddInputModes.get(disk.id) || "edges";
    const row = createElement("div", {
      className: "dd-row",
      dataset: { ddId: disk.id },
    });

    const head = createElement("div", { className: "dd-row__head" }, [
      labelWithTipNode("Name", TIP_LABEL["Disk name"]),
      createElement("input", { className: "dd-name", attrs: { type: "text" } }),
      createElement("button", {
        className: "small danger dd-remove",
        attrs: { type: "button" },
        text: "Remove",
      }),
    ]);
    setInputValue(head.querySelector(".dd-name"), disk.name || `Debris disk ${index + 1}`);
    row.appendChild(head);

    row.appendChild(
      createElement(
        "div",
        {
          className: "physics-duo-toggle dd-mode-toggle",
          attrs: { style: "margin-top:8px", "data-toggle": "dd-mode" },
        },
        [
          createElement("input", {
            attrs: {
              type: "radio",
              name: `ddMode_${disk.id}`,
              id: `ddModeEdges_${disk.id}`,
              value: "edges",
            },
            checked: mode === "edges",
          }),
          createElement("label", {
            attrs: { for: `ddModeEdges_${disk.id}` },
            text: "Inner / Outer",
          }),
          createElement("input", {
            attrs: {
              type: "radio",
              name: `ddMode_${disk.id}`,
              id: `ddModeCenter_${disk.id}`,
              value: "center",
            },
            checked: mode === "center",
          }),
          createElement("label", {
            attrs: { for: `ddModeCenter_${disk.id}` },
            text: "Center / Width",
          }),
          createElement("span"),
        ],
      ),
    );

    const edgesGroup = createElement("div", {
      className: "dd-edges-group",
      attrs: { style: mode === "center" ? "display:none" : "" },
    });
    const innerRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Inner edge", TIP_LABEL["Inner edge"], { unit: "AU" }),
        ]),
        numberSliderPairNode({
          inputClass: "dd-inner",
          sliderClass: "dd-inner-slider",
          value: inner,
          step: "0.01",
          min: "0.01",
          max: "1000",
          rangeMinLabel: "0.01",
          rangeMaxLabel: "1000",
        }),
      ],
    );
    setInputValue(innerRow.querySelector(".dd-inner"), inner);
    edgesGroup.appendChild(innerRow);

    const outerRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Outer edge", TIP_LABEL["Outer edge"], { unit: "AU" }),
        ]),
        numberSliderPairNode({
          inputClass: "dd-outer",
          sliderClass: "dd-outer-slider",
          value: outer,
          step: "0.01",
          min: "0.01",
          max: "1000",
          rangeMinLabel: "0.01",
          rangeMaxLabel: "1000",
        }),
      ],
    );
    setInputValue(outerRow.querySelector(".dd-outer"), outer);
    edgesGroup.appendChild(outerRow);
    row.appendChild(edgesGroup);

    const centerGroup = createElement("div", {
      className: "dd-center-group",
      attrs: { style: mode === "edges" ? "display:none" : "" },
    });
    const centerRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Center", TIP_LABEL["Disk center"], { unit: "AU" }),
        ]),
        numberSliderPairNode({
          inputClass: "dd-center",
          sliderClass: "dd-center-slider",
          value: center,
          step: "0.01",
          min: "0.01",
          max: "1000",
          rangeMinLabel: "0.01",
          rangeMaxLabel: "1000",
        }),
      ],
    );
    setInputValue(centerRow.querySelector(".dd-center"), center);
    centerGroup.appendChild(centerRow);

    const widthRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Width", TIP_LABEL["Disk width"], { unit: "AU" }),
        ]),
        numberSliderPairNode({
          inputClass: "dd-width",
          sliderClass: "dd-width-slider",
          value: width,
          step: "0.01",
          min: "0.01",
          max: "500",
          rangeMinLabel: "0.01",
          rangeMaxLabel: "500",
        }),
      ],
    );
    setInputValue(widthRow.querySelector(".dd-width"), width);
    centerGroup.appendChild(widthRow);
    row.appendChild(centerGroup);

    const eccentricityRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Eccentricity", TIP_LABEL["Disk Eccentricity"]),
        ]),
        numberSliderPairNode({
          inputClass: "dd-ecc",
          sliderClass: "dd-ecc-slider",
          value: disk.eccentricity != null ? disk.eccentricity : "",
          step: "0.01",
          min: "0",
          max: "0.5",
          placeholder: "0.05",
          rangeMinLabel: "0",
          rangeMaxLabel: "0.5",
        }),
      ],
    );
    setInputValue(
      eccentricityRow.querySelector(".dd-ecc"),
      disk.eccentricity != null ? disk.eccentricity : "",
    );
    row.appendChild(eccentricityRow);

    const inclinationRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Inclination", TIP_LABEL["Disk Inclination"], { unit: "\u00b0" }),
        ]),
        numberSliderPairNode({
          inputClass: "dd-inc",
          sliderClass: "dd-inc-slider",
          value: disk.inclination != null ? disk.inclination : "",
          step: "1",
          min: "0",
          max: "90",
          placeholder: "0",
          rangeMinLabel: "0",
          rangeMaxLabel: "90",
        }),
      ],
    );
    setInputValue(
      inclinationRow.querySelector(".dd-inc"),
      disk.inclination != null ? disk.inclination : "",
    );
    row.appendChild(inclinationRow);

    const massRow = createElement(
      "div",
      { className: "form-row", attrs: { style: "margin-top:8px" } },
      [
        createElement("div", {}, [
          labelWithTipNode("Total mass", TIP_LABEL["Disk Mass Override"], { unit: "M\u2295" }),
        ]),
        createElement("div", { className: "input-pair" }, [
          createElement("input", {
            className: "dd-mass",
            attrs: {
              type: "number",
              step: "0.001",
              min: "0",
              placeholder: "Auto",
            },
          }),
          createElement("button", {
            className: "small dd-mass-clear",
            attrs: { type: "button", style: "margin-left:4px" },
            text: "Auto",
          }),
        ]),
      ],
    );
    setInputValue(
      massRow.querySelector(".dd-mass"),
      disk.totalMassMearth != null ? disk.totalMassMearth : "",
    );
    row.appendChild(massRow);

    return row;
  }

  function createOuterKpiCard(label, value, meta, tipText) {
    return createElement("div", { className: "kpi-wrap" }, [
      createElement("div", { className: "kpi" }, [
        createElement("div", { className: "kpi__label" }, [
          label,
          tipText ? " " : "",
          tipIconNode(tipText),
        ]),
        createElement("div", { className: "kpi__value", text: value }),
        createElement("div", { className: "kpi__meta", text: meta || "" }),
      ]),
    ]);
  }

  function renderDebrisDisksEditor(world, model) {
    const disks = getDebrisDisks(world);

    // Compute suggestions for the preview
    const gasGiants = getGasGiants(world);
    const zones = calcDebrisDiskSuggestions({
      gasGiants: gasGiants.map((g) => ({ name: g.name, au: g.au })),
      starLuminosityLsol: model.star.luminosityLsol,
    });
    replaceChildren(debrisEditorEl, [
      createElement("div", { className: "subsection" }, [
        createElement("div", { className: "subsection__title" }, [
          "Debris disks",
          " ",
          tipIconNode(TIP_LABEL["Debris disks"]),
        ]),
        createElement("div", {
          className: "hint",
          text: "Debris disk positions can be auto-suggested from gas giant resonances (or frost line if no giants), or set manually.",
        }),
        createElement("div", { className: "dd-suggest-preview" }, [
          zones.length
            ? createElement("div", { className: "label", attrs: { style: "margin-top:8px" } }, [
                "Possible zones",
                " ",
                tipIconNode(TIP_LABEL["Suggest"]),
              ])
            : null,
          zones.length
            ? createElement("div", {
                className: "hint",
                text: `Select zones to add. Based on ${
                  gasGiants.length ? "gas giant resonances" : "frost line estimate"
                }. Recommended zones are pre-selected.`,
              })
            : createElement("div", {
                className: "hint",
                attrs: { style: "margin-top:8px" },
                text: "No suggestions available. Add gas giants or adjust star parameters.",
              }),
          zones.length
            ? createElement(
                "div",
                { className: "dd-suggest-list" },
                zones.map((zone, index) =>
                  createElement(
                    "label",
                    {
                      className: `dd-suggest-item${
                        zone.recommended ? "" : " dd-suggest-item--alt"
                      }`,
                    },
                    [
                      createElement("input", {
                        attrs: { type: "checkbox" },
                        dataset: { zoneIdx: index },
                        checked: zone.recommended,
                      }),
                      createElement("span", {
                        className: "dd-suggest-priority",
                        text: `P${zone.priority}`,
                      }),
                      createElement("span", {
                        className: "dd-suggest-label",
                        text: zone.label,
                      }),
                      createElement("span", {
                        className: "dd-suggest-range",
                        text: `${fmt(zone.innerAu, 2)}\u2013${fmt(zone.outerAu, 2)} AU`,
                      }),
                      createElement("span", {
                        className: "dd-suggest-res",
                        text: `${
                          zone.resonanceInner && zone.resonanceOuter
                            ? `${zone.resonanceInner} \u2192 ${zone.resonanceOuter}`
                            : "Frost-line scaled"
                        }${zone.sculptorName ? ` (${zone.sculptorName})` : ""}`,
                      }),
                    ],
                  ),
                ),
              )
            : null,
          zones.length
            ? createElement(
                "div",
                { className: "button-row", attrs: { style: "margin-top:6px" } },
                [
                  createElement("button", {
                    attrs: { id: "btn-dd-add-selected", type: "button" },
                    text: "Add selected",
                  }),
                ],
              )
            : null,
        ]),
        createElement("div", { className: "dd-list" }, disks.map(debrisRowNode)),
        createElement("div", { className: "button-row", attrs: { style: "margin-top:10px" } }, [
          createElement("button", {
            attrs: { id: "btn-dd-add", type: "button" },
            text: "Add debris disk",
          }),
        ]),
      ]),
    ]);

    const ddRows = [...debrisEditorEl.querySelectorAll(".dd-row")];
    let hydrating = true;

    function saveFromEditor() {
      if (isRendering) return;
      const result = [];
      for (const row of ddRows) {
        const id = row.getAttribute("data-dd-id");
        const name = row.querySelector(".dd-name").value;
        const mode = ddInputModes.get(id) || "edges";
        let innerAu, outerAu;
        if (mode === "center") {
          const c = Number(row.querySelector(".dd-center").value);
          const w = Number(row.querySelector(".dd-width").value);
          const cVal = Number.isFinite(c) && c > 0 ? c : 1;
          const wVal = Number.isFinite(w) && w > 0 ? w : 0.1;
          innerAu = Math.max(0.01, cVal - wVal / 2);
          outerAu = cVal + wVal / 2;
        } else {
          const inner = Number(row.querySelector(".dd-inner").value);
          const outer = Number(row.querySelector(".dd-outer").value);
          innerAu = Number.isFinite(inner) && inner > 0 ? inner : 0.01;
          outerAu = Number.isFinite(outer) && outer > 0 ? outer : 0.01;
        }
        const eccVal = row.querySelector(".dd-ecc").value;
        const incVal = row.querySelector(".dd-inc").value;
        const massVal = row.querySelector(".dd-mass").value;
        result.push({
          id,
          name,
          innerAu,
          outerAu,
          suggested: false,
          eccentricity: eccVal !== "" ? Number(eccVal) : null,
          inclination: incVal !== "" ? Number(incVal) : null,
          totalMassMearth: massVal !== "" ? Number(massVal) : null,
        });
      }
      saveSystemDebrisDisks(result);
      scheduleRender();
    }

    for (const row of ddRows) {
      const id = row.getAttribute("data-dd-id");
      const innerEl = row.querySelector(".dd-inner");
      const innerSl = row.querySelector(".dd-inner-slider");
      const outerEl = row.querySelector(".dd-outer");
      const outerSl = row.querySelector(".dd-outer-slider");
      const centerEl = row.querySelector(".dd-center");
      const centerSl = row.querySelector(".dd-center-slider");
      const widthEl = row.querySelector(".dd-width");
      const widthSl = row.querySelector(".dd-width-slider");
      const edgesGroup = row.querySelector(".dd-edges-group");
      const centerGroup = row.querySelector(".dd-center-group");
      const modeToggle = row.querySelector(".dd-mode-toggle");

      const onChange = () => {
        if (hydrating) return;
        saveFromEditor();
      };

      bindNumberAndSlider({
        numberEl: innerEl,
        sliderEl: innerSl,
        min: 0.01,
        max: 1000,
        step: 0.01,
        mode: "auto",
        onChange,
      });
      bindNumberAndSlider({
        numberEl: outerEl,
        sliderEl: outerSl,
        min: 0.01,
        max: 1000,
        step: 0.01,
        mode: "auto",
        onChange,
      });
      bindNumberAndSlider({
        numberEl: centerEl,
        sliderEl: centerSl,
        min: 0.01,
        max: 1000,
        step: 0.01,
        mode: "auto",
        onChange,
      });
      bindNumberAndSlider({
        numberEl: widthEl,
        sliderEl: widthSl,
        min: 0.01,
        max: 500,
        step: 0.01,
        mode: "auto",
        onChange,
      });

      const eccEl = row.querySelector(".dd-ecc");
      const eccSl = row.querySelector(".dd-ecc-slider");
      const incEl = row.querySelector(".dd-inc");
      const incSl = row.querySelector(".dd-inc-slider");
      const massEl = row.querySelector(".dd-mass");
      const massClear = row.querySelector(".dd-mass-clear");

      bindNumberAndSlider({
        numberEl: eccEl,
        sliderEl: eccSl,
        min: 0,
        max: 0.5,
        step: 0.01,
        mode: "linear",
        onChange,
      });
      bindNumberAndSlider({
        numberEl: incEl,
        sliderEl: incSl,
        min: 0,
        max: 90,
        step: 1,
        mode: "linear",
        onChange,
      });
      massEl.addEventListener("change", onChange);
      massClear.addEventListener("click", () => {
        massEl.value = "";
        onChange();
      });

      modeToggle.addEventListener("change", () => {
        const newMode = row.querySelector('input[name="ddMode_' + id + '"]:checked').value;
        ddInputModes.set(id, newMode);
        if (newMode === "center") {
          // Sync center/width from current inner/outer
          const inner = Number(innerEl.value) || 0;
          const outer = Number(outerEl.value) || 0;
          centerEl.value = Math.round(((inner + outer) / 2) * 100) / 100;
          widthEl.value = Math.round((outer - inner) * 100) / 100;
          centerEl.dispatchEvent(new Event("input", { bubbles: true }));
          widthEl.dispatchEvent(new Event("input", { bubbles: true }));
          edgesGroup.style.display = "none";
          centerGroup.style.display = "";
        } else {
          // Sync inner/outer from current center/width
          const c = Number(centerEl.value) || 0;
          const w = Number(widthEl.value) || 0;
          innerEl.value = Math.max(0.01, Math.round((c - w / 2) * 100) / 100);
          outerEl.value = Math.round((c + w / 2) * 100) / 100;
          innerEl.dispatchEvent(new Event("input", { bubbles: true }));
          outerEl.dispatchEvent(new Event("input", { bubbles: true }));
          edgesGroup.style.display = "";
          centerGroup.style.display = "none";
        }
      });

      row.querySelector(".dd-name").addEventListener("change", saveFromEditor);
      row.querySelector(".dd-remove").addEventListener("click", () => {
        const now = getDebrisDisks(loadWorld()).filter((d) => d.id !== id);
        ddInputModes.delete(id);
        saveSystemDebrisDisks(now);
        scheduleRender();
      });
    }

    hydrating = false;

    // "Add selected" button — adds only checked zones from the preview
    debrisEditorEl.querySelector("#btn-dd-add-selected")?.addEventListener("click", () => {
      const checked = [
        ...debrisEditorEl.querySelectorAll('.dd-suggest-item input[type="checkbox"]:checked'),
      ];
      if (!checked.length) return;

      const w = loadWorld();
      const existing = getDebrisDisks(w);
      const newDisks = [...existing];
      for (const cb of checked) {
        const idx = Number(cb.dataset.zoneIdx);
        const z = zones[idx];
        if (!z) continue;
        newDisks.push({
          id: `dd${Math.random().toString(36).slice(2, 9)}`,
          name: z.label,
          innerAu: z.innerAu,
          outerAu: z.outerAu,
          suggested: true,
        });
      }
      saveSystemDebrisDisks(newDisks);
      scheduleRender();
    });

    // Add button
    debrisEditorEl.querySelector("#btn-dd-add")?.addEventListener("click", () => {
      const now = getDebrisDisks(loadWorld());
      // Default placement: beyond frost line, scaled to this system
      const frostAu = model.frostLineAu || 5;
      const defaultInner = Math.round(frostAu * 3 * 100) / 100;
      const defaultOuter = Math.round(frostAu * 5 * 100) / 100;
      now.push({
        id: `dd${Math.random().toString(36).slice(2, 9)}`,
        name: `Debris disk ${now.length + 1}`,
        innerAu: defaultInner,
        outerAu: defaultOuter,
      });
      saveSystemDebrisDisks(now);
      scheduleRender();
    });
  }

  /* ── Output Summary ─────────────────────────────────────────────── */

  function renderSummary(world, model) {
    const disks = getDebrisDisks(world);
    const gasGiants = getGasGiants(world);
    const starTeffK = model.star.tempK || 0;
    const starData = {
      starMassMsol: Number(world.star.massMsol) || 1,
      starLuminosityLsol: model.star.luminosityLsol,
      starAgeGyr: Number(world.star.ageGyr) || 4.6,
      starRadiusRsol: model.star.radiusRsol,
      starMetallicityFeH: Number(world.star.metallicityFeH) || 0,
    };
    const giantsForEngine = gasGiants.map((g) => ({
      name: g.name,
      au: g.au,
      massMjup: g.massMjup,
    }));

    // Compute debris disk derived properties
    const ddModels = disks.map((d) =>
      calcDebrisDisk({
        innerAu: d.innerAu,
        outerAu: d.outerAu,
        eccentricity: d.eccentricity,
        inclination: d.inclination,
        totalMassMearth: d.totalMassMearth,
        gasGiants: giantsForEngine,
        starTeffK,
        ...starData,
      }),
    );

    replaceChildren(summaryEl, [
      createElement("div", { className: "kpi-grid" }, [
        createOuterKpiCard("Debris disks", disks.length, "", TIP_LABEL["Debris disks count"]),
      ]),
      disks.map((disk, index) => {
        const diskModel = ddModels[index];
        return [
          createElement("div", {
            className: "label",
            attrs: { style: "margin-top:18px" },
            text: disk.name,
          }),
          createElement("div", { className: "kpi-grid" }, [
            createOuterKpiCard(
              "Range",
              diskModel.display.range,
              diskModel.inputs.eccentricity > 0 ? diskModel.display.periApo : "",
              TIP_LABEL["Disk Range"],
            ),
            createOuterKpiCard(
              "Temperature",
              diskModel.display.temperature,
              "",
              TIP_LABEL["Disk Temperature"],
            ),
            createOuterKpiCard(
              "Composition",
              diskModel.display.composition,
              diskModel.composition.dominantMaterials.join(", "),
              TIP_LABEL["Disk Composition"],
            ),
            createOuterKpiCard(
              "Classification",
              diskModel.display.classification,
              diskModel.display.frostLine,
              TIP_LABEL["Resonance"],
            ),
            createOuterKpiCard(
              "Estimated Mass",
              `${diskModel.display.mass} M\u2295`,
              diskModel.display.massSource,
              TIP_LABEL["Estimated Mass"],
            ),
            createOuterKpiCard(
              "Orbital Period",
              diskModel.display.orbitalPeriod,
              "At midpoint",
              TIP_LABEL["Disk Orbital Period"],
            ),
            createOuterKpiCard(
              "Collision Velocity",
              diskModel.display.collisionVelocity,
              diskModel.display.collisionRegime,
              TIP_LABEL["Collision Velocity"],
            ),
            createOuterKpiCard(
              "Surface Density",
              `${diskModel.display.surfaceDensity} g/cm\u00b2`,
              diskModel.display.surfaceDensityVsMMSN,
              TIP_LABEL["Surface Density"],
            ),
            createOuterKpiCard(
              "IR Excess",
              diskModel.display.irExcess,
              diskModel.display.irExcessLabel,
              TIP_LABEL["IR Excess"],
            ),
            createOuterKpiCard(
              "Stability",
              diskModel.display.stability,
              "",
              TIP_LABEL["Disk Stability"],
            ),
          ]),
          createElement("div", { attrs: { style: "margin-top:14px" } }, [
            createElement("div", { className: "label" }, [
              "Derived details",
              " ",
              tipIconNode(TIP_LABEL["Disk Derived"]),
            ]),
            createElement("div", {
              className: "derived-readout",
              text:
                `Fractional luminosity: ${diskModel.display.luminosity}\n` +
                `Optical depth: ${diskModel.display.opticalDepth}\n\n` +
                `Grain blowout size: ${diskModel.display.blowout}\n` +
                `PR drag timescale: ${diskModel.display.prDrag}\n` +
                `Collisional lifetime: ${diskModel.display.collisional}\n` +
                `Dominant process: ${diskModel.display.dominantProcess}\n\n` +
                `Dust production: ${diskModel.display.dustProduction}\n` +
                `Zodiacal delivery: ${diskModel.display.zodiacalInflow} (${diskModel.display.zodiacalLabel})\n` +
                `Ice-to-rock ratio: ${diskModel.display.iceToRock}`,
            }),
          ]),
          createElement("div", { attrs: { style: "margin-top:14px" } }, [
            createElement("div", { className: "label" }, [
              "Condensation species",
              " ",
              tipIconNode(TIP_LABEL["Condensation Species"]),
            ]),
            createElement("div", { className: "derived-readout" }, [
              createElement("table", { className: "mini-table" }, [
                createElement("thead", {}, [
                  createElement("tr", {}, [
                    createElement("th", { text: "Species" }),
                    createElement("th", {}, ["T", createElement("sub", { text: "cond" })]),
                    createElement("th", { text: "Inner" }),
                    createElement("th", { text: "Mid" }),
                    createElement("th", { text: "Outer" }),
                  ]),
                ]),
                createElement(
                  "tbody",
                  {},
                  diskModel.composition.species.map((species) =>
                    createElement("tr", {}, [
                      createElement("td", { text: species.name }),
                      createElement("td", { text: `${species.condensationK} K` }),
                      createElement("td", { text: species.presentAtInner ? "\u2713" : "\u2717" }),
                      createElement("td", { text: species.presentAtMid ? "\u2713" : "\u2717" }),
                      createElement("td", { text: species.presentAtOuter ? "\u2713" : "\u2717" }),
                    ]),
                  ),
                ),
              ]),
              createElement("div", { attrs: { style: "margin-top:4px" } }, [
                "Ice-to-rock ratio",
                " ",
                tipIconNode(TIP_LABEL["Ice-to-Rock Ratio"]),
                ": ",
                diskModel.display.iceToRock,
              ]),
            ]),
          ]),
        ];
      }),
    ]);
  }

  /* ── Main render ────────────────────────────────────────────────── */

  function render() {
    if (isRendering) return;
    isRendering = true;
    try {
      let world = loadWorld();
      const dSov = getStarOverrides(world.star);
      const dStarCalc = calcStar({
        massMsol: Number(world.star.massMsol),
        ageGyr: Number(world.star.ageGyr) || 4.6,
        radiusRsolOverride: dSov.r,
        luminosityLsolOverride: dSov.l,
        tempKOverride: dSov.t,
        evolutionMode: dSov.ev,
      });
      const model = calcSystem({
        starMassMsol: Number(world.star.massMsol),
        spacingFactor: Number(world.system.spacingFactor),
        orbit1Au: Number(world.system.orbit1Au),
        luminosityLsolOverride: dStarCalc.luminosityLsol,
        radiusRsolOverride: dStarCalc.radiusRsol,
      });

      // Auto-sync: when gas giants change, update any suggested debris disks
      const gg = getGasGiants(world);
      const allZones = calcDebrisDiskSuggestions({
        gasGiants: gg.map((g) => ({ name: g.name, au: g.au })),
        starLuminosityLsol: model.star.luminosityLsol,
      });
      const zones = allZones.filter((z) => z.recommended);
      const existingDisks = getDebrisDisks(world);
      const userEdited = existingDisks.filter((d) => !d.suggested);
      const pristine = existingDisks.filter((d) => d.suggested);
      if (
        pristine.length > 0 &&
        (pristine.length !== zones.length ||
          pristine.some(
            (d, i) => !zones[i] || d.innerAu !== zones[i].innerAu || d.outerAu !== zones[i].outerAu,
          ))
      ) {
        const synced = [...userEdited];
        for (let i = 0; i < zones.length; i++) {
          synced.push({
            id: pristine[i]?.id || `dd${Math.random().toString(36).slice(2, 9)}`,
            name: zones[i].label,
            innerAu: zones[i].innerAu,
            outerAu: zones[i].outerAu,
            suggested: true,
          });
        }
        saveSystemDebrisDisks(synced);
        world = loadWorld();
      }

      renderDebrisDisksEditor(world, model);
      renderSummary(world, model);
    } finally {
      isRendering = false;
    }
  }

  render();
}
