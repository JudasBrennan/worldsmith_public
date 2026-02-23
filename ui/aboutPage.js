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
          <b>WorldSmith Web 1.11.0</b> is a browser-based tool by <b>Judas Brennan</b> for generating
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

        <p><b>Version 1.11.0</b> (from 1.10.0)</p>
        <ul>
          <li><b>Apparent Size &amp; Brightness</b> &mdash; Bug fixes (angular-diameter swap, Roche limit divisor, moon absolute magnitude formula), multi-moon support, Bond-to-geometric albedo conversion, and NASA-validated Sol reference data.</li>
          <li><b>Sky Canvas</b> &mdash; Angular size comparison chart rendering star, moons, and planets as disks at true relative angular sizes with Sol reference outlines, phase crescents, brightness-scaled glow, and a day/night sky toggle using the planet engine&rsquo;s computed sky colours.</li>
          <li><b>Sol System Preset</b> &mdash; Corrected orbital, physical, and photometric data for 19 bodies against NASA Planetary Fact Sheets.</li>
        </ul>

        <p><b>Version 1.10.0</b> (from 1.9.1)</p>
        <ul>
          <li><b>Rocky Planet Composition</b> &mdash; Seven composition classes (Ice world through Coreless) and six water regimes derived from core mass fraction and water mass fraction. Includes core radius, mass&ndash;radius scaling, and composition-dependent tidal parameters.</li>
          <li><b>Rocky Planet Atmosphere</b> &mdash; Ten-gas atmosphere with three greenhouse modes (Manual, Core, Full). Sky and vegetation colours vary by star type and pressure. Adds circulation cells, atmospheric tide resistance, and liquid water checks.</li>
          <li><b>Magnetic Field</b> &mdash; Dynamo model with dipolar and multipolar regimes, driven by core fraction, mass, age, and rotation.</li>
          <li><b>Tectonic Regimes</b> &mdash; Probability distribution across four regimes (stagnant lid, mobile lid, episodic, plutonic-squishy) based on mass, age, water, composition, and tidal heating.</li>
          <li><b>Science Divergences</b> &mdash; New section on the Science &amp; Maths page listing 22 places where WorldSmith departs from published formulas, with explanations.</li>
        </ul>

        <p><b>Version 1.9.1</b> (from 1.9.0)</p>
        <ul>
          <li><b>Cluster Import</b> &mdash; Paste a tab-separated table of star systems to replace the generated neighbourhood with custom data.</li>
        </ul>

        <p><b>Version 1.9.0</b> (from 1.8.1)</p>
        <ul>
          <li><b>Tidal Heating</b> &mdash; Moon tidal dissipation model with accurate high-eccentricity heating. Outputs total power, surface flux, and Earth-normalised flux.</li>
          <li><b>Composition Override</b> &mdash; Seven interior classes for moons, with calibrated overrides for partially molten and subsurface ocean bodies.</li>
          <li><b>Tidal Recession</b> &mdash; Orbital migration rate and fate prediction from competing planet and moon tidal torques.</li>
        </ul>

        <p><b>Version 1.8.1</b> (from 1.8.0)</p>
        <ul>
          <li><b>Greenhouse Modes</b> &mdash; Greenhouse effect can now be derived from atmospheric composition (Core or Full mode) or set manually.</li>
          <li><b>Sol Preset</b> &mdash; All preset values cross-referenced against the NASA Planetary Fact Sheet.</li>
          <li><b>Local Cluster</b> &mdash; Add or remove star types with +/&minus; buttons and manage companions via right-click context menu.</li>
        </ul>

        <p><b>Version 1.8.0</b> (from 1.7.0)</p>
        <ul>
          <li><b>Sky Colours</b> &mdash; Account for atmospheric column density and CO&sub2; tint.</li>
          <li><b>Vegetation Colours</b> &mdash; Pressure-dependent plant colours with twilight variants for tidally locked worlds.</li>
          <li><b>Science &amp; Maths</b> &mdash; New reference page documenting all equations with LaTeX rendering and interactive calculators.</li>
          <li><b>Temperature</b> &mdash; Improved surface temperature accuracy for airless and thin-atmosphere bodies.</li>
          <li><b>UI</b> &mdash; Expandable KPI cards with hover-to-reveal detail and contrast-aware text on colour swatches.</li>
        </ul>

        <p><b>Version 1.7.0</b> (from 1.6.0)</p>
        <ul>
          <li><b>Unified Visualiser</b> &mdash; System and Local Cluster views merged into one page with seamless zoom transitions.</li>
          <li><b>Star</b> &mdash; Stellar metallicity [Fe/H] input driving giant planet probability and population labels.</li>
          <li><b>Star</b> &mdash; Improved mass&ndash;luminosity and mass&ndash;radius relations replacing the old textbook approximations.</li>
        </ul>

        <p><b>Version 1.6.0</b> (from 1.5.0)</p>
        <ul>
          <li><b>Planets / Other Objects</b> &mdash; Reworked gas giant and debris disk mechanics.</li>
          <li><b>System Visualiser</b> &mdash; Improved gas giant rendering covering many real and fantastical types.</li>
        </ul>

        <p><b>Version 1.5.0</b> (from 1.4.0)</p>
        <ul>
          <li><b>Star</b> &mdash; Advanced Physics mode: choose which two of Radius/Luminosity/Temperature to set.</li>
          <li><b>System Visualiser</b> &mdash; Eccentric orbits rendered as tilted, inclined ellipses with Kepler-solved motion.</li>
          <li><b>System Visualiser</b> &mdash; Moons now share the same orbital mechanics as planets.</li>
          <li><b>Local Cluster</b> &mdash; Fixed stellar population fractions, class-weighted multiplicity, companion mass filtering, habitable-zone probability, and disk geometry.</li>
          <li><b>Import/Export</b> &mdash; Fantasy system preset included.</li>
        </ul>

        <p><b>Version 1.4.0</b> (from 1.3.1)</p>
        <ul>
          <li><b>Apparent Size</b> &mdash; New page for apparent magnitude, brightness, and angular size calculations.</li>
          <li><b>Calendar</b> &mdash; New page for solar, lunar, and lunisolar calendar derivations.</li>
        </ul>

        <p><b>Version 1.3.1</b> (from 1.3.0)</p>
        <ul>
          <li><b>System Visualiser</b> &mdash; Fixed depth layering for planets and gas giants around the star.</li>
        </ul>

        <p><b>Version 1.3.0</b> (from 1.2.0)</p>
        <ul>
          <li><b>System Visualiser</b> &mdash; Full 3D camera navigation with PNG and GIF export.</li>
          <li><b>Planet</b> &mdash; Moon orbit guardrails and improved sky-colour presentation.</li>
          <li><b>Local Cluster</b> &mdash; Range/bearing grid and renameable star systems.</li>
          <li><b>Import/Export</b> &mdash; Built-in Sol preset import.</li>
        </ul>

        <p><b>Version 1.2.0</b> (from 1.1.0)</p>
        <ul>
          <li><b>System</b> &mdash; Temperature-dependent habitable-zone model.</li>
          <li><b>System Visualiser</b> &mdash; Habitable-zone overlay with show/hide toggle.</li>
        </ul>

        <p><b>Version 1.1.0</b> (from 1.0.0)</p>
        <ul>
          <li><b>Import/Export</b> &mdash; Direct XLSX import for WorldSmith 8.x workbooks, with multi-tab support.</li>
          <li><b>System Visualiser</b> &mdash; Improved focus-follow and star rendering.</li>
          <li><b>Star</b> &mdash; Solar flare and coronal mass ejection estimates based on star type and age.</li>
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
