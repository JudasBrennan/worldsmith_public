// 3D planet splash overlay — shows an animated Three.js planet on every page load.
// Three.js + loaders loaded lazily from cdn.jsdelivr.net (ESM).

const THREE_VER = "0.170.0";
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}`;
const THREE_URL = `${CDN}/+esm`;
const GLTF_URL = `${CDN}/examples/jsm/loaders/GLTFLoader.js/+esm`;
const DRACO_URL = `${CDN}/examples/jsm/loaders/DRACOLoader.js/+esm`;
const ORBIT_URL = `${CDN}/examples/jsm/controls/OrbitControls.js/+esm`;
const DRACO_DECODER_PATH = `${CDN}/examples/jsm/libs/draco/`;

const SEA_LEVEL = 5.0;

let threePromise = null;

function loadThreeDeps() {
  if (threePromise) return threePromise;
  threePromise = Promise.all([
    import(/* webpackIgnore: true */ THREE_URL),
    import(/* webpackIgnore: true */ GLTF_URL),
    import(/* webpackIgnore: true */ DRACO_URL),
    import(/* webpackIgnore: true */ ORBIT_URL),
  ]).catch((err) => {
    threePromise = null;
    throw err;
  });
  return threePromise;
}

/* ── Biome colouring from vertex position ──────────────── */

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const OCEAN = [0.08, 0.3, 0.7];
const OCEAN_DEEP = [0.04, 0.15, 0.5];
const COASTAL_SAND = [0.76, 0.7, 0.5];
const TROPICAL = [0.18, 0.55, 0.15];
const SAVANNA = [0.55, 0.6, 0.2];
const DESERT = [0.82, 0.72, 0.42];
const TEMPERATE = [0.2, 0.5, 0.18];
const BOREAL = [0.12, 0.35, 0.15];
const TUNDRA = [0.55, 0.6, 0.55];
const POLAR = [0.9, 0.92, 0.95];
const MOUNTAIN = [0.45, 0.38, 0.3];
const SNOW_PEAK = [0.92, 0.93, 0.96];

function biomeColor(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const elevation = r - SEA_LEVEL;

  // Ocean
  if (elevation < 0.003) {
    const depth = Math.max(0, -elevation);
    const t = Math.min(1, depth / 0.05);
    return lerp3(OCEAN, OCEAN_DEEP, t);
  }

  // Normalised elevation above sea level (max continent height ~0.2)
  const elNorm = Math.min(1, elevation / 0.2);
  // Latitude: 0 = equator, 1 = pole
  const lat = Math.abs(z) / Math.max(r, 0.001);

  // Base biome from latitude
  let base;
  if (lat < 0.2) base = lerp3(TROPICAL, SAVANNA, smoothstep(0.1, 0.2, lat));
  else if (lat < 0.35) base = lerp3(SAVANNA, DESERT, smoothstep(0.2, 0.35, lat));
  else if (lat < 0.55) base = lerp3(DESERT, TEMPERATE, smoothstep(0.35, 0.55, lat));
  else if (lat < 0.7) base = lerp3(TEMPERATE, BOREAL, smoothstep(0.55, 0.7, lat));
  else if (lat < 0.85) base = lerp3(BOREAL, TUNDRA, smoothstep(0.7, 0.85, lat));
  else base = lerp3(TUNDRA, POLAR, smoothstep(0.85, 1.0, lat));

  // Coastal sand at very low elevation
  const coastT = 1 - smoothstep(0.0, 0.03, elNorm);
  base = lerp3(base, COASTAL_SAND, coastT * 0.6);

  // Mountain brown at high elevation
  const mtT = smoothstep(0.4, 0.7, elNorm);
  base = lerp3(base, MOUNTAIN, mtT);

  // Snow peaks at very high elevation (more at high latitudes)
  const snowThresh = 0.7 - lat * 0.3;
  const snowT = smoothstep(snowThresh, snowThresh + 0.15, elNorm);
  base = lerp3(base, SNOW_PEAK, snowT);

  return base;
}

function applyPlanetMaterials(gltfScene, THREE) {
  gltfScene.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || "").toLowerCase();

    if (name.includes("continent") || name.includes("planet")) {
      // Apply vertex colours from position-based biome logic
      const geo = child.geometry;
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const c = biomeColor(px, py, pz);
        colors[i * 3] = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      child.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.0,
      });
    } else if (name.includes("cloud")) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    } else if (name.includes("atmosphere") || name.includes("atmo")) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0x88bbff,
        transparent: true,
        opacity: 0.12,
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.BackSide,
        depthWrite: false,
      });
    } else if (name.includes("city") || name.includes("light")) {
      child.material = new THREE.MeshBasicMaterial({
        color: 0xffce60,
      });
    }
  });
}

/* ── Scene builder ─────────────────────────────────────── */

function buildScene(canvas, THREE, GLTFLoader, DRACOLoader, OrbitControls) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 2, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    controls.autoRotate = false;
  }

  // Directional sun light
  const sun = new THREE.DirectionalLight(0xfff4e0, 2);
  sun.position.set(-8, -1, 4);
  scene.add(sun);

  // Soft ambient fill so night side isn't pure black
  const ambient = new THREE.AmbientLight(0x223355, 0.3);
  scene.add(ambient);

  // Dim fill light opposite the sun so landmasses are faintly visible at night
  const nightFill = new THREE.DirectionalLight(0x334466, 0.5);
  nightFill.position.set(8, 1, -4);
  scene.add(nightFill);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: "js" });

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  let animId = null;
  let disposed = false;

  const loadPromise = new Promise((resolve, reject) => {
    gltfLoader.load(
      "./assets/planet.glb",
      (gltf) => {
        // Remove GLB lights/cameras — we use our own
        const toRemove = [];
        gltf.scene.traverse((child) => {
          if (child.isLight || child.isCamera) toRemove.push(child);
        });
        toRemove.forEach((obj) => obj.removeFromParent());

        applyPlanetMaterials(gltf.scene, THREE);
        scene.add(gltf.scene);
        resolve();
      },
      undefined,
      reject,
    );
  });

  function resize() {
    const el = canvas.parentElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height, 420);
    renderer.setSize(size, size);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (disposed) return;
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    disposed = true;
    if (animId != null) cancelAnimationFrame(animId);
    controls.dispose();
    renderer.dispose();
    dracoLoader.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  return { loadPromise, resize, animate, dispose };
}

export function showSplashOverlay() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "splash-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "WorldSmith splash screen");
    overlay.innerHTML = `
      <div class="splash__content">
        <canvas class="splash__canvas"></canvas>
        <h1 class="splash__title">WorldSmith</h1>
        <div class="splash__loading">Loading planet\u2026</div>
        <button class="splash__enter primary" hidden>Enter WorldSmith</button>
      </div>
    `;

    const canvas = overlay.querySelector(".splash__canvas");
    const loadingEl = overlay.querySelector(".splash__loading");
    const enterBtn = overlay.querySelector(".splash__enter");

    document.body.appendChild(overlay);

    let sceneHandle = null;
    let cleaned = false;

    function dismiss() {
      if (cleaned) return;
      overlay.classList.add("splash--dismissing");
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (sceneHandle) sceneHandle.dispose();
        window.removeEventListener("resize", onResize);
        overlay.remove();
        resolve();
      };
      overlay.addEventListener("transitionend", cleanup, { once: true });
      setTimeout(cleanup, 600);
    }

    function onResize() {
      if (sceneHandle) sceneHandle.resize();
    }

    enterBtn.addEventListener("click", dismiss);
    window.addEventListener("resize", onResize);

    loadThreeDeps()
      .then(([THREE, gltfMod, dracoMod, orbitMod]) => {
        if (cleaned) return;
        sceneHandle = buildScene(
          canvas,
          THREE,
          gltfMod.GLTFLoader,
          dracoMod.DRACOLoader,
          orbitMod.OrbitControls,
        );
        sceneHandle.resize();
        sceneHandle.animate();
        return sceneHandle.loadPromise;
      })
      .then(() => {
        if (cleaned) return;
        loadingEl.style.display = "none";
        enterBtn.hidden = false;
      })
      .catch((err) => {
        console.error("[WorldSmith] Splash 3D load failed:", err);
        loadingEl.textContent = "3D preview unavailable";
        enterBtn.hidden = false;
      });
  });
}
