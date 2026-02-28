# Saturnian Satellite Fact Sheets

Sources: JPL Solar System Dynamics (ssd.jpl.nasa.gov), science.nasa.gov

## Summary Table

| Satellite | GM (km³/s²) | Mean Radius (km) | Density (g/cm³) | Semi-major (km) | Eccentricity | Inc. (°) | Period (days) |
| --------- | ----------: | ---------------: | --------------: | --------------: | -----------: | -------: | ------------: |
| Mimas     |       2.503 |           198.20 |           1.149 |         185,540 |        0.020 |     1.57 |         0.942 |
| Enceladus |       7.210 |           252.10 |           1.610 |         238,400 |        0.005 |     0.00 |         1.370 |
| Tethys    |      41.209 |           531.00 |           0.984 |         294,670 |        0.000 |     1.09 |         1.888 |
| Dione     |      73.113 |           561.40 |           1.476 |         377,420 |        0.002 |     0.03 |         2.737 |
| Rhea      |     153.944 |           763.50 |           1.233 |         527,070 |        0.001 |     0.33 |         4.518 |
| Titan     |   8,978.137 |         2,574.76 |           1.881 |       1,221,870 |        0.029 |     0.31 |        15.945 |
| Iapetus   |     120.512 |           735.60 |           1.083 |       3,560,840 |        0.029 |     7.49 |        79.322 |

---

## Enceladus

### Physical Properties

| Parameter           | Value        | Unit        |
| ------------------- | ------------ | ----------- |
| Mass                | 1.080 × 10²⁰ | kg          |
| GM                  | 7.210        | km³/s²      |
| Mean radius         | 252.1        | km          |
| Mean density        | 1,610        | kg/m³       |
| Surface gravity     | 0.113        | m/s²        |
| Escape velocity     | 0.239        | km/s        |
| Geometric albedo    | 1.375        | — (>1!)     |
| Surface temperature | 72           | K (−201 °C) |

### Orbital Parameters

| Parameter               | Value   | Unit    |
| ----------------------- | ------- | ------- |
| Semi-major axis         | 238,400 | km      |
| Eccentricity            | 0.0047  | —       |
| Inclination             | 0.009   | degrees |
| Sidereal orbital period | 1.3702  | days    |
| Orbital period          | 32.9    | hours   |
| Tidally locked          | Yes     | —       |

### Internal Structure

| Parameter               | Value        | Unit |
| ----------------------- | ------------ | ---- |
| Ice shell (south pole)  | 1–5          | km   |
| Ice shell (global avg.) | 20–25        | km   |
| Subsurface ocean        | Yes (global) | —    |

### Tidal Heating

| Parameter              | Value            | Notes                  |
| ---------------------- | ---------------- | ---------------------- |
| Observed tidal heating | ~1.6 × 10¹⁰      | W (total, from plumes) |
| Plume ejection speed   | ~400             | m/s                    |
| Resonance              | 2:1 with Dione   | —                      |
| WorldSmith class       | Subsurface ocean | μ=0.3 GPa, Q=2         |

### Notes

- Brightest object in the solar system (albedo > 1 due to fresh ice)
- Tiger stripe fractures at south pole emit water vapour and ice particles
- Hydrothermal activity confirmed (silica nanoparticles, H₂)
- WorldSmith's "Subsurface ocean" override (calibrated to Enceladus) gives
  tidal heating ~1.1× observed value

---

## Titan

### Physical Properties

| Parameter        | Value         | Unit   |
| ---------------- | ------------- | ------ |
| Mass             | 1.3452 × 10²³ | kg     |
| GM               | 8,978.137     | km³/s² |
| Mean radius      | 2,574.76      | km     |
| Mean density     | 1,881         | kg/m³  |
| Surface gravity  | 1.35          | m/s²   |
| Escape velocity  | 2.64          | km/s   |
| Geometric albedo | 0.21          | —      |

### Orbital Parameters

| Parameter               | Value     | Unit    |
| ----------------------- | --------- | ------- |
| Semi-major axis         | 1,221,870 | km      |
| Eccentricity            | 0.0288    | —       |
| Inclination             | 0.306     | degrees |
| Sidereal orbital period | 15.9454   | days    |
| Tidally locked          | Yes       | —       |

### Atmosphere

| Parameter           | Value  | Unit            |
| ------------------- | ------ | --------------- |
| Surface pressure    | ~1,470 | mbar (1.45 atm) |
| Atmosphere height   | ~600   | km              |
| Composition (N₂)    | ~95%   | by volume       |
| Composition (CH₄)   | ~5%    | by volume       |
| Surface temperature | 94     | K (−179 °C)     |

### Internal Structure

| Parameter              | Value           | Unit               |
| ---------------------- | --------------- | ------------------ |
| Subsurface ocean depth | 55–80           | km (below surface) |
| Ocean composition      | Water + ammonia | —                  |

### Surface Features

| Feature                   | Value    | Notes             |
| ------------------------- | -------- | ----------------- |
| Methane lakes/seas        | Hundreds | Mostly north pole |
| Largest sea (Kraken Mare) | ~400,000 | km²               |

### Notes

- Only moon with a substantial atmosphere
- Only body besides Earth with stable surface liquids
- Second-largest moon in the solar system (after Ganymede)
- Density (1.88 g/cm³) → WorldSmith "Icy" class by default
- "Subsurface ocean" override massively over-predicts heating (37×) —
  use "Icy" for Titan-like moons
- Dragonfly rotorcraft mission launching 2028
