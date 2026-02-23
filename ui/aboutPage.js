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
          <b>WorldSmith Web 1.9.1</b> is a browser-based tool by <b>Judas Brennan</b> for generating
          <b>Sol-like planetary systems</b> and <b>Earth-like worlds</b> for tabletop roleplaying games.
        </p>

        <p>
          This project is based on <b>WorldSmith 8.0</b> by <b>Artifexian</b>. Artifexian created the underlying
          methods, calculations, and spreadsheet model that this web app is built from.
        </p>

        <p>
          The corrected temperature-dependent habitable-zone implementation is adapted from the Desmos model by
          <b>Chromant</b>.
        </p>

        <div class="page-title" style="margin-top:18px">Credits</div>
        <ul>
          <li>Artifexian YouTube: <a href="https://www.youtube.com/c/Artifexian" target="_blank" rel="noopener noreferrer">https://www.youtube.com/c/Artifexian</a></li>
          <li>WorldSmith 8.0 spreadsheet: <a href="https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy" target="_blank" rel="noopener noreferrer">https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy</a></li>
          <li>Chromant Desmos model (Star System Visualizer 1.1.0): <a href="https://www.desmos.com/calculator/gcgvefvuc7" target="_blank" rel="noopener noreferrer">https://www.desmos.com/calculator/gcgvefvuc7</a></li>
        </ul>

        <div class="page-title" style="margin-top:18px">Community</div>
        <ul>
          <li>Artifexian Discord: <a href="https://discord.com/invite/hPvqDBPkhg" target="_blank" rel="noopener noreferrer">https://discord.com/invite/hPvqDBPkhg</a></li>
          <li>Judas Brennan Discord: <a href="https://discord.gg/f63SfkW7vh" target="_blank" rel="noopener noreferrer">https://discord.gg/f63SfkW7vh</a></li>
        </ul>

        <div class="page-title" style="margin-top:18px">How to use it</div>
        <ol>
          <li><b>Star</b>: choose a star mass (and any other inputs) to generate star properties.</li>
          <li><b>Planetary System</b>: set spacing and orbit framework for the system.</li>
          <li><b>Planets</b>: create and edit rocky planets and gas giants, then assign them to system slots.</li>
          <li><b>Other Objects</b>: configure debris disks and other non-planetary components.</li>
          <li><b>Moons</b>: create moons and assign them to parent planets.</li>
          <li><b>Apparent Size</b>: compare apparent magnitude, angular size, and visibility for star/object/moon setups.</li>
          <li><b>Calendar</b>: build a world-linked calendar from orbital periods, then define holidays, festivals, leap rules, and work/rest cycles.</li>
          <li><b>Visualiser</b>: pan (drag) and zoom (mouse wheel) to inspect the system. Zoom out past the outermost object to seamlessly transition into the 3D local cluster view.</li>
          <li><b>Local Cluster</b>: generate nearby systems around your home star, manually add or remove stars and companions, and edit local system names.</li>
          <li><b>Science &amp; Maths</b>: reference page documenting every equation used across the engine, with LaTeX rendering and interactive calculators.</li>
        </ol>

        <div class="page-title" style="margin-top:18px">Tips</div>
        <ul>
          <li>If something looks wrong, use <b>Refresh</b> on the visualiser to redraw from latest data.</li>
          <li>Most inputs support both a <b>slider</b> and a <b>text box</b> for precision.</li>
          <li>Your work is stored locally in your browser (LocalStorage). Clearing site data will reset the tool.</li>
        </ul>

        <div class="page-title" style="margin-top:18px">Changelog</div>
        <p class="hint"><i>Note: version 1.5.0 was a duplicate release of 1.4.0 and has been removed. Numbering continues from 1.4.0.</i></p>

        <p><b>Version 1.9.1</b> (from 1.9.0)</p>
        <ul>
          <li><b>Cluster Import</b> &mdash; Paste a tab-separated table of star systems into the Local Cluster page to replace the generated neighbourhood with custom coordinates, names, and spectral types.</li>
        </ul>

        <p><b>Version 1.9.0</b> (from 1.8.1)</p>
        <ul>
          <li><b>Tidal Heating</b> &mdash; Full tidal dissipation model using the Wisdom (2008) eccentricity function, replacing the simple e&sup2; truncation. Outputs total power, surface heat flux, and Earth-normalised flux.</li>
          <li><b>Composition Override</b> &mdash; Seven-class interior model with two calibrated overrides: &ldquo;Partially molten&rdquo; (Io, within 1%) and &ldquo;Subsurface ocean&rdquo; (Enceladus, within 10%). Override dropdown on the Moon page.</li>
          <li><b>Tidal Recession</b> &mdash; Orbital migration rate (cm/yr) and fate (time to Roche limit or Hill sphere escape) from competing planet and moon tidal torques.</li>
        </ul>

        <p><b>Version 1.8.1</b> (from 1.8.0)</p>
        <ul>
          <li><b>Atmosphere &amp; Greenhouse</b> &mdash; Overhauled rocky planet atmospheric system with improved greenhouse gas calculations. The greenhouse effect can now be derived from atmospheric composition (Core or Full mode) or set manually via user override.</li>
          <li><b>Sol Preset</b> &mdash; Cross-referenced and corrected all Sol preset values against the NASA Planetary Fact Sheet (rotation periods, eccentricities, atmospheric compositions, orbital elements, and radii).</li>
          <li><b>Local Cluster</b> &mdash; Added the ability to manually add or remove specific star types via +/&minus; buttons, and to add or remove companion stars via right-click context menu (single &rarr; binary &rarr; triple &rarr; quadruple). Includes a random seed generator button and a confirmation prompt when discarding manual changes.</li>
        </ul>

        <p><b>Version 1.8.0</b> (from 1.7.0)</p>
        <ul>
          <li><b>Sky Colours</b> — Now account for atmospheric column density (gravity + temperature scale height) and CO&sub2; tint, with OKLab colour interpolation.</li>
          <li><b>Vegetation Colours</b> — Pressure-dependent plant colours from 0.1&ndash;100 atm, with dedicated twilight variants for tidally locked K/M worlds.</li>
          <li><b>Science &amp; Maths</b> — New reference page documenting all 61 equations, with LaTeX rendering, variable legends, and interactive calculators.</li>
          <li><b>Temperature Accuracy</b> — Surface divisor now ramps with optical depth (no inflation for airless bodies). Sol preset recalibrated to NASA Planetary Fact Sheet values.</li>
          <li><b>UI</b> — Expandable KPI cards with hover-to-reveal detail, contrast-aware text on colour swatches, expanded tooltips and JSDoc across all engine files.</li>
        </ul>

        <p><b>Version 1.7.0</b> (from 1.6.0)</p>
        <ul>
          <li><b>Unified Visualiser</b> — System and Local Cluster visualisers merged into one page with seamless zoom-based transitions.</li>
          <li><b>Star</b> — New stellar metallicity [Fe/H] input driving giant planet probability (Fischer &amp; Valenti 2005) and stellar population labels.</li>
          <li><b>Star</b> — Scientific accuracy overhaul: Eker et al. (2018) six-piece mass&ndash;luminosity and quadratic mass&ndash;radius relations replace the old textbook approximations.</li>
        </ul>

        <p><b>Version 1.6.0</b> (from 1.5.0)</p>
        <ul>
          <li><b>Planets / Other Objects</b> — Ground up rework of gas giant and debris disk mechanics.</li>
          <li><b>System Visualiser</b> — More accurate and detailed styles for gas giants, covering many real and fantastical types.</li>
        </ul>

        <p><b>Version 1.5.0</b> (from 1.4.0)</p>
        <ul>
          <li><b>Star</b> — Advanced Physics mode: choose which two of Radius/Luminosity/Temperature to set; the third is derived via Stefan-Boltzmann.</li>
          <li><b>System Visualiser</b> — Eccentric Orbits toggle: orbits render as tilted, inclined ellipses with Kepler-solved motion and Pe/Ap markers.</li>
          <li><b>System Visualiser</b> — Moon orbit parity: moons now share the same orbital mechanics as planets (eccentricity, inclination, Kepler solve).</li>
          <li><b>System Visualiser</b> — Replaced distance and size scale checkboxes with pill-toggle controls.</li>
          <li><b>Local Cluster</b> — Fixed stellar population fractions to sum to 100% (was 140% in WS8).</li>
          <li><b>Local Cluster</b> — Class-weighted multiplicity from Duch&ecirc;ne &amp; Kraus (2013) for binary/triple/quadruple generation.</li>
          <li><b>Local Cluster</b> — Companions filtered so none is heavier than the primary.</li>
          <li><b>Local Cluster</b> — Added Galactic Habitable Zone probability (Lineweaver 2004 Gaussian model).</li>
          <li><b>Local Cluster</b> — Disk geometry flattening for large neighbourhood radii.</li>
          <li><b>Import/Export</b> — New fantasy system preset included.</li>
        </ul>

        <p><b>Version 1.4.0</b> (from 1.3.1)</p>
        <ul>
          <li><b>Apparent Size</b> — New page for star/object/moon apparent magnitude, brightness, and size calculations.</li>
          <li><b>Calendar</b> — New page for solar, lunar, and lunisolar calendar derivations from orbital and rotation periods.</li>
          <li><b>Navigation</b> — Added sidebar links for the new Apparent Size and Calendar tools.</li>
        </ul>

        <p><b>Version 1.3.1</b> (from 1.3.0)</p>
        <ul>
          <li><b>System Visualiser</b> — Fixed depth layering so planets and gas giants correctly render behind or in front of the star.</li>
        </ul>

        <p><b>Version 1.3.0</b> (from 1.2.0)</p>
        <ul>
          <li><b>System Visualiser</b> — Improved scale controls and full 3D camera navigation.</li>
          <li><b>System Visualiser</b> — Export tools for static PNG snapshots and animated GIF captures.</li>
          <li><b>Planet</b> — Moon orbit guardrails to keep semi-major-axis values within valid moon-zone bounds.</li>
          <li><b>Planet</b> — Refined sky-colour presentation, especially the &ldquo;sun near horizon&rdquo; output.</li>
          <li><b>Local Cluster</b> — Improved interaction and range/bearing grid support.</li>
          <li><b>Local Cluster</b> — Support for renaming star systems and showing names in the cluster visualiser.</li>
          <li><b>Import/Export</b> — Built-in Sol preset import.</li>
          <li><b>UI</b> — Unified wording and visual styling across major pages.</li>
        </ul>

        <p><b>Version 1.2.0</b> (from 1.1.0)</p>
        <ul>
          <li><b>System</b> — Updated habitable-zone maths to use the corrected temperature-dependent model (Chromant&rsquo;s Desmos implementation).</li>
          <li><b>System Visualiser</b> — Habitable-zone overlay: green HZ band between inner and outer limits, with a show/hide toggle.</li>
        </ul>

        <p><b>Version 1.1.0</b> (from 1.0.0)</p>
        <ul>
          <li><b>Import/Export</b> — Direct XLSX spreadsheet import for WorldSmith 8.x workbooks.</li>
          <li><b>Import/Export</b> — Import detects Star/System/Planet/Moon tabs by structure; tab order changes are supported.</li>
          <li><b>Import/Export</b> — Multiple Planet or Moon tabs are imported as Planet 1..N and Moon 1..N.</li>
          <li><b>System Visualiser</b> — Improved focus-follow with gas giant support and zoom while following.</li>
          <li><b>System Visualiser</b> — Improved star rendering effects.</li>
          <li><b>Star</b> — Computed expected solar flares and coronal mass ejections based on star type and age.</li>
        </ul>

        <p class="hint" style="margin-top:14px">
          This is a static web app (HTML/CSS/JS) and can be hosted anywhere that serves static files.
        </p>
      </div>
    </div>
  `;
  mountEl.innerHTML = "";
  mountEl.appendChild(el);
}
