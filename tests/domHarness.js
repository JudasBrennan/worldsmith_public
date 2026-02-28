import { JSDOM } from "jsdom";
import { createCanvas as createNativeCanvas } from "@napi-rs/canvas";

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "HTMLElement",
  "Node",
  "Blob",
  "URL",
  "MutationObserver",
  "requestAnimationFrame",
  "cancelAnimationFrame",
];

function defineGlobal(key, value) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

export function installDomHarness({
  url = "http://localhost/#/calendar",
  html = "<!doctype html><html><body></body></html>",
} = {}) {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
  });

  const previousDescriptors = new Map();
  for (const key of GLOBAL_KEYS) {
    previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }

  defineGlobal("window", dom.window);
  defineGlobal("document", dom.window.document);
  defineGlobal("navigator", dom.window.navigator);
  defineGlobal("localStorage", dom.window.localStorage);
  defineGlobal("sessionStorage", dom.window.sessionStorage);
  defineGlobal("CustomEvent", dom.window.CustomEvent);
  defineGlobal("Event", dom.window.Event);
  defineGlobal("MouseEvent", dom.window.MouseEvent);
  defineGlobal("KeyboardEvent", dom.window.KeyboardEvent);
  defineGlobal("HTMLElement", dom.window.HTMLElement);
  defineGlobal("Node", dom.window.Node);
  defineGlobal("Blob", dom.window.Blob);
  defineGlobal("URL", dom.window.URL);
  defineGlobal("MutationObserver", dom.window.MutationObserver);
  defineGlobal(
    "requestAnimationFrame",
    dom.window.requestAnimationFrame?.bind(dom.window) ||
      ((cb) => setTimeout(() => cb(Date.now()), 0)),
  );
  defineGlobal(
    "cancelAnimationFrame",
    dom.window.cancelAnimationFrame?.bind(dom.window) || ((id) => clearTimeout(id)),
  );

  // Patch HTMLCanvasElement so getContext("2d") delegates to @napi-rs/canvas.
  const CanvasProto = dom.window.HTMLCanvasElement.prototype;
  const _origGetContext = CanvasProto.getContext;
  CanvasProto.getContext = function (type, attrs) {
    if (type === "2d") {
      if (!this.__nativeCtx) {
        const nc = createNativeCanvas(this.width || 1, this.height || 1);
        this.__nativeCtx = nc.getContext("2d", attrs);
      }
      return this.__nativeCtx;
    }
    return _origGetContext?.call(this, type, attrs) ?? null;
  };

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      media: "",
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!window.scrollTo) window.scrollTo = () => {};
  if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:test";
  if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
  if (!window.open) window.open = () => null;
  if (!window.prompt) window.prompt = () => "";
  if (!window.confirm) window.confirm = () => false;
  if (!navigator.clipboard) {
    navigator.clipboard = {
      writeText: async () => {},
    };
  }

  function cleanup() {
    dom.window.close();
    for (const key of GLOBAL_KEYS) {
      const descriptor = previousDescriptors.get(key);
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
  }

  return { dom, cleanup };
}
