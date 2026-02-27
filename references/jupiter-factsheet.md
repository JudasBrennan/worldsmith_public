# Jupiter Fact Sheet

Sources: JPL Solar System Dynamics, science.nasa.gov

## Bulk Parameters

| Parameter              | Value            | Unit          |
| ---------------------- | ---------------- | ------------- |
| Mass                   | 1,898.13 × 10²⁴  | kg            |
| GM                     | 1.26686534 × 10⁸ | km³/s²        |
| Equatorial radius      | 71,492           | km            |
| Polar radius           | 66,854           | km            |
| Volumetric mean radius | 69,911           | km            |
| Mean density           | 1,326            | kg/m³         |
| Surface gravity (eq.)  | 24.79            | m/s²          |
| Escape velocity        | 60.20            | km/s          |
| Bond albedo            | 0.343            | —             |
| Geometric albedo       | 0.52             | —             |
| Effective temperature  | 124.4            | K             |
| Love number k₂         | 0.565            | —             |
| Tidal Q                | ~10⁵–10⁶         | — (uncertain) |

## Orbital Parameters

| Parameter             | Value        | Unit    |
| --------------------- | ------------ | ------- |
| Semi-major axis       | 778.57 × 10⁶ | km      |
| Semi-major axis       | 5.2026       | AU      |
| Sidereal orbit period | 4,332.59     | days    |
| Orbital eccentricity  | 0.0489       | —       |
| Orbital inclination   | 1.304        | degrees |
| Mean orbital velocity | 13.07        | km/s    |

## Rotation

| Parameter                | Value  | Unit    |
| ------------------------ | ------ | ------- |
| Sidereal rotation period | 9.9250 | hours   |
| Obliquity to orbit       | 3.13   | degrees |

## Magnetosphere

| Parameter               | Value     | Unit      |
| ----------------------- | --------- | --------- |
| Dipole field strength   | 4.28      | gauss-Rⱼ³ |
| Magnetosphere (sunward) | 1–3 × 10⁶ | km        |
| Magnetosphere (tail)    | ~10⁹      | km        |

## Ring System

| Parameter          | Value    | Unit |
| ------------------ | -------- | ---- |
| Inner edge         | ~92,000  | km   |
| Outer edge         | ~225,000 | km   |
| Ring optical depth | ~10⁻⁶    | —    |

## Moons

| Parameter           | Value                              |
| ------------------- | ---------------------------------- |
| Known moons         | 95                                 |
| Galilean satellites | 4 (Io, Europa, Ganymede, Callisto) |

## Notes

- Jupiter's tidal Q is highly uncertain (10⁵–10⁶). WorldSmith uses Q = 10⁵
  for gas giant parent bodies (density < 2 g/cm³)
- Rotation period 9.925 hr is used in WorldSmith's recession calculation
  to determine sign(Ω_planet − n)
- k₂ = 0.565 observed; WorldSmith applies K2_DIFFERENTIATION = 0.37 correction
  to the homogeneous-body formula
