// SPDX-License-Identifier: MPL-2.0
import {
  calcMoonMaterialProfileFromDensity,
  getMoonMaterialProfileByClass,
} from "../physics/materials.js";

export function compositionFromDensity(densityGcm3) {
  return calcMoonMaterialProfileFromDensity({ densityGcm3 });
}

export function compositionFromClass(className) {
  return getMoonMaterialProfileByClass({ className });
}
