const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  cellToBoundary,
  u64ToHex,
  FIRST_HILBERT_RESOLUTION
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'global-neighbors.json');

// Handle antimeridian: normalize longitude difference
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

function sharesVertex(bA, bB) {
  return countSharedVertices(bA, bB) > 0;
}

function sharesEdge(bA, bB) {
  return countSharedVertices(bA, bB) >= 2;
}

/**
 * For a given resolution, compute all cells, their boundaries, and brute-force
 * neighbors for selected test cells.
 */
function generateForResolution(resolution, cellsPerCategory) {
  console.log(`\nResolution ${resolution}:`);
  const cells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
  console.log(`  ${cells.length} total cells`);

  // Precompute all boundaries
  console.log('  Computing boundaries...');
  const boundaries = new Map();
  for (const cell of cells) {
    boundaries.set(cell, cellToBoundary(cell, {closedRing: false, segments: 1}));
  }

  // First pass: use getCellNeighbors to classify cells by neighbor count
  // (we trust it now since it matched brute-force 100%)
  // But we'll generate the actual fixture values via brute-force for independence.
  console.log('  Classifying cells by neighbor count (brute-force)...');

  // For res 2-4, we can afford full brute-force classification
  // For res 5, we sample cells and brute-force check only those
  const neighborCounts = new Map(); // cell -> count
  const cellsByCount = new Map(); // count -> cell[]

  if (cells.length <= 4000) {
    // Full brute-force classification
    for (let i = 0; i < cells.length; i++) {
      if (i % 500 === 0 && i > 0) console.log(`    Progress: ${i}/${cells.length}`);
      const cell = cells[i];
      const bA = boundaries.get(cell);
      let count = 0;
      for (const other of cells) {
        if (other === cell) continue;
        if (sharesVertex(bA, boundaries.get(other))) count++;
      }
      neighborCounts.set(cell, count);
      if (!cellsByCount.has(count)) cellsByCount.set(count, []);
      cellsByCount.get(count).push(cell);
    }
  } else {
    // For larger resolutions, sample cells spread across the index space
    // and classify only those. We need enough to find 6, 7, and 8 cases.
    const sampleSize = Math.min(cells.length, 800);
    const step = Math.floor(cells.length / sampleSize);
    const sample = [];
    for (let i = 0; i < cells.length; i += step) {
      sample.push(cells[i]);
    }
    // Also add cells near face boundaries (every 64th cell per quintant at res 5
    // is the first/last cell in each quintant)
    const cellsPerQuintant = Math.pow(4, resolution - FIRST_HILBERT_RESOLUTION + 1);
    for (let faceIdx = 0; faceIdx < 60; faceIdx++) {
      // First and last cells in each quintant
      const base = cells[faceIdx * cellsPerQuintant];
      const last = cells[Math.min((faceIdx + 1) * cellsPerQuintant - 1, cells.length - 1)];
      if (base && !sample.includes(base)) sample.push(base);
      if (last && !sample.includes(last)) sample.push(last);
    }

    console.log(`    Sampling ${sample.length} cells for classification...`);
    for (let i = 0; i < sample.length; i++) {
      if (i % 200 === 0 && i > 0) console.log(`    Progress: ${i}/${sample.length}`);
      const cell = sample[i];
      const bA = boundaries.get(cell);
      let count = 0;
      for (const other of cells) {
        if (other === cell) continue;
        if (sharesVertex(bA, boundaries.get(other))) count++;
      }
      neighborCounts.set(cell, count);
      if (!cellsByCount.has(count)) cellsByCount.set(count, []);
      cellsByCount.get(count).push(cell);
    }
  }

  // Report distribution
  const counts = [...cellsByCount.keys()].sort((a, b) => a - b);
  for (const c of counts) {
    console.log(`  ${c} neighbors: ${cellsByCount.get(c).length} cells found`);
  }

  // Select test cells: pick from each category, spread across different faces
  const selectedCells = [];
  for (const count of counts) {
    const pool = cellsByCount.get(count);
    // Spread selection across the pool
    const n = Math.min(cellsPerCategory, pool.length);
    const step = Math.max(1, Math.floor(pool.length / n));
    for (let i = 0; i < n; i++) {
      selectedCells.push(pool[Math.min(i * step, pool.length - 1)]);
    }
  }

  // Compute brute-force neighbors for selected cells (both all-neighbors and edge-only)
  console.log(`  Computing brute-force neighbors for ${selectedCells.length} selected cells...`);
  const fixtures = [];
  for (const cell of selectedCells) {
    const bA = boundaries.get(cell);
    const neighbors = [];
    const edgeNeighbors = [];
    for (const other of cells) {
      if (other === cell) continue;
      const shared = countSharedVertices(bA, boundaries.get(other));
      if (shared > 0) {
        neighbors.push(other);
        if (shared >= 2) edgeNeighbors.push(other);
      }
    }
    neighbors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    edgeNeighbors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    fixtures.push({
      input: {cellId: u64ToHex(cell)},
      output: {
        neighbors: neighbors.map(n => u64ToHex(n)),
        edgeNeighbors: edgeNeighbors.map(n => u64ToHex(n))
      }
    });
  }

  return fixtures;
}

// Generate fixtures for resolutions 0-1 (all cells, brute-force)
const allFixtures = [];

for (const resolution of [0, 1]) {
  console.log(`\nResolution ${resolution}:`);
  const cells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
  console.log(`  ${cells.length} total cells`);

  const boundaries = new Map();
  for (const cell of cells) {
    boundaries.set(cell, cellToBoundary(cell, {closedRing: false, segments: 1}));
  }

  for (const cell of cells) {
    const bA = boundaries.get(cell);
    const neighbors = [];
    const edgeNeighbors = [];
    for (const other of cells) {
      if (other === cell) continue;
      const shared = countSharedVertices(bA, boundaries.get(other));
      if (shared > 0) {
        neighbors.push(other);
        if (shared >= 2) edgeNeighbors.push(other);
      }
    }
    neighbors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    edgeNeighbors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    allFixtures.push({
      input: {cellId: u64ToHex(cell)},
      output: {
        neighbors: neighbors.map(n => u64ToHex(n)),
        edgeNeighbors: edgeNeighbors.map(n => u64ToHex(n))
      }
    });
  }
  console.log(`  Added ${cells.length} test cases for resolution ${resolution}`);
}

// Generate fixtures for resolutions 2-5
const resolutions = [2, 3, 4, 5];
const cellsPerCategory = 8;

for (const res of resolutions) {
  const fixtures = generateForResolution(res, cellsPerCategory);
  allFixtures.push(...fixtures);
  console.log(`  Added ${fixtures.length} test cases for resolution ${res}`);
}

// Sort by cell ID for deterministic output
allFixtures.sort((a, b) => a.input.cellId.localeCompare(b.input.cellId));

console.log(`\nTotal: ${allFixtures.length} test cases across resolutions ${resolutions.join(', ')}`);

// Verify distribution
const neighborDist = {};
const edgeDist = {};
for (const f of allFixtures) {
  const n = f.output.neighbors.length;
  neighborDist[n] = (neighborDist[n] || 0) + 1;
  const e = f.output.edgeNeighbors.length;
  edgeDist[e] = (edgeDist[e] || 0) + 1;
}
console.log('Neighbor count distribution in fixtures:', JSON.stringify(neighborDist));
console.log('Edge neighbor count distribution in fixtures:', JSON.stringify(edgeDist));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(allFixtures, null, 2));
console.log(`Wrote fixtures to ${outputPath}`);
