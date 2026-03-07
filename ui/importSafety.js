// SPDX-License-Identifier: MPL-2.0
export const JSON_TEXT_IMPORT_LIMIT_BYTES = 4 * 1024 * 1024;
export const JSON_FILE_IMPORT_LIMIT_BYTES = 4 * 1024 * 1024;
export const XLSX_FILE_IMPORT_LIMIT_BYTES = 12 * 1024 * 1024;
export const LARGE_IMPORT_WARNING_BYTES = 512 * 1024;

function safeBytes(value) {
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
}

export function formatBytes(bytes) {
  const value = safeBytes(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function getImportLimitForKind(kind) {
  if (kind === "xlsx") return XLSX_FILE_IMPORT_LIMIT_BYTES;
  return JSON_FILE_IMPORT_LIMIT_BYTES;
}

export function getImportLimitLabel(kind) {
  return formatBytes(getImportLimitForKind(kind));
}

export function assertImportFileWithinLimit(file, kind) {
  const limit = getImportLimitForKind(kind);
  const size = safeBytes(file?.size);
  if (size <= limit) return;
  throw new Error(
    `${String(file?.name || "Selected file")} is ${formatBytes(size)}. ` +
      `The ${kind === "xlsx" ? "XLSX" : "JSON"} import limit is ${formatBytes(limit)}.`,
  );
}

export function assertImportTextWithinLimit(text, sourceLabel = "Pasted JSON") {
  const size = safeBytes(new Blob([String(text || "")]).size);
  if (size <= JSON_TEXT_IMPORT_LIMIT_BYTES) return;
  throw new Error(
    `${sourceLabel} is ${formatBytes(size)}. ` +
      `The JSON import limit is ${formatBytes(JSON_TEXT_IMPORT_LIMIT_BYTES)}.`,
  );
}

export function isLargeImport(bytes) {
  return safeBytes(bytes) >= LARGE_IMPORT_WARNING_BYTES;
}

export function nextImportTurn() {
  return new Promise((resolve) => {
    const schedule =
      typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout.bind(window)
        : setTimeout;
    schedule(resolve, 0);
  });
}
