import { getKatexCssHref, importKatexModule } from "./runtimeDeps.js";

let katexPromise = null;

function ensureKatexStylesheet() {
  if (typeof document === "undefined") return;
  const href = getKatexCssHref();
  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
    (node) => node.href === href,
  );
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.worldsmithKatex = "true";
  document.head.appendChild(link);
}

export function loadKaTeX() {
  if (katexPromise) return katexPromise;
  katexPromise = Promise.resolve()
    .then(() => {
      ensureKatexStylesheet();
      return importKatexModule();
    })
    .then((mod) => mod?.default || mod)
    .catch((err) => {
      katexPromise = null;
      throw err;
    });
  return katexPromise;
}

export function renderAllMath(root, katex) {
  if (!root || !katex?.render) return;
  root.querySelectorAll(".sci-math").forEach((el) => {
    const tex = el.textContent;
    const displayMode = el.classList.contains("sci-math--block");
    try {
      katex.render(tex, el, { throwOnError: false, displayMode });
    } catch {
      /* leave raw LaTeX as fallback */
    }
  });
}
