import { calcSystem } from "../../engine/system.js";
import { calcStar, starColourHexFromTempK } from "../../engine/star.js";
import { calcPlanetExact } from "../../engine/planet.js";
import { calcMoonExact } from "../../engine/moon.js";
import { calcGasGiant } from "../../engine/gasGiant.js";
import { computeStellarActivityModel } from "../../engine/stellarActivity.js";
import { clamp } from "../../engine/utils.js";
import {
  GAS_GIANT_RADIUS_MAX_RJ,
  GAS_GIANT_RADIUS_MIN_RJ,
  getStarOverrides,
  listMoons,
  listPlanets,
  listSystemDebrisDisks,
  listSystemGasGiants,
} from "../store.js";
import { computeRockyVisualProfile } from "../rockyPlanetStyles.js";
import {
  MOON_RADIUS_KM,
  SOL_RADIUS_KM,
  representativeGasBaseRadiusPx,
  representativePlanetBaseRadiusPx,
} from "./scaleMath.js";
import { buildOffscaleZoneInfo } from "./projectionMath.js";

export function buildVisualizerSnapshot(world, options = {}) {
  const { debug = {}, hashUnit = () => 0 } = options;
  const { enabled = false, log = () => {}, logThrottled = () => {} } = debug;
  const starName = String(world.star?.name || "").trim() || "Star";
  const starMassRaw =
    Number.isFinite(Number(world.star?.massMsol)) && Number(world.star?.massMsol) > 0
      ? Number(world.star.massMsol)
      : Number(world.system?.starMassMsol);
  const starMassMsol = Number.isFinite(starMassRaw) && starMassRaw > 0 ? starMassRaw : 0.8653;
  const starAgeRaw = Number(world.star?.ageGyr);
  const starAgeGyr = Number.isFinite(starAgeRaw) && starAgeRaw >= 0 ? starAgeRaw : 6.254;
  const starMetallicityRaw = Number(world.star?.metallicityFeH);
  const starMetallicityFeH = Number.isFinite(starMetallicityRaw) ? starMetallicityRaw : 0;
  const starOverrides = getStarOverrides(world.star);
  const starSeedRaw = world.star?.activitySeed ?? world.star?.seed ?? null;
  const starPhysicsMode = world.star?.physicsMode ?? "simple";
  const starDerivMode = world.star?.advancedDerivationMode ?? "rl";
  let starRadiusOv = null;
  let starLumOv = null;
  let starTempOv = null;
  if (starPhysicsMode === "advanced") {
    const radiusOverride =
      Number.isFinite(Number(world.star?.radiusRsolOverride)) &&
      Number(world.star?.radiusRsolOverride) > 0
        ? Number(world.star.radiusRsolOverride)
        : null;
    const luminosityOverride =
      Number.isFinite(Number(world.star?.luminosityLsolOverride)) &&
      Number(world.star?.luminosityLsolOverride) > 0
        ? Number(world.star.luminosityLsolOverride)
        : null;
    const tempOverride =
      Number.isFinite(Number(world.star?.tempKOverride)) && Number(world.star?.tempKOverride) > 0
        ? Number(world.star.tempKOverride)
        : null;
    if (starDerivMode === "rt") {
      starRadiusOv = radiusOverride;
      starTempOv = tempOverride;
    } else if (starDerivMode === "lt") {
      starLumOv = luminosityOverride;
      starTempOv = tempOverride;
    } else {
      starRadiusOv = radiusOverride;
      starLumOv = luminosityOverride;
    }
  }

  const starCalc = calcStar({
    massMsol: starMassMsol,
    ageGyr: starAgeGyr,
    radiusRsolOverride: starRadiusOv,
    luminosityLsolOverride: starLumOv,
    tempKOverride: starTempOv,
    metallicityFeH: starMetallicityFeH,
    evolutionMode: starOverrides?.ev || world.star?.evolutionMode || "zams",
  });
  const starTempK = Number(starCalc?.tempK);
  const starLuminosityLsun = Number(starCalc?.luminosityLsol);
  const starRadiusRsol = Math.max(0.01, Number(starCalc?.radiusRsol) || 1);
  const starRadiusKmRaw = Number(starCalc?.metric?.radiusKm);
  const starRadiusKm =
    Number.isFinite(starRadiusKmRaw) && starRadiusKmRaw > 0
      ? starRadiusKmRaw
      : starRadiusRsol * SOL_RADIUS_KM;
  const starColourHex = String(starCalc?.starColourHex || starColourHexFromTempK(starTempK));
  const activityModelVersion = world.star?.activityModelVersion === "v1" ? "v1" : "v2";
  const activityModel = computeStellarActivityModel(
    {
      teffK: starTempK,
      ageGyr: starAgeGyr,
      massMsun: starMassMsol,
      luminosityLsun: starLuminosityLsun,
    },
    { activityCycle: 0.5 },
  );
  const flareParams = activityModel.activity;
  const n32 = Math.max(0, Number(flareParams?.N32) || 0);
  const starActivityLevel = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);

  const system = calcSystem({
    starMassMsol,
    spacingFactor: Number(world.system?.spacingFactor),
    orbit1Au: Number(world.system?.orbit1Au),
    luminosityLsolOverride: starLuminosityLsun,
    radiusRsolOverride: starRadiusRsol,
  });
  logThrottled(enabled, "flare:snapshot:model", 1000, "flare:snapshot:model", {
    activityModelVersion,
    starMassMsol,
    starAgeGyr,
    starTempK,
    starLuminosityLsun,
    starMetallicityFeH,
    starEvolutionMode: starOverrides?.ev || world.star?.evolutionMode || "zams",
    teffBin: flareParams?.teffBin,
    ageBand: flareParams?.ageBand,
    N32: Number(flareParams?.N32) || 0,
    energeticFlareRatePerDay: Number(flareParams?.energeticFlareRatePerDay) || 0,
    cmeAssociatedRatePerDay: Number(flareParams?.cmeAssociatedRatePerDay) || 0,
    cmeBackgroundRatePerDay: Number(flareParams?.cmeBackgroundRatePerDay) || 0,
    cmeTotalRatePerDay: Number(flareParams?.cmeTotalRatePerDay) || 0,
  });
  log(enabled, "system inputs", world.system);
  log(enabled, "calcSystem (inputs echoed)", system.inputs);
  log(enabled, "calcSystem.orbitsAu[0..5]", (system.orbitsAu || []).slice(0, 6));

  const planets = listPlanets(world);
  const moons = listMoons(world);
  const orbitAuBySlot = system.orbitsAu || [];
  const planetNodes = planets
    .filter((planet) => planet.slotIndex != null || Number(planet.inputs?.semiMajorAxisAu) > 0)
    .map((planet) => {
      const slot = Number(planet.slotIndex);
      const slotAuRaw = orbitAuBySlot[slot - 1];
      const slotAu = Number(slotAuRaw);
      const inputAu = Number(planet.inputs?.semiMajorAxisAu);
      const au =
        Number.isFinite(slotAu) && slotAu > 0
          ? slotAu
          : Number.isFinite(inputAu) && inputAu > 0
            ? inputAu
            : 1;
      let periodDays = null;
      let radiusEarth = null;
      let skyHighHex = null;
      let skyHorizonHex = null;
      let visualProfile = null;
      const planetInputs = { ...planet.inputs, semiMajorAxisAu: au };
      try {
        const planetCalc = calcPlanetExact({
          starMassMsol,
          starAgeGyr,
          starRadiusRsolOverride: starOverrides.r,
          starLuminosityLsolOverride: starOverrides.l,
          starTempKOverride: starOverrides.t,
          starEvolutionMode: starOverrides.ev,
          planet: planetInputs,
        });
        periodDays = Number(planetCalc?.derived?.orbitalPeriodEarthDays);
        if (!Number.isFinite(periodDays) || periodDays <= 0) periodDays = null;
        radiusEarth = Number(planetCalc?.derived?.radiusEarth);
        if (!Number.isFinite(radiusEarth) || radiusEarth <= 0) radiusEarth = null;
        skyHighHex = String(planetCalc?.derived?.skyColourDayHex ?? "").trim();
        skyHorizonHex = String(planetCalc?.derived?.skyColourHorizonHex ?? "").trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(skyHighHex)) skyHighHex = null;
        if (!/^#?[0-9a-fA-F]{6}$/.test(skyHorizonHex)) skyHorizonHex = null;
        if (skyHighHex && !skyHighHex.startsWith("#")) skyHighHex = `#${skyHighHex}`;
        if (skyHorizonHex && !skyHorizonHex.startsWith("#")) skyHorizonHex = `#${skyHorizonHex}`;
        if (planetCalc?.derived) {
          visualProfile = computeRockyVisualProfile(planetCalc.derived, planet.inputs);
        }
      } catch {
        periodDays = null;
        radiusEarth = null;
        skyHighHex = null;
        skyHorizonHex = null;
        visualProfile = null;
      }

      return {
        id: planet.id,
        name: planet.name || planet.inputs?.name || planet.id,
        slot,
        au,
        periodDays,
        radiusEarth,
        massEarth: Number(planet.inputs?.massEarth) || null,
        rotationPeriodHours: Number(planet.inputs?.rotationPeriodHours) || null,
        axialTiltDeg: clamp(Number(planet.inputs?.axialTiltDeg ?? 0), 0, 180),
        skyHighHex,
        skyHorizonHex,
        visualProfile,
        eccentricity: clamp(Number(planet.inputs?.eccentricity ?? 0), 0, 0.99),
        longitudeOfPeriapsisDeg: Number(planet.inputs?.longitudeOfPeriapsisDeg ?? 0),
        inclinationDeg: clamp(Number(planet.inputs?.inclinationDeg ?? 0), 0, 180),
        locked: !!planet.locked,
        moons: buildMoonNodes({
          moons,
          starMassMsol,
          starAgeGyr,
          starOverrides,
          parentId: planet.id,
          parentInputs: planetInputs,
          hashUnit,
        }),
      };
    })
    .sort((left, right) => left.au - right.au);

  const gasGiants = listSystemGasGiants(world)
    .map((gasGiant, idx) =>
      buildGasGiantNode(gasGiant, idx, {
        moons,
        starAgeGyr,
        starMassMsol,
        starMetallicityFeH,
        starOverrides,
        hashUnit,
        world,
      }),
    )
    .filter((gasGiant) => Number.isFinite(gasGiant.au) && gasGiant.au > 0)
    .sort((left, right) => left.au - right.au);

  const debrisDisks = [];
  for (const disk of listSystemDebrisDisks(world)) {
    const inner = Number(disk.innerAu);
    const outer = Number(disk.outerAu);
    if (Number.isFinite(inner) && Number.isFinite(outer) && inner > 0 && outer > 0) {
      debrisDisks.push({
        id: disk.id || `dd${debrisDisks.length + 1}`,
        name: disk.name || `Debris disk ${debrisDisks.length + 1}`,
        inner: Math.min(inner, outer),
        outer: Math.max(inner, outer),
      });
    }
  }

  log(enabled, "debrisDisks", debrisDisks);
  log(enabled, "gasGiants", gasGiants);
  log(
    enabled,
    "planets (assigned)",
    planetNodes.map((planet) => ({ name: planet.name, slot: planet.slot, au: planet.au })),
  );

  return {
    sys: system,
    planetNodes,
    debrisDisks,
    gasGiants,
    starName,
    starMassMsol,
    starAgeGyr,
    starTempK,
    starLuminosityLsun,
    starRadiusRsol,
    starRadiusKm,
    starColourHex,
    starActivityLevel,
    starSeed: starSeedRaw,
    activityModelVersion,
    starActivityModel: activityModel,
  };
}

