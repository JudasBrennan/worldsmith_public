// SPDX-License-Identifier: MPL-2.0
const DB_NAME = "worldsmith-world-storage";
const DB_VERSION = 1;
const META_STORE = "meta";
const BACKUPS_STORE = "backups";
const CURRENT_WORLD_META_KEY = "current-world-raw";

const LEGACY_PRIMARY_KEY = "worldsmith.world.v1";
const LEGACY_FALLBACK_KEY = "worldsmith.world";
const LEGACY_BACKUPS_INDEX_KEY = "worldsmith.world.backups";
const LEGACY_BACKUP_PREFIX = "worldsmith.world.backup.";

const STORAGE_DRIVER_KEY = "worldsmith.storage.driver";
const STORAGE_HAS_WORLD_KEY = "worldsmith.storage.hasWorld";
const STORAGE_MIGRATED_KEY = "worldsmith.storage.migrated.v1";
const STORAGE_LAST_SAVED_KEY = "worldsmith.storage.lastSavedUtc";

const SAVE_DEBOUNCE_MS = 180;

let dbPromise = null;
let storageReadyPromise = null;
let persistenceQueue = Promise.resolve();
let pendingWorldRaw = null;
let pendingWorldTimer = null;
let lifecycleFlushHandlersInstalled = false;
let lastLifecycleFlushPromise = Promise.resolve();

let currentRawCache = null;
let currentSourceKey = null;
let backupsIndexCache = [];
let backupRawByIdCache = new Map();
let storageDriver = "memory";
let lastStorageError = null;

initializeStorage();

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function emitStorageError(message, cause = null) {
  lastStorageError = {
    message: String(message || "Storage error"),
    cause: cause == null ? null : String(cause),
    detectedAt: new Date().toISOString(),
  };
  try {
    window.dispatchEvent(
      new CustomEvent("worldsmith:storageError", {
        detail: { ...lastStorageError },
      }),
    );
  } catch {
    // Ignore event failures.
  }
}

function markDriver(driver) {
  storageDriver = driver;
  safeLocalStorageSet(STORAGE_DRIVER_KEY, driver);
}

function markHasWorld(hasWorld) {
  safeLocalStorageSet(STORAGE_HAS_WORLD_KEY, hasWorld ? "1" : "0");
  if (hasWorld) {
    safeLocalStorageSet(STORAGE_LAST_SAVED_KEY, new Date().toISOString());
  } else {
    safeLocalStorageRemove(STORAGE_LAST_SAVED_KEY);
  }
}

function readLegacyCurrentWorld() {
  const primary = safeLocalStorageGet(LEGACY_PRIMARY_KEY);
  if (primary) return { raw: primary, sourceKey: LEGACY_PRIMARY_KEY };
  const fallback = safeLocalStorageGet(LEGACY_FALLBACK_KEY);
  if (fallback) return { raw: fallback, sourceKey: LEGACY_FALLBACK_KEY };
  return { raw: null, sourceKey: null };
}

function readLegacyBackups() {
  const rawById = new Map();
  let index = [];
  try {
    const rawIndex = safeLocalStorageGet(LEGACY_BACKUPS_INDEX_KEY);
    const parsed = rawIndex ? JSON.parse(rawIndex) : [];
    if (Array.isArray(parsed)) {
      index = parsed
        .map((item) => {
          const id = String(item?.id || "").trim();
          const key = String(item?.key || `${LEGACY_BACKUP_PREFIX}${id}`).trim();
          const createdUtc = String(item?.createdUtc || "").trim() || new Date().toISOString();
          if (!id) return null;
          const raw = safeLocalStorageGet(key);
          if (!raw) return null;
          rawById.set(id, raw);
          return { id, createdUtc };
        })
        .filter(Boolean);
    }
  } catch {
    index = [];
  }

  if (index.length) {
    index.sort((a, b) => String(b.createdUtc).localeCompare(String(a.createdUtc)));
    return { index, rawById };
  }

  try {
    const discovered = [];
    if (typeof localStorage?.length === "number" && typeof localStorage?.key === "function") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(LEGACY_BACKUP_PREFIX)) continue;
        const raw = safeLocalStorageGet(key);
        if (!raw) continue;
        const id = key.slice(LEGACY_BACKUP_PREFIX.length);
        rawById.set(id, raw);
        discovered.push({ id, createdUtc: new Date().toISOString() });
      }
    }
    discovered.sort((a, b) => String(b.createdUtc).localeCompare(String(a.createdUtc)));
    return { index: discovered, rawById };
  } catch {
    return { index: [], rawById: new Map() };
  }
}

