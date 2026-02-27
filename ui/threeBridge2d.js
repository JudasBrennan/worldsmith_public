const THREE_VERSION = "0.170.0";
const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
const THREE_URL = `${THREE_CDN}/+esm`;

let threePromise = null;

export function loadThreeCore() {
  if (threePromise) return threePromise;
  threePromise = import(/* webpackIgnore: true */ THREE_URL)
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
