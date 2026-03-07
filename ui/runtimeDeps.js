export function importThreeModule() {
  return import("./vendor/three.module.js");
}

export function importThreeGltfLoaderModule() {
  return import("./vendor/three-gltf-loader.module.js");
}

export function importThreeDracoLoaderModule() {
  return import("./vendor/three-draco-loader.module.js");
}

export function importThreeOrbitControlsModule() {
  return import("./vendor/three-orbit-controls.module.js");
}

export function importXlsxModule() {
  return import("./vendor/xlsx.module.js");
}

export function importKatexModule() {
  return import("./vendor/katex.module.js");
}

export function runtimeAssetUrl(path) {
  if (typeof document !== "undefined" && document.baseURI) {
    return new URL(path, document.baseURI).href;
  }
  return path;
}

export function getKatexCssHref() {
  return runtimeAssetUrl("./assets/vendor/katex/katex.min.css");
}

export function getDracoDecoderPath() {
  return runtimeAssetUrl("./assets/vendor/draco/");
}