function bootstrapLegacyCaches() {
  const legacyWorld = readLegacyCurrentWorld();
  if (legacyWorld.raw) {
    currentRawCache = legacyWorld.raw;
    currentSourceKey = legacyWorld.sourceKey;
  }
  const legacyBackups = readLegacyBackups();
  backupsIndexCache = legacyBackups.index;
  backupRawByIdCache = legacyBackups.rawById;
  markHasWorld(!!currentRawCache);
  if (currentRawCache || backupsIndexCache.length) {
    markDriver("localStorage");
  }
}

function initializeStorage() {
  bootstrapLegacyCaches();
  installStorageLifecycleFlushHandlers();
  storageReadyPromise = bootstrapStorage();
}

function requestLifecycleFlush() {
  lastLifecycleFlushPromise = flushWorldStorage().catch(() => {});
  return lastLifecycleFlushPromise;
}

function handleStorageLifecyclePagehide() {
  void requestLifecycleFlush();
}

function handleStorageLifecycleVisibilityChange() {
  if (typeof document === "undefined") return;
  if (document.visibilityState !== "hidden") return;
  void requestLifecycleFlush();
}

function installStorageLifecycleFlushHandlers() {
  if (lifecycleFlushHandlersInstalled) return;

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", handleStorageLifecyclePagehide);
    window.addEventListener("beforeunload", handleStorageLifecyclePagehide);
  }

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", handleStorageLifecycleVisibilityChange);
  }

  lifecycleFlushHandlersInstalled = true;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
        db.createObjectStore(BACKUPS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      resolve(null);
    };
  });
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

async function readIndexedDbState(db) {
  if (!db) {
    return { currentRaw: null, backups: [] };
  }
  const metaTx = db.transaction(META_STORE, "readonly");
  const currentRecord = await requestToPromise(
    metaTx.objectStore(META_STORE).get(CURRENT_WORLD_META_KEY),
  ).catch(() => null);

  const backupsTx = db.transaction(BACKUPS_STORE, "readonly");
  const backupRecords = await requestToPromise(backupsTx.objectStore(BACKUPS_STORE).getAll()).catch(
    () => [],
  );

  const backups = (Array.isArray(backupRecords) ? backupRecords : [])
    .map((record) => ({
      id: String(record?.id || "").trim(),
      createdUtc: String(record?.createdUtc || "").trim() || new Date().toISOString(),
      raw: typeof record?.raw === "string" ? record.raw : null,
    }))
    .filter((record) => record.id && record.raw);

  backups.sort((a, b) => String(b.createdUtc).localeCompare(String(a.createdUtc)));

  return {
    currentRaw: typeof currentRecord?.value === "string" ? currentRecord.value : null,
    backups,
  };
}

function setBackupCaches(backups) {
  backupsIndexCache = backups.map(({ id, createdUtc }) => ({ id, createdUtc }));
  backupRawByIdCache = new Map(backups.map(({ id, raw }) => [id, raw]));
}

async function writeIndexedDbState(db, currentRaw, backups) {
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BACKUPS_STORE], "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));

    const metaStore = tx.objectStore(META_STORE);
    if (typeof currentRaw === "string" && currentRaw) {
      metaStore.put({ key: CURRENT_WORLD_META_KEY, value: currentRaw, savedAt: Date.now() });
    } else {
      metaStore.delete(CURRENT_WORLD_META_KEY);
    }

    const backupsStore = tx.objectStore(BACKUPS_STORE);
    backupsStore.clear();
    for (const backup of backups || []) {
      backupsStore.put({
        id: backup.id,
        createdUtc: backup.createdUtc,
        raw: backup.raw,
      });
    }
  });
}

async function writeIndexedDbCurrentRaw(db, currentRaw) {
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));

    const metaStore = tx.objectStore(META_STORE);
    if (typeof currentRaw === "string" && currentRaw) {
      metaStore.put({ key: CURRENT_WORLD_META_KEY, value: currentRaw, savedAt: Date.now() });
    } else {
      metaStore.delete(CURRENT_WORLD_META_KEY);
    }
  });
}

