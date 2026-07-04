// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {writeFileSync} from 'node:fs';
import type {File, Task} from 'vitest';
import {BenchmarkReportsMap} from 'vitest/reporters';

type Row = {name: string; mean: number; hz: number; rme: number; samples: number};

function formatMean(ms: number): string {
  if (ms < 1e-3) return `${(ms * 1e6).toFixed(1)}ns`;
  if (ms < 1) return `${(ms * 1e3).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function collect(task: Task, path: string[], rows: Row[]): void {
  // Suites carry a stub result.benchmark (name/rank only) — real benchmarks
  // are marked with meta.benchmark
  const benchmark = (task as any).meta?.benchmark ? (task as any).result?.benchmark : undefined;
  if (benchmark) {
    // Drop suite segments the benchmark name already starts with,
    // e.g. 'polygonToCells > polygonToCells France' -> 'polygonToCells France'
    const segments = path.filter(segment => !task.name.startsWith(`${segment} `));
    rows.push({
      name: [...segments, task.name].join(' > '),
      mean: benchmark.mean,
      hz: benchmark.hz,
      rme: benchmark.rme,
      samples: benchmark.samples?.length ?? 0
    });
  }
  const children = (task as any).tasks as Task[] | undefined;
  if (children) {
    const childPath = task.type === 'suite' && task.name ? [...path, task.name] : path;
    for (let i = 0; i < children.length; i++) {
      collect(children[i], childPath, rows);
    }
  }
}

/**
 * The default benchmark reporter, but with the final relative summary
 * ("x.xx times faster than ...") replaced by a flat table of absolute mean
 * times. Relative rankings vary run to run and say nothing in isolation;
 * absolute times are directly comparable when diffing two versions of the
 * code.
 */
export default class MeanTimeReporter extends BenchmarkReportsMap.default {
  async reportBenchmarkSummary(files: File[]): Promise<void> {
    const rows: Row[] = [];
    const sorted = [...files].sort((a, b) => a.filepath.localeCompare(b.filepath));
    for (const file of sorted) {
      for (let i = 0; i < file.tasks.length; i++) {
        collect(file.tasks[i], [], rows);
      }
    }
    if (rows.length === 0) return;

    const nameWidth = Math.max(9, ...rows.map(r => r.name.length));
    const lines: string[] = [];
    lines.push('');
    lines.push(' BENCH  Mean times');
    lines.push('');
    lines.push(
      `  ${'benchmark'.padEnd(nameWidth)}  ${'mean'.padStart(10)}  ${'ops/s'.padStart(14)}  ${'rme'.padStart(8)}  ${'samples'.padStart(8)}`
    );
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hz = r.hz.toLocaleString('en-US', {maximumFractionDigits: 0});
      lines.push(
        `  ${r.name.padEnd(nameWidth)}  ${formatMean(r.mean).padStart(10)}  ${hz.padStart(14)}  ${`±${r.rme.toFixed(2)}%`.padStart(8)}  ${String(r.samples).padStart(8)}`
      );
    }
    lines.push('');
    this.ctx.logger.log(lines.join('\n'));

    // Machine-readable output for CI comparison (scripts/compare-benchmarks.cjs)
    const outputFile = process.env.BENCH_OUTPUT_FILE;
    if (outputFile) {
      writeFileSync(outputFile, JSON.stringify({benchmarks: rows}, null, 2));
      this.ctx.logger.log(`Benchmark results written to ${outputFile}\n`);
    }
  }
}
