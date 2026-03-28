const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  cellToBoundary,
  u64ToHex,
  FIRST_HILBERT_RESOLUTION,
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'grid-disk.json');

// --- Brute-force neighbor finding (boundary vertex/edge sharing) ---

function lonDiff(a, b) {
  let d = a - b;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

function countSharedVertices(bA, bB) {
  let count = 0;
  for (const va of bA) {
    for (const vb of bB) {
      if (Math.abs(lonDiff(va[0], vb[0])) < 1e-6 && Math.abs(va[1] - vb[1]) < 1e-6) count++;
    }
  }
  return count;
}

/**
 * Brute-force grid disk BFS.
 * @param {boolean} edgeOnly - if true, only follow edge-sharing (>=2 shared vertices)
 */
function bruteForceGridDisk(cellId, k, allCells, boundaryMap, edgeOnly) {
  const visited = new Set([cellId]);
  let frontier = new Set([cellId]);

  for (let ring = 1; ring <= k; ring++) {
    const nextFrontier = new Set();
    for (const id of frontier) {
      const bA = boundaryMap.get(id);
      for (const other of allCells) {
        if (visited.has(other)) continue;
        const shared = countSharedVertices(bA, boundaryMap.get(other));
        if (edgeOnly ? shared >= 2 : shared > 0) {
          visited.add(other);
          nextFrontier.add(other);
        }
      }
    }
    frontier = nextFrontier;
  }

  return Array.from(visited).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Generate fixtures ---

console.log('Generating traversal/grid-disk fixtures...');

const fixtures = [];

// Generate fixtures for resolutions 0 and 1 (all cells)
for (const resolution of [0, 1]) {
  console.log(`\nResolution ${resolution}:`);
  const cells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
  console.log(`  ${cells.length} total cells`);

  const boundaries = new Map();
  for (const cell of cells) {
    boundaries.set(cell, cellToBoundary(cell, {closedRing: false, segments: 1}));
  }

  // Test a sample of cells (every 5th at res 0, every 10th at res 1)
  const step = resolution === 0 ? 4 : 10;
  const testCells = cells.filter((_, i) => i % step === 0);
  console.log(`  Selected ${testCells.length} test cells`);

  for (const k of [1, 2]) {
    console.log(`  Generating k=${k} fixtures...`);
    for (const cellId of testCells) {
      const edgeCells = bruteForceGridDisk(cellId, k, cells, boundaries, true);
      const vertexCells = bruteForceGridDisk(cellId, k, cells, boundaries, false);
      const edgeSet = new Set(edgeCells.map(c => u64ToHex(c)));
      const extraVertexCells = vertexCells
        .filter(c => !edgeSet.has(u64ToHex(c)))
        .map(c => u64ToHex(c));

      fixtures.push({
        cellId: u64ToHex(cellId),
        k,
        cells: edgeCells.map(c => u64ToHex(c)),
        extraVertexCells,
      });
    }
  }
}

// Generate fixtures for resolution 3
const resolution = 3;
console.log(`\nResolution ${resolution}:`);
const cells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
console.log(`  ${cells.length} total cells`);

// Precompute boundaries
console.log('  Computing boundaries...');
const boundaries = new Map();
for (const cell of cells) {
  boundaries.set(cell, cellToBoundary(cell, {closedRing: false, segments: 1}));
}

// Select diverse test cells: sample across faces/quintants
const cellsPerQuintant = Math.pow(4, resolution - FIRST_HILBERT_RESOLUTION + 1);
const testCellIndices = new Set();
for (let faceIdx = 0; faceIdx < 60; faceIdx += 10) {
  const base = faceIdx * cellsPerQuintant;
  testCellIndices.add(base);
  testCellIndices.add(base + Math.floor(cellsPerQuintant / 2));
}

const testCells = Array.from(testCellIndices)
  .filter(i => i < cells.length)
  .map(i => cells[i]);

console.log(`  Selected ${testCells.length} test cells`);

for (const k of [1, 2]) {
  console.log(`  Generating k=${k} fixtures...`);
  for (const cellId of testCells) {
    const edgeCells = bruteForceGridDisk(cellId, k, cells, boundaries, true);
    const vertexCells = bruteForceGridDisk(cellId, k, cells, boundaries, false);
    const edgeSet = new Set(edgeCells.map(c => u64ToHex(c)));
    const extraVertexCells = vertexCells
      .filter(c => !edgeSet.has(u64ToHex(c)))
      .map(c => u64ToHex(c));

    fixtures.push({
      cellId: u64ToHex(cellId),
      k,
      cells: edgeCells.map(c => u64ToHex(c)),
      extraVertexCells,
    });
  }
}

console.log(`  ${fixtures.length} cases`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