async function writeIndexedDbBackups(db, backups) {
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));

    const backupsStore = tx.objectStore(BACKUPS_STORE);
    backupsStore.clear();
    for (const backup of backups || []) {
      backupsStore.put({
        id: backup.id,
        createdUtc: backup.createdUtc,
        raw: backup.raw,
      });
    }
  });
}

async function applyIndexedDbBackupDelta(db, change = {}) {
  if (!db) return false;
  const upserts = Array.isArray(change?.upserts) ? change.upserts : [];
  const removedIds = Array.isArray(change?.removedIds) ? change.removedIds : [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));

    const backupsStore = tx.objectStore(BACKUPS_STORE);
    for (const id of removedIds) {
      const backupId = String(id || "").trim();
      if (backupId) backupsStore.delete(backupId);
    }
    for (const backup of upserts) {
      const id = String(backup?.id || "").trim();
      const createdUtc = String(backup?.createdUtc || "").trim();
      if (!id || typeof backup?.raw !== "string" || !backup.raw) continue;
      backupsStore.put({
        id,
        createdUtc: createdUtc || new Date().toISOString(),
        raw: backup.raw,
      });
    }
  });
}

function buildBackupRecordsFromCache() {
  return backupsIndexCache
    .map((backup) => ({
      id: backup.id,
      createdUtc: backup.createdUtc,
      raw: backupRawByIdCache.get(backup.id) || null,
    }))
    .filter((backup) => backup.id && backup.raw);
}

function buildLegacyBackupIndex(index = backupsIndexCache) {
  return index.map((backup) => ({
    id: backup.id,
    key: `${LEGACY_BACKUP_PREFIX}${backup.id}`,
    createdUtc: backup.createdUtc,
  }));
}

function removeLegacyPersistenceKeys() {
  safeLocalStorageRemove(LEGACY_PRIMARY_KEY);
  safeLocalStorageRemove(LEGACY_FALLBACK_KEY);
  safeLocalStorageRemove(LEGACY_BACKUPS_INDEX_KEY);
  try {
    if (typeof localStorage?.length === "number" && typeof localStorage?.key === "function") {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LEGACY_BACKUP_PREFIX)) toRemove.push(key);
      }
      for (const key of toRemove) {
        safeLocalStorageRemove(key);
      }
    }
  } catch {
    // Ignore cleanup failures.
  }
}

async function migrateLegacyStateToIndexedDb(db) {
  if (!db) return false;
  const legacyWorld = readLegacyCurrentWorld();
  const legacyBackups = readLegacyBackups();
  if (!legacyWorld.raw && !legacyBackups.index.length) {
    markDriver("indexeddb");
    markHasWorld(false);
    safeLocalStorageSet(STORAGE_MIGRATED_KEY, "1");
    return true;
  }

  const backupRecords = legacyBackups.index
    .map((backup) => ({
      id: backup.id,
      createdUtc: backup.createdUtc,
      raw: legacyBackups.rawById.get(backup.id) || null,
    }))
    .filter((backup) => backup.id && backup.raw);

  try {
    await writeIndexedDbState(db, legacyWorld.raw, backupRecords);
    currentRawCache = legacyWorld.raw;
    currentSourceKey = legacyWorld.raw ? "indexeddb" : null;
    setBackupCaches(backupRecords);
    removeLegacyPersistenceKeys();
    safeLocalStorageSet(STORAGE_MIGRATED_KEY, "1");
    markDriver("indexeddb");
    markHasWorld(!!currentRawCache);
    return true;
  } catch (error) {
    emitStorageError(
      "Could not migrate existing local WorldSmith data into IndexedDB.",
      error?.message,
    );
    markDriver("localStorage");
    return false;
  }
}

async function bootstrapStorage() {
  const db = await openDb();
  if (!db) {
    markDriver(currentRawCache || backupsIndexCache.length ? "localStorage" : "memory");
    return;
  }

  const idbState = await readIndexedDbState(db);
  if (idbState.currentRaw || idbState.backups.length) {
    currentRawCache = idbState.currentRaw ?? currentRawCache;
    currentSourceKey = idbState.currentRaw ? "indexeddb" : currentSourceKey;
    setBackupCaches(idbState.backups);
    markDriver("indexeddb");
    markHasWorld(!!currentRawCache);
    if (safeLocalStorageGet(STORAGE_MIGRATED_KEY) !== "1") {
      removeLegacyPersistenceKeys();
      safeLocalStorageSet(STORAGE_MIGRATED_KEY, "1");
    }
    return;
  }

  const migrated = await migrateLegacyStateToIndexedDb(db);
  if (migrated) return;

  markDriver(currentRawCache || backupsIndexCache.length ? "localStorage" : "memory");
}

