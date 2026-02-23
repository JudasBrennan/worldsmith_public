/**
 * Shared transition-bar drawing for the unified visualiser.
 */

/* ── Progress-bar constants ──────────────────────────────────── */

const BAR_WIDTH = 300;
const BAR_HEIGHT = 6;
const BAR_RADIUS = 3;
const BAR_BOTTOM_OFFSET = 40;

/**
 * Draw a transition progress bar at the bottom of the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W   canvas CSS width
 * @param {number} H   canvas CSS height
 * @param {number} progress  0‥1
 * @param {string} label     text shown above the bar
 */
export function drawTransitionBar(ctx, W, H, progress, label) {
  if (progress <= 0) return;

  /* Fade in over the first 10% of progress */
  const alpha = Math.min(1, progress / 0.1);

  const x = (W - BAR_WIDTH) / 2;
  const y = H - BAR_BOTTOM_OFFSET;

  ctx.save();
  ctx.globalAlpha = alpha;

  /* Label */
  ctx.font = "13px var(--font-body, sans-serif)";
  ctx.fillStyle = "rgba(200,220,255,0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, W / 2, y - 10);

  /* Track (background) */
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, x, y, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  /* Fill */
  const fillW = Math.max(BAR_HEIGHT, BAR_WIDTH * progress);
  ctx.fillStyle = "rgba(140,180,255,0.7)";
  roundRect(ctx, x, y, fillW, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  ctx.restore();
}

/** Draw a rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
