import { clamp } from "../../engine/utils.js";
import {
  FLARE_E0_ERG,
  computeStellarActivityModel,
  scheduleNextFlare,
  scheduleNextCme,
  maybeSpawnCME,
  flareClassFromEnergy,
  createSeededRng,
} from "../../engine/stellarActivity.js";

export const DEFAULT_STAR_ACTIVITY_CONSTANTS = Object.freeze({
  maxFlaresPerTick: 48,
  maxCmesPerTick: 48,
  maxSurfaceFlaresPerTick: 96,
  maxStarBursts: 48,
  starBurstInitialAgeSec: 0.08,
  surfaceFlareEminErg: 1e30,
  surfaceFlareEmaxErg: FLARE_E0_ERG * 0.999,
});

export function buildFlareSignature(snapshot) {
  const seedKey = snapshot.starSeed == null ? "" : String(snapshot.starSeed);
  const m = Number(snapshot.starMassMsol);
  const a = Number(snapshot.starAgeGyr);
  const t = Number(snapshot.starTempK);
  const l = Number(snapshot.starLuminosityLsun);
  const activityModelVersion = snapshot?.activityModelVersion === "v1" ? "v1" : "v2";
  return `${seedKey}|${m.toFixed(6)}|${a.toFixed(6)}|${t.toFixed(3)}|${l.toFixed(6)}|${activityModelVersion}`;
}

function flareVisualProfile(flareClass) {
  switch (flareClass) {
    case "super":
      return { spread: 0.22, reach: 1.9, intensity: 0.34, ttl: 1.45 };
    case "large":
      return { spread: 0.17, reach: 1.45, intensity: 0.27, ttl: 1.1 };
    case "medium":
      return { spread: 0.13, reach: 1.1, intensity: 0.21, ttl: 0.86 };
    case "small":
      return { spread: 0.09, reach: 0.82, intensity: 0.16, ttl: 0.62 };
    case "micro":
    default:
      return { spread: 0.06, reach: 0.58, intensity: 0.11, ttl: 0.42 };
  }
}

export function flareEnergyNorm(energyErg) {
  const e = Math.max(1, Number(energyErg) || 1e30);
  return clamp((Math.log10(e) - 30) / 5, 0, 1);
}

