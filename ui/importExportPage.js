import * as store from "./store.js";
import { isXlsxFile, importLegacyWorldsmithWorkbook } from "./legacyXlsxImport.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { createSolPresetEnvelope } from "./solPreset.js";
import { createRealmspacePresetEnvelope } from "./realmspacePreset.js";
import { createArrakisPresetEnvelope } from "./arrakisPreset.js";

const { exportEnvelope, validateEnvelope, importWorld, createBackup, listBackups, restoreBackup } =
  store;

const TIP_LABEL = {
  Export:
    "Export the full world model as JSON, including star, system, planets, moons, assignments, and settings.",
  Backups: "Automatic restore points created before imports are applied.",
  Import:
    "Validate and import a previously exported JSON world file or a WorldSmith 8.x XLSX workbook.",
  "Download JSON": "Download the current world as a JSON file.",
  "Copy to clipboard": "Copy the current export JSON to your clipboard.",
  "Refresh view": "Regenerate the export preview from current saved data.",
  "Clear saved data":
    "Remove all WorldSmith saved data from this browser, including backups. This cannot be undone.",
  "Validate import": "Check import JSON structure and show a pre-import summary.",
  "Replace current world": "Apply the validated import and replace the current saved world.",
  "Import Sol preset":
    "Load and import a built-in Sol preset (Mercury-Mars, Jupiter-Neptune, belts, and key moons).",
  "Import Realmspace preset":
    "Load a Forgotten Realms / Spelljammer preset (Anadia-Chandos, Coliar, Glyth, Selune, and Calendar of Harptos).",
  "Import Arrakis preset":
    "Load the Arrakis (Dune) preset: Canopus system with Seban, Menaris, Arrakis, Ven, gas giants Extaris and Revona, moons Krelln and Arvon, and Imperial Standard calendar.",
  "Import file": "Select either a JSON export file or a WorldSmith 8.x XLSX workbook.",
  "Import JSON text": "Paste JSON here for validation and import.",
  "Export JSON text": "Read-only JSON export preview.",
};
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function setStatus(el, msg, kind = "info") {
  if (!el) return;
  const normalizedKind = kind === "bad" ? "error" : kind;
  el.textContent = msg;
  el.dataset.kind = normalizedKind;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summariseWorld(w) {
  const star = w.star || {};
  const sys = w.system || {};
  const planets = w.planets?.byId
    ? Object.values(w.planets.byId)
    : w.planet && typeof w.planet === "object"
      ? [{ id: "legacy-p1", ...w.planet }]
      : [];
  const moons = w.moons?.byId
    ? Object.values(w.moons.byId)
    : w.moon && typeof w.moon === "object"
      ? [{ id: "legacy-m1", ...w.moon }]
      : [];
  const assigned = planets.filter((p) => p.slotIndex != null).length;
  const unassigned = planets.length - assigned;

  const starMass = Number(star.massMsol ?? star.mass);
  const starAge = Number(star.ageGyr ?? star.age);
  const spec = star.spectralClass || star.class || "";

  const gasList = Array.isArray(sys.gasGiants)
    ? sys.gasGiants
    : (sys.gasGiants?.order || []).map((id) => sys.gasGiants?.byId?.[id]).filter(Boolean);
  const gasAuList = gasList
    .map((g) => Number(g?.au ?? g?.semiMajorAxisAu))
    .filter((au) => Number.isFinite(au) && au > 0);
  const outermostGas = gasAuList.length ? Math.max(...gasAuList) : 0;

  const legacyDebris = Number(sys.debrisDiskOuterAu ?? sys.debrisOuterAu);
  const debrisList = Array.isArray(sys.debrisDisks)
    ? sys.debrisDisks
    : (sys.debrisDisks?.order || []).map((id) => sys.debrisDisks?.byId?.[id]).filter(Boolean);
  const debrisRanges = debrisList
    .map((d) => ({
      name: d?.name || "Debris disk",
      inner: Number(d?.innerAu ?? d?.inner),
      outer: Number(d?.outerAu ?? d?.outer),
    }))
    .filter((d) => Number.isFinite(d.inner) && Number.isFinite(d.outer))
    .map((d) => ({ ...d, inner: Math.min(d.inner, d.outer), outer: Math.max(d.inner, d.outer) }));
  if (!debrisRanges.length && Number.isFinite(legacyDebris)) {
    const legacyInner = Number(sys.debrisDiskInnerAu ?? sys.debrisInnerAu ?? legacyDebris);
    if (Number.isFinite(legacyInner)) {
      debrisRanges.push({
        name: "Debris disk",
        inner: Math.min(legacyInner, legacyDebris),
        outer: Math.max(legacyInner, legacyDebris),
      });
    }
  }

  return {
    spec,
    starMass: Number.isFinite(starMass) ? starMass : null,
    starAge: Number.isFinite(starAge) ? starAge : null,
    planets: planets.length,
    moons: moons.length,
    assigned,
    unassigned,
    gasCount: gasAuList.length || (Number.isFinite(outermostGas) ? 1 : 0),
    gas: Number.isFinite(outermostGas) ? outermostGas : null,
    debrisCount: debrisRanges.length,
    debrisRanges,
  };
}

function clearAllSavedDataSafe() {
  if (typeof store.clearAllSavedData === "function") {
    return store.clearAllSavedData();
  }
  // Fallback for mixed-cache deployments where app files are newer than store.js.
  try {
    const backupIdxRaw = localStorage.getItem("worldsmith.world.backups");
    const backupIdx = backupIdxRaw ? JSON.parse(backupIdxRaw) : [];
    for (const item of Array.isArray(backupIdx) ? backupIdx : []) {
      if (item?.key) localStorage.removeItem(item.key);
    }
    localStorage.removeItem("worldsmith.world.backups");
    localStorage.removeItem("worldsmith.world.v1");
    localStorage.removeItem("worldsmith.world");
    try {
      window.dispatchEvent(new CustomEvent("worldsmith:worldChanged"));
    } catch {}
    return true;
  } catch {
    return false;
  }
}

export function initImportExportPage(root) {
  let pendingImport = null; // { world, meta }

  root.innerHTML = `
    <div class="page">
      <div class="panel">
        <div class="panel__header">
          <h1 class="panel__title"><span class="ws-icon icon--import-export" aria-hidden="true"></span><span>Import/Export</span></h1>
          <div class="badge">Interactive tool</div>
        </div>
        <div class="panel__body">
          <div class="hint">Export your full world as JSON, or validate and import saved worlds. Imports replace current data after confirmation and automatic backup.</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel__header"><h2>Export ${tipIcon(TIP_LABEL["Export"] || "")}</h2></div>
          <div class="panel__body">
            <div class="hint">This exports <b>all</b> data (star, system, planets, moons, locks, slots, and settings).</div>
            <div style="height:10px"></div>

            <div class="io-actions">
              <button id="btn-download" type="button">Download JSON</button>
              <button id="btn-copy" type="button">Copy to clipboard</button>
              <button id="btn-refresh" type="button">Refresh view</button>
              <button id="btn-clear-data" type="button" class="danger">Clear saved data</button>
            </div>

            <div style="height:10px"></div>
            <textarea id="txt-json" class="io-textarea" spellcheck="false"></textarea>
            <div id="status-export" class="io-status" data-kind="info"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__header"><h2>Import & Backups</h2></div>
          <div class="panel__body">
            <div class="label">Backups ${tipIcon(TIP_LABEL["Backups"] || "")}</div>
            <div class="hint">A backup is created automatically before applying an import. If something goes wrong, restore one here.</div>
            <div style="height:10px"></div>
            <div id="backupList" class="io-backups"></div>
            <div style="height:14px"></div>

            <div class="label">Import ${tipIcon(TIP_LABEL["Import"] || "")}</div>
            <div class="hint">Choose a previously exported JSON file, a WorldSmith 8.x XLSX workbook, or paste JSON into the box below. You will see a summary before anything is replaced.</div>
            <div style="height:10px"></div>

            <div class="io-actions">
              <input id="file" type="file" accept="application/json,.json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
              <button id="btn-import" type="button">Validate import</button>
              <button id="btn-sol-preset" type="button">Import Sol preset</button>
              <button id="btn-realmspace-preset" type="button">Import Realmspace preset</button>
              <button id="btn-arrakis-preset" type="button">Import Arrakis preset</button>
            </div>

            <div style="height:10px"></div>

            <div id="importPreview" class="io-import-preview" style="display:none"></div>
            <div class="io-import-actions" id="importActions" style="display:none">
              <button id="btn-apply-import" type="button" class="btn-primary">Replace current world</button>
              <button id="btn-cancel-import" type="button">Cancel</button>
            </div>

            <div style="height:10px"></div>
            <textarea id="txt-import" class="io-textarea" spellcheck="false" placeholder="{ ... }"></textarea>
            <div id="status-import" class="io-status" data-kind="info"></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Notes</h2></div>
        <div class="panel__body">
          <ul class="bullets">
            <li>WorldSmith Web stores your data in your browser (local storage), not in cookies.</li>
            <li>If you clear site data, use a different browser, or use a different device, your data will not follow you unless you export and import.</li>
            <li>Imported files are validated and migrated to the latest format automatically where possible.</li>
            <li>XLSX imports identify Star/System/Planet/Moon tabs by sheet structure, so tab order changes and duplicated tab copies are supported.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const txtJson = root.querySelector("#txt-json");
  const txtImport = root.querySelector("#txt-import");
  const statusExport = root.querySelector("#status-export");
  const statusImport = root.querySelector("#status-import");
  const btnDownload = root.querySelector("#btn-download");
  const btnCopy = root.querySelector("#btn-copy");
  const btnRefresh = root.querySelector("#btn-refresh");
  const btnClearData = root.querySelector("#btn-clear-data");
  const btnImport = root.querySelector("#btn-import");
  const btnSolPreset = root.querySelector("#btn-sol-preset");
  const btnRealmspacePreset = root.querySelector("#btn-realmspace-preset");
  const btnArrakisPreset = root.querySelector("#btn-arrakis-preset");
  const fileInput = root.querySelector("#file");

  const backupListEl = root.querySelector("#backupList");
  const importPreviewEl = root.querySelector("#importPreview");
  const importActionsEl = root.querySelector("#importActions");
  const btnApplyImport = root.querySelector("#btn-apply-import");
  const btnCancelImport = root.querySelector("#btn-cancel-import");

  attachTooltips(root);
  btnDownload?.setAttribute("data-tip", TIP_LABEL["Download JSON"] || "");
  btnCopy?.setAttribute("data-tip", TIP_LABEL["Copy to clipboard"] || "");
  btnRefresh?.setAttribute("data-tip", TIP_LABEL["Refresh view"] || "");
  btnClearData?.setAttribute("data-tip", TIP_LABEL["Clear saved data"] || "");
  btnImport?.setAttribute("data-tip", TIP_LABEL["Validate import"] || "");
  btnSolPreset?.setAttribute("data-tip", TIP_LABEL["Import Sol preset"] || "");
  btnRealmspacePreset?.setAttribute("data-tip", TIP_LABEL["Import Realmspace preset"] || "");
  btnArrakisPreset?.setAttribute("data-tip", TIP_LABEL["Import Arrakis preset"] || "");
  btnApplyImport?.setAttribute("data-tip", TIP_LABEL["Replace current world"] || "");
  fileInput?.setAttribute("data-tip", TIP_LABEL["Import file"] || "");

  function refreshExportView() {
    const env = exportEnvelope();
    const str = JSON.stringify(env, null, 2);
    txtJson.value = str;
    setStatus(statusExport, `Ready. ${str.length.toLocaleString("en-GB")} characters.`, "ok");
  }

  function renderBackups() {
    if (!backupListEl) return;
    const items = listBackups();
    if (!items.length) {
      backupListEl.innerHTML = '<div class="hint">No backups yet.</div>';
      return;
    }
    backupListEl.innerHTML = items
      .map((b) => {
        const when = (b.createdUtc || "").replace("T", " ").replace("Z", " UTC");
        const safeWhen = escapeHtml(when);
        const safeId = escapeHtml(b.id);
        return `<div class="io-backup-row">
        <div class="io-backup-meta">
          <div class="io-backup-title">Backup</div>
          <div class="io-backup-sub">${safeWhen}</div>
        </div>
        <div class="io-backup-actions">
          <button type="button" data-restore="${safeId}">Restore</button>
        </div>
      </div>`;
      })
      .join("");

    backupListEl.querySelectorAll("button[data-restore]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-restore");
        const ok = restoreBackup(id);
        setStatus(
          statusImport,
          ok ? "Restored backup." : "Could not restore backup.",
          ok ? "ok" : "bad",
        );
        refreshExportView();
      });
    });
  }

  function showImportPreview(world) {
    pendingImport = { world, meta: summariseWorld(world) };
    if (!importPreviewEl || !importActionsEl) return;

    const m = pendingImport.meta;
    const safeSpec = escapeHtml(m.spec ? m.spec : "-");
    const safeDebris = m.debrisCount
      ? m.debrisRanges.map((d) => `${escapeHtml(d.name)}: ${d.inner}-${d.outer} AU`).join(" | ")
      : "-";
    importPreviewEl.style.display = "block";
    importActionsEl.style.display = "flex";

    importPreviewEl.innerHTML = `
      <div class="io-preview-grid">
        <div><strong>Star</strong></div>
        <div>${safeSpec}${m.starMass != null ? ` | ${m.starMass} Msol` : ""}${m.starAge != null ? ` | ${m.starAge} Gyr` : ""}</div>

        <div><strong>Planets</strong></div>
        <div>${m.planets} total (${m.assigned} assigned, ${m.unassigned} unassigned)</div>

        <div><strong>Moons</strong></div>
        <div>${m.moons} total</div>

        <div><strong>Gas giants</strong></div>
        <div>${m.gasCount} total${m.gas != null ? ` (outermost ${m.gas} AU)` : ""}</div>

        <div><strong>Debris disks</strong></div>
        <div>${safeDebris}</div>
      </div>
      <div class="hint" style="margin-top:8px">Import will replace your current saved world. A backup will be created automatically first.</div>
    `;
  }

  function hideImportPreview() {
    pendingImport = null;
    if (importPreviewEl) importPreviewEl.style.display = "none";
    if (importActionsEl) importActionsEl.style.display = "none";
    if (importPreviewEl) importPreviewEl.innerHTML = "";
  }

  async function parseImportText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      setStatus(statusImport, "No import JSON provided.", "bad");
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      setStatus(statusImport, `Invalid JSON: ${e?.message || e}`, "bad");
      return null;
    }
  }

  btnRefresh.addEventListener("click", refreshExportView);

  btnDownload.addEventListener("click", () => {
    const env = exportEnvelope();
    const json = JSON.stringify(env, null, 2);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mon = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ][now.getMonth()];
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${yyyy}${mon}${dd}_${hh}${mm}hrs`;
    downloadText(`worldsmith-export-${stamp}.json`, json);
    setStatus(statusExport, "Downloaded JSON.", "ok");
  });

  btnCopy.addEventListener("click", async () => {
    const ok = await copyText(txtJson.value || "");
    setStatus(
      statusExport,
      ok ? "Copied to clipboard." : "Could not copy (browser blocked clipboard).",
      ok ? "ok" : "bad",
    );
  });

  btnClearData?.addEventListener("click", () => {
    const shouldClear =
      typeof window?.confirm !== "function"
        ? true
        : window.confirm(
            "Clear all WorldSmith saved data from this browser, including backups?\nThis cannot be undone.",
          );
    if (!shouldClear) {
      setStatus(statusExport, "Clear saved data cancelled.", "info");
      return;
    }

    clearAllSavedDataSafe();
    hideImportPreview();
    txtImport.value = "";
    if (fileInput) fileInput.value = "";
    refreshExportView();
    renderBackups();
    setStatus(statusExport, "All saved WorldSmith data has been cleared.", "ok");
    setStatus(statusImport, "Saved data cleared.", "info");
  });

  // Validate import (file or text) and show preview
  btnImport.addEventListener("click", async () => {
    const data = await parseImportText(txtImport.value);
    if (!data) return;
    const v = validateEnvelope(data);
    if (!v.ok) {
      setStatus(statusImport, `Import failed:\n- ${v.errors.join("\n- ")}`, "bad");
      hideImportPreview();
      return;
    }
    setStatus(statusImport, "Validated. Review the summary and confirm to apply.", "ok");
    showImportPreview(v.world);
  });

  btnSolPreset.addEventListener("click", () => {
    const envelope = createSolPresetEnvelope();
    txtImport.value = JSON.stringify(envelope, null, 2);

    const v = validateEnvelope(envelope);
    if (!v.ok) {
      setStatus(statusImport, `Sol preset failed validation:\n- ${v.errors.join("\n- ")}`, "bad");
      hideImportPreview();
      return;
    }

    showImportPreview(v.world);
    const shouldApply =
      typeof window?.confirm !== "function"
        ? true
        : window.confirm(
            "Import Sol preset and replace the current world?\nA backup will be created automatically first.",
          );

    if (!shouldApply) {
      setStatus(
        statusImport,
        "Sol preset loaded. Review the summary and click Replace current world to apply.",
        "info",
      );
      return;
    }

    createBackup(5);
    importWorld(v.world);
    hideImportPreview();
    renderBackups();
    refreshExportView();
    setStatus(statusImport, "Sol preset imported (a backup was created first).", "ok");
  });

  btnRealmspacePreset.addEventListener("click", () => {
    const envelope = createRealmspacePresetEnvelope();
    txtImport.value = JSON.stringify(envelope, null, 2);

    const v = validateEnvelope(envelope);
    if (!v.ok) {
      setStatus(
        statusImport,
        `Realmspace preset failed validation:\n- ${v.errors.join("\n- ")}`,
        "bad",
      );
      hideImportPreview();
      return;
    }

    showImportPreview(v.world);
    const shouldApply =
      typeof window?.confirm !== "function"
        ? true
        : window.confirm(
            "Import Realmspace preset and replace the current world?\nA backup will be created automatically first.",
          );

    if (!shouldApply) {
      setStatus(
        statusImport,
        "Realmspace preset loaded. Review the summary and click Replace current world to apply.",
        "info",
      );
      return;
    }

    createBackup(5);
    importWorld(v.world);
    hideImportPreview();
    renderBackups();
    refreshExportView();
    setStatus(statusImport, "Realmspace preset imported (a backup was created first).", "ok");
  });

  btnArrakisPreset.addEventListener("click", () => {
    const envelope = createArrakisPresetEnvelope();
    txtImport.value = JSON.stringify(envelope, null, 2);

    const v = validateEnvelope(envelope);
    if (!v.ok) {
      setStatus(
        statusImport,
        `Arrakis preset failed validation:\n- ${v.errors.join("\n- ")}`,
        "bad",
      );
      hideImportPreview();
      return;
    }

    showImportPreview(v.world);
    const shouldApply =
      typeof window?.confirm !== "function"
        ? true
        : window.confirm(
            "Import Arrakis (Dune) preset and replace the current world?\nA backup will be created automatically first.",
          );

    if (!shouldApply) {
      setStatus(
        statusImport,
        "Arrakis preset loaded. Review the summary and click Replace current world to apply.",
        "info",
      );
      return;
    }

    createBackup(5);
    importWorld(v.world);
    hideImportPreview();
    renderBackups();
    refreshExportView();
    setStatus(statusImport, "Arrakis preset imported (a backup was created first).", "ok");
  });

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      if (isXlsxFile(f)) {
        const parsed = await importLegacyWorldsmithWorkbook(f);
        const v = validateEnvelope(parsed.world);
        if (!v.ok) {
          setStatus(statusImport, `Import failed:\n- ${v.errors.join("\n- ")}`, "bad");
          hideImportPreview();
          return;
        }

        txtImport.value = JSON.stringify({ world: parsed.world }, null, 2);
        const planetTabs = (parsed.summary.planetSheetNames || []).slice(0, 4).join(", ");
        const moonTabs = (parsed.summary.moonSheetNames || []).slice(0, 4).join(", ");
        const planetTabsSuffix = parsed.summary.planetSheetNames?.length > 4 ? ", ..." : "";
        const moonTabsSuffix = parsed.summary.moonSheetNames?.length > 4 ? ", ..." : "";
        setStatus(
          statusImport,
          `XLSX parsed (star: ${parsed.summary.starSheet || "?"}, system: ${parsed.summary.systemSheet || "?"}). Imported ${parsed.summary.planetSheetsImported} planet tab(s) [${planetTabs}${planetTabsSuffix}] and ${parsed.summary.moonSheetsImported} moon tab(s) [${moonTabs}${moonTabsSuffix}]. Review and confirm.`,
          "ok",
        );
        showImportPreview(v.world);
        return;
      }

      const text = await f.text();
      txtImport.value = text;
      // auto-validate
      const data = await parseImportText(text);
      if (!data) return;
      const v = validateEnvelope(data);
      if (!v.ok) {
        setStatus(statusImport, `Import failed:\n- ${v.errors.join("\n- ")}`, "bad");
        hideImportPreview();
        return;
      }
      setStatus(statusImport, "Validated. Review the summary and confirm to apply.", "ok");
      showImportPreview(v.world);
    } catch (e) {
      setStatus(statusImport, `Could not read file: ${e?.message || e}`, "bad");
      hideImportPreview();
    }
  });

  btnApplyImport.addEventListener("click", () => {
    if (!pendingImport?.world) return;
    createBackup(5);
    importWorld(pendingImport.world);
    hideImportPreview();
    renderBackups();
    refreshExportView();
    setStatus(statusImport, "Import applied (a backup was created first).", "ok");
  });

  btnCancelImport.addEventListener("click", () => {
    hideImportPreview();
    setStatus(statusImport, "Import cancelled.", "info");
  });

  refreshExportView();
  renderBackups();
  setStatus(statusImport, "");
}