function buildMoonNodes({
  moons,
  starMassMsol,
  starAgeGyr,
  starOverrides,
  parentId,
  parentInputs,
  hashUnit,
}) {
  return moons
    .filter((moon) => moon.planetId === parentId)
    .map((moon) =>
      buildMoonNode(moon, {
        starMassMsol,
        starAgeGyr,
        starOverrides,
        parentInputs,
        hashUnit,
      }),
    )
    .sort((left, right) => {
      const a = Number.isFinite(left.semiMajorAxisKm) ? left.semiMajorAxisKm : Infinity;
      const b = Number.isFinite(right.semiMajorAxisKm) ? right.semiMajorAxisKm : Infinity;
      return a - b;
    });
}

function buildMoonNode(moon, context) {
  const { hashUnit, parentInputs, starAgeGyr, starMassMsol, starOverrides } = context;
  const semiMajorAxisKm = Number(moon.inputs?.semiMajorAxisKm);
  let periodDays = null;
  let radiusKm = null;
  let rotationPeriodDays = null;
  let moonCalc = null;
  try {
    moonCalc = calcMoonExact({
      starMassMsol,
      starAgeGyr,
      starRadiusRsolOverride: starOverrides.r,
      starLuminosityLsolOverride: starOverrides.l,
      starTempKOverride: starOverrides.t,
      starEvolutionMode: starOverrides.ev,
      planet: parentInputs,
      moon: { ...moon.inputs },
    });
    periodDays = Number(moonCalc?.orbit?.orbitalPeriodSiderealDays);
    if (!Number.isFinite(periodDays) || periodDays <= 0) periodDays = null;
    rotationPeriodDays = Number(moonCalc?.orbit?.rotationPeriodDays);
    if (!Number.isFinite(rotationPeriodDays) || rotationPeriodDays <= 0) rotationPeriodDays = null;
    const moonRadiusMoon = Number(moonCalc?.physical?.radiusMoon);
    if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
      radiusKm = moonRadiusMoon * MOON_RADIUS_KM;
    }
  } catch {
    periodDays = null;
    radiusKm = null;
    rotationPeriodDays = null;
    moonCalc = null;
  }
  const rotationPeriodHours = Number(moon.inputs?.rotationPeriodHours);
  const rotationDaysInput =
    Number.isFinite(rotationPeriodHours) && rotationPeriodHours > 0
      ? rotationPeriodHours / 24
      : null;
  const axialTiltInput = Number(moon.inputs?.axialTiltDeg);
  const axialTiltProxy = Number(moon.inputs?.inclinationDeg);
  return {
    id: moon.id,
    name: moon.name || moon.inputs?.name || moon.id,
    semiMajorAxisKm:
      Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
    periodDays,
    rotationPeriodDays: rotationPeriodDays ?? rotationDaysInput ?? periodDays,
    axialTiltDeg: Number.isFinite(axialTiltInput)
      ? clamp(axialTiltInput, 0, 180)
      : Number.isFinite(axialTiltProxy)
        ? clamp(axialTiltProxy, 0, 180)
        : 0,
    radiusKm,
    moonCalc,
    eccentricity: clamp(Number(moon.inputs?.eccentricity ?? 0), 0, 0.99),
    inclinationDeg: clamp(Number(moon.inputs?.inclinationDeg ?? 0), 0, 180),
    longitudeOfPeriapsisDeg: hashUnit(moon.id) * 360,
  };
}

