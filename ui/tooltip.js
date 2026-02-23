// Lightweight hover tooltips (event-delegated).
// Works for dynamically rendered content (e.g., KPI grids updated via innerHTML).
//
// Usage:
// - Render an icon/span with data-tip="..."
// - Call attachTooltips(root) once for the page root.

let activeEl = null;
let activeBubble = null;
let hideTimer = null;

export function tipIcon(text) {
  if (!text) return "";
  const safe = escapeAttr(text);
  return `<span class="tip-icon" tabindex="0" role="note" aria-label="Info" data-tip="${safe}">i</span>`;
}

export function attachTooltips(root) {
  if (!root || root.__tooltipsAttached) return;
  root.__tooltipsAttached = true;

  root.addEventListener("mouseover", (e) => {
    const el = closestTipEl(e.target);
    if (!el) return;
    // Ignore transitions within the same tip element
    if (activeEl === el) return;
    show(el);
  });

  root.addEventListener("mouseout", (e) => {
    const from = closestTipEl(e.target);
    const to = closestTipEl(e.relatedTarget);
    if (from && from !== to) scheduleHide();
  });

  root.addEventListener("focusin", (e) => {
    const el = closestTipEl(e.target);
    if (el) show(el);
  });

  root.addEventListener("focusout", (e) => {
    const from = closestTipEl(e.target);
    const to = closestTipEl(e.relatedTarget);
    if (from && from !== to) scheduleHide();
  });
}

function closestTipEl(node) {
  if (!node) return null;
  if (node.closest) return node.closest("[data-tip]");
  // very old browsers fallback
  return null;
}

function show(el) {
  clearTimeout(hideTimer);
  hideTimer = null;

  const text = el.getAttribute("data-tip");
  if (!text) return;

  if (activeBubble && activeEl === el) return;

  destroy();

  activeEl = el;
  activeBubble = document.createElement("div");
  activeBubble.className = "tooltip-bubble";
  // data-tip is HTML-escaped; decode entities by leveraging DOM
  activeBubble.textContent = unescapeAttr(text);
  document.body.appendChild(activeBubble);

  positionBubble();
  window.addEventListener("scroll", positionBubble, true);
  window.addEventListener("resize", positionBubble, true);
}

function positionBubble() {
  if (!activeEl || !activeBubble) return;

  const rect = activeEl.getBoundingClientRect();
  const bubble = activeBubble;

  const padding = 10;
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;

  // Prefer right side
  let x = rect.right + padding;
  let y = rect.top + rect.height / 2 - bh / 2;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (x + bw > vw - padding) x = rect.left - padding - bw;
  if (x < padding) x = padding;

  if (y + bh > vh - padding) y = vh - padding - bh;
  if (y < padding) y = padding;

  bubble.style.left = `${Math.round(x)}px`;
  bubble.style.top = `${Math.round(y)}px`;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => destroy(), 180);
}

function destroy() {
  if (activeBubble) {
    activeBubble.remove();
    activeBubble = null;
  }
  activeEl = null;
  window.removeEventListener("scroll", positionBubble, true);
  window.removeEventListener("resize", positionBubble, true);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeAttr(s) {
  // Convert a small set of entities back for display
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