export function createStarActivityRuntime(options = {}) {
  const {
    constants = {},
    debugLog = () => {},
    debugLogThrottled = () => {},
    isDebugEnabled = () => false,
    random = Math.random,
    state,
  } = options;

  if (!state || typeof state !== "object") {
    throw new Error("createStarActivityRuntime requires a state object");
  }
  if (!state.flareState || typeof state.flareState !== "object") {
    throw new Error("createStarActivityRuntime requires state.flareState");
  }
  if (!Array.isArray(state.starBursts)) {
    state.starBursts = [];
  }

  const runtimeConstants = {
    ...DEFAULT_STAR_ACTIVITY_CONSTANTS,
    ...constants,
  };

  function flareDebugEnabled() {
    return !!isDebugEnabled();
  }

  function cycleValueAt(simSec) {
    const fs = state.flareState;
    if (fs.params?.teffBin !== "FGK") return 0.5;
    const phase = (simSec / fs.cyclePeriodSec) * Math.PI * 2 + fs.cyclePhase;
    return 0.5 + 0.5 * Math.sin(phase);
  }

  function ensureFlareModel(snapshot, nowSimSec) {
    const fs = state.flareState;
    const signature = buildFlareSignature(snapshot);
    if (fs.signature === signature && fs.params) return;
    const activityModelVersion = snapshot?.activityModelVersion === "v1" ? "v1" : "v2";
    const activityModel =
      snapshot?.starActivityModel && typeof snapshot.starActivityModel === "object"
        ? snapshot.starActivityModel
        : computeStellarActivityModel(
            {
              massMsun: snapshot.starMassMsol,
              ageGyr: snapshot.starAgeGyr,
              teffK: snapshot.starTempK,
              luminosityLsun: snapshot.starLuminosityLsun,
            },
            { activityCycle: 0.5 },
          );
    const activity =
      activityModel?.activity && typeof activityModel.activity === "object"
        ? activityModel.activity
        : activityModel || {};
    const energeticRatePerDay = Math.max(
      0,
      Number(activity?.energeticFlareRatePerDay) || Number(activity?.N32) || 0,
    );
    const associatedCmeRatePerDay =
      activityModelVersion === "v2"
        ? Math.max(0, Number(activity?.cmeAssociatedRatePerDay) || 0)
        : 0;
    const backgroundCmeRatePerDay =
      activityModelVersion === "v2"
        ? Math.max(0, Number(activity?.cmeBackgroundRatePerDay) || 0)
        : 0;
    const params = {
      ...activity,
      lambdaFlarePerDay: energeticRatePerDay,
      EminErg: FLARE_E0_ERG,
      activityModelVersion,
      cmeAssociatedRatePerDay: associatedCmeRatePerDay,
      cmeBackgroundRatePerDay: backgroundCmeRatePerDay,
      cmeTotalRatePerDay: associatedCmeRatePerDay + backgroundCmeRatePerDay,
    };
    const totalFlareRatePerDay = Math.max(
      0,
      Number(activity?.totalFlareRatePerDay) || energeticRatePerDay,
    );
    const surfaceFlareRatePerDay = Math.max(0, totalFlareRatePerDay - energeticRatePerDay);
    const surfaceParams = {
      ...activity,
      lambdaFlarePerDay: surfaceFlareRatePerDay,
      EminErg: runtimeConstants.surfaceFlareEminErg,
      EmaxErg: runtimeConstants.surfaceFlareEmaxErg,
    };
    const hasSeed = snapshot.starSeed != null && String(snapshot.starSeed).trim() !== "";
    const rng = hasSeed ? createSeededRng(snapshot.starSeed) : random;

    fs.signature = signature;
    fs.params = params;
    fs.surfaceParams = surfaceParams;
    fs.seeded = hasSeed;
    fs.rng = rng;
    fs.cmeTimes24hSec = [];
    fs.cyclePhase = rng() * Math.PI * 2;
    fs.cyclePeriodSec = (8 + rng() * 6) * 365.25 * 86400;
    fs.loopToggle = rng() >= 0.5;
    state.starBursts = [];

    const next = scheduleNextFlare(nowSimSec, params, rng);
    fs.nextFlareTimeSec = next.timeSec;
    fs.nextFlareEnergyErg = next.energyErg;
    const nextSurface = scheduleNextFlare(nowSimSec, surfaceParams, rng);
    fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
    fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
    fs.nextAssociatedCmeTimeSec =
      activityModelVersion === "v2"
        ? scheduleNextCme(nowSimSec, params.cmeAssociatedRatePerDay, rng)
        : Infinity;
    fs.nextBackgroundCmeTimeSec =
      activityModelVersion === "v2"
        ? scheduleNextCme(nowSimSec, params.cmeBackgroundRatePerDay, rng)
        : Infinity;

    debugLog(flareDebugEnabled(), "flare:model:init", {
      signature,
      activityModelVersion,
      starSeed: snapshot.starSeed ?? null,
      starMassMsol: Number(snapshot.starMassMsol) || null,
      starAgeGyr: Number(snapshot.starAgeGyr) || null,
      starTempK: Number(snapshot.starTempK) || null,
      starLuminosityLsun: Number(snapshot.starLuminosityLsun) || null,
      teffBin: params.teffBin,
      ageBand: params.ageBand,
      N32: Number(params.N32),
      lambdaFlarePerDay: Number(params.lambdaFlarePerDay),
      EminErg: Number(params.EminErg),
      totalFlareRatePerDay: Number(totalFlareRatePerDay) || 0,
      surfaceFlareRatePerDay: Number(surfaceFlareRatePerDay) || 0,
      cmeAssociatedRatePerDay: Number(params.cmeAssociatedRatePerDay) || 0,
      cmeBackgroundRatePerDay: Number(params.cmeBackgroundRatePerDay) || 0,
      cmeTotalRatePerDay: Number(params.cmeTotalRatePerDay) || 0,
      nextFlareInSec: Number.isFinite(next.timeSec)
        ? Number((next.timeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextFlareEnergyErg: Number(next.energyErg) || null,
      nextSurfaceFlareInSec: Number.isFinite(fs.nextSurfaceFlareTimeSec)
        ? Number((fs.nextSurfaceFlareTimeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextSurfaceFlareEnergyErg: Number(fs.nextSurfaceFlareEnergyErg) || null,
      nextAssociatedCmeInSec: Number.isFinite(fs.nextAssociatedCmeTimeSec)
        ? Number((fs.nextAssociatedCmeTimeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextBackgroundCmeInSec: Number.isFinite(fs.nextBackgroundCmeTimeSec)
        ? Number((fs.nextBackgroundCmeTimeSec - nowSimSec).toFixed(3))
        : Infinity,
    });
  }

  function pushStarBurst({ type, flareClass, energyErg, angle, activityCycle = 0.5 }) {
    if (state.starBursts.length >= runtimeConstants.maxStarBursts) return false;

    const fs = state.flareState;
    const rng = fs.rng || random;
    const base = flareVisualProfile(flareClass);
    const isCme = type === "cme";
    const isSurface = type === "surface";
    let hasLoops = false;
    if (!isCme && !isSurface) {
      hasLoops = fs.loopToggle !== false;
      fs.loopToggle = !hasLoops;
    }
    const energyNorm = flareEnergyNorm(energyErg);
    const n32 = Math.max(0, Number(fs.params?.N32) || 0);
    const activityNorm = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);
    const cycleNorm = clamp(Number(activityCycle), 0, 1);

    const jitter = (rng() - 0.5) * 0.25;
    const spread = Math.max(
      0.03,
      base.spread *
        (isCme ? 1.45 : isSurface ? 0.65 : 1.0) *
        (1 + jitter) *
        (0.88 + energyNorm * 0.42 + activityNorm * 0.18),
    );
    const reach = Math.max(
      0.2,
      base.reach *
        (isCme ? 2.0 : isSurface ? 0.35 : 1.0) *
        (1 + jitter) *
        (0.9 + energyNorm * 0.8 + cycleNorm * 0.25),
    );
    const intensity = Math.max(
      0.06,
      base.intensity *
        (isCme ? 0.86 : isSurface ? 0.72 : 1.0) *
        (1 + jitter * 0.5) *
        (0.84 + energyNorm * 0.82 + activityNorm * 0.32),
    );
    const ttl = Math.max(
      0.2,
      base.ttl *
        (isCme ? 1.95 : isSurface ? 0.55 : 1.0) *
        (1 + jitter * 0.2) *
        (0.9 + energyNorm * 0.45),
    );
    const loopCount = clamp(
      Math.round(
        (isCme ? 2.2 : 1.2) +
          energyNorm * (isCme ? 3.0 : 2.2) +
          activityNorm * 1.4 +
          cycleNorm * 0.9 +
          (rng() - 0.5) * 1.2,
      ),
      1,
      isCme ? 7 : 5,
    );
    const radialStartNorm = isCme
      ? clamp(0.28 + rng() * 0.16 + energyNorm * 0.08, 0.22, 0.64)
      : clamp(0.07 + rng() * 0.09 + energyNorm * 0.04, 0.05, 0.26);
    const radialEndNorm = isCme
      ? clamp(
          1.15 + energyNorm * 0.9 + activityNorm * 0.25 + cycleNorm * 0.2 + rng() * 0.18,
          1.08,
          2.6,
        )
      : clamp(0.5 + energyNorm * 0.32 + cycleNorm * 0.15 + rng() * 0.08, 0.42, 1.15);
    const frontThickness = isCme
      ? clamp(0.16 + energyNorm * 0.09 + activityNorm * 0.04, 0.14, 0.42)
      : clamp(0.06 + energyNorm * 0.03, 0.05, 0.16);
    const streamers = isCme
      ? clamp(Math.round(2 + energyNorm * 2.2 + activityNorm * 1.1 + rng() * 2.1), 2, 7)
      : clamp(Math.round(1 + energyNorm * 1.8 + rng() * 1.6), 1, 4);
    const shellRipple = isCme ? clamp(0.012 + rng() * 0.03, 0.012, 0.05) : 0;
    const plumeStretch = isCme
      ? clamp(1.2 + energyNorm * 0.65 + cycleNorm * 0.25, 1.1, 2.4)
      : clamp(0.75 + energyNorm * 0.35, 0.72, 1.35);
    const cmeLobes = isCme
      ? clamp(Math.round(3 + energyNorm * 2.5 + activityNorm * 1.3 + rng() * 1.8), 3, 8)
      : 0;
    const plumeNoise = isCme ? rng() * Math.PI * 2 : 0;
    const surfaceRadiusNorm = isSurface ? Math.pow(rng(), 0.62) * 0.9 : 0;
    const surfaceSpotScale = isSurface
      ? clamp(0.65 + energyNorm * 0.9 + rng() * 0.35, 0.5, 1.7)
      : 1;

    state.starBursts.push({
      type: isCme ? "cme" : isSurface ? "surface" : "flare",
      flareClass,
      energyErg,
      angle,
      spread,
      reach,
      curl: (rng() - 0.5) * 0.45,
      intensity,
      ttl,
      age: Math.min(runtimeConstants.starBurstInitialAgeSec, ttl * 0.22),
      loops: loopCount,
      hasLoops,
      loopRise: clamp(0.5 + energyNorm * 0.4 + (isCme ? 0.18 : 0), 0.45, 1.25),
      energyNorm,
      activityNorm,
      cycleNorm,
      radialStartNorm,
      radialEndNorm,
      frontThickness,
      streamers,
      shellRipple,
      plumeStretch,
      cmeLobes,
      plumeNoise,
      surfaceRadiusNorm,
      surfaceSpotScale,
      beads: isCme
        ? clamp(Math.round(2 + energyNorm * 3 + activityNorm * 1.2 + rng() * 1.8), 2, 8)
        : 0,
    });
    return true;
  }

  function updateStarBursts(dtSec, snapshot, nowActivitySec) {
    const fs = state.flareState;
    const debugOn = flareDebugEnabled();
    ensureFlareModel(snapshot, nowActivitySec);
    const rng = fs.rng || random;
    const activityModelVersion = fs.params?.activityModelVersion === "v1" ? "v1" : "v2";
    const useSplitCmeScheduler = activityModelVersion === "v2";

    let changed = false;
    const burstCountBefore = state.starBursts.length;
    let expiredBursts = 0;
    let spawnedFlares = 0;
    let spawnedSurfaceFlares = 0;
    let spawnedCmes = 0;
    let spawnedAssociatedCmes = 0;
    let spawnedBackgroundCmes = 0;

    if (state.starBursts.length) {
      changed = true;
      for (const burst of state.starBursts) burst.age += dtSec;
      const before = state.starBursts.length;
      state.starBursts = state.starBursts.filter((burst) => burst.age < burst.ttl);
      expiredBursts = Math.max(0, before - state.starBursts.length);
    }

    fs.cmeTimes24hSec = fs.cmeTimes24hSec.filter((timeSec) => timeSec >= nowActivitySec - 86400);

    let flareCountThisTick = 0;
    let flareBacklogGuardTriggered = false;
    let surfaceFlareIterations = 0;
    let surfaceFlareBacklogGuardTriggered = false;
    while (
      Number.isFinite(fs.nextFlareTimeSec) &&
      fs.nextFlareTimeSec <= nowActivitySec &&
      flareCountThisTick < runtimeConstants.maxFlaresPerTick &&
      state.starBursts.length < runtimeConstants.maxStarBursts
    ) {
      const flareEnergy = Number(fs.nextFlareEnergyErg) || 1e30;
      const flareClass = flareClassFromEnergy(flareEnergy);
      const angle = (fs.rng || random)() * Math.PI * 2;
      const activityCycle = cycleValueAt(fs.nextFlareTimeSec);

      const flareAdded = pushStarBurst({
        type: "flare",
        flareClass,
        energyErg: flareEnergy,
        angle,
        activityCycle,
      });
      if (flareAdded) {
        changed = true;
        spawnedFlares += 1;
      }

      if (!useSplitCmeScheduler) {
        const recentCMECount24h = fs.cmeTimes24hSec.length;
        const spawnCME = maybeSpawnCME(
          flareEnergy,
          fs.params,
          recentCMECount24h,
          {
            teffK: snapshot.starTempK,
            ageGyr: snapshot.starAgeGyr,
            massMsun: snapshot.starMassMsol,
            luminosityLsun: snapshot.starLuminosityLsun,
          },
          { activityCycle, rng: fs.rng },
        );
        if (spawnCME && state.starBursts.length < runtimeConstants.maxStarBursts) {
          const cmeAdded = pushStarBurst({
            type: "cme",
            flareClass,
            energyErg: flareEnergy,
            angle: angle + (rng() - 0.5) * 0.22,
            activityCycle,
          });
          if (cmeAdded) {
            fs.cmeTimes24hSec.push(fs.nextFlareTimeSec);
            changed = true;
            spawnedCmes += 1;
          }
        }
      }

      const next = scheduleNextFlare(fs.nextFlareTimeSec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
      flareCountThisTick += 1;
    }

    while (
      Number.isFinite(fs.nextSurfaceFlareTimeSec) &&
      fs.nextSurfaceFlareTimeSec <= nowActivitySec &&
      surfaceFlareIterations < runtimeConstants.maxSurfaceFlaresPerTick &&
      state.starBursts.length < runtimeConstants.maxStarBursts
    ) {
      const flareEnergy =
        Number(fs.nextSurfaceFlareEnergyErg) || runtimeConstants.surfaceFlareEminErg;
      const flareClass = flareClassFromEnergy(flareEnergy);
      const activityCycle = cycleValueAt(fs.nextSurfaceFlareTimeSec);
      const flareAdded = pushStarBurst({
        type: "surface",
        flareClass,
        energyErg: flareEnergy,
        angle: rng() * Math.PI * 2,
        activityCycle,
      });
      if (flareAdded) {
        changed = true;
        spawnedSurfaceFlares += 1;
      }
      const nextSurface = scheduleNextFlare(
        fs.nextSurfaceFlareTimeSec,
        fs.surfaceParams || fs.params,
        fs.rng,
      );
      fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
      fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
      surfaceFlareIterations += 1;
    }

    if (
      (flareCountThisTick >= runtimeConstants.maxFlaresPerTick ||
        state.starBursts.length >= runtimeConstants.maxStarBursts) &&
      fs.nextFlareTimeSec <= nowActivitySec
    ) {
      const next = scheduleNextFlare(nowActivitySec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
      flareBacklogGuardTriggered = true;
    }
    if (
      (surfaceFlareIterations >= runtimeConstants.maxSurfaceFlaresPerTick ||
        state.starBursts.length >= runtimeConstants.maxStarBursts) &&
      fs.nextSurfaceFlareTimeSec <= nowActivitySec
    ) {
      const nextSurface = scheduleNextFlare(nowActivitySec, fs.surfaceParams || fs.params, fs.rng);
      fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
      fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
      surfaceFlareBacklogGuardTriggered = true;
    }

    let associatedCmeIterations = 0;
    let backgroundCmeIterations = 0;
    let associatedCmeBacklogGuardTriggered = false;
    let backgroundCmeBacklogGuardTriggered = false;

    if (useSplitCmeScheduler) {
      const associatedRatePerDay = Math.max(0, Number(fs.params?.cmeAssociatedRatePerDay) || 0);
      const backgroundRatePerDay = Math.max(0, Number(fs.params?.cmeBackgroundRatePerDay) || 0);

      while (
        Number.isFinite(fs.nextAssociatedCmeTimeSec) &&
        fs.nextAssociatedCmeTimeSec <= nowActivitySec &&
        associatedCmeIterations < runtimeConstants.maxCmesPerTick &&
        state.starBursts.length < runtimeConstants.maxStarBursts
      ) {
        const burstTime = fs.nextAssociatedCmeTimeSec;
        const activityCycle = cycleValueAt(burstTime);
        const activeFlares = state.starBursts.filter(
          (burst) => burst.type === "flare" && burst.age < burst.ttl * 0.85,
        );
        let angle = rng() * Math.PI * 2;
        let energyErg = FLARE_E0_ERG * (1 + rng() * 2.5);
        if (activeFlares.length) {
          const anchor = activeFlares[Math.floor(rng() * activeFlares.length)];
          angle = anchor.angle + (rng() - 0.5) * 0.2;
          energyErg = Math.max(FLARE_E0_ERG, Number(anchor.energyErg) || FLARE_E0_ERG);
        }
        const cmeAdded = pushStarBurst({
          type: "cme",
          flareClass: flareClassFromEnergy(energyErg),
          energyErg,
          angle,
          activityCycle,
        });
        if (cmeAdded) {
          fs.cmeTimes24hSec.push(burstTime);
          changed = true;
          spawnedCmes += 1;
          spawnedAssociatedCmes += 1;
        }
        fs.nextAssociatedCmeTimeSec = scheduleNextCme(
          fs.nextAssociatedCmeTimeSec,
          associatedRatePerDay,
          fs.rng,
        );
        associatedCmeIterations += 1;
      }

      if (
        (associatedCmeIterations >= runtimeConstants.maxCmesPerTick ||
          state.starBursts.length >= runtimeConstants.maxStarBursts) &&
        fs.nextAssociatedCmeTimeSec <= nowActivitySec
      ) {
        fs.nextAssociatedCmeTimeSec = scheduleNextCme(nowActivitySec, associatedRatePerDay, fs.rng);
        associatedCmeBacklogGuardTriggered = true;
      }

      while (
        Number.isFinite(fs.nextBackgroundCmeTimeSec) &&
        fs.nextBackgroundCmeTimeSec <= nowActivitySec &&
        backgroundCmeIterations < runtimeConstants.maxCmesPerTick &&
        state.starBursts.length < runtimeConstants.maxStarBursts
      ) {
        const burstTime = fs.nextBackgroundCmeTimeSec;
        const activityCycle = cycleValueAt(burstTime);
        const energyErg = FLARE_E0_ERG * (0.55 + rng() * 1.3);
        const cmeAdded = pushStarBurst({
          type: "cme",
          flareClass: flareClassFromEnergy(energyErg),
          energyErg,
          angle: rng() * Math.PI * 2,
          activityCycle,
        });
        if (cmeAdded) {
          fs.cmeTimes24hSec.push(burstTime);
          changed = true;
          spawnedCmes += 1;
          spawnedBackgroundCmes += 1;
        }
        fs.nextBackgroundCmeTimeSec = scheduleNextCme(
          fs.nextBackgroundCmeTimeSec,
          backgroundRatePerDay,
          fs.rng,
        );
        backgroundCmeIterations += 1;
      }

      if (
        (backgroundCmeIterations >= runtimeConstants.maxCmesPerTick ||
          state.starBursts.length >= runtimeConstants.maxStarBursts) &&
        fs.nextBackgroundCmeTimeSec <= nowActivitySec
      ) {
        fs.nextBackgroundCmeTimeSec = scheduleNextCme(nowActivitySec, backgroundRatePerDay, fs.rng);
        backgroundCmeBacklogGuardTriggered = true;
      }
    } else {
      fs.nextAssociatedCmeTimeSec = Infinity;
      fs.nextBackgroundCmeTimeSec = Infinity;
    }

    const tickSummary = {
      dtSec: Number(dtSec.toFixed(4)),
      speedDaysPerSec: Number(state.speed),
      nowActivitySec: Number(nowActivitySec.toFixed(3)),
      isPlaying: !!state.isPlaying,
      exportingGif: !!state.exportingGif,
      activityModelVersion,
      burstCountBefore,
      burstCountAfter: state.starBursts.length,
      expiredBursts,
      spawnedFlares,
      spawnedSurfaceFlares,
      spawnedCmes,
      spawnedAssociatedCmes,
      spawnedBackgroundCmes,
      flareIterations: flareCountThisTick,
      surfaceFlareIterations,
      associatedCmeIterations,
      backgroundCmeIterations,
      flareBacklogGuardTriggered,
      surfaceFlareBacklogGuardTriggered,
      associatedCmeBacklogGuardTriggered,
      backgroundCmeBacklogGuardTriggered,
      reachedTickCap: flareCountThisTick >= runtimeConstants.maxFlaresPerTick,
      reachedBufferCap: state.starBursts.length >= runtimeConstants.maxStarBursts,
      nextFlareInSec: Number.isFinite(fs.nextFlareTimeSec)
        ? Number((fs.nextFlareTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextFlareEnergyErg: Number(fs.nextFlareEnergyErg) || null,
      nextSurfaceFlareInSec: Number.isFinite(fs.nextSurfaceFlareTimeSec)
        ? Number((fs.nextSurfaceFlareTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextSurfaceFlareEnergyErg: Number(fs.nextSurfaceFlareEnergyErg) || null,
      nextAssociatedCmeInSec: Number.isFinite(fs.nextAssociatedCmeTimeSec)
        ? Number((fs.nextAssociatedCmeTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextBackgroundCmeInSec: Number.isFinite(fs.nextBackgroundCmeTimeSec)
        ? Number((fs.nextBackgroundCmeTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      teffBin: fs.params?.teffBin || null,
      ageBand: fs.params?.ageBand || null,
      N32: Number(fs.params?.N32) || 0,
      lambdaFlarePerDay: Number(fs.params?.lambdaFlarePerDay) || 0,
      lowEnergySurfaceRatePerDay: Number(fs.surfaceParams?.lambdaFlarePerDay) || 0,
      cmeAssociatedRatePerDay: Number(fs.params?.cmeAssociatedRatePerDay) || 0,
      cmeBackgroundRatePerDay: Number(fs.params?.cmeBackgroundRatePerDay) || 0,
      cmeTotalRatePerDay: Number(fs.params?.cmeTotalRatePerDay) || 0,
    };
    const hasTickEvent =
      spawnedFlares > 0 ||
      spawnedSurfaceFlares > 0 ||
      spawnedCmes > 0 ||
      expiredBursts > 0 ||
      flareCountThisTick > 0 ||
      surfaceFlareIterations > 0 ||
      associatedCmeIterations > 0 ||
      backgroundCmeIterations > 0 ||
      flareBacklogGuardTriggered ||
      surfaceFlareBacklogGuardTriggered ||
      associatedCmeBacklogGuardTriggered ||
      backgroundCmeBacklogGuardTriggered ||
      burstCountBefore !== state.starBursts.length;
    if (hasTickEvent) debugLog(debugOn, "flare:tick:event", tickSummary);
    else debugLogThrottled(debugOn, "flare:tick:idle", 2000, "flare:tick:idle", tickSummary);

    return changed;
  }

  return {
    buildFlareSignature,
    cycleValueAt,
    ensureFlareModel,
    updateStarBursts,
  };
}
