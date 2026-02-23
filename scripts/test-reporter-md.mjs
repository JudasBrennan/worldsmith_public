// Markdown test reporter — writes grouped results to test-results.md

const FILES = new Map(); // path → { pass, fail, tests[] }

function relative(abs) {
  return abs.replace(/.*[/\\]tests[/\\]/, "tests/").replace(/\\/g, "/");
}

export default async function* reporter(source) {
  for await (const event of source) {
    if ((event.type === "test:pass" || event.type === "test:fail") && event.data.nesting === 0) {
      const file = relative(event.data.file ?? "unknown");
      const entry = FILES.get(file) ?? { pass: 0, fail: 0, tests: [] };
      const passed = event.type === "test:pass";
      if (passed) entry.pass++;
      else entry.fail++;
      entry.tests.push({
        name: event.data.name,
        passed,
        duration: event.data.details?.duration_ms ?? 0,
        error: event.data.details?.error?.message ?? null,
      });
      FILES.set(file, entry);
    }
  }

  let totalPass = 0;
  let totalFail = 0;

  yield "# Test Results\n\n";

  for (const [file, info] of FILES) {
    totalPass += info.pass;
    totalFail += info.fail;
    const count = info.pass + info.fail;
    const status = info.fail > 0 ? `${info.fail} fail` : `${count} pass`;
    yield `## ${file} — ${status}\n\n`;

    for (const t of info.tests) {
      const icon = t.passed ? "\u2714" : "\u2718";
      const dur =
        t.duration < 1000 ? `${Math.round(t.duration)} ms` : `${(t.duration / 1000).toFixed(1)} s`;
      yield `- ${icon} ${t.name} (${dur})\n`;
      if (!t.passed && t.error) {
        yield "  ```\n";
        for (const line of t.error.split("\n").slice(0, 8)) {
          yield `  ${line}\n`;
        }
        yield "  ```\n";
      }
    }
    yield "\n";
  }

  const total = totalPass + totalFail;
  yield "---\n\n";
  yield `**${total} tests** across ${FILES.size} files — `;
  if (totalFail > 0) {
    yield `**${totalPass} pass, ${totalFail} fail**\n`;
  } else {
    yield `**all pass**\n`;
  }
}
