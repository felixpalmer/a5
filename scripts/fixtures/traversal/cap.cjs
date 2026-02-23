const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  cellToSpherical,
  u64ToHex,
  haversine,
  FIRST_HILBERT_RESOLUTION,
  metersToH,
  estimateCellRadius,
  pickCoarseResolution,
} = require('../../a5-test.cjs');
const { sphericalCap } = require('../../../dist/a5.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'cap.json');

const EARTH_RADIUS_M = 6_371_000;

function localMetersToH(meters) {
  const s = Math.sin(meters / (2 * EARTH_RADIUS_M));
  return s * s;
}

/**
 * Brute-force cellsWithinRadius: returns all cells whose centers fall
 * within the given Haversine distance. No BFS fringe — strict distance check.
 */
function bruteForceCellsWithinRadius(cellId, radiusM, allCells) {
  const center = cellToSpherical(cellId);
  const hThreshold = localMetersToH(radiusM);
  const result = [cellId];
  for (const other of allCells) {
    if (other === cellId) continue;
    if (haversine(center, cellToSpherical(other)) <= hThreshold) {
      result.push(other);
    }
  }
  return result.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Generate fixtures ---

console.log('Generating traversal/cap fixtures...');

// --- sphericalCap tests at res 3 ---
const resolution = 3;
console.log(`\nResolution ${resolution}:`);
const cells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
console.log(`  ${cells.length} total cells`);

const cellsPerQuintant = Math.pow(4, resolution - FIRST_HILBERT_RESOLUTION + 1);
const testCellIndices = new Set();
for (let faceIdx = 0; faceIdx < 60; faceIdx += 5) {
  const base = faceIdx * cellsPerQuintant;
  testCellIndices.add(base);
  testCellIndices.add(base + Math.floor(cellsPerQuintant / 2));
  testCellIndices.add(base + cellsPerQuintant - 1);
}
const testCells = Array.from(testCellIndices)
  .filter(i => i < cells.length)
  .map(i => cells[i]);

const sphericalCapFixtures = [];
const radii = [500_000, 1_000_000];
const radiusTestCells = testCells.slice(0, 4);

for (const radius of radii) {
  console.log(`  Generating sphericalCap radius=${radius}m fixtures...`);
  for (const cellId of radiusTestCells) {
    const result = bruteForceCellsWithinRadius(cellId, radius, cells);
    sphericalCapFixtures.push({
      cellId: u64ToHex(cellId),
      radius,
      cells: result.map(c => u64ToHex(c)),
    });
  }
}

console.log(`  sphericalCap: ${sphericalCapFixtures.length} cases`);

// --- sphericalCapCompact tests at res 5 ---
const compactResolution = 5;
console.log(`\nGenerating sphericalCapCompact fixtures at res ${compactResolution}...`);
const compactCells = getRes0Cells().flatMap(c => cellToChildren(c, compactResolution));
console.log(`  ${compactCells.length} total cells at res ${compactResolution}`);

const compactCellsPerQuintant = Math.pow(4, compactResolution - FIRST_HILBERT_RESOLUTION + 1);
const compactTestIndices = new Set();
for (let faceIdx = 0; faceIdx < 60; faceIdx += 20) {
  const base = faceIdx * compactCellsPerQuintant;
  compactTestIndices.add(base);
}
const compactTestCells = Array.from(compactTestIndices)
  .filter(i => i < compactCells.length)
  .map(i => compactCells[i]);

console.log(`  Selected ${compactTestCells.length} test cells`);

const sphericalCapCompactFixtures = [];
const compactRadii = [500_000, 1_000_000];
for (const radius of compactRadii) {
  console.log(`  Generating sphericalCapCompact radius=${radius}m fixtures...`);
  for (const cellId of compactTestCells) {
    const compactedResult = sphericalCap(cellId, radius);
    const compactedSorted = Array.from(compactedResult).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    sphericalCapCompactFixtures.push({
      cellId: u64ToHex(cellId),
      radius,
      compactedCells: compactedSorted.map(c => u64ToHex(c)),
    });
  }
}

console.log(`  sphericalCapCompact: ${sphericalCapCompactFixtures.length} cases`);

// --- Helper function tests ---
const helperFixtures = {};

// metersToH
const meterValues = [0, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];
helperFixtures.metersToH = meterValues.map(meters => ({
  meters,
  expectedH: metersToH(meters),
}));
console.log(`  metersToH: ${helperFixtures.metersToH.length} cases`);

// estimateCellRadius
helperFixtures.estimateCellRadius = [];
for (let res = 0; res <= 15; res++) {
  helperFixtures.estimateCellRadius.push({
    resolution: res,
    expectedMeters: estimateCellRadius(res),
  });
}
console.log(`  estimateCellRadius: ${helperFixtures.estimateCellRadius.length} cases`);

// pickCoarseResolution
const pickCases = [
  {radius: 1_000, targetRes: 3},
  {radius: 10_000, targetRes: 5},
  {radius: 100_000, targetRes: 8},
  {radius: 500_000, targetRes: 10},
  {radius: 1_000_000, targetRes: 12},
  {radius: 5_000_000, targetRes: 15},
  {radius: 10_000_000, targetRes: 10},
  {radius: 500_000, targetRes: FIRST_HILBERT_RESOLUTION},
];
helperFixtures.pickCoarseResolution = pickCases.map(({radius, targetRes}) => ({
  radius,
  targetRes,
  expectedCoarseRes: pickCoarseResolution(radius, targetRes),
}));
console.log(`  pickCoarseResolution: ${helperFixtures.pickCoarseResolution.length} cases`);

const fixtures = {
  sphericalCap: sphericalCapFixtures,
  sphericalCapCompact: sphericalCapCompactFixtures,
  helpers: helperFixtures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
