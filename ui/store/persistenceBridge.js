// SPDX-License-Identifier: MPL-2.0
import {
  __resetWorldStorageForTests,
  clearLastStorageError,
  clearStoredCurrentWorldData,
  clearStoredWorldData,
  createStoredBackup,
  flushWorldStorage,
  getLastStorageError,
  hasAnyStoredDataSync,
  hasStoredWorldDataSync,
  listStoredBackupsSync,
  readStoredWorldRawSync,
  restoreStoredBackup,
  setStoredWorldRaw,
  waitForWorldStorageReady,
} from "../worldStorage.js";

const WORLD_CHANGED_EVENT = "worldsmith:worldChanged";

let volatileWorldRaw = null;

function dispatchWorldChanged() {
  try {
    window.dispatchEvent(new CustomEvent(WORLD_CHANGED_EVENT));
  } catch {}
}

function clearLegacyWorldsmithLocalStorageKeys() {
  try {
    if (typeof localStorage?.length !== "number" || typeof localStorage?.key !== "function") return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && String(key).startsWith("worldsmith.")) toRemove.push(key);
    }
    for (const key of toRemove) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  } catch {}
}

export function hasSavedWorldInLocalStorage() {
  return hasStoredWorldDataSync();
}

export function hasAnySavedData() {
  return hasAnyStoredDataSync();
}

export function waitForStorageReady() {
  return waitForWorldStorageReady();
}

export function flushStorage() {
  return flushWorldStorage();
}

export function readWorldRaw() {
  const stored = readStoredWorldRawSync();
  if (stored.raw) return stored;
  if (volatileWorldRaw) return { raw: volatileWorldRaw, sourceKey: "memory" };
  return { raw: null, sourceKey: null };
}

export function saveWorldRaw(raw, options = {}) {
  volatileWorldRaw = raw;
  void setStoredWorldRaw(raw, { immediate: options.immediate === true });
  dispatchWorldChanged();
  return true;
}

export function getStorageError() {
  return getLastStorageError();
}

export function clearStorageError() {
  return clearLastStorageError();
}

export function listBackups() {
  return listStoredBackupsSync();
}

export function createBackup(maxKeep = 5) {
  return createStoredBackup(maxKeep);
}

export function restoreBackup(id) {
  const restored = restoreStoredBackup(id);
  if (!restored) return false;
  volatileWorldRaw = readStoredWorldRawSync().raw;
  dispatchWorldChanged();
  return true;
}

export function clearAllSavedData() {
  const removed = clearStoredWorldData();
  clearLegacyWorldsmithLocalStorageKeys();
  volatileWorldRaw = null;
  dispatchWorldChanged();
  return removed;
}

export async function clearCurrentSavedWorld() {
  const result = await clearStoredCurrentWorldData();
  if (result?.ok) {
    volatileWorldRaw = null;
    dispatchWorldChanged();
  }
  return result;
}

export async function resetStorePersistenceForTests(options = {}) {
  volatileWorldRaw = null;
  await __resetWorldStorageForTests(options);
}