async function deleteStorageDatabase() {
  if (typeof indexedDB === "undefined") return;
  await new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.deleteDatabase(DB_NAME);
    } catch {
      resolve();
      return;
    }
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function queuePersistence(job) {
  persistenceQueue = persistenceQueue.then(job, job);
  return persistenceQueue;
}

async function persistCurrentRaw(raw) {
  const db = await openDb();
  if (db) {
    try {
      await writeIndexedDbCurrentRaw(db, raw);
      currentSourceKey = raw ? "indexeddb" : null;
      markDriver("indexeddb");
      markHasWorld(!!raw);
      return "indexeddb";
    } catch (error) {
      emitStorageError(
        "IndexedDB could not save the current world. Falling back to local storage.",
        error?.message,
      );
    }
  }

  const savedPrimary = raw
    ? safeLocalStorageSet(LEGACY_PRIMARY_KEY, raw)
    : safeLocalStorageRemove(LEGACY_PRIMARY_KEY);
  const savedLegacy = raw
    ? safeLocalStorageSet(LEGACY_FALLBACK_KEY, raw)
    : safeLocalStorageRemove(LEGACY_FALLBACK_KEY);
  if (savedPrimary || savedLegacy) {
    currentSourceKey = raw ? LEGACY_PRIMARY_KEY : null;
    markDriver("localStorage");
    markHasWorld(!!raw);
    return "localStorage";
  }

  markDriver("memory");
  markHasWorld(!!raw);
  emitStorageError(
    "Storage quota exceeded or unavailable. Changes are only kept for this session.",
    null,
  );
  return "memory";
}

function scheduleCurrentRawPersist(raw, { immediate = false } = {}) {
  currentRawCache = typeof raw === "string" && raw ? raw : null;
  currentSourceKey = currentRawCache ? "memory-write" : null;
  markHasWorld(!!currentRawCache);
  pendingWorldRaw = currentRawCache;

  const flushJob = () => {
    const nextRaw = pendingWorldRaw;
    pendingWorldRaw = null;
    return queuePersistence(() => persistCurrentRaw(nextRaw));
  };

  if (pendingWorldTimer != null) {
    clearTimeout(pendingWorldTimer);
    pendingWorldTimer = null;
  }

  if (immediate) {
    return flushJob();
  }

  pendingWorldTimer = setTimeout(() => {
    pendingWorldTimer = null;
    flushJob();
  }, SAVE_DEBOUNCE_MS);
  return Promise.resolve(storageDriver);
}

function scheduleBackupPersist(change = null) {
  return queuePersistence(async () => {
    const db = await openDb();
    const backupRecords = buildBackupRecordsFromCache();
    const hasDelta =
      !!change &&
      (change.replaceAll === true ||
        (Array.isArray(change.upserts) && change.upserts.length > 0) ||
        (Array.isArray(change.removedIds) && change.removedIds.length > 0));
    if (db) {
      try {
        if (change?.replaceAll) {
          await writeIndexedDbBackups(db, backupRecords);
        } else if (hasDelta) {
          await applyIndexedDbBackupDelta(db, change);
        } else {
          await writeIndexedDbBackups(db, backupRecords);
        }
        markDriver("indexeddb");
        return "indexeddb";
      } catch (error) {
        emitStorageError("IndexedDB could not save backup history.", error?.message);
      }
    }

    const legacyIndex = buildLegacyBackupIndex();
    const wroteIndex = safeLocalStorageSet(LEGACY_BACKUPS_INDEX_KEY, JSON.stringify(legacyIndex));
    let wroteBackups = false;
    if (change?.replaceAll || !hasDelta) {
      for (const backup of backupRecords) {
        wroteBackups =
          safeLocalStorageSet(`${LEGACY_BACKUP_PREFIX}${backup.id}`, backup.raw) || wroteBackups;
      }
    } else {
      for (const backup of change.upserts || []) {
        const id = String(backup?.id || "").trim();
        if (!id || typeof backup?.raw !== "string" || !backup.raw) continue;
        wroteBackups =
          safeLocalStorageSet(`${LEGACY_BACKUP_PREFIX}${id}`, backup.raw) || wroteBackups;
      }
      for (const removedId of change.removedIds || []) {
        const id = String(removedId || "").trim();
        if (!id) continue;
        wroteBackups = safeLocalStorageRemove(`${LEGACY_BACKUP_PREFIX}${id}`) || wroteBackups;
      }
    }
    if (wroteIndex || wroteBackups) {
      markDriver("localStorage");
      return "localStorage";
    }
    return "memory";
  });
}