function buildGasGiantNode(gasGiant, idx, context) {
  const { hashUnit, moons, starAgeGyr, starMassMsol, starMetallicityFeH, starOverrides, world } =
    context;
  const node = {
    id: gasGiant.id || `gg${idx + 1}`,
    name: gasGiant.name || `Gas giant ${idx + 1}`,
    au: Number(gasGiant.au),
    radiusRj: Number.isFinite(Number(gasGiant.radiusRj))
      ? clamp(Number(gasGiant.radiusRj), GAS_GIANT_RADIUS_MIN_RJ, GAS_GIANT_RADIUS_MAX_RJ)
      : 1,
    style: gasGiant.style || "jupiter",
    rings: !!gasGiant.rings,
    massMjup: gasGiant.massMjup,
    rotationPeriodHours: gasGiant.rotationPeriodHours,
    metallicity: gasGiant.metallicity,
  };
  let parentOverride = null;
  try {
    const gasCalc = calcGasGiant({
      massMjup: gasGiant.massMjup,
      radiusRj: gasGiant.radiusRj,
      orbitAu: node.au || 5,
      rotationPeriodHours: gasGiant.rotationPeriodHours,
      metallicity: gasGiant.metallicity,
      starMassMsol,
      starLuminosityLsol: Number(world.star?.luminosityLsol) || 1,
      starAgeGyr,
      starRadiusRsol: Number(world.star?.radiusRsol) || 1,
      stellarMetallicityFeH: Number(world.star?.metallicityFeH) || starMetallicityFeH,
    });
    node.gasCalc = gasCalc;
    parentOverride = {
      inputs: {
        massEarth: gasCalc.physical.massEarth,
        semiMajorAxisAu: gasCalc.inputs.orbitAu,
        eccentricity: 0,
        rotationPeriodHours: gasCalc.inputs.rotationPeriodHours,
        cmfPct: 0,
      },
      derived: {
        densityGcm3: gasCalc.physical.densityGcm3,
        radiusEarth: gasCalc.physical.radiusEarth,
        gravityG: gasCalc.physical.gravityG,
      },
    };
  } catch {
    parentOverride = null;
  }
  node.moons = moons
    .filter((moon) => moon.planetId === node.id)
    .map((moon) => {
      const semiMajorAxisKm = Number(moon.inputs?.semiMajorAxisKm);
      let periodDays = null;
      let radiusKm = null;
      let rotationPeriodDays = null;
      let moonCalc = null;
      if (parentOverride) {
        try {
          moonCalc = calcMoonExact({
            starMassMsol,
            starAgeGyr,
            starRadiusRsolOverride: starOverrides.r,
            starLuminosityLsolOverride: starOverrides.l,
            starTempKOverride: starOverrides.t,
            starEvolutionMode: starOverrides.ev,
            moon: { ...moon.inputs },
            parentOverride,
          });
          periodDays = Number(moonCalc?.orbit?.orbitalPeriodSiderealDays);
          if (!Number.isFinite(periodDays) || periodDays <= 0) periodDays = null;
          rotationPeriodDays = Number(moonCalc?.orbit?.rotationPeriodDays);
          if (!Number.isFinite(rotationPeriodDays) || rotationPeriodDays <= 0)
            rotationPeriodDays = null;
          const moonRadiusMoon = Number(moonCalc?.physical?.radiusMoon);
          if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
            radiusKm = moonRadiusMoon * MOON_RADIUS_KM;
          }
        } catch {
          periodDays = null;
          radiusKm = null;
          rotationPeriodDays = null;
          moonCalc = null;
        }
      }
      const rotationPeriodHours = Number(moon.inputs?.rotationPeriodHours);
      const rotationDaysInput =
        Number.isFinite(rotationPeriodHours) && rotationPeriodHours > 0
          ? rotationPeriodHours / 24
          : null;
      const axialTiltInput = Number(moon.inputs?.axialTiltDeg);
      const axialTiltProxy = Number(moon.inputs?.inclinationDeg);
      return {
        id: moon.id,
        name: moon.name || moon.inputs?.name || moon.id,
        semiMajorAxisKm:
          Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
        periodDays,
        rotationPeriodDays: rotationPeriodDays ?? rotationDaysInput ?? periodDays,
        axialTiltDeg: Number.isFinite(axialTiltInput)
          ? clamp(axialTiltInput, 0, 180)
          : Number.isFinite(axialTiltProxy)
            ? clamp(axialTiltProxy, 0, 180)
            : 0,
        radiusKm,
        moonCalc,
        eccentricity: clamp(Number(moon.inputs?.eccentricity ?? 0), 0, 0.99),
        inclinationDeg: clamp(Number(moon.inputs?.inclinationDeg ?? 0), 0, 180),
        longitudeOfPeriapsisDeg: hashUnit(moon.id) * 360,
      };
    })
    .sort((left, right) => {
      const a = Number.isFinite(left.semiMajorAxisKm) ? left.semiMajorAxisKm : Infinity;
      const b = Number.isFinite(right.semiMajorAxisKm) ? right.semiMajorAxisKm : Infinity;
      return a - b;
    });
  return node;
}

