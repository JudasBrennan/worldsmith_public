import { access, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, "Backup");
const BACKUP_PREFIX = "worldsmith-live-";
const BACKUP_SUFFIX = ".zip";
const MAX_BACKUPS = 3;

// Files/folders required to run the live static product.
const LIVE_PATHS = ["index.html", "app.js", "styles.css", "favicon.svg", "assets", "engine", "ui"];

function stamp() {
  // YYYYMMDD-HHMMSS
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function ensureLivePathsExist() {
  const missing = [];
  for (const rel of LIVE_PATHS) {
    const abs = path.join(ROOT, rel);
    try {
      await access(abs);
    } catch {
      missing.push(rel);
    }
  }
  if (missing.length) {
    throw new Error(`Missing required live path(s): ${missing.join(", ")}`);
  }
}

function runPowershellZip(destinationZip) {
  const psCommand =
    "$ErrorActionPreference='Stop'; " +
    `$paths=@(${LIVE_PATHS.map((p) => `'${p.replace(/'/g, "''")}'`).join(",")}); ` +
    `Compress-Archive -Path $paths -DestinationPath '${destinationZip.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`;

  const proc = spawnSync(
    "powershell",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  return proc;
}

async function pruneOldBackups() {
  const entries = await readdir(BACKUP_DIR, { withFileTypes: true });
  const zips = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(BACKUP_PREFIX) &&
        entry.name.endsWith(BACKUP_SUFFIX),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse(); // newest first because timestamp is lexicographically sortable

  const toDelete = zips.slice(MAX_BACKUPS);
  for (const name of toDelete) {
    await rm(path.join(BACKUP_DIR, name), { force: true });
  }
  return { kept: zips.length - toDelete.length, removed: toDelete.length };
}

async function main() {
  await ensureLivePathsExist();
  await mkdir(BACKUP_DIR, { recursive: true });

  const zipName = `${BACKUP_PREFIX}${stamp()}${BACKUP_SUFFIX}`;
  const zipPath = path.join(BACKUP_DIR, zipName);

  const ps = runPowershellZip(zipPath);
  if (ps.status !== 0) {
    const details = [ps.stdout, ps.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `Backup zip creation failed via Compress-Archive.${details ? `\n${details}` : ""}`,
    );
  }

  const prune = await pruneOldBackups();
  console.log(`Created backup: ${path.relative(ROOT, zipPath)}`);
  console.log(`Included paths: ${LIVE_PATHS.join(", ")}`);
  console.log(`Backups kept: ${prune.kept} (removed ${prune.removed} old backup(s))`);
}

main().catch((err) => {
  console.error(`backup:live failed: ${err?.message || err}`);
  process.exitCode = 1;
});
