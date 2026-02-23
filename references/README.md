# NASA Reference Data

Compiled from official NASA sources for use as WorldSmith calibration and validation references.

## Sources

The original NASA/GSFC NSSDC Planetary Fact Sheets (nssdc.gsfc.nasa.gov) are currently offline (307 redirect as of Feb 2026). Data in these files was compiled from:

- **JPL Solar System Dynamics** — ssd.jpl.nasa.gov/planets/phys_par.html (planetary physical parameters)
- **JPL Satellite Physical Parameters** — ssd.jpl.nasa.gov/sats/phys_par/ (GM, radius, density)
- **JPL Satellite Orbital Elements** — ssd.jpl.nasa.gov/sats/elem/ (a, e, i, P)
- **NASA Science** — science.nasa.gov (individual body fact pages)
- **Colorado NSSDC Mirror** — atoc.colorado.edu (Earth fact sheet with full NSSDC data)
- **IAU 2015 Resolution B3** — nominal solar values (L☉, R☉, Teff☉)

## File Index

### Star

| File                                 | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| [sun-factsheet.md](sun-factsheet.md) | Solar mass, luminosity, temperature, composition |

### Planets

| File                                         | Description                                          |
| -------------------------------------------- | ---------------------------------------------------- |
| [planets-summary.md](planets-summary.md)     | All 8 planets — physical & orbital parameters table  |
| [mercury-factsheet.md](mercury-factsheet.md) | Mercury — 3:2 resonance, highest density             |
| [venus-factsheet.md](venus-factsheet.md)     | Venus — retrograde rotation, extreme greenhouse      |
| [earth-factsheet.md](earth-factsheet.md)     | Earth — full NSSDC data, atmosphere, geothermal flux |
| [mars-factsheet.md](mars-factsheet.md)       | Mars — Phobos/Deimos data, atmosphere                |
| [jupiter-factsheet.md](jupiter-factsheet.md) | Jupiter — gas giant reference, k₂, Q, magnetosphere  |
| [saturn-factsheet.md](saturn-factsheet.md)   | Saturn — ring system, tidal Q, 146 moons             |
| [uranus-factsheet.md](uranus-factsheet.md)   | Uranus — extreme tilt, ice giant                     |
| [neptune-factsheet.md](neptune-factsheet.md) | Neptune — ice giant, Triton capture                  |

### Moons

| File                                               | Description                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| [moon-factsheet.md](moon-factsheet.md)             | Earth's Moon — recession rate 3.83 cm/yr calibration |
| [jovian-satellites.md](jovian-satellites.md)       | Io, Europa, Ganymede, Callisto — tidal heating data  |
| [saturnian-satellites.md](saturnian-satellites.md) | Enceladus, Titan + summary table (Mimas→Iapetus)     |
| [triton-factsheet.md](triton-factsheet.md)         | Triton — retrograde captured KBO                     |

## WorldSmith Relevance

These factsheets are referenced by:

- `engine/star.js` — solar luminosity, temperature, mass calibration
- `engine/planet.js` — planetary mass/radius/density relationships
- `engine/moon.js` — tidal heating validation (Io, Enceladus calibration), recession (Moon)
- `engine/apparent.js` — magnitude calculations, albedo values
- `scripts/tidal-heating-validation.mjs` — NASA comparison targets
