const fs = require('fs');
const path = require('path');

const {
  serialize,
  cellToChildren,
  cellToParent,
  WORLD_CELL,
  u64ToHex,
  hexToU64,
  compact,
  uncompact,
  origins
} = require('../../a5-test.cjs');
const {
  compactionMarker,
  compactionMarkerResolution,
  covering,
  sortByCurve,
  flatAt,
  sameSet,
  res30Cell
} = require('./collection-utils.cjs');

const hex = cells => cells.map(c => u64ToHex(c));

function generateCompactFixtures() {
  const fixtures = [];

  // Test case 1: All 4 siblings at resolution 3 -> compact to parent at res 2
  const res2Cell = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2});
  const res3Children = cellToChildren(res2Cell, 3);
  fixtures.push({
    name: 'four_siblings_res3',
    description:
      'Four sibling cells at resolution 3 compact to parent at resolution 2, compaction marker records res 3',
    input: hex(res3Children),
    expectedOutput: hex(covering([res2Cell], 3))
  });

  // Test case 2: Only 3 of 4 siblings -> no compaction
  fixtures.push({
    name: 'three_of_four_siblings',
    description: 'Three sibling cells cannot be compacted (missing one sibling)',
    input: hex(res3Children.slice(0, 3)),
    expectedOutput: hex(covering(res3Children.slice(0, 3), 3))
  });

  // Test case 3: All 5 segments at resolution 1 -> compact to res 0
  const res0Cell = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 0});
  const res1Children = cellToChildren(res0Cell, 1);
  fixtures.push({
    name: 'five_segments_res1',
    description: 'All 5 segments at resolution 1 compact to parent at resolution 0',
    input: hex(res1Children),
    expectedOutput: hex(covering([res0Cell], 1))
  });

  // Test case 4: All 12 resolution 0 cells -> compact to world cell
  const worldChildren = cellToChildren(WORLD_CELL, 0);
  fixtures.push({
    name: 'twelve_res0_cells',
    description: 'All 12 resolution 0 cells compact to world cell',
    input: hex(worldChildren),
    expectedOutput: hex(covering([WORLD_CELL], 0))
  });

  // Test case 5: Mixed resolutions
  const res4Cell = serialize({origin: origins[1], segment: 2, S: 5n, resolution: 4});
  const res5Cell = serialize({origin: origins[2], segment: 1, S: 10n, resolution: 5});
  fixtures.push({
    name: 'mixed_resolutions',
    description: 'Cells at different resolutions with no sibling relationships, compaction marker records the finest',
    input: hex([res4Cell, res5Cell]),
    expectedOutput: hex(covering([res4Cell, res5Cell], 5))
  });

  // Test case 6: Nested compaction - 16 cells at res 4 -> 4 at res 3 -> 1 at res 2
  const res2CellNested = serialize({origin: origins[3], segment: 1, S: 0n, resolution: 2});
  const res4Descendants = cellToChildren(res2CellNested, 4);
  fixtures.push({
    name: 'nested_compaction_res4_to_res2',
    description: '16 cells at resolution 4 compact through res 3 to single cell at res 2',
    input: hex(res4Descendants),
    expectedOutput: hex(covering([res2CellNested], 4))
  });

  // Test case 7: Empty array
  fixtures.push({
    name: 'empty_array',
    description: 'Empty input returns empty output (there is no resolution to record)',
    input: [],
    expectedOutput: []
  });

  // Test case 8: Single cell
  const singleCell = serialize({origin: origins[5], segment: 3, S: 7n, resolution: 6});
  fixtures.push({
    name: 'single_cell',
    description: 'Single cell remains unchanged',
    input: hex([singleCell]),
    expectedOutput: hex(covering([singleCell], 6))
  });

  // Test case 9: Duplicates
  fixtures.push({
    name: 'duplicate_cells',
    description: 'Duplicate cells are removed',
    input: hex([singleCell, singleCell, singleCell]),
    expectedOutput: hex(covering([singleCell], 6))
  });

  // Test case 10: Partial compaction - some groups complete, some incomplete
  const parent1 = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2});
  const parent2 = serialize({origin: origins[0], segment: 0, S: 1n, resolution: 2});
  const children1 = cellToChildren(parent1, 3); // All 4 children
  const children2 = cellToChildren(parent2, 3).slice(0, 2); // Only 2 of 4 children
  fixtures.push({
    name: 'partial_compaction',
    description: 'One complete sibling group compacts, one incomplete group does not',
    input: hex([...children1, ...children2]),
    expectedOutput: hex(covering([parent1, ...children2], 3))
  });

  // Test case 11: Incomplete set of resolution 0 cells (only 10 of 12)
  const incompleteRes0 = worldChildren.slice(0, 10);
  fixtures.push({
    name: 'incomplete_res0_cells',
    description: 'Only 10 of 12 resolution 0 cells - should not compact to world cell',
    input: hex(incompleteRes0),
    expectedOutput: hex(covering(incompleteRes0, 0))
  });

  // Test case 12: Cross-origin compaction (cells from different origins that don't form sibling groups)
  const origin0Cell = serialize({origin: origins[0], segment: 2, S: 3n, resolution: 4});
  const origin1Cell = serialize({origin: origins[1], segment: 2, S: 3n, resolution: 4});
  fixtures.push({
    name: 'cross_origin_no_compact',
    description: 'Cells from different origins with same segment/S should not compact',
    input: hex([origin0Cell, origin1Cell]),
    expectedOutput: hex(covering([origin0Cell, origin1Cell], 4))
  });

  // Test case 13: The motivating case - 8 res-4 cells compact to 2 res-3 cells, and
  // the compaction marker keeps the meaning "8 cells at res 4"
  const res3Pair = cellToChildren(res2Cell, 3).slice(1, 3);
  fixtures.push({
    name: 'eight_res4_to_two_res3',
    description: '8 res-4 cells compact to 2 res-3 cells; the compaction marker records res 4',
    input: hex(res3Pair.flatMap(c => cellToChildren(c, 4))),
    expectedOutput: hex(covering(res3Pair, 4))
  });

  // Test case 14: A cell and its descendants - the descendants are absorbed
  const otherRes4 = serialize({origin: origins[6], segment: 0, S: 9n, resolution: 4});
  fixtures.push({
    name: 'ancestor_absorbs_descendants',
    description: 'Cells inside another input cell are absorbed by it',
    input: hex([cellToChildren(res2Cell, 4)[5], otherRes4, res2Cell, cellToChildren(res2Cell, 3)[0]]),
    expectedOutput: hex(covering([res2Cell, otherRes4], 4))
  });

  // Test case 15: A covering compacts to itself
  const compacted = compact(res3Pair.flatMap(c => cellToChildren(c, 4)));
  fixtures.push({
    name: 'idempotent',
    description: 'Compacting a covering (with its compaction marker) returns it unchanged',
    input: hex(Array.from(compacted)),
    expectedOutput: hex(covering(res3Pair, 4))
  });

  // Test case 16: A compaction marker alone is an empty covering at its resolution
  fixtures.push({
    name: 'marker_only',
    description: 'An empty covering keeps its resolution',
    input: hex([compactionMarker(7)]),
    expectedOutput: hex([compactionMarker(7)])
  });

  // Test case 17: Resolution 30, across the three quintant encodings (...1, ...100,
  // ...10000), whose IDs don't sort like the curve
  const res30Low = res30Cell(5, 1234n);
  const res30Mid = res30Cell(35, 77n);
  const res30High = res30Cell(41, 5n);
  const res30Siblings = cellToChildren(cellToParent(res30Mid, 29), 30);
  fixtures.push({
    name: 'res30_quintant_encodings',
    description: 'Res-30 cells from quintants 5, 35 and 41 come out in curve order; full sibling groups compact',
    input: hex([res30High, ...res30Siblings, res30Low]),
    expectedOutput: hex(covering([res30Low, cellToParent(res30Mid, 29), res30High], 30))
  });

  // Test case 18: Res 0 and res 1 cells, whose IDs don't sort like the curve
  const res0Origin1 = serialize({origin: origins[1], segment: 0, S: 0n, resolution: 0});
  const res1Quintant3 = cellToChildren(res0Cell, 1)[3];
  fixtures.push({
    name: 'res0_res1_curve_order',
    description: 'A res-0 cell (origin 1, quintants 5-9) sorts after a res-1 cell in quintant 3',
    input: hex([res0Origin1, res1Quintant3]),
    expectedOutput: hex(covering([res1Quintant3, res0Origin1], 1))
  });

  // Every expected output must stand for exactly the input's cells
  for (const f of fixtures) {
    if (f.input.length === 0) continue;
    const expected = f.expectedOutput.map(hexToU64);
    const resolution = compactionMarkerResolution(expected[expected.length - 1]);
    if (!sameSet(flatAt(f.input.map(hexToU64), resolution), flatAt(expected, resolution))) {
      throw new Error(`compact fixture ${f.name} is inconsistent`);
    }
  }

  return fixtures;
}

