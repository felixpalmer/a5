const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  lonLatToCell,
  gridDisk,
  uncompact,
  u64ToHex,
  cellToSubcell,
  cellToSupercell,
  getResolution,
  WORLD_CELL
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/regions');
const outputPath = path.join(outputDir, 'subcell.json');

console.log('Generating regions/subcell fixtures...');

// Cells on faces with both curve orientations, on face edges and corners, and
// at resolutions 0 and 1, where the hierarchy is loosest
const points = [
  [2.35, 48.85],
  [-74.0, 40.7],
  [139.7, 35.7],
  [-43.2, -22.9],
  [109.07117398349976, -2.698853948126821], // on a dodecahedron edge
  [151.2, -33.9],
  [-0.1, 51.5],
  [0, 90],
  [180, -90]
];
const cases = [];
const res0 = getRes0Cells();
cases.push([res0[0], 2], [res0[7], 3]);
cases.push([cellToChildren(res0[2], 1)[3], 3], [cellToChildren(res0[9], 1)[0], 4]);
const resolutions = [2, 3, 5, 8, 12];
for (let i = 0; i < points.length; i++) {
  const resolution = resolutions[i % resolutions.length];
  const cell = lonLatToCell(points[i], resolution);
  cases.push([cell, resolution + 1 + (i % 3)]);
}
// Edge cells at resolution 2: every one sticks out into a neighboring face
for (const cell of cellToChildren(res0[5], 2).slice(0, 4)) cases.push([cell, 4]);
// Resolution 30: within the first 42 quintants, and beyond them (given at 29)
cases.push([lonLatToCell(points[0], 28), 30], [lonLatToCell([-120, -60], 28), 30]);

const subcell = [];
for (const [cell, resolution] of cases) {
  const result = Array.from(cellToSubcell(cell, resolution));
  const cells = new Set(uncompact(result));
  const [first] = cells;
  const actualResolution = first === undefined ? resolution : getResolution(first);

  // Brute force: the subcells are exactly the candidates whose supercell is the cell
  const cellResolution = getResolution(cell);
  const neighborhood = cellResolution >= 3 ? uncompact(gridDisk(cell, 2)) : cellToChildren(WORLD_CELL, cellResolution);
  let expected = 0;
  for (const n of neighborhood) {
    for (const c of cellToChildren(n, actualResolution)) {
      const inside = cellToSupercell(c, cellResolution) === cell;
      if (inside !== cells.has(c)) {
        throw new Error(`subcell mismatch for ${u64ToHex(cell)} at ${actualResolution}: ${u64ToHex(c)}`);
      }
      if (inside) expected++;
    }
  }
  if (expected !== cells.size) throw new Error(`subcell of ${u64ToHex(cell)} reaches outside its neighborhood`);

  subcell.push({cell: u64ToHex(cell), resolution, count: cells.size, cells: result.map(c => u64ToHex(c))});
}
console.log(`  cellToSubcell: ${subcell.length} cases`);

const supercell = [];
for (const [cell, resolution] of cases) {
  // A few subcells of each case, mapped back up to each coarser resolution
  const fine = uncompact(cellToSubcell(cell, resolution));
  for (const c of [fine[0], fine[fine.length >> 1], fine[fine.length - 1]]) {
    const res = getResolution(c);
    for (const target of [0, 1, res >> 1, res - 1, res]) {
      supercell.push({cell: u64ToHex(c), resolution: target, supercell: u64ToHex(cellToSupercell(c, target))});
    }
  }
}
console.log(`  cellToSupercell: ${supercell.length} cases`);

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({subcell, supercell}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
