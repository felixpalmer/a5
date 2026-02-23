const fs = require('fs');
const path = require('path');

const { serialize, cellToChildren, WORLD_CELL, u64ToHex, compact, uncompact } = require('../../a5-test.cjs');
const { origins } = require('../../a5-test.cjs');

function generateCompactFixtures() {
  const fixtures = [];

  // Test case 1: All 4 siblings at resolution 3 -> compact to parent at res 2
  const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
  const res3Children = cellToChildren(res2Cell, 3);
  fixtures.push({
    name: 'four_siblings_res3',
    description: 'Four sibling cells at resolution 3 compact to parent at resolution 2',
    input: res3Children.map(c => u64ToHex(c)),
    expectedOutput: [u64ToHex(res2Cell)]
  });

  // Test case 2: Only 3 of 4 siblings -> no compaction
  fixtures.push({
    name: 'three_of_four_siblings',
    description: 'Three sibling cells cannot be compacted (missing one sibling)',
    input: res3Children.slice(0, 3).map(c => u64ToHex(c)),
    expectedOutput: res3Children.slice(0, 3).map(c => u64ToHex(c))
  });

  // Test case 3: All 5 segments at resolution 1 -> compact to res 0
  const res0Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 0 });
  const res1Children = cellToChildren(res0Cell, 1);
  fixtures.push({
    name: 'five_segments_res1',
    description: 'All 5 segments at resolution 1 compact to parent at resolution 0',
    input: res1Children.map(c => u64ToHex(c)),
    expectedOutput: [u64ToHex(res0Cell)]
  });

  // Test case 4: All 12 resolution 0 cells -> compact to world cell
  const worldChildren = cellToChildren(WORLD_CELL, 0);
  fixtures.push({
    name: 'twelve_res0_cells',
    description: 'All 12 resolution 0 cells compact to world cell',
    input: worldChildren.map(c => u64ToHex(c)),
    expectedOutput: [u64ToHex(WORLD_CELL)]
  });

  // Test case 5: Mixed resolutions
  const res4Cell = serialize({ origin: origins[1], segment: 2, S: 5n, resolution: 4 });
  const res5Cell = serialize({ origin: origins[2], segment: 1, S: 10n, resolution: 5 });
  fixtures.push({
    name: 'mixed_resolutions',
    description: 'Cells at different resolutions with no sibling relationships',
    input: [u64ToHex(res4Cell), u64ToHex(res5Cell)],
    expectedOutput: [u64ToHex(res4Cell), u64ToHex(res5Cell)]
  });

  // Test case 6: Nested compaction - 16 cells at res 4 -> 4 at res 3 -> 1 at res 2
  const res2CellNested = serialize({ origin: origins[3], segment: 1, S: 0n, resolution: 2 });
  const res4Descendants = cellToChildren(res2CellNested, 4);
  fixtures.push({
    name: 'nested_compaction_res4_to_res2',
    description: '16 cells at resolution 4 compact through res 3 to single cell at res 2',
    input: res4Descendants.map(c => u64ToHex(c)),
    expectedOutput: [u64ToHex(res2CellNested)]
  });

  // Test case 7: Empty array
  fixtures.push({
    name: 'empty_array',
    description: 'Empty input returns empty output',
    input: [],
    expectedOutput: []
  });

  // Test case 8: Single cell
  const singleCell = serialize({ origin: origins[5], segment: 3, S: 7n, resolution: 6 });
  fixtures.push({
    name: 'single_cell',
    description: 'Single cell remains unchanged',
    input: [u64ToHex(singleCell)],
    expectedOutput: [u64ToHex(singleCell)]
  });

  // Test case 9: Duplicates
  fixtures.push({
    name: 'duplicate_cells',
    description: 'Duplicate cells are removed',
    input: [u64ToHex(singleCell), u64ToHex(singleCell), u64ToHex(singleCell)],
    expectedOutput: [u64ToHex(singleCell)]
  });

  // Test case 10: Partial compaction - some groups complete, some incomplete
  const parent1 = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
  const parent2 = serialize({ origin: origins[0], segment: 0, S: 1n, resolution: 2 });
  const children1 = cellToChildren(parent1, 3); // All 4 children
  const children2 = cellToChildren(parent2, 3).slice(0, 2); // Only 2 of 4 children
  fixtures.push({
    name: 'partial_compaction',
    description: 'One complete sibling group compacts, one incomplete group does not',
    input: [...children1, ...children2].map(c => u64ToHex(c)),
    expectedOutput: [u64ToHex(parent1), ...children2].map(c => u64ToHex(c))
  });

  // Test case 11: Incomplete set of resolution 0 cells (only 10 of 12)
  const incompleteRes0 = worldChildren.slice(0, 10);
  fixtures.push({
    name: 'incomplete_res0_cells',
    description: 'Only 10 of 12 resolution 0 cells - should not compact to world cell',
    input: incompleteRes0.map(c => u64ToHex(c)),
    expectedOutput: incompleteRes0.map(c => u64ToHex(c))
  });

  // Test case 12: Cross-origin compaction (cells from different origins that don't form sibling groups)
  const origin0Cell = serialize({ origin: origins[0], segment: 2, S: 3n, resolution: 4 });
  const origin1Cell = serialize({ origin: origins[1], segment: 2, S: 3n, resolution: 4 });
  fixtures.push({
    name: 'cross_origin_no_compact',
    description: 'Cells from different origins with same segment/S should not compact',
    input: [u64ToHex(origin0Cell), u64ToHex(origin1Cell)],
    expectedOutput: [u64ToHex(origin0Cell), u64ToHex(origin1Cell)]
  });

  return fixtures;
}

