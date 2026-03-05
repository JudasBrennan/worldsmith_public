/**
 * Lessons page — progressive curriculum teaching the scientific concepts
 * behind every WorldSmith calculator.
 *
 * Architecture mirrors sciencePage.js: lazy KaTeX, collapsible accordion,
 * TOC with unit groupings, and embedded mini-calculators.  A global
 * Basic / Advanced toggle switches every lesson between plain-language
 * explainers and equation-level deep-dives.
 */

import { CURRICULUM } from "./lessons/curriculum.js";

/* ── KaTeX lazy loader (shared pattern with sciencePage) ────── */

let katexPromise = null;

function loadKaTeX() {
  if (window.katex) return Promise.resolve();
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    link.integrity = "sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    script.integrity = "sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return katexPromise;
}

function renderAllMath(root) {
  if (!window.katex) return;
  root.querySelectorAll(".sci-math").forEach((el) => {
    const tex = el.textContent;
    const displayMode = el.classList.contains("sci-math--block");
    try {
      window.katex.render(tex, el, { throwOnError: false, displayMode });
    } catch {
      /* leave raw LaTeX as fallback */
    }
  });
}

/* ── Persistence ──────────────────────────────────────────────── */

const MODE_KEY = "worldsmith.lessons.mode";

function savedMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "advanced") return "advanced";
  } catch {
    /* ignore */
  }
  return "basic";
}

function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/* ── HTML builders ────────────────────────────────────────────── */

function buildToc() {
  return CURRICULUM.map(
    (u) => `
    <div class="les-toc__unit">
      <div class="les-toc__unit-title">${u.unit}</div>
      <div class="les-toc__links">
        ${u.lessons.map((l) => `<a class="les-toc__link" data-target="${l.id}">${l.num}. ${l.title}</a>`).join("")}
      </div>
    </div>`,
  ).join("");
}

function buildSections() {
  return CURRICULUM.map(
    (u) =>
      `<div class="les-unit-divider">${u.unit}</div>` +
      u.lessons
        .map(
          (l) => `
      <details class="les-section" id="les-${l.id}">
        <summary class="les-section__summary">
          <span class="les-section__number">${l.num}</span>
          <span class="les-section__title">${l.title}</span>
          <span class="les-section__meta">${l.subtitle}</span>
        </summary>
        <div class="les-section__body" data-lesson="${l.id}"></div>
      </details>`,
        )
        .join(""),
  ).join("");
}

/* ── Page init ────────────────────────────────────────────────── */

export function initLessonsPage(mountEl) {
  let mode = savedMode();

  const wrap = document.createElement("div");
  wrap.className = "page";

  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title">
          <span class="ws-icon icon--lessons" aria-hidden="true"></span>
          <span>Lessons</span>
        </h1>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="physics-duo-toggle les-mode-toggle" id="lessonModeToggle">
            <input type="radio" name="lessonMode" id="lesModeBasic" value="basic" ${mode !== "advanced" ? "checked" : ""} />
            <label for="lesModeBasic">Basic</label>
            <input type="radio" name="lessonMode" id="lesModeAdvanced" value="advanced" ${mode === "advanced" ? "checked" : ""} />
            <label for="lesModeAdvanced">Advanced</label>
            <span></span>
          </div>
          <div class="badge">Educational</div>
        </div>
      </div>
      <div class="panel__body">
        <p style="color:var(--muted);font-size:13px;margin:0 0 4px">
          A progressive curriculum covering every scientific concept in WorldSmith.
          Work through the units in order, or jump to any topic.
        </p>
        ${buildToc()}
      </div>
    </div>

    <div class="les-sections">${buildSections()}</div>
  `;

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);

  /* ── Lookup helpers ──────────────────────────────────────── */

  const allLessons = CURRICULUM.flatMap((u) => u.lessons);
  const lessonById = Object.fromEntries(allLessons.map((l) => [l.id, l]));

  function renderLesson(id) {
    const lesson = lessonById[id];
    if (!lesson) return;
    const body = wrap.querySelector(`.les-section__body[data-lesson="${id}"]`);
    if (!body) return;
    body.innerHTML = lesson.build(mode);
    if (mode === "advanced") {
      loadKaTeX().then(() => renderAllMath(body));
    }
    if (lesson.wire) lesson.wire(body);
  }

  /* ── Accordion (one open at a time) ─────────────────────── */

  const sections = wrap.querySelectorAll(".les-section");

  sections.forEach((det) => {
    det.addEventListener("toggle", () => {
      if (!det.open) return;
      // Close other sections
      sections.forEach((other) => {
        if (other !== det && other.open) other.open = false;
      });
      // Render content on first open (or re-render after mode change)
      const id = det.id.replace("les-", "");
      renderLesson(id);
      // Scroll into view
      det.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ── TOC links ──────────────────────────────────────────── */

  wrap.querySelectorAll(".les-toc__link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.target;
      const det = wrap.querySelector(`#les-${target}`);
      if (det) {
        det.open = true;
        // toggle event handles rendering and scrolling
      }
    });
  });

  /* ── Mode toggle ────────────────────────────────────────── */

  wrap.querySelector("#lessonModeToggle").addEventListener("change", (e) => {
    mode = e.target.value;
    saveMode(mode);
    // Re-render the currently open section
    const openSection = wrap.querySelector(".les-section[open]");
    if (openSection) {
      const id = openSection.id.replace("les-", "");
      renderLesson(id);
    }
  });
}