function generateUncompactFixtures() {
  const fixtures = [];
  const res2Cell = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2});
  const res0Cell = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 0});
  const res3Cell = serialize({origin: origins[1], segment: 1, S: 2n, resolution: 3});
  const res4Cell = serialize({origin: origins[2], segment: 2, S: 5n, resolution: 4});
  const res6Cell = serialize({origin: origins[4], segment: 3, S: 10n, resolution: 6});
  const res3Pair = cellToChildren(res2Cell, 3).slice(1, 3);

  const push = (name, description, input, expectedResolution, expectedCells) =>
    fixtures.push({
      name,
      description,
      input: hex(input),
      expectedResolution,
      expectedCount: expectedCells.length,
      expectedCells: hex(expectedCells)
    });

  push(
    'expand_res2_to_res3',
    'A res-2 cell in a res-3 covering expands to its 4 children',
    covering([res2Cell], 3),
    3,
    cellToChildren(res2Cell, 3)
  );
  push(
    'expand_res2_to_res4',
    'A res-2 cell in a res-4 covering expands to its 16 descendants',
    covering([res2Cell], 4),
    4,
    cellToChildren(res2Cell, 4)
  );
  push(
    'expand_res0_to_res1',
    'A res-0 cell in a res-1 covering expands to its 5 quintants',
    covering([res0Cell], 1),
    1,
    cellToChildren(res0Cell, 1)
  );
  push(
    'expand_world_to_res0',
    'The world cell in a res-0 covering expands to the 12 res-0 cells',
    covering([WORLD_CELL], 0),
    0,
    cellToChildren(WORLD_CELL, 0)
  );
  push(
    'mixed_input_to_res5',
    'Cells at resolutions 3 and 4 in a res-5 covering both expand to resolution 5',
    covering([res3Cell, res4Cell], 5),
    5,
    sortByCurve([...cellToChildren(res3Cell, 5), ...cellToChildren(res4Cell, 5)])
  );
  push(
    'two_res3_to_eight_res4',
    'The motivating case: 2 res-3 cells with a res-4 compaction marker stand for 8 res-4 cells',
    covering(res3Pair, 4),
    4,
    res3Pair.flatMap(c => cellToChildren(c, 4))
  );
  push(
    'no_marker_single',
    'Without a compaction marker, the finest cell gives the resolution: a single cell is unchanged',
    [res6Cell],
    6,
    [res6Cell]
  );
  push(
    'no_marker_mixed',
    'Without a compaction marker, cells expand to the finest resolution present',
    sortByCurve([res3Cell, res4Cell]),
    4,
    sortByCurve([...cellToChildren(res3Cell, 4), res4Cell])
  );
  push('world_alone', 'The world cell alone is a covering at resolution -1', [WORLD_CELL], -1, [WORLD_CELL]);
  push('empty_array', 'Empty input returns empty output', [], -1, []);
  push('marker_only', 'An empty covering expands to no cells', [compactionMarker(5)], 5, []);

  return fixtures;
}