function generateUncompactFixtures() {
  const fixtures = [];

  // Test case 1: Expand res 2 cell to res 3 (4 children)
  const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
  fixtures.push({
    name: 'expand_res2_to_res3',
    description: 'Single cell at resolution 2 expands to 4 cells at resolution 3',
    input: [u64ToHex(res2Cell)],
    targetResolution: 3,
    expectedCount: 4
  });

  // Test case 2: Expand res 2 cell to res 4 (16 children)
  fixtures.push({
    name: 'expand_res2_to_res4',
    description: 'Single cell at resolution 2 expands to 16 cells at resolution 4',
    input: [u64ToHex(res2Cell)],
    targetResolution: 4,
    expectedCount: 16
  });

  // Test case 3: Expand res 0 cell to res 1 (5 segments)
  const res0Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 0 });
  fixtures.push({
    name: 'expand_res0_to_res1',
    description: 'Resolution 0 cell expands to 5 segments at resolution 1',
    input: [u64ToHex(res0Cell)],
    targetResolution: 1,
    expectedCount: 5
  });

  // Test case 4: Expand world cell to res 0 (12 origins)
  fixtures.push({
    name: 'expand_world_to_res0',
    description: 'World cell expands to 12 resolution 0 cells',
    input: [u64ToHex(WORLD_CELL)],
    targetResolution: 0,
    expectedCount: 12
  });

  // Test case 5: Mixed input resolutions
  const res3Cell = serialize({ origin: origins[1], segment: 1, S: 2n, resolution: 3 });
  const res4Cell = serialize({ origin: origins[2], segment: 2, S: 5n, resolution: 4 });
  fixtures.push({
    name: 'mixed_input_to_res5',
    description: 'Cells at resolutions 3 and 4 both expand to resolution 5',
    input: [u64ToHex(res3Cell), u64ToHex(res4Cell)],
    targetResolution: 5,
    expectedCount: 16 + 4  // res3->res5 = 16, res4->res5 = 4
  });

  // Test case 6: Cell already at target resolution
  const res6Cell = serialize({ origin: origins[4], segment: 3, S: 10n, resolution: 6 });
  fixtures.push({
    name: 'already_at_target',
    description: 'Cell already at target resolution remains unchanged',
    input: [u64ToHex(res6Cell)],
    targetResolution: 6,
    expectedCount: 1
  });

  // Test case 7: Empty array
  fixtures.push({
    name: 'empty_array',
    description: 'Empty input returns empty output',
    input: [],
    targetResolution: 5,
    expectedCount: 0
  });

  // Test case 8: Error case - trying to uncompact to lower resolution
  const highResCell = serialize({ origin: origins[3], segment: 1, S: 15n, resolution: 5 });
  fixtures.push({
    name: 'uncompact_to_lower_resolution',
    description: 'Attempting to uncompact to lower resolution should throw error',
    input: [u64ToHex(highResCell)],
    targetResolution: 3,
    expectedError: true
  });

  return fixtures;
}

function generateRoundTripFixtures() {
  const fixtures = [];

  // Test case 1: Basic round-trip - compact then uncompact maintains coverage
  const parent = serialize({ origin: origins[0], segment: 1, S: 5n, resolution: 3 });
  const children = cellToChildren(parent, 6);
  const compacted = compact(children);
  fixtures.push({
    name: 'roundtrip_basic',
    description: 'Compact then uncompact should maintain cell coverage',
    initialCells: children.map(c => u64ToHex(c)),
    afterCompact: Array.from(compacted).map(c => u64ToHex(c)),
    targetResolution: 6,
    afterUncompact: children.map(c => u64ToHex(c)).sort()
  });

  // Test case 2: Mixed resolutions round-trip
  const mixedCells = [
    serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 }),
    serialize({ origin: origins[1], segment: 1, S: 2n, resolution: 4 }),
    serialize({ origin: origins[2], segment: 2, S: 5n, resolution: 5 })
  ];
  const compactedMixed = compact(mixedCells);
  const uncompactedMixed = uncompact(compactedMixed, 5);
  fixtures.push({
    name: 'roundtrip_mixed_resolutions',
    description: 'Mixed resolutions maintain coverage through compact/uncompact cycle',
    initialCells: mixedCells.map(c => u64ToHex(c)),
    afterCompact: Array.from(compactedMixed).map(c => u64ToHex(c)),
    targetResolution: 5,
    expectedCount: uncompactedMixed.length
  });

  // Test case 3: Cell coverage verification
  const coverageParent = serialize({ origin: origins[3], segment: 2, S: 10n, resolution: 4 });
  const coverageCells = cellToChildren(coverageParent, 7);
  const compactedCoverage = compact(coverageCells);
  fixtures.push({
    name: 'roundtrip_cell_coverage',
    description: 'Verify cell count is preserved through operations',
    initialCells: coverageCells.map(c => u64ToHex(c)),
    initialCount: coverageCells.length,
    afterCompact: Array.from(compactedCoverage).map(c => u64ToHex(c)),
    targetResolution: 7,
    expectedFinalCount: coverageCells.length
  });

  return fixtures;
}

// Generate and write fixtures
const compactFixtures = generateCompactFixtures();
const uncompactFixtures = generateUncompactFixtures();
const roundTripFixtures = generateRoundTripFixtures();

const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'compact.json');
const output = {
  compact: compactFixtures,
  uncompact: uncompactFixtures,
  roundTrip: roundTripFixtures
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Generated compact/uncompact fixtures: ${outputPath}`);
console.log(`  - ${compactFixtures.length} compact test cases`);
console.log(`  - ${uncompactFixtures.length} uncompact test cases`);
console.log(`  - ${roundTripFixtures.length} round-trip test cases`);