export function readStoredWorldRawSync() {
  if (pendingWorldRaw) {
    return { raw: pendingWorldRaw, sourceKey: "pending-write" };
  }
  if (currentRawCache) {
    return { raw: currentRawCache, sourceKey: currentSourceKey || "cache" };
  }
  const legacy = readLegacyCurrentWorld();
  if (legacy.raw) {
    return legacy;
  }
  return { raw: null, sourceKey: null };
}

export function hasStoredWorldDataSync() {
  if (pendingWorldRaw || currentRawCache) return true;
  if (safeLocalStorageGet(STORAGE_HAS_WORLD_KEY) === "1") return true;
  const legacy = readLegacyCurrentWorld();
  return !!legacy.raw;
}

export function hasAnyStoredDataSync() {
  if (pendingWorldRaw || currentRawCache || backupsIndexCache.length) return true;
  if (safeLocalStorageGet(STORAGE_HAS_WORLD_KEY) === "1") return true;
  const legacy = readLegacyCurrentWorld();
  if (legacy.raw) return true;
  return readLegacyBackups().index.length > 0;
}

export function listStoredBackupsSync() {
  return backupsIndexCache.slice();
}

export function readStoredBackupRawSync(id) {
  return backupRawByIdCache.get(String(id || "").trim()) || null;
}

export function getWorldStorageDriver() {
  return storageDriver;
}

export function getLastStorageError() {
  return lastStorageError ? { ...lastStorageError } : null;
}

export function clearLastStorageError() {
  const hadError = !!lastStorageError;
  lastStorageError = null;
  return hadError;
}

export function setStoredWorldRaw(raw, options = {}) {
  return scheduleCurrentRawPersist(raw, { immediate: options.immediate === true });
}

export async function waitForWorldStorageReady() {
  await storageReadyPromise;
}

export async function flushWorldStorage() {
  if (pendingWorldTimer != null) {
    clearTimeout(pendingWorldTimer);
    pendingWorldTimer = null;
    await scheduleCurrentRawPersist(pendingWorldRaw, { immediate: true });
  }
  await persistenceQueue;
}

function restoreCurrentWorldState(previousRaw, previousSourceKey) {
  if (!(typeof previousRaw === "string" && previousRaw)) {
    pendingWorldRaw = null;
    currentRawCache = null;
    currentSourceKey = null;
    markHasWorld(false);
    return;
  }

  currentRawCache = previousRaw;
  pendingWorldRaw = previousSourceKey === "pending-write" ? previousRaw : null;
  currentSourceKey =
    previousSourceKey === "pending-write" ? "memory-write" : previousSourceKey || "cache";
  markHasWorld(true);

  if (previousSourceKey === LEGACY_PRIMARY_KEY || previousSourceKey === LEGACY_FALLBACK_KEY) {
    safeLocalStorageSet(previousSourceKey, previousRaw);
  }
}

export async function clearStoredCurrentWorldData() {
  try {
    await storageReadyPromise;
  } catch {
    // Ignore bootstrap failures and still attempt a direct clear.
  }

  if (pendingWorldTimer != null) {
    clearTimeout(pendingWorldTimer);
    pendingWorldTimer = null;
  }

  try {
    await persistenceQueue;
  } catch {
    // Ignore earlier persistence failures so recovery can still proceed.
  }

  const legacy = readLegacyCurrentWorld();
  const previousRaw = pendingWorldRaw || currentRawCache || legacy.raw;
  const previousSourceKey =
    currentSourceKey || (pendingWorldRaw ? "pending-write" : legacy.sourceKey) || null;
  const hadWorld = !!previousRaw;

  pendingWorldRaw = null;
  currentRawCache = null;
  currentSourceKey = null;
  markHasWorld(false);
  safeLocalStorageRemove(LEGACY_PRIMARY_KEY);
  safeLocalStorageRemove(LEGACY_FALLBACK_KEY);

  const db = await openDb();
  if (db) {
    try {
      await writeIndexedDbCurrentRaw(db, null);
      markDriver("indexeddb");
      return { ok: true, hadWorld, driver: "indexeddb" };
    } catch (error) {
      restoreCurrentWorldState(previousRaw, previousSourceKey);
      emitStorageError(
        "Could not remove the unreadable saved world from browser storage.",
        error?.message,
      );
      return {
        ok: false,
        hadWorld,
        driver: storageDriver,
        error: error?.message || String(error),
      };
    }
  }

  markDriver(backupsIndexCache.length ? "localStorage" : "memory");
  return { ok: true, hadWorld, driver: storageDriver };
}

