const AU_M = 149597870000;
const AU_KM = 149597870;
const KG_PER_MSOL = 1.989e30;
const KG_PER_MEARTH = 5.972e24;
const KG_PER_MMOON = 7.342e22;

export function auToMeters(distanceAu) {
  return distanceAu * AU_M;
}

export function auToKilometers(distanceAu) {
  return distanceAu * AU_KM;
}

export function solarMassToKg(massSolar) {
  return massSolar * KG_PER_MSOL;
}

export function earthMassToKg(massEarth) {
  return massEarth * KG_PER_MEARTH;
}

export function moonMassToKg(massMoon) {
  return massMoon * KG_PER_MMOON;
}

export function calcOrbitalPeriodYearsKepler({ semiMajorAxisAu, centralMassMsol }) {
  return Math.sqrt(semiMajorAxisAu ** 3 / centralMassMsol);
}

export function orbitalPeriodYearsKepler(semiMajorAxisAu, centralMassMsol) {
  return calcOrbitalPeriodYearsKepler({ semiMajorAxisAu, centralMassMsol });
}

export function calcOrbitalPeriodDaysKepler({
  semiMajorAxisAu,
  centralMassMsol,
  daysPerYear = 365.25,
}) {
  return calcOrbitalPeriodYearsKepler({ semiMajorAxisAu, centralMassMsol }) * daysPerYear;
}

export function orbitalPeriodDaysKepler(semiMajorAxisAu, centralMassMsol, daysPerYear = 365.25) {
  return calcOrbitalPeriodDaysKepler({
    semiMajorAxisAu,
    centralMassMsol,
    daysPerYear,
  });
}

export function orbitalDirectionFromInclination(inclinationDeg) {
  if (inclinationDeg > 90) return "Retrograde";
  if (inclinationDeg < 90) return "Prograde";
  return "Undefined";
}

export function calcTwoBodyOrbitalPeriodSeconds({
  semiMajorAxisM,
  primaryMassKg,
  secondaryMassKg = 0,
  gravitationalConstant = 6.67e-11,
}) {
  return (
    2 *
    Math.PI *
    Math.sqrt(semiMajorAxisM ** 3 / (gravitationalConstant * (primaryMassKg + secondaryMassKg)))
  );
}

export function twoBodyOrbitalPeriodSeconds(
  semiMajorAxisM,
  primaryMassKg,
  secondaryMassKg = 0,
  gravitationalConstant = 6.67e-11,
) {
  return calcTwoBodyOrbitalPeriodSeconds({
    semiMajorAxisM,
    primaryMassKg,
    secondaryMassKg,
    gravitationalConstant,
  });
}
