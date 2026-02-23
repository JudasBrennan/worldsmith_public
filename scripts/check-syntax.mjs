import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([".git", "node_modules", "assets"]);

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      out.push(full);
    }
  }

  return out;
}

function checkFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const proc = spawnSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (proc.status === 0) return null;
  return {
    file: rel,
    error: (proc.stderr || proc.stdout || "Unknown syntax error").trim(),
  };
}

const files = await walk(ROOT);
const failures = [];
for (const file of files) {
  const result = checkFile(file);
  if (result) failures.push(result);
}

if (failures.length > 0) {
  console.error(`Syntax check failed for ${failures.length} file(s):`);
  for (const failure of failures) {
    console.error(`\n- ${failure.file}\n${failure.error}`);
  }
  process.exit(1);
}

console.log(`Syntax check passed (${files.length} files).`);
