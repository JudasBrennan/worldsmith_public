// Custom test reporter — groups results by file with a summary table.

const FILES = new Map(); // path → { pass, fail, duration, failures[] }
let totalDuration = 0;

function relative(abs) {
  return abs.replace(/.*[/\\]tests[/\\]/, "tests/").replace(/\\/g, "/");
}

export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type === "test:pass" && event.data.nesting === 0) {
      const file = relative(event.data.file ?? "unknown");
      const entry = FILES.get(file) ?? { pass: 0, fail: 0, duration: 0, failures: [] };
      entry.pass++;
      entry.duration += event.data.details?.duration_ms ?? 0;
      FILES.set(file, entry);
    }

    if (event.type === "test:fail" && event.data.nesting === 0) {
      const file = relative(event.data.file ?? "unknown");
      const entry = FILES.get(file) ?? { pass: 0, fail: 0, duration: 0, failures: [] };
      entry.fail++;
      entry.duration += event.data.details?.duration_ms ?? 0;
      entry.failures.push({
        name: event.data.name,
        error: event.data.details?.error?.message ?? "unknown error",
      });
      FILES.set(file, entry);
    }

    if (event.type === "test:diagnostic" && /^duration_ms/.test(event.data.message)) {
      totalDuration = parseFloat(event.data.message.split(" ")[1]) || 0;
    }
  }

  // ── File results ────────────────────────────────────────────────
  let totalPass = 0;
  let totalFail = 0;
  const maxLen = Math.max(...[...FILES.keys()].map((k) => k.length));

  yield "\n";
  for (const [file, info] of FILES) {
    totalPass += info.pass;
    totalFail += info.fail;
    const pad = " ".repeat(maxLen - file.length + 2);
    const count = info.pass + info.fail;
    const status =
      info.fail > 0 ? `\x1b[31m${info.fail} fail\x1b[0m` : `\x1b[32m${count} pass\x1b[0m`;
    const dur =
      info.duration < 1000
        ? `${Math.round(info.duration)} ms`
        : `${(info.duration / 1000).toFixed(1)} s`;
    yield `  ${file}${pad}${status}  ${dur}\n`;

    // Show individual failures indented
    for (const f of info.failures) {
      yield `    \x1b[31m✘ ${f.name}\x1b[0m\n`;
      for (const line of f.error.split("\n").slice(0, 6)) {
        yield `      ${line}\n`;
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  const total = totalPass + totalFail;
  const dur =
    totalDuration < 1000
      ? `${Math.round(totalDuration)} ms`
      : `${(totalDuration / 1000).toFixed(1)} s`;
  const failStr = totalFail > 0 ? `\x1b[31m${totalFail}\x1b[0m` : "0";

  yield "\n  ──────────────────────────────────────────\n";
  yield `  Files   ${FILES.size}      Tests  ${total}\n`;
  yield `  Pass    \x1b[32m${totalPass}\x1b[0m    Fail   ${failStr}\n`;
  yield `  Duration ${dur}\n`;
  yield "\n";

  if (totalFail > 0) {
    yield `\x1b[31m  ${totalFail} test${totalFail > 1 ? "s" : ""} failed.\x1b[0m\n\n`;
  }
}
