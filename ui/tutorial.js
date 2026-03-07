// SPDX-License-Identifier: MPL-2.0
// Shared tutorial toast panel
//
// Each page supplies its own steps array and localStorage key.
// This module creates the panel, wires navigation, and persists
// the user's position across sessions.

/**
 * Create a tutorial toast panel and attach it to the DOM.
 *
 * @param {object}  opts
 * @param {Array<{title:string, body:string}>} opts.steps - Tutorial step data.
 * @param {string}  opts.storageKey  - localStorage key, e.g. "worldsmith.star.tutorial".
 * @param {Element} opts.container   - Element to append the panel to.
 * @param {Element} [opts.triggerBtn] - Optional button that toggles the panel.
 * @returns {{ show: Function, hide: Function, toggle: Function, destroy: Function }|null}
 */
export function createTutorial({ steps, storageKey, container, triggerBtn }) {
  if (!steps?.length || !container) return null;

  /* ── State ──────────────────────────────────────────────────── */

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        step: Math.max(0, Math.min(steps.length - 1, Number(raw.step) || 0)),
        open: !!raw.open,
      };
    } catch {
      return { step: 0, open: false };
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }

  const state = load();

  /* ── Panel DOM ──────────────────────────────────────────────── */

  const panel = document.createElement("div");
  panel.className = "ws-tutorial";
  panel.style.display = "none";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = [
    '<div class="ws-tutorial__header">',
    '  <span class="ws-tutorial__step-indicator"></span>',
    '  <button class="ws-tutorial__close" type="button" aria-label="Close">&times;</button>',
    "</div>",
    '<h3 class="ws-tutorial__title"></h3>',
    '<p class="ws-tutorial__body"></p>',
    '<div class="ws-tutorial__nav">',
    '  <button class="ws-tutorial__nav-btn ws-tutorial__prev" type="button">\u2190 Prev</button>',
    '  <button class="ws-tutorial__nav-btn ws-tutorial__next" type="button">Next \u2192</button>',
    "</div>",
  ].join("");

  container.appendChild(panel);

  const indicator = panel.querySelector(".ws-tutorial__step-indicator");
  const title = panel.querySelector(".ws-tutorial__title");
  const body = panel.querySelector(".ws-tutorial__body");
  const prevBtn = panel.querySelector(".ws-tutorial__prev");
  const nextBtn = panel.querySelector(".ws-tutorial__next");
  const closeBtn = panel.querySelector(".ws-tutorial__close");

  /* ── Render / Show / Hide ───────────────────────────────────── */

  function render() {
    const s = steps[state.step];
    if (!s) return;
    indicator.textContent = `${state.step + 1} of ${steps.length}`;
    title.textContent = s.title;
    body.textContent = s.body;
    prevBtn.disabled = state.step === 0;
    nextBtn.textContent = state.step === steps.length - 1 ? "Done" : "Next \u2192";
  }

  function show() {
    state.open = true;
    panel.style.display = "";
    panel.setAttribute("aria-hidden", "false");
    triggerBtn?.classList.add("is-active");
    render();
    save();
  }

  function hide() {
    state.open = false;
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    triggerBtn?.classList.remove("is-active");
    save();
  }

  function toggle() {
    if (state.open) hide();
    else show();
  }

  /* ── Events ─────────────────────────────────────────────────── */

  triggerBtn?.addEventListener("click", toggle);
  closeBtn.addEventListener("click", hide);

  prevBtn.addEventListener("click", () => {
    if (state.step > 0) {
      state.step--;
      render();
      save();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (state.step < steps.length - 1) {
      state.step++;
      render();
      save();
    } else {
      hide();
    }
  });

  function onEsc(e) {
    if (e.key === "Escape" && state.open) hide();
  }
  document.addEventListener("keydown", onEsc);

  /* ── Init ───────────────────────────────────────────────────── */

  render();
  if (state.open) show();

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    show,
    hide,
    toggle,
    destroy() {
      triggerBtn?.removeEventListener("click", toggle);
      document.removeEventListener("keydown", onEsc);
      panel.remove();
    },
  };
}
