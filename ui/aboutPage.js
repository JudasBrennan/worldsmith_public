export function initAboutPage(mountEl) {
  const el = document.createElement("div");
  el.className = "page";
  el.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--about" aria-hidden="true"></span><span>About WorldSmith</span></h1>
        <div class="badge">Reference</div>
      </div>
      <div class="panel__body">
        <p>
          <b>WorldSmith Web 1.19.0</b> is a browser-based sci-fi worldbuilding toolkit by <b>Judas Brennan</b>.
          Design stars, planetary systems, rocky worlds, gas giants, moons, and debris disks with
          real astrophysics. Model tectonics, climate zones, atmospheres, populations, and calendars.
          Explore your creations in an interactive 3D visualiser with procedural textures, or study
          the underlying science through 160+ documented equations and a 20-lesson curriculum.
        </p>

        <p>
          Inspired by the <b>WorldSmith 8.0</b> spreadsheet by <b>Artifexian</b>, though the science,
          code, and feature set have since been built from scratch. The corrected temperature-dependent
          habitable-zone implementation is adapted from the Desmos model by <b>Chromant</b>.
        </p>

        <div class="page-title" style="margin-top:18px">Credits</div>
        <ul>
          <li>Artifexian YouTube: <a href="https://www.youtube.com/c/Artifexian" target="_blank" rel="noopener noreferrer">https://www.youtube.com/c/Artifexian</a></li>
          <li>WorldSmith 8.0 spreadsheet: <a href="https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy" target="_blank" rel="noopener noreferrer">https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy</a></li>
          <li>Chromant Desmos model (Star System Visualizer 1.1.0): <a href="https://www.desmos.com/calculator/gcgvefvuc7" target="_blank" rel="noopener noreferrer">https://www.desmos.com/calculator/gcgvefvuc7</a></li>
          <li>&#x1D539;&#x1D55A;&#x1D55D;&#x1D55D; &#x2115;&#x1D56A;&#x1D556; the Science Guy*: style improvements <br><span style="font-size:12px;color:var(--muted)">*Not THAT Bill Nye</span></li>
        </ul>

        <div class="page-title" style="margin-top:18px">Community</div>
        <ul>
          <li>Judas Brennan Discord: <a href="https://discord.gg/f63SfkW7vh" target="_blank" rel="noopener noreferrer">https://discord.gg/f63SfkW7vh</a></li>
          <li>Artifexian Discord: <a href="https://discord.com/invite/hPvqDBPkhg" target="_blank" rel="noopener noreferrer">https://discord.com/invite/hPvqDBPkhg</a></li>
        </ul>

        <div class="page-title" style="margin-top:18px">Tips</div>
        <ul>
          <li>Hover over any <b>(i)</b> icon next to a label to see a tooltip explaining what the field does, valid ranges, and real-world context.</li>
          <li>If something looks wrong, use <b>Refresh</b> on the visualiser to redraw from latest data.</li>
          <li>Most inputs support both a <b>slider</b> and a <b>text box</b> for precision.</li>
          <li>Use <b>Import/Export</b> to save your world as JSON and reload it later, or import a WorldSmith 8.x spreadsheet directly.</li>
          <li>Try the <b>Sol</b>, <b>Arrakis</b>, or <b>Realmspace</b> presets on the Import/Export page to explore a fully configured system. Sol includes dwarf planets (Ceres, Pluto) and Charon.</li>
          <li>Use the <b>Splash</b> toggle at the bottom of the sidebar to skip the loading screen on startup.</li>
          <li>Switch between <b>light</b> and <b>dark</b> themes with the toggle at the bottom of the sidebar.</li>
          <li>Turn on <b>Atmospheric escape filter</b> on the Planet page to automatically remove gases the body is too small or warm to retain. The model includes non-thermal losses for H&#x2082; and He.</li>
          <li>Use the <b>Radioisotope Abundance</b> slider (or Per-Isotope mode) to model worlds with more or less internal heat than Earth, affecting volcanism, lithosphere thickness, and dynamo lifetime.</li>
          <li>Your work is stored locally in your browser (localStorage). Use <b>Export</b> regularly to back up your world. Clearing site data will reset the tool.</li>
          <li>Click the <b>Tutorials</b> button in any page header for a step-by-step guide to that page&rsquo;s workflow. Your position is remembered across sessions.</li>
        </ul>

        <p style="margin-top:18px">
          <button class="btn btn--accent" id="openChangelog" type="button">View Changelog</button>
        </p>

        <p class="hint" style="margin-top:14px">
          This is a static web app (HTML/CSS/JS) and can be hosted anywhere that serves static files.
        </p>
      </div>
    </div>
  `;
  mountEl.innerHTML = "";
  mountEl.appendChild(el);

  el.querySelector("#openChangelog").addEventListener("click", openChangelog);
}

/* ── Changelog toast ──────────────────────────────────────── */

const RELEASE_SCIENTISTS = {
  "1.0.0": {
    name: "Nicolaus Copernicus",
    born: 1473,
    died: 1543,
    country: "Poland",
    summary:
      "Proposed the heliocentric model of the solar system, placing the Sun rather than the Earth at the center.",
  },
  "1.1.0": {
    name: "Tycho Brahe",
    born: 1546,
    died: 1601,
    country: "Denmark",
    summary:
      "Made the most precise astronomical observations of the pre-telescopic era, compiling an extensive catalog of stellar and planetary positions.",
  },
  "1.2.0": {
    name: "Johannes Kepler",
    born: 1571,
    died: 1630,
    country: "Germany",
    summary:
      "Formulated the three laws of planetary motion, establishing that planets orbit the Sun in ellipses rather than perfect circles.",
  },
  "1.3.0": {
    name: "Galileo Galilei",
    born: 1564,
    died: 1642,
    country: "Italy",
    summary:
      "Pioneered the use of the telescope for astronomical observation, discovering Jupiter\u2019s moons and the phases of Venus.",
  },
  "1.4.0": {
    name: "Christiaan Huygens",
    born: 1629,
    died: 1695,
    country: "Netherlands",
    summary:
      "Proposed the wave theory of light, discovered Saturn\u2019s moon Titan, and invented the pendulum clock.",
  },
  "1.5.0": {
    name: "Isaac Newton",
    born: 1643,
    died: 1727,
    country: "England",
    summary: "Formulated the laws of motion and universal gravitation, and co-invented calculus.",
  },
  "1.6.0": {
    name: "William Herschel",
    born: 1738,
    died: 1822,
    country: "Germany",
    summary:
      "Discovered the planet Uranus, cataloged thousands of nebulae and double stars, and discovered infrared radiation.",
  },
  "1.7.0": {
    name: "Edwin Hubble",
    born: 1889,
    died: 1953,
    country: "United States",
    summary:
      "Demonstrated that galaxies exist beyond the Milky Way and discovered that the universe is expanding.",
  },
  "1.8.0": {
    name: "James Clerk Maxwell",
    born: 1831,
    died: 1879,
    country: "Scotland",
    summary:
      "Unified electricity, magnetism, and optics into a single theoretical framework, demonstrating that light is an electromagnetic wave.",
  },
  "1.9.0": {
    name: "Emmy Noether",
    born: 1882,
    died: 1935,
    country: "Germany",
    summary:
      "Proved Noether\u2019s theorem linking symmetries in physics to conservation laws, fundamental to modern theoretical physics.",
  },
  "1.10.0": {
    name: "Cecilia Payne-Gaposchkin",
    born: 1900,
    died: 1979,
    country: "England",
    summary:
      "Demonstrated that stars are composed primarily of hydrogen and helium, overturning the prevailing assumption of Earth-like composition.",
  },
  "1.11.0": {
    name: "Henrietta Swan Leavitt",
    born: 1868,
    died: 1921,
    country: "United States",
    summary:
      "Discovered the period\u2013luminosity relationship for Cepheid variables, providing the first reliable method for measuring cosmic distances.",
  },
  "1.12.0": {
    name: "Georges Lema\u00eetre",
    born: 1894,
    died: 1966,
    country: "Belgium",
    summary:
      "First proposed the Big Bang theory, describing the origin of the universe as an expansion from a \u2018primeval atom.\u2019",
  },
  "1.13.0": {
    name: "Caroline Herschel",
    born: 1750,
    died: 1848,
    country: "Germany",
    summary:
      "Discovered several comets and nebulae and was the first woman to receive a salary as a scientist.",
  },
  "1.14.0": {
    name: "Richard Feynman",
    born: 1918,
    died: 1988,
    country: "United States",
    summary:
      "Developed the path integral formulation of quantum mechanics and the theory of quantum electrodynamics.",
  },
  "1.15.0": {
    name: "Marie Curie",
    born: 1867,
    died: 1934,
    country: "Poland",
    summary:
      "Pioneered research on radioactivity and discovered polonium and radium. The only person to win Nobel Prizes in two different sciences.",
  },
  "1.16.0": {
    name: "Lise Meitner",
    born: 1878,
    died: 1968,
    country: "Austria",
    summary:
      "Provided the first theoretical explanation of nuclear fission, correctly interpreting the splitting of the uranium nucleus.",
  },
  "1.17.0": {
    name: "Subrahmanyan Chandrasekhar",
    born: 1910,
    died: 1995,
    country: "India",
    summary:
      "Calculated the maximum mass of a stable white dwarf star (the Chandrasekhar limit), showing that more massive stars must collapse further.",
  },
  "1.18.0": {
    name: "Niels Bohr",
    born: 1885,
    died: 1962,
    country: "Denmark",
    summary:
      "Developed the Bohr model of the atom with quantized electron orbits and made foundational contributions to quantum mechanics.",
  },
  "1.19.0": {
    name: "Max Planck",
    born: 1858,
    died: 1947,
    country: "Germany",
    summary:
      "Originated quantum theory by proposing that energy is emitted in discrete packets called quanta. His discovery of Planck\u2019s constant earned him the 1918 Nobel Prize in Physics.",
  },
};
function scientistCard(version) {
  const s = RELEASE_SCIENTISTS[version];
  if (!s) return "";
  const surname = s.name.split(" ").pop();
  return `
        <div class="changelog-scientist">
          <div class="changelog-scientist__title">The ${surname} Release</div>
          <div class="changelog-scientist__detail">${s.name} (${s.born}\u2013${s.died}) \u00b7 ${s.country}</div>
          <div class="changelog-scientist__summary">${s.summary}</div>
        </div>`;
}

function release(version, note, items) {
  const open = version === "1.19.0" ? " open" : "";
  const lis = items.map((i) => `<li>${i}</li>`).join("\n          ");
  const s = RELEASE_SCIENTISTS[version];
  const surname = s ? ` \u2014 The ${s.name.split(" ").pop()} Release` : "";
  return `
      <details class="changelog-release"${open}>
        <summary class="changelog-release__summary"><b>Version ${version}${surname}</b> <span class="changelog-release__note">${note}</span></summary>${scientistCard(version)}
        <ul>${lis}</ul>
      </details>`;
}

function changelogHTML() {
  return [
    release("1.19.0", "(from 1.18.1)", [
      "<b>Schweitzer M-dwarf Radius</b> &mdash; Replaced the Eker quadratic below 0.5 M&#9737; with the Schweitzer et al. (2019) linear relation (R&nbsp;=&nbsp;0.0282&nbsp;+&nbsp;0.935&thinsp;M), with a smooth blend over 0.5&ndash;0.7 M&#9737;. Improves low-mass radius accuracy against benchmark stars.",
      "<b>L4/L5 Stability</b> &mdash; Lagrange Trojan points now show whether they are stable or unstable via the Gascheau (1843) criterion (&mu;&nbsp;&lt;&nbsp;0.0385). Unstable Trojans appear as dimmed amber diamonds in the visualiser.",
      "<b>Giant Planet Probability</b> &mdash; Updated to Kepler-era baseline (~7% at solar mass and metallicity) with stellar mass dependence from Johnson et al. (2010). M&nbsp;dwarfs now show lower probability; A/F&nbsp;stars show higher.",
      "<b>Collapsible Sidebar</b> &mdash; Replaced the dual top-nav + sidebar with a single collapsible sidebar. Starts as a slim icon rail on desktop; click to expand, click outside to collapse. On mobile, opens as a full drawer via a hamburger button. Nav reorganised into six semantic groups.",
      "<b>Science Visualiser Icon</b> &mdash; New blackboard-style icon for the Science Visualiser page, distinct from the flask used by Science &amp; Maths.",
      "<b>Light Mode Overhaul</b> &mdash; Warm-cream Paper Dashboard palette replacing the old grey theme. 18 dedicated light-mode icon variants, light favicon, flash-free theme loading, and redesigned Other Objects icon (comet + debris instead of gas giant).",
      "<b>Changelog Toast</b> &mdash; Changelog moved from the About page to a modal overlay with collapsible releases.",
      "<b>Release Scientists</b> &mdash; Each major release is now dedicated to a scientist, shown as a card in the changelog with name, dates, country, and contribution.",
    ]),
    release("1.18.1", "(from 1.18.0)", [
      "<b>Improved Mass-Radius Relation</b> &mdash; Extended the Eker (2018) quadratic MRR to its full calibration range of 1.5 M&#9737; (was 1.0). Above 1.5 M&#9737; the old Demircan &amp; Kahraman power law is replaced by a Stefan-Boltzmann derivation from Eker MLR + MTR, cutting RMSE against benchmark stars from ~28% to ~18%.",
      "<b>Mass-Temperature Relation</b> &mdash; New <code>massToTeff()</code> function implementing the Eker (2018) MTR for high-mass stars (M &gt; 1.5 M&#9737;).",
      "<b>Science &amp; Maths</b> &mdash; Updated MRR formula display with the new piecewise equation, and added the MTR formula entry.",
    ]),
    release("1.18.0", "(from 1.17.1)", [
      "<b>Calendar UX Redesign</b> &mdash; Rebuilt the Calendar page with a toolbar + closable drawer layout. The calendar grid now fills the full width when the drawer is closed. Four drawer tabs (Structure, Identity, Rules, Output) replace the previous eight collapsible panels.",
      "<b>Tutorials on Every Page</b> &mdash; All 13 interactive pages now have a &ldquo;Tutorials&rdquo; button in their header. Each tutorial walks you through the page&rsquo;s workflow in 4&ndash;8 steps with a persistent toast panel that remembers your position.",
      "<b>Live-Update Inputs</b> &mdash; Star, Moon, System, and Calendar pages now update outputs instantly as you type or drag sliders, removing the Apply button from these pages.",
      "<b>Calendar Structure Controls</b> &mdash; Replaced the three &ldquo;weeks per month&rdquo; sliders with direct &ldquo;Days per month&rdquo; and &ldquo;Days per week&rdquo; inputs with a structure readout showing weekly breakdown and drift warnings.",
      "<b>Bug Fixes</b> &mdash; Fixed infinite loop on Moon and Star pages when dragging sliders, fixed Science page crash from malformed data table call, fixed calendar rounding toggle responsiveness.",
    ]),
    release("1.17.1", "(from 1.17.0)", [
      "<b>Science Visualiser</b> &mdash; New interactive dependency graph page mapping 58 scientific concepts across 12 sections with 112 typed edges. Three view modes (full graph, section filter, trace mode), search, and detail panels with formulas and engine references.",
      "<b>Climate State Classification</b> &mdash; Planets are now classified as Stable, Snowball, Moist greenhouse, or Runaway greenhouse based on surface temperature and absorbed stellar flux. New KPI card on the planet page, climate advisory warnings, and a science visualiser node with five edges.",
      "<b>Climate State NASA Validation</b> &mdash; 19 tests validating absorbed flux and climate state against Solar System data (Mercury, Venus, Earth, Mars, Ceres) in dry and wet configurations.",
      "<b>Calendar Rounding Override</b> &mdash; New &ldquo;Round derived data&rdquo; toggle on the Calendar page with a 0&ndash;6 decimal places slider. When enabled, rounds orbital periods before they enter the calendar model, affecting month lengths and leap cycles. Persists per profile.",
    ]),
    release("1.17.0", "(from 1.16.1)", [
      "<b>Lessons Page</b> &mdash; 20-lesson progressive curriculum covering every scientific concept in the model, organised into six units with a Basic/Advanced toggle and embedded mini-calculators.",
      "<b>Gas Giant Orbital Parameters</b> &mdash; Eccentricity, inclination, and axial tilt inputs for gas giants, unlocking periapsis/apoapsis temperatures, insolation, spin-orbit resonance, and giant-to-giant mean-motion resonance.",
      "<b>Gas Giant Physics</b> &mdash; Christensen energy-flux dynamo model, Chapman-Ferraro magnetopause with moon plasma inflation, per-species Jeans escape analysis, moon tidal heating, and atmospheric sputtering magnetopause inflation.",
      "<b>Rocky Planet Enhancements</b> &mdash; Periapsis/apoapsis temperatures, volatile sublimation flags for dwarf planets, and suggested gas giant resonance for all rocky planets.",
      "<b>Moon Volatile Inventory</b> &mdash; Moons now display surface ices and thin volatile atmospheres for seven species, with Jeans escape and geological retention checks.",
      "<b>Unified KPI Layout</b> &mdash; Rocky planet, gas giant, and moon pages now share a consistent KPI card order for shared concepts (Appearance, Composition, Radius, Density, Gravity, Escape Velocity, Magnetic Field, Temperature, Orbital Period). Derived detail sections split into labelled sub-headings for readability.",
    ]),
    release("1.16.1", "(from 1.16.0)", [
      "<b>Internal Heat UI</b> &mdash; Added the missing Internal Heat input section to the planet page with Simple (single slider) and Per-Isotope (U-238, U-235, Th-232, K-40) modes.",
      "<b>Toggle Consistency</b> &mdash; Atmospheric Escape and Vegetation toggles converted to pill-style controls matching the rest of the app.",
      "<b>Cluster Visualiser Export</b> &mdash; Fixed PNG and GIF exports producing blank images in cluster mode.",
    ]),
    release("1.16.0", "(from 1.15.0)", [
      "<b>Atmospheric Escape</b> &mdash; Per-species Jeans escape analysis with exobase temperature model, pressure-dependent XUV absorption, and non-thermal escape enhancement for H&#x2082; and He. Optional auto-strip toggle removes gases the body cannot retain. Calibrated against NASA Planetary Fact Sheet data.",
      "<b>Dwarf Planets</b> &mdash; Mass-based body classification (Dwarf planet below 0.01 M&#x2295;). Mass floor lowered to 0.0001 M&#x2295;. Sol preset adds Ceres, Pluto, and Charon.",
      "<b>Radioisotope Abundance</b> &mdash; Configurable radioisotope abundance for rocky planets with Simple (single slider) and Per-Isotope (U-238, U-235, Th-232, K-40) modes. Scales volcanic activity, lithosphere thickness, internal heat budget, and magnetic dynamo lifetime.",
      "<b>Moon Physics</b> &mdash; Surface temperature calculation, magnetospheric radiation dose from host planet, tidal-thermal feedback for rocky moons (Io-calibrated), and configurable initial rotation period with estimated current spin.",
      "<b>Orbit Placement Mode</b> &mdash; Guided / Manual orbit toggle on the System tab lets you place planets at arbitrary semi-major axes.",
      "<b>Local Cluster Limits</b> &mdash; Tightened input ranges (25 ly max radius, 0.1 /ly&sup3; max density) and raised system render cap from 99 to 750.",
      "<b>UI Polish</b> &mdash; Unified pill-toggle style across planet and star pages, section headings in Derived Details, and canvas loading performance optimisations (IndexedDB texture caching, worker pre-warming, progressive LOD).",
    ]),
    release("1.15.0", "(from 1.14.0)", [
      "<b>Tectonics</b> &mdash; New interactive tectonics page with mountain ranges, shield volcanoes, rift valleys, seafloor spreading, isostasy modes, continental margins, and a full plate canvas with Voronoi tessellation, Euler pole rotation, and boundary classification.",
      "<b>Climate Zones</b> &mdash; Latitude-based K&ouml;ppen climate classification with aridity indices, tidally-locked zone modelling, and colour-coded zone cards.",
      "<b>Population</b> &mdash; Carrying capacity, logistic growth curves, land-use cascades, and Zipf rank-size regional distribution across configurable tech eras.",
      "<b>Science &amp; Maths Expansion</b> &mdash; Six new formula sections (Stellar Evolution, Gas Giant Physics, Lagrange Points, Climate, Population, Debris Disks) and four expanded sections, bringing coverage to ~160 equations across 18 sections.",
      "<b>Tooltip Audit</b> &mdash; Added ~80 new tooltips across Tectonics, Climate, and Population pages. Rewrote existing tooltips for style guide compliance with declarative tone, Unicode units, and correct naming.",
      "<b>Preset Updates</b> &mdash; Sol, Realmspace, and Arrakis presets updated to the current schema with all new planet, moon, and gas giant fields. Fixed a data corruption bug affecting Venus and Toril preset values.",
      "<b>Import/Export</b> &mdash; Import preview now shows all nine world sections including tectonics, population, climate, and calendar summaries.",
    ]),
    release("1.14.0", "(from 1.13.0)", [
      "<b>Three.js Rendering</b> &mdash; All major render surfaces (Visualiser, System Poster, Apparent Sky, body previews) now use native Three.js WebGL with procedural textures, PBR materials, and LOD quality tiers.",
      "<b>Procedural Celestial Textures</b> &mdash; Rocky planets, gas giants, and moons generate unique equirectangular texture maps using 3D noise, domain warping, and rule-driven composition layers (oceans, ice caps, clouds, craters, bands, storms, and more).",
      "<b>Cluster Visualiser Overhaul</b> &mdash; Rewritten as a pure 2D overlay with radial-gradient star dots, native text labels with collision detection, and a toggleable starfield background.",
      "<b>Stellar Activity Model</b> &mdash; Three-tier activity model with cycle-aware flare modulation, split-rate CME channels, and an animated star preview showing real-time flare bursts and CME events.",
      "<b>Camera Controls</b> &mdash; Momentum-based pan and rotate with inertia, smooth zoom interpolation, click-to-center, double-click-to-zoom, focus lock that survives drag, animated reset, and full touch gesture support. Press <b>?</b> on the visualiser for the control reference.",
      "<b>Splash Screen Toggle</b> &mdash; Persistent opt-out checkbox in the header to skip the loading overlay on startup.",
      "<b>Gas Giant Styles</b> &mdash; Fantastical styles removed; 17 realistic styles with tuned palettes for higher saturation and contrast.",
    ]),
    release("1.13.0", "(from 1.12.0)", [
      "<b>Debris Disk Modelling</b> &mdash; Added resonance-driven asteroid belt and outer disk generation with derived composition, collision regime, and detection estimates.",
      "<b>Unified Body Visuals</b> &mdash; Rocky planets, gas giants, and moons now use a shared rendering pipeline for more consistent presentation across Planet, System Poster, Visualiser, and Apparent views.",
      "<b>Gas Giant Auto-Rings</b> &mdash; Ring visibility and visual style now auto-update from gas giant physics outputs, so appearance stays aligned with calculated ring properties.",
      "<b>System Page Consistency</b> &mdash; Star evolution overrides and slot-aware orbit inputs now propagate correctly into System Poster planet and moon calculations.",
    ]),
    release("1.12.0", "(from 1.11.1)", [
      "<b>3D Splash Screen</b> &mdash; Interactive loading overlay with a 3D planet model you can grab and spin. Biome colouring, clouds, atmosphere, and city lights on the night side. Click &ldquo;Enter WorldSmith&rdquo; to dismiss.",
      "<b>Rocky Planet Visuals</b> &mdash; Rocky planets now render with physics-driven canvas visuals matching gas giant richness. Surface palettes, oceans, ice caps, clouds, atmosphere rim, terrain types, vegetation, lava cracks, and tidal-lock darkening &mdash; all determined by the planet&rsquo;s properties.",
      "<b>Gas Giant Physics Overhaul</b> &mdash; Six new subsystems: rotational oblateness, atmospheric mass loss, interior structure &amp; core mass, age-dependent radius cooling, ring properties, and tidal locking/circularisation. All derived from existing inputs.",
      "<b>Stellar Evolution</b> &mdash; New &ldquo;Evolved&rdquo; toggle on the Star page. When enabled, luminosity, radius, and temperature evolve with age and metallicity instead of using static scaling laws. Propagates through planet insolation, habitable zone, surface temperature, and moon illumination.",
      "<b>Lagrange Points</b> &mdash; Toggle-able L1&ndash;L5 overlay in the system visualiser. Click a body to see all five equilibrium points.",
      "<b>Cluster Metallicity</b> &mdash; Each star system in the local cluster now receives a [Fe/H] value based on galactic position, with giant-planet probability.",
    ]),
    release("1.11.1", "(from 1.11.0)", [
      "<b>System Poster</b> &mdash; Dynamic solar system lineup visualization on the Planetary System page. Star glows on the left; rocky planets, gas giants, debris disks, and moons are arranged by orbital distance with power-law sizing. Includes curved orbital arcs for habitable zone and debris disks, irregular asteroid particle effects, control panel toggles, logarithmic/linear scale, fullscreen mode, and PNG export.",
    ]),
    release("1.11.0", "(from 1.10.0)", [
      "<b>Apparent Size &amp; Brightness</b> &mdash; Bug fixes (angular-diameter swap, Roche limit divisor, moon absolute magnitude formula), multi-moon support, Bond-to-geometric albedo conversion, and NASA-validated Sol reference data.",
      "<b>Sky Canvas</b> &mdash; Angular size comparison chart rendering star, moons, and planets as disks at true relative angular sizes with Sol reference outlines, phase crescents, brightness-scaled glow, and a day/night sky toggle using the planet engine&rsquo;s computed sky colours.",
      "<b>Sol System Preset</b> &mdash; Corrected orbital, physical, and photometric data for 19 bodies against NASA Planetary Fact Sheets.",
    ]),
    release("1.10.0", "(from 1.9.1)", [
      "<b>Rocky Planet Composition</b> &mdash; Seven composition classes (Ice world through Coreless) and six water regimes derived from core mass fraction and water mass fraction. Includes core radius, mass&ndash;radius scaling, and composition-dependent tidal parameters.",
      "<b>Rocky Planet Atmosphere</b> &mdash; Ten-gas atmosphere with three greenhouse modes (Manual, Core, Full). Sky and vegetation colours vary by star type and pressure. Adds circulation cells, atmospheric tide resistance, and liquid water checks.",
      "<b>Magnetic Field</b> &mdash; Dynamo model with dipolar and multipolar regimes, driven by core fraction, mass, age, and rotation.",
      "<b>Tectonic Regimes</b> &mdash; Probability distribution across four regimes (stagnant lid, mobile lid, episodic, plutonic-squishy) based on mass, age, water, composition, and tidal heating.",
      "<b>Science Divergences</b> &mdash; New section on the Science &amp; Maths page listing 22 places where WorldSmith departs from published formulas, with explanations.",
    ]),
    release("1.9.1", "(from 1.9.0)", [
      "<b>Cluster Import</b> &mdash; Paste a tab-separated table of star systems to replace the generated neighbourhood with custom data.",
    ]),
    release("1.9.0", "(from 1.8.1)", [
      "<b>Tidal Heating</b> &mdash; Moon tidal dissipation model with accurate high-eccentricity heating. Outputs total power, surface flux, and Earth-normalised flux.",
      "<b>Composition Override</b> &mdash; Seven interior classes for moons, with calibrated overrides for partially molten and subsurface ocean bodies.",
      "<b>Tidal Recession</b> &mdash; Orbital migration rate and fate prediction from competing planet and moon tidal torques.",
    ]),
    release("1.8.1", "(from 1.8.0)", [
      "<b>Greenhouse Modes</b> &mdash; Greenhouse effect can now be derived from atmospheric composition (Core or Full mode) or set manually.",
      "<b>Sol Preset</b> &mdash; All preset values cross-referenced against the NASA Planetary Fact Sheet.",
      "<b>Local Cluster</b> &mdash; Add or remove star types with +/&minus; buttons and manage companions via right-click context menu.",
    ]),
    release("1.8.0", "(from 1.7.0)", [
      "<b>Sky Colours</b> &mdash; Account for atmospheric column density and CO&sub2; tint.",
      "<b>Vegetation Colours</b> &mdash; Pressure-dependent plant colours with twilight variants for tidally locked worlds.",
      "<b>Science &amp; Maths</b> &mdash; New reference page documenting all equations with LaTeX rendering and interactive calculators.",
      "<b>Temperature</b> &mdash; Improved surface temperature accuracy for airless and thin-atmosphere bodies.",
      "<b>UI</b> &mdash; Expandable KPI cards with hover-to-reveal detail and contrast-aware text on colour swatches.",
    ]),
    release("1.7.0", "(from 1.6.0)", [
      "<b>Unified Visualiser</b> &mdash; System and Local Cluster views merged into one page with seamless zoom transitions.",
      "<b>Star</b> &mdash; Stellar metallicity [Fe/H] input driving giant planet probability and population labels.",
      "<b>Star</b> &mdash; Improved mass&ndash;luminosity and mass&ndash;radius relations replacing the old textbook approximations.",
    ]),
    release("1.6.0", "(from 1.5.0)", [
      "<b>Planets / Other Objects</b> &mdash; Reworked gas giant and debris disk mechanics.",
      "<b>System Visualiser</b> &mdash; Improved gas giant rendering covering many realistic types.",
    ]),
    release("1.5.0", "(from 1.4.0)", [
      "<b>Star</b> &mdash; Advanced Physics mode: choose which two of Radius/Luminosity/Temperature to set.",
      "<b>System Visualiser</b> &mdash; Eccentric orbits rendered as tilted, inclined ellipses with Kepler-solved motion.",
      "<b>System Visualiser</b> &mdash; Moons now share the same orbital mechanics as planets.",
      "<b>Local Cluster</b> &mdash; Fixed stellar population fractions, class-weighted multiplicity, companion mass filtering, habitable-zone probability, and disk geometry.",
      "<b>Import/Export</b> &mdash; Fantasy system preset included.",
    ]),
    release("1.4.0", "(from 1.3.1)", [
      "<b>Apparent Size</b> &mdash; New page for apparent magnitude, brightness, and angular size calculations.",
      "<b>Calendar</b> &mdash; New page for solar, lunar, and lunisolar calendar derivations.",
    ]),
    release("1.3.1", "(from 1.3.0)", [
      "<b>System Visualiser</b> &mdash; Fixed depth layering for planets and gas giants around the star.",
    ]),
    release("1.3.0", "(from 1.2.0)", [
      "<b>System Visualiser</b> &mdash; Full 3D camera navigation with PNG and GIF export.",
      "<b>Planet</b> &mdash; Moon orbit guardrails and improved sky-colour presentation.",
      "<b>Local Cluster</b> &mdash; Range/bearing grid and renameable star systems.",
      "<b>Import/Export</b> &mdash; Built-in Sol preset import.",
    ]),
    release("1.2.0", "(from 1.1.0)", [
      "<b>System</b> &mdash; Temperature-dependent habitable-zone model.",
      "<b>System Visualiser</b> &mdash; Habitable-zone overlay with show/hide toggle.",
    ]),
    release("1.1.0", "(from 1.0.0)", [
      "<b>Import/Export</b> &mdash; Direct XLSX import for WorldSmith 8.x workbooks, with multi-tab support.",
      "<b>System Visualiser</b> &mdash; Improved focus-follow and star rendering.",
      "<b>Star</b> &mdash; Solar flare and coronal mass ejection estimates based on star type and age.",
    ]),
    release("1.0.0", "", ["Initial release."]),
  ].join("");
}

function openChangelog() {
  if (document.querySelector(".changelog-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "changelog-backdrop";
  backdrop.innerHTML = `
    <div class="changelog-toast">
      <div class="changelog-toast__header">
        <h2 class="changelog-toast__title">Changelog</h2>
        <button class="changelog-toast__close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="changelog-toast__body">${changelogHTML()}</div>
    </div>`;

  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".changelog-toast__close").addEventListener("click", close);
  window.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") {
      close();
      window.removeEventListener("keydown", onKey);
    }
  });
}
