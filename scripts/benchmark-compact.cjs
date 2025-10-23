// Performance benchmark for compact/uncompact implementations
// Run with: node scripts/benchmark-compact.cjs

const a5Test = require('./a5-test.cjs');
const { serialize, cellToChildren, WORLD_CELL, origins, compactNaive, uncompactNaive, compactOptimized, uncompactOptimized, compactForwardScan } = a5Test;

const naive = { compact: compactNaive, uncompact: uncompactNaive };
const optimized = { compact: compactOptimized, uncompact: uncompactOptimized };
const forwardScan = { compact: compactForwardScan };

function benchmark(name, fn, iterations) {
  // Warm up
  for (let i = 0; i < 10; i++) {
    fn();
  }

  // Actual benchmark
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();

  const totalMs = Number(end - start) / 1000000;
  return totalMs / iterations;
}

function formatTime(ms) {
  if (ms < 0.001) {
    return `${(ms * 1000000).toFixed(2)}ns`;
  } else if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`;
  } else {
    return `${ms.toFixed(2)}ms`;
  }
}

console.log('A5 Compact/Uncompact Performance Benchmarks');
console.log('='.repeat(80));
console.log('');

const results = [];

// Benchmark 1: Uncompact single cell from res 2 to res 5
console.log('1. Uncompact: Single cell res 2 → res 5 (64 children)');
const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
const naiveTime1 = benchmark('uncompact_res2_res5_naive', () => naive.uncompact([res2Cell], 5), 10000);
const optTime1 = benchmark('uncompact_res2_res5_opt', () => optimized.uncompact([res2Cell], 5), 10000);
results.push({ name: 'Uncompact res2→res5', naive: naiveTime1, optimized: optTime1, speedup: naiveTime1 / optTime1 });
console.log(`  Naive:     ${formatTime(naiveTime1)}`);
console.log(`  Optimized: ${formatTime(optTime1)}`);
console.log(`  Speedup:   ${(naiveTime1 / optTime1).toFixed(2)}x`);
console.log('');

// Benchmark 2: Uncompact multiple cells at different resolutions
console.log('2. Uncompact: 10 cells at mixed resolutions → res 6');
const mixedCells = [
  serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 }),
  serialize({ origin: origins[1], segment: 1, S: 1n, resolution: 3 }),
  serialize({ origin: origins[2], segment: 2, S: 5n, resolution: 4 }),
  serialize({ origin: origins[3], segment: 3, S: 10n, resolution: 5 }),
  serialize({ origin: origins[4], segment: 0, S: 2n, resolution: 3 }),
  serialize({ origin: origins[5], segment: 1, S: 8n, resolution: 4 }),
  serialize({ origin: origins[6], segment: 2, S: 1n, resolution: 2 }),
  serialize({ origin: origins[7], segment: 3, S: 15n, resolution: 5 }),
  serialize({ origin: origins[8], segment: 4, S: 12n, resolution: 4 }),
  serialize({ origin: origins[9], segment: 0, S: 3n, resolution: 3 })
];
const naiveTime2 = benchmark('uncompact_mixed_naive', () => naive.uncompact(mixedCells, 6), 1000);
const optTime2 = benchmark('uncompact_mixed_opt', () => optimized.uncompact(mixedCells, 6), 1000);
results.push({ name: 'Uncompact mixed→res6', naive: naiveTime2, optimized: optTime2, speedup: naiveTime2 / optTime2 });
console.log(`  Naive:     ${formatTime(naiveTime2)}`);
console.log(`  Optimized: ${formatTime(optTime2)}`);
console.log(`  Speedup:   ${(naiveTime2 / optTime2).toFixed(2)}x`);
console.log('');

// Benchmark 3: Compact 4 siblings to parent
console.log('3. Compact: 4 sibling cells → parent (res 3 → res 2)');
const parent = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
const children = cellToChildren(parent, 3);
const naiveTime3 = benchmark('compact_4_siblings_naive', () => naive.compact(children), 10000);
const optTime3 = benchmark('compact_4_siblings_opt', () => optimized.compact(children), 10000);
const fwdTime3 = benchmark('compact_4_siblings_fwd', () => forwardScan.compact(children), 10000);
results.push({ name: 'Compact 4 siblings', naive: naiveTime3, optimized: optTime3, forwardScan: fwdTime3, speedup: naiveTime3 / optTime3, fwdSpeedup: optTime3 / fwdTime3 });
console.log(`  Naive:       ${formatTime(naiveTime3)}`);
console.log(`  Optimized:   ${formatTime(optTime3)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime3)}`);
console.log(`  Speedup (naive→opt): ${(naiveTime3 / optTime3).toFixed(2)}x`);
console.log(`  Speedup (opt→fwd):   ${(optTime3 / fwdTime3).toFixed(2)}x`);
console.log('');

// Benchmark 4: Compact deeply nested cells
console.log('4. Compact: 64 cells → parent (res 5 → res 2, nested)');
const deepParent = serialize({ origin: origins[1], segment: 2, S: 3n, resolution: 2 });
const deepChildren = cellToChildren(deepParent, 5);
const naiveTime4 = benchmark('compact_64_nested_naive', () => naive.compact(deepChildren), 1000);
const optTime4 = benchmark('compact_64_nested_opt', () => optimized.compact(deepChildren), 1000);
const fwdTime4 = benchmark('compact_64_nested_fwd', () => forwardScan.compact(deepChildren), 1000);
results.push({ name: 'Compact 64 nested cells', naive: naiveTime4, optimized: optTime4, forwardScan: fwdTime4, speedup: naiveTime4 / optTime4, fwdSpeedup: optTime4 / fwdTime4 });
console.log(`  Naive:       ${formatTime(naiveTime4)}`);
console.log(`  Optimized:   ${formatTime(optTime4)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime4)}`);
console.log(`  Speedup (opt→fwd): ${(optTime4 / fwdTime4).toFixed(2)}x`);
console.log('');

// Benchmark 5: Compact all 12 res-0 cells to world cell
console.log('5. Compact: 12 res-0 cells → world cell');
const worldChildren = cellToChildren(WORLD_CELL, 0);
const naiveTime5 = benchmark('compact_world_naive', () => naive.compact(worldChildren), 10000);
const optTime5 = benchmark('compact_world_opt', () => optimized.compact(worldChildren), 10000);
results.push({ name: 'Compact to world cell', naive: naiveTime5, optimized: optTime5, speedup: naiveTime5 / optTime5 });
console.log(`  Naive:     ${formatTime(naiveTime5)}`);
console.log(`  Optimized: ${formatTime(optTime5)}`);
console.log(`  Speedup:   ${(naiveTime5 / optTime5).toFixed(2)}x`);
console.log('');

// Benchmark 6: Large mixed dataset
console.log('6. Compact: Large mixed dataset (100 cells at various resolutions)');
const largeMixed = [];
for (let i = 0; i < 100; i++) {
  const res = 2 + (i % 5);
  const origin = origins[i % 12];
  const segment = i % 5;
  const hilbertLevels = res - 2 + 1;
  const maxS = (1 << (2 * hilbertLevels)) - 1;
  const S = BigInt(i % maxS);
  largeMixed.push(serialize({ origin, segment, S, resolution: res }));
}
const naiveTime6 = benchmark('compact_100_mixed_naive', () => naive.compact(largeMixed), 100);
const optTime6 = benchmark('compact_100_mixed_opt', () => optimized.compact(largeMixed), 100);
const fwdTime6 = benchmark('compact_100_mixed_fwd', () => forwardScan.compact(largeMixed), 100);
results.push({ name: 'Compact 100 mixed cells', naive: naiveTime6, optimized: optTime6, forwardScan: fwdTime6, speedup: naiveTime6 / optTime6, fwdSpeedup: optTime6 / fwdTime6 });
console.log(`  Optimized:   ${formatTime(optTime6)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime6)}`);
console.log(`  Speedup (opt→fwd): ${(optTime6 / fwdTime6).toFixed(2)}x`);
console.log('');

// Benchmark 7: 1,000 cells
console.log('7. Compact: 1,000 mixed cells');
const large1k = [];
for (let i = 0; i < 1000; i++) {
  const res = 2 + (i % 6);
  const origin = origins[i % 12];
  const segment = i % 5;
  const hilbertLevels = res - 2 + 1;
  const maxS = (1 << (2 * hilbertLevels)) - 1;
  const S = BigInt(i % maxS);
  large1k.push(serialize({ origin, segment, S, resolution: res }));
}
const optTime7 = benchmark('compact_1k_opt', () => optimized.compact(large1k), 10);
const fwdTime7 = benchmark('compact_1k_fwd', () => forwardScan.compact(large1k), 10);
results.push({ name: 'Compact 1k cells', naive: null, optimized: optTime7, forwardScan: fwdTime7, speedup: null, fwdSpeedup: optTime7 / fwdTime7 });
console.log(`  Optimized:   ${formatTime(optTime7)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime7)}`);
console.log(`  Speedup (opt→fwd): ${(optTime7 / fwdTime7).toFixed(2)}x`);
console.log('');

// Benchmark 8: 10,000 cells
console.log('8. Compact: 10,000 mixed cells');
const large10k = [];
for (let i = 0; i < 10000; i++) {
  const res = 2 + (i % 7);
  const origin = origins[i % 12];
  const segment = i % 5;
  const hilbertLevels = res - 2 + 1;
  const maxS = (1 << (2 * hilbertLevels)) - 1;
  const S = BigInt(i % maxS);
  large10k.push(serialize({ origin, segment, S, resolution: res }));
}
const optTime8 = benchmark('compact_10k_opt', () => optimized.compact(large10k), 5);
const fwdTime8 = benchmark('compact_10k_fwd', () => forwardScan.compact(large10k), 5);
results.push({ name: 'Compact 10k cells', naive: null, optimized: optTime8, forwardScan: fwdTime8, speedup: null, fwdSpeedup: optTime8 / fwdTime8 });
console.log(`  Optimized:   ${formatTime(optTime8)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime8)}`);
console.log(`  Speedup (opt→fwd): ${(optTime8 / fwdTime8).toFixed(2)}x`);
console.log('');

// Benchmark 9: 100,000 cells
console.log('9. Compact: 100,000 mixed cells');
const large100k = [];
for (let i = 0; i < 100000; i++) {
  const res = 2 + (i % 8);
  const origin = origins[i % 12];
  const segment = i % 5;
  const hilbertLevels = res - 2 + 1;
  const maxS = (1 << (2 * hilbertLevels)) - 1;
  const S = BigInt(i % maxS);
  large100k.push(serialize({ origin, segment, S, resolution: res }));
}
const optTime9 = benchmark('compact_100k_opt', () => optimized.compact(large100k), 3);
const fwdTime9 = benchmark('compact_100k_fwd', () => forwardScan.compact(large100k), 3);
results.push({ name: 'Compact 100k cells', naive: null, optimized: optTime9, forwardScan: fwdTime9, speedup: null, fwdSpeedup: optTime9 / fwdTime9 });
console.log(`  Optimized:   ${formatTime(optTime9)}`);
console.log(`  ForwardScan: ${formatTime(fwdTime9)}`);
console.log(`  Speedup (opt→fwd): ${(optTime9 / fwdTime9).toFixed(2)}x`);
console.log('');

// Summary
console.log('='.repeat(80));
console.log('Summary');
console.log('='.repeat(80));
console.log('');
console.log('Benchmark                         | Naive      | Optimized  | Speedup');
console.log('-'.repeat(80));
for (const result of results) {
  const name = result.name.padEnd(33);
  const naive = formatTime(result.naive).padStart(10);
  const opt = formatTime(result.optimized).padStart(10);
  const speedup = `${result.speedup.toFixed(2)}x`.padStart(7);
  console.log(`${name} | ${naive} | ${opt} | ${speedup}`);
}
console.log('');

const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x`);
console.log('');
