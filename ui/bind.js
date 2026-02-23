// Helper to bind a number input and a slider input together.
// For huge ranges, the slider uses a log scale automatically (unless forced).
//
// Usage:
//   bindNumberAndSlider({ numberEl, sliderEl, min, max, step });
//
// Notes:
// - number input is the "source of truth" for precision
// - slider provides quick adjustment
// - for log sliders, min must be > 0

export function bindNumberAndSlider({
  numberEl,
  sliderEl,
  min,
  max,
  step,
  mode = "auto",
  onChange,
}) {
  const span = max - min;
  const ratio = min > 0 ? max / min : Infinity;

  const useLog = mode === "log" || (mode === "auto" && (span > 5000 || ratio > 2000) && min > 0);

  if (useLog) {
    // Slider operates in [0..1000] space
    const S_MIN = 0;
    const S_MAX = 1000;

    sliderEl.min = String(S_MIN);
    sliderEl.max = String(S_MAX);
    sliderEl.step = "1";

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);

    function valueToSlider(v) {
      const lv = Math.log10(v);
      const t = (lv - logMin) / (logMax - logMin);
      return Math.round(S_MIN + t * (S_MAX - S_MIN));
    }

    function sliderToValue(s) {
      const t = (Number(s) - S_MIN) / (S_MAX - S_MIN);
      const lv = logMin + t * (logMax - logMin);
      return 10 ** lv;
    }

    function syncFromNumber() {
      const v = Number(numberEl.value);
      if (!Number.isFinite(v)) return;
      const clamped = Math.min(max, Math.max(min, v));
      sliderEl.value = String(valueToSlider(clamped));
      onChange?.(clamped);
    }

    function syncFromSlider() {
      const v = sliderToValue(sliderEl.value);
      // Round to nearest step for display, but snap to exact min/max at
      // slider extremes so the full range is always reachable.
      let vv = v;
      if (step && step > 0 && step < max - min) {
        vv = Math.round(v / step) * step;
      }
      if (Number(sliderEl.value) <= S_MIN) vv = min;
      else if (Number(sliderEl.value) >= S_MAX) vv = max;
      const clamped = Math.min(max, Math.max(min, vv));
      numberEl.value = String(clamped);
      onChange?.(clamped);
    }

    numberEl.addEventListener("input", syncFromNumber);
    sliderEl.addEventListener("input", syncFromSlider);

    // initial
    syncFromNumber();
    return { useLog: true, syncFromNumber, syncFromSlider };
  }

  // Linear slider
  sliderEl.min = String(min);
  sliderEl.max = String(max);
  sliderEl.step = String(step ?? "any");

  function syncFromNumber() {
    const v = Number(numberEl.value);
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(max, Math.max(min, v));
    sliderEl.value = String(clamped);
    onChange?.(clamped);
  }

  function syncFromSlider() {
    const v = Number(sliderEl.value);
    if (!Number.isFinite(v)) return;
    numberEl.value = String(v);
    onChange?.(v);
  }

  numberEl.addEventListener("input", syncFromNumber);
  sliderEl.addEventListener("input", syncFromSlider);

  // initial
  syncFromNumber();
  return { useLog: false, syncFromNumber, syncFromSlider };
}
