const fs = require('fs');
const path = require('path');
const {getRes0Cells, cellToChildren, getLatticeNeighbors, u64ToHex} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'lattice-neighbors.json');

const sortHex = a => [...a].map(u64ToHex).sort();

/**
 * Pick a small spread of cells across resolutions and quintant positions:
 * the first/middle/last child of each face's first quintant. Captures
 * within-quintant, edge, and apex cases.
 */
function pickTestCells(resolution) {
  const all = getRes0Cells().flatMap(c => cellToChildren(c, resolution));
  const cellsPerQuintant = all.length / 60;
  const picks = new Set();
  for (let face = 0; face < 12; face++) {
    const base = face * 5 * cellsPerQuintant;
    picks.add(all[base]);
    picks.add(all[base + Math.floor(cellsPerQuintant / 2)]);
    picks.add(all[base + cellsPerQuintant - 1]);
  }
  return [...picks].filter(Boolean);
}

const cases = [];

for (const resolution of [2, 4, 6]) {
  const cells = pickTestCells(resolution);
  for (const cell of cells) {
    const edge = getLatticeNeighbors(cell, true);
    const superset = getLatticeNeighbors(cell, false);
    cases.push({
      cell: u64ToHex(cell),
      resolution,
      edgeOnlyNeighbors: sortHex(edge),
      supersetNeighbors: sortHex(superset)
    });
  }
}

console.log('Generating traversal/lattice-neighbors fixtures...');
console.log(`  ${cases.length} cases`);

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({cases}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
