// SPDX-License-Identifier: MPL-2.0
const GIF_JS_URL = "./assets/vendor/gif.js";
const GIF_WORKER_URL = "./assets/vendor/gif.worker.js";

let gifJsLoadPromise = null;

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {}
  }, 0);
}

function loadScript(src, { integrity, crossOrigin } = {}) {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Document is not available."));
  }
  const scripts = Array.from(document.querySelectorAll("script"));
  const existing = scripts.find((node) => node.src === src);
  if (existing) {
    if (existing.dataset.worldsmithLoaded === "true") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const onLoad = () => {
        existing.dataset.worldsmithLoaded = "true";
        resolve();
      };
      const onError = () => reject(new Error(`Could not load script: ${src}`));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    if (integrity) script.integrity = integrity;
    if (crossOrigin) script.crossOrigin = crossOrigin;
    script.onload = () => {
      script.dataset.worldsmithLoaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureGifCtor() {
  const ctorNow = globalThis?.GIF;
  if (typeof ctorNow === "function") return ctorNow;

  if (!gifJsLoadPromise) {
    gifJsLoadPromise = loadScript(GIF_JS_URL).catch((error) => {
      gifJsLoadPromise = null;
      throw new Error(`Could not load local GIF encoder: ${error?.message || error}`);
    });
  }
  await gifJsLoadPromise;
  const ctor = globalThis?.GIF;
  if (typeof ctor !== "function") {
    throw new Error("Local GIF encoder did not initialize.");
  }
  return ctor;
}

export function makeTimestampToken(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    if (!canvas?.toBlob) {
      reject(new Error("Canvas export is unavailable in this browser."));
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not generate PNG image."));
          return;
        }
        downloadBlob(blob, filename || "worldsmith-visualiser.png");
        resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export async function captureCanvasGif({
  canvas,
  filename = "worldsmith-visualiser.gif",
  fps = 12,
  seconds = 4,
  quality = 10,
  renderFrame,
  onStatus,
}) {
  if (!canvas) {
    throw new Error("Canvas element is required for GIF capture.");
  }

  const frameRate = Math.max(1, Number(fps) || 12);
  const duration = Math.max(0.5, Number(seconds) || 4);
  const frameCount = Math.max(2, Math.round(frameRate * duration));
  const frameDelayMs = Math.max(16, Math.round(1000 / frameRate));

  if (typeof onStatus === "function") onStatus("loading");
  const GifCtor = await ensureGifCtor();

  const gif = new GifCtor({
    workers: 2,
    quality: Math.max(1, Math.min(30, Math.round(Number(quality) || 10))),
    workerScript: GIF_WORKER_URL,
    width: canvas.width,
    height: canvas.height,
  });

  if (typeof onStatus === "function") onStatus("recording");
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    if (typeof renderFrame === "function") {
      renderFrame({
        frameIndex,
        frameCount,
        deltaTimeSec: 1 / frameRate,
      });
    }
    gif.addFrame(canvas, { copy: true, delay: frameDelayMs });
  }

  if (typeof onStatus === "function") onStatus("encoding");
  const blob = await new Promise((resolve, reject) => {
    gif.on("finished", (finishedBlob) => {
      resolve(finishedBlob);
    });
    try {
      gif.render();
    } catch (err) {
      reject(err);
    }
  });

  downloadBlob(blob, filename);
  if (typeof onStatus === "function") onStatus("done");
  return blob;
}