function generateRoundTripFixtures() {
  const fixtures = [];

  // Test case 1: Basic round-trip - compact then uncompact maintains coverage
  const parent = serialize({origin: origins[0], segment: 1, S: 5n, resolution: 3});
  const children = cellToChildren(parent, 6);
  const compacted = compact(children);
  fixtures.push({
    name: 'roundtrip_basic',
    description: 'Compact then uncompact returns the original cells',
    initialCells: hex(children),
    afterCompact: hex(Array.from(compacted)),
    resolution: 6,
    expectedFinalCount: children.length
  });

  // Test case 2: Mixed resolutions round-trip
  const mixedCells = [
    serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2}),
    serialize({origin: origins[1], segment: 1, S: 2n, resolution: 4}),
    serialize({origin: origins[2], segment: 2, S: 5n, resolution: 5})
  ];
  const compactedMixed = compact(mixedCells);
  fixtures.push({
    name: 'roundtrip_mixed_resolutions',
    description: 'Mixed resolutions expand to the finest resolution through compact/uncompact',
    initialCells: hex(mixedCells),
    afterCompact: hex(Array.from(compactedMixed)),
    resolution: 5,
    expectedFinalCount: uncompact(compactedMixed).length
  });

  // Test case 3: Cell coverage verification
  const coverageParent = serialize({origin: origins[3], segment: 2, S: 10n, resolution: 4});
  const coverageCells = cellToChildren(coverageParent, 7);
  const compactedCoverage = compact(coverageCells);
  fixtures.push({
    name: 'roundtrip_cell_coverage',
    description: 'Verify cell count is preserved through operations',
    initialCells: hex(coverageCells),
    afterCompact: hex(Array.from(compactedCoverage)),
    resolution: 7,
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
