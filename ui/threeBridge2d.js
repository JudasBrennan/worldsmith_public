// SPDX-License-Identifier: MPL-2.0
import {
  getDracoDecoderPath,
  importThreeDracoLoaderModule,
  importThreeGltfLoaderModule,
  importThreeModule,
  importThreeOrbitControlsModule,
} from "./runtimeDeps.js";

let threePromise = null;
let threeSplashDepsPromise = null;

export { getDracoDecoderPath };

export function loadThreeCore() {
  if (threePromise) return threePromise;
  threePromise = importThreeModule()
    .then((mod) => {
      if (!mod?.WebGLRenderer) {
        throw new Error("Three.js core module did not expose WebGLRenderer");
      }
      return mod;
    })
    .catch((err) => {
      threePromise = null;
      throw err;
    });
  return threePromise;
}

export function loadThreeSplashDeps() {
  if (threeSplashDepsPromise) return threeSplashDepsPromise;
  threeSplashDepsPromise = Promise.all([
    loadThreeCore(),
    importThreeGltfLoaderModule(),
    importThreeDracoLoaderModule(),
    importThreeOrbitControlsModule(),
  ]).catch((err) => {
    threeSplashDepsPromise = null;
    throw err;
  });
  return threeSplashDepsPromise;
}