export async function __waitForLastStorageLifecycleFlushForTests() {
  await lastLifecycleFlushPromise;
}

export function createStoredBackup(maxKeep = 5) {
  const raw = pendingWorldRaw || currentRawCache || readLegacyCurrentWorld().raw;
  if (!raw) return null;

  const id = `b${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUtc = new Date().toISOString();
  const removedIds = [];
  backupsIndexCache.unshift({ id, createdUtc });
  backupRawByIdCache.set(id, raw);

  const keepCount = Math.max(1, Math.trunc(Number(maxKeep) || 1));
  for (const extra of backupsIndexCache.slice(keepCount)) {
    removedIds.push(extra.id);
    backupRawByIdCache.delete(extra.id);
    safeLocalStorageRemove(`${LEGACY_BACKUP_PREFIX}${extra.id}`);
  }
  backupsIndexCache = backupsIndexCache.slice(0, keepCount);

  scheduleBackupPersist({
    upserts: [{ id, createdUtc, raw }],
    removedIds,
  });
  return backupsIndexCache[0];
}

export function restoreStoredBackup(id) {
  const raw = readStoredBackupRawSync(id);
  if (!raw) return false;
  scheduleCurrentRawPersist(raw, { immediate: true });
  return true;
}

async function clearIndexedDbState() {
  const db = await openDb();
  if (!db) return;
  await writeIndexedDbState(db, null, []);
}

export function clearStoredWorldData() {
  const previousBackupCount = backupsIndexCache.length;
  const hadWorld = !!(pendingWorldRaw || currentRawCache || readLegacyCurrentWorld().raw);

  if (pendingWorldTimer != null) {
    clearTimeout(pendingWorldTimer);
    pendingWorldTimer = null;
  }
  pendingWorldRaw = null;
  currentRawCache = null;
  currentSourceKey = null;
  backupsIndexCache = [];
  backupRawByIdCache = new Map();
  markHasWorld(false);

  safeLocalStorageRemove(LEGACY_PRIMARY_KEY);
  safeLocalStorageRemove(LEGACY_FALLBACK_KEY);
  safeLocalStorageRemove(LEGACY_BACKUPS_INDEX_KEY);
  safeLocalStorageRemove(STORAGE_MIGRATED_KEY);

  try {
    if (typeof localStorage?.length === "number" && typeof localStorage?.key === "function") {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LEGACY_BACKUP_PREFIX)) toRemove.push(key);
      }
      for (const key of toRemove) {
        safeLocalStorageRemove(key);
      }
    }
  } catch {
    // Ignore iteration failures.
  }

  queuePersistence(clearIndexedDbState);
  return previousBackupCount + (hadWorld ? 1 : 0);
}

export async function __resetWorldStorageForTests(options = {}) {
  const { deleteDatabase = false, rebootstrap = true } = options;

  if (pendingWorldTimer != null) {
    clearTimeout(pendingWorldTimer);
    pendingWorldTimer = null;
  }
  pendingWorldRaw = null;

  try {
    await storageReadyPromise;
  } catch {
    // Ignore bootstrap failures during test resets.
  }

  try {
    await persistenceQueue;
  } catch {
    // Ignore queued write failures during test resets.
  }

  const db = dbPromise ? await dbPromise.catch(() => null) : null;
  if (db && typeof db.close === "function") {
    try {
      db.close();
    } catch {
      // Ignore close failures.
    }
  }

  dbPromise = null;
  storageReadyPromise = null;
  persistenceQueue = Promise.resolve();
  lastLifecycleFlushPromise = Promise.resolve();
  currentRawCache = null;
  currentSourceKey = null;
  backupsIndexCache = [];
  backupRawByIdCache = new Map();
  storageDriver = "memory";
  lastStorageError = null;
  markDriver("memory");
  markHasWorld(false);

  if (deleteDatabase) {
    await deleteStorageDatabase();
  }

  if (rebootstrap) {
    initializeStorage();
    await storageReadyPromise;
  }
}
