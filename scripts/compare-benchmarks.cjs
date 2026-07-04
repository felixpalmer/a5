// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Compares two benchmark runs produced by `BENCH_OUTPUT_FILE=<file> yarn bench`
// and exits non-zero if any benchmark regressed by more than the threshold.
//
// Usage: node scripts/compare-benchmarks.cjs <baseline.json> <current.json> [threshold%]
//
// Output is GitHub-flavored markdown for $GITHUB_STEP_SUMMARY: regressions
// and gains beyond the threshold are surfaced in their own tables at the top,
// with the full results in a collapsed <details> section below.

const fs = require('fs');

function formatMean(ms) {
  if (ms < 1e-3) return `${(ms * 1e6).toFixed(1)}ns`;
  if (ms < 1) return `${(ms * 1e3).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDelta(delta) {
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function renderTable(rows) {
  const lines = [];
  lines.push('| benchmark | baseline | current | change |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    lines.push(`| ${r.name} | ${r.baseline} | ${r.current} | ${r.change} |`);
  }
  return lines;
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

  // Full results in run order; regressions/gains collected for the top sections
  const rows = [];
  const regressions = [];
  const gains = [];
  let added = 0;

  for (let i = 0; i < current.length; i++) {
    const bench = current[i];
    const base = baselineByName.get(bench.name);
    if (!base) {
      added++;
      rows.push({name: bench.name, baseline: '—', current: formatMean(bench.mean), change: 'new'});
      continue;
    }
    baselineByName.delete(bench.name);
    const delta = (100 * (bench.mean - base.mean)) / base.mean;
    const row = {
      name: bench.name,
      baseline: formatMean(base.mean),
      current: formatMean(bench.mean),
      change: formatDelta(delta),
      delta
    };
    rows.push(row);
    if (delta > threshold) {
      regressions.push(row);
    } else if (delta < -threshold) {
      gains.push(row);
    }
  }

  const removed = [...baselineByName.values()];
  for (let i = 0; i < removed.length; i++) {
    rows.push({name: removed[i].name, baseline: formatMean(removed[i].mean), current: '—', change: 'removed'});
  }

  // Worst regression / biggest gain first
  regressions.sort((a, b) => b.delta - a.delta);
  gains.sort((a, b) => a.delta - b.delta);

  const lines = [];
  lines.push('## Benchmark comparison');
  lines.push('');

  if (regressions.length > 0) {
    lines.push(`### ❌ ${regressions.length} regression${regressions.length === 1 ? '' : 's'} above ${threshold}%`);
    lines.push('');
    lines.push(...renderTable(regressions.map(r => ({...r, change: `**${r.change}**`}))));
    lines.push('');
  } else {
    lines.push(`### ✅ No regressions above ${threshold}%`);
    lines.push('');
  }

  if (gains.length > 0) {
    lines.push(`### 🚀 ${gains.length} gain${gains.length === 1 ? '' : 's'} above ${threshold}%`);
    lines.push('');
    lines.push(...renderTable(gains.map(r => ({...r, change: `**${r.change}**`}))));
    lines.push('');
  }

  if (added > 0 || removed.length > 0) {
    lines.push(`_${added} benchmark(s) added, ${removed.length} removed (not compared)._`);
    lines.push('');
  }

  lines.push('<details>');
  lines.push(`<summary>All results (${rows.length} benchmarks)</summary>`);
  lines.push('');
  lines.push(...renderTable(rows));
  lines.push('');
  lines.push('</details>');

  console.log(lines.join('\n'));
  process.exit(regressions.length > 0 ? 1 : 0);
}

main();