export function mapAuToPx(au, minAu, maxAu, maxR, { logScale = false } = {}) {
  const maxSafe = Number.isFinite(maxAu) && maxAu > 0 ? maxAu : 1;
  const auNum = Number(au);
  const a = Number.isFinite(auNum) && auNum > 0 ? auNum : 0;
  if (!maxR) return 0;
  let t = 0;
  if (logScale) {
    const minSafe = Number.isFinite(minAu) && minAu > 0 ? minAu : maxSafe * 0.001;
    const denom = Math.log10(maxSafe) - Math.log10(minSafe);
    t = denom > 0 ? (Math.log10(Math.max(a, minSafe)) - Math.log10(minSafe)) / denom : 0;
  } else {
    t = maxSafe > 0 ? a / maxSafe : 0;
  }
  return clamp(t, 0, 1) * maxR;
}

export function getFrameMetrics(snapshot, options) {
  const {
    bodyScale,
    canvasHeight,
    canvasWidth,
    dpr = 1,
    logScale = false,
    offscaleZoneMinAu,
    offscaleZoneRangeRatio,
    offscaleZoneRatio,
    physicalScale = false,
    showDebris = true,
    showFrost = true,
    showHz = true,
    zoom,
  } = options;
  const W = canvasWidth / dpr;
  const H = canvasHeight / dpr;
  const baseCx = W * 0.5;
  const baseCy = H * 0.5;
  const minAuCandidates = [];
  const maxAuCandidates = [];

  if (snapshot.planetNodes?.length) {
    const planetAus = snapshot.planetNodes
      .map((planet) => Number(planet.au))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (planetAus.length) {
      minAuCandidates.push(Math.min(...planetAus));
      maxAuCandidates.push(Math.max(...planetAus));
    }
  }
  if (showDebris && snapshot.debrisDisks?.length) {
    snapshot.debrisDisks.forEach((disk) => {
      minAuCandidates.push(Number(disk.inner), Number(disk.outer));
      maxAuCandidates.push(Number(disk.inner), Number(disk.outer));
    });
  }
  if (snapshot.gasGiants?.length) {
    snapshot.gasGiants.forEach((gasGiant) => {
      minAuCandidates.push(Number(gasGiant.au));
      maxAuCandidates.push(Number(gasGiant.au));
    });
  }

  const coreScaleCandidates = maxAuCandidates.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const hasCoreScaleFeatures = coreScaleCandidates.length > 0;
  const coreMaxAu = hasCoreScaleFeatures ? Math.max(...coreScaleCandidates) : null;
  if (!hasCoreScaleFeatures) {
    if (showFrost) {
      minAuCandidates.push(Number(snapshot.sys?.frostLineAu));
      maxAuCandidates.push(Number(snapshot.sys?.frostLineAu));
    }
    if (showHz) {
      minAuCandidates.push(
        Number(snapshot.sys?.habitableZoneAu?.inner),
        Number(snapshot.sys?.habitableZoneAu?.outer),
      );
      maxAuCandidates.push(
        Number(snapshot.sys?.habitableZoneAu?.inner),
        Number(snapshot.sys?.habitableZoneAu?.outer),
      );
    }
  }

  const minFiniteCandidates = minAuCandidates.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const maxFiniteCandidates = maxAuCandidates.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const minSourceAu = minFiniteCandidates.length ? Math.min(...minFiniteCandidates) : 0.1;
  const minAu = minSourceAu * 0.85;
  const maxSourceAu = maxFiniteCandidates.length ? Math.max(...maxFiniteCandidates) : 1;
  const maxAu = Math.max(maxSourceAu * 1.05, minAu * 5);
  const maxR = Math.min(W, H) * 0.45 * zoom;
  const starRadiusRsol = Math.max(0.01, Number(snapshot?.starRadiusRsol) || 1);
  const innermostOrbitPx = mapAuToPx(minSourceAu, minAu, maxAu, maxR, { logScale });
  let starR;
  if (physicalScale) {
    const starRadiusAu = starRadiusRsol * 0.00465047;
    const pixelsPerAu = logScale
      ? (() => {
          const logDenom = Math.log10(maxAu) - Math.log10(Math.max(minAu, 1e-9));
          return logDenom > 0 ? maxR / (Math.LN10 * logDenom * Math.max(minAu, 1e-9)) : maxR;
        })()
      : maxR / Math.max(maxAu, 1e-6);
    starR = Math.max(0.5, starRadiusAu * pixelsPerAu);
  } else {
    const baseStarR = Math.max(5, maxR * 0.03);
    const scaledRadiusFactor = Math.pow(starRadiusRsol, 0.45);
    const maxStarR = innermostOrbitPx > 0 ? innermostOrbitPx * 0.48 : maxR * 0.12;
    starR = clamp(baseStarR * scaledRadiusFactor, 4, Math.max(4, maxStarR));
  }
  const starRadiusKm = Number(snapshot?.starRadiusKm);
  const bodyZoom = physicalScale ? 1 : clamp(Math.pow(zoom, 0.5) * bodyScale, 0.06, 20);
  let repBodyScale = 1;
  let repBodyMinPx = 1.2;
  if (!physicalScale) {
    const bodyRadiusCandidates = [];
    for (const planet of snapshot.planetNodes || []) {
      bodyRadiusCandidates.push(representativePlanetBaseRadiusPx(planet, bodyZoom));
    }
    for (const gasGiant of snapshot.gasGiants || []) {
      bodyRadiusCandidates.push(representativeGasBaseRadiusPx(gasGiant, bodyZoom));
    }
    const maxBodyRadiusPx = bodyRadiusCandidates.length ? Math.max(...bodyRadiusCandidates) : 0;
    if (maxBodyRadiusPx > 0 && Number.isFinite(starR) && starR > 0) {
      repBodyScale = Math.min(1, starR / maxBodyRadiusPx);
    }
    repBodyMinPx = clamp(starR * 0.12, 1.05, 1.8);
  }
  const offscaleZones = buildOffscaleZoneInfo(snapshot, coreMaxAu, {
    enabledFrost: !!showFrost,
    enabledHz: !!showHz,
    minZoneAu: offscaleZoneMinAu,
    rangeRatio: offscaleZoneRangeRatio,
    suppressAll: !!logScale,
    zoneRatio: offscaleZoneRatio,
  });
  return {
    W,
    H,
    baseCx,
    baseCy,
    minAu,
    maxAu,
    maxR,
    starR,
    starRadiusKm: Number.isFinite(starRadiusKm) && starRadiusKm > 0 ? starRadiusKm : SOL_RADIUS_KM,
    isPhysical: physicalScale,
    bodyZoom,
    repBodyScale,
    repBodyMinPx,
    offscaleZones,
  };
}
