const fs = require('fs');
const path = require('path');

const {lonLatToCell, u64ToHex} = require('../../a5-test.cjs');

// A lookup's result must not depend on the lookups before it. lonLatToCell
// reuses the previous lookup's cell when the point projects inside it, and the
// face projection maps the antipodal face center exactly onto a face's center,
// a vertex of the cells around it: the south pole used to come back as the
// north pole's cell. The fixture is a sequence of lookups, to be made in order,
// each with the cell a cold lookup of that point gives.

const MAX_RESOLUTION = 30;

// The poles. The other face centers trigger the same bug, but as cell vertices
// their cold lookups are last-ULP tie-breaks that differ between languages
const points = [
  [0, 90],
  [0, -90]
];

// North, south, north
const lookups = [0, 1, 0];

// A lookup at another resolution leaves nothing for this one to reuse
const cold = (point, resolution) => {
  lonLatToCell(point, (resolution + 1) % (MAX_RESOLUTION + 1));
  return lonLatToCell(point, resolution);
};

const sequences = [];
for (let resolution = 1; resolution <= MAX_RESOLUTION; resolution++) {
  const expected = points.map(p => cold(p, resolution));
  const cells = [];
  for (const i of lookups) {
    const cell = lonLatToCell(points[i], resolution);
    if (cell !== expected[i]) {
      console.log(`  WARNING: res ${resolution} point ${i} depends on the previous lookup`);
    }
    cells.push(u64ToHex(expected[i]));
  }
  sequences.push({resolution, lookups, cells});
}

const outputDir = path.join(__dirname, '../../../tests/fixtures');
const outputPath = path.join(outputDir, 'lonlat-to-cell-sequence.json');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({points, sequences}, null, 2));
console.log(`Generated ${sequences.length} lonlat-to-cell sequences at: ${outputPath}`);
