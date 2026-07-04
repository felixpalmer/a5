// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Compares two benchmark runs produced by `BENCH_OUTPUT_FILE=<file> yarn bench`
// and exits non-zero if any benchmark regressed by more than the threshold.
//
// Usage: node scripts/compare-benchmarks.cjs <baseline.json> <current.json> [threshold%]
//
// Output is a GitHub-flavored markdown table so it can be appended to
// $GITHUB_STEP_SUMMARY in CI.

const fs = require('fs');

function formatMean(ms) {
  if (ms < 1e-3) return `${(ms * 1e6).toFixed(1)}ns`;
  if (ms < 1) return `${(ms * 1e3).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function main() {
  const [baselinePath, currentPath, thresholdArg] = process.argv.slice(2);
  if (!baselinePath || !currentPath) {
    console.error('Usage: node scripts/compare-benchmarks.cjs <baseline.json> <current.json> [threshold%]');
    process.exit(2);
  }
  const threshold = Number(thresholdArg) || 15;

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).benchmarks;
  const current = JSON.parse(fs.readFileSync(currentPath, 'utf8')).benchmarks;

  const baselineByName = new Map();
  for (let i = 0; i < baseline.length; i++) {
    baselineByName.set(baseline[i].name, baseline[i]);
  }

  const regressions = [];
  const added = [];
  const lines = [];
  lines.push(`## Benchmark comparison (threshold ${threshold}%)`);
  lines.push('');
  lines.push('| benchmark | baseline | current | change |');
  lines.push('| --- | ---: | ---: | ---: |');

  for (let i = 0; i < current.length; i++) {
    const bench = current[i];
    const base = baselineByName.get(bench.name);
    if (!base) {
      added.push(bench.name);
      lines.push(`| ${bench.name} | — | ${formatMean(bench.mean)} | new |`);
      continue;
    }
    baselineByName.delete(bench.name);
    const delta = (100 * (bench.mean - base.mean)) / base.mean;
    const regressed = delta > threshold;
    if (regressed) {
      regressions.push({name: bench.name, delta});
    }
    const marker = regressed ? ' ❌' : delta < -threshold ? ' 🚀' : '';
    lines.push(
      `| ${bench.name} | ${formatMean(base.mean)} | ${formatMean(bench.mean)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%${marker} |`
    );
  }

  const removed = [...baselineByName.keys()];
  for (let i = 0; i < removed.length; i++) {
    lines.push(`| ${removed[i]} | ${formatMean(baselineByName.get(removed[i]).mean)} | — | removed |`);
  }

  lines.push('');
  if (regressions.length > 0) {
    lines.push(`### ❌ ${regressions.length} benchmark(s) regressed more than ${threshold}%`);
    for (let i = 0; i < regressions.length; i++) {
      lines.push(`- ${regressions[i].name}: +${regressions[i].delta.toFixed(1)}%`);
    }
  } else {
    lines.push(`### ✅ No regressions above ${threshold}%`);
  }
  if (added.length > 0 || removed.length > 0) {
    lines.push('');
    lines.push(`_${added.length} benchmark(s) added, ${removed.length} removed (not compared)._`);
  }

  console.log(lines.join('\n'));
  process.exit(regressions.length > 0 ? 1 : 0);
}

main();
