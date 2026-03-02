# WorldSmith Web — Todo

## Next

## Definitely

Ordered by impact-to-difficulty ratio (most worthwhile first):

3. **Atmospheric Escape** — Medium | High impact
   - [ ] Compute atmospheric escape and retention (Jeans escape).
   - Compare thermal velocity of each gas species to the body's escape velocity to determine which gases are retained over geological time. Applies to rocky planets, dwarf planets, and (eventually) moons. The atmosphere model in `engine/planet.js` already computes partial pressures and greenhouse effects but does not check whether a body can actually hold a given gas. Adding Jeans escape would flag unrealistic atmospheres (e.g. hydrogen on Mars-mass worlds) and is a prerequisite for meaningful dwarf-planet and moon atmospheres.

4. **Oort Clouds** — Medium | Medium impact
   - [ ] Implement Oort Clouds.
   - Self-contained feature with minimal coupling. Needs a new `engine/oortCloud.js` computing mass, inner/outer boundaries (galactic tidal truncation, Hill sphere), and comet flux rate. UI goes in the existing outer objects page. Oort cloud physics are observationally poorly constrained, so careful scoping needed.

5. **Moons with Atmospheres** — Medium-Large | High impact
   - [ ] Moons with Atmospheres.
   - The full atmosphere model (greenhouse, partial pressures, sky colour, circulation cells) exists in `engine/planet.js` but is tightly coupled. Work: refactor or duplicate the atmosphere block, add pressure/gas inputs to moon UI, compute greenhouse-corrected surface temp, and add atmospheric escape/retention (Jeans escape). High impact — Titan, Triton, and habitable moons are a core worldbuilding use case.

6. **Comets** — Large | Medium impact
   - [ ] Implement Comets.
   - Nothing exists. Needs a new engine module (highly elliptical orbits, sublimation rates, coma radius, dust/ion tail geometry as a function of heliocentric distance), a new UI page, and visualiser support for tail rendering. The volatile condensation table in `debrisDisk.js` is reusable for nucleus composition.

7. **Binary/Ternary/Quaternary Home Systems** — Very Large | High impact
   - [ ] Add support for binary, ternary, and quaternary home systems.
   - The single-star assumption is deeply embedded across every engine module (`star.js`, `planet.js`, `moon.js`, `system.js`, `apparent.js`) and the store. Neighbour systems already support multiplicity in the cluster engine, but the home system is hard-coded to single. Touches the store schema, insolation calculations, circumbinary vs circumstellar orbit logic, multi-sun sky rendering, and the visualiser centre. Highest impact for sci-fi worldbuilding, but the largest refactor by far.

## Maybe?

8. **Galaxy Viewer** — Large | Low-Medium impact
   - [ ] Galaxy viewer. Displays galaxy in overview (not rendering each star), with your local and orbit around the SMBH, and the GHZ.
   - Three.js infrastructure exists and the cluster mode already has a 3D perspective camera. But rendering a procedural spiral galaxy at galactic scale is a fundamentally different rendering task. No engine produces spiral arm geometry or SMBH orbital mechanics. Visually impressive but doesn't feed into any downstream calculations — purely a visualisation feature.

## Complete

- [x] Calculate moon surface temperature (equilibrium + tidal + radiogenic).
- [x] Calculate moon radioactivity from host planet (magnetospheric radiation + radiogenic heating + tidal-thermal feedback).
- [x] Add rotation and axial tilt in visualiser.
- [x] Debris disk composition influenced by stellar metallicity
- [x] Link gas giant atmospheric metallicity default to stellar [Fe/H]
- [x] Refresh canvas when turning on lagrange points.
- [x] Camera briefly jumps to star when selecting a planet to focus (fix it)
- [x] Fix artifacts on bottom of canvas.
- [x] Icy planets (Ganymede, for example)
- [x] Improve planet and moon colour logic in system visualiser
- [x] Implement calculated planet colour logic
- [x] Implement tidal heating with Wisdom (2008) eccentricity, composition overrides, and tidal recession.
- [x] Figure out relationship between debris disk and gas giants, allow multiple of both.
- [x] Unify inner planets and outer objects pages.
- [x] Add more detailed options for displaying certain elements on the system visualiser.
- [x] Point and zoom on system visualiser.
- [x] Zoom out far enough on system visualiser redraws the canvas as cluster visualiser.
- [x] Add a page icon.
- [x] Lock sidebar & header when scrolling a long way down page.
- [x] Maths page displaying all of the formulae and what we used them for.
- [x] Improve Ap/Pe symbols (5-sided arrows above the orbit?)
- [x] Hill Spheres on visualiser.
- [x] Overhaul ground composition for rocky planets.
- [x] Second pass on apparent size page
- [x] Ambitious idea for the Apparent Size page. A canvas with a view over the shoulder of a person, showing the day or night sky, comparing the apparent size of celestial objects to ones in the Sol system from earth
- [x] Lagrange Points in the visualiser.
- [x] Planet & satellite visualiser
- [x] Convert HTML5 Canvas 2D items to Three.js.
- [x] Utilise metallicity [Fe/H] in local cluster star generation
- [x] Overhaul and increase depth and complexity of Gas Giants.
- [x] Overhaul and increase complexity and usefulness of Debris Disks.
- [x] Add optional moon initial rotation period slider.
- [x] Add Radioactive Mass Fraction as an advanced override. Displayed as Radioisotope Abundance (relative to Earth).
- [x] Implement Tectonics tab, updating and improving systems from the WS8 spreadsheet.
- [x] Implement Climate tab, updating and improving systems from the WS8 spreadsheet.
- [x] Implement Population tab, updating and improving systems from the WS8 spreadsheet.
- [x] Local cluster limited to 25ly radius, 0.1per ly density, 750 stellar objects max.
- [x] Implement Dwarf Planets.
