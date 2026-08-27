const fs = require('fs');
const path = require('path');
const {sToCell, tripleToS, tripleParity, tripleInBounds, roundToTriple} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'curve.json');

console.log('Generating lattice/curve fixtures...');

const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
const resolutions = [3, 5, 7];

// --- sToCell (triple + pentagon flavor) + tripleToS round-trip ---
const sToCellFixtures = [];
for (const resolution of resolutions) {
  const numCells = Math.pow(4, resolution);
  // Pick 10 evenly-spaced s-values per (resolution, orientation)
  const sValues = Array.from({length: 10}, (_, i) => Math.floor((i * numCells) / 10));

  for (const orientation of orientations) {
    for (const s of sValues) {
      const {triple, flavor} = sToCell(BigInt(s), resolution, orientation);
      const parity = tripleParity(triple);

      // Verify round-trip: tripleToS should return the original s
      const roundTrip = tripleToS(triple, resolution, orientation);
      if (roundTrip === null || Number(roundTrip) !== s) {
        console.error(
          `  ERROR: tripleToS round-trip failed for s=${s}, res=${resolution}, ori=${orientation}: got ${roundTrip}`
        );
        process.exit(1);
      }

      sToCellFixtures.push({
        s,
        resolution,
        orientation,
        x: triple.x,
        y: triple.y,
        z: triple.z,
        parity,
        flavor
      });
    }
  }
}
console.log(`  sToCell: ${sToCellFixtures.length} cases (all round-trips verified)`);

// --- pointToS: fractional IJ point -> s of the containing cell (roundToTriple + encode) ---
// Deterministic sample points, as fractions of the quintant triangle
// (i >= 0, j >= 0, i + j <= 2^resolution)
const pointFractions = [
  [0.1, 0.2],
  [0.3, 0.15],
  [0.05, 0.6],
  [0.45, 0.45],
  [0.7, 0.1],
  [0.33, 0.33],
  [0.011, 0.017],
  [0.6, 0.25]
];
const ijToSFixtures = [];
for (const resolution of resolutions) {
  const n = Math.pow(2, resolution);
  const numCells = Math.pow(4, resolution);
  for (const orientation of orientations) {
    for (const [fi, fj] of pointFractions) {
      const i = fi * n;
      const j = fj * n;
      const s = tripleToS(roundToTriple([i, j], resolution), resolution, orientation);
      if (s < 0n || s >= BigInt(numCells)) {
        console.error(`  ERROR: pointToS(${i},${j}) out of range for res=${resolution}, ori=${orientation}: ${s}`);
        process.exit(1);
      }
      // Cross-check: the containing cell's centroid must map back to the same s
      // (triple -> IJ centroid: parity 0 -> (x+y+1/3, -x+1/3), parity 1 -> (x+y-1/3, -x+2/3))
      const {triple} = sToCell(s, resolution, orientation);
      const parity = tripleParity(triple);
      const ci = triple.x + triple.y + (parity === 0 ? 1 / 3 : -1 / 3);
      const cj = -triple.x + (parity === 0 ? 1 / 3 : 2 / 3);
      const sCentroid = tripleToS(roundToTriple([ci, cj], resolution), resolution, orientation);
      if (sCentroid !== s) {
        console.error(
          `  ERROR: pointToS centroid cross-check failed for (${i},${j}) res=${resolution}, ori=${orientation}: ${s} vs ${sCentroid}`
        );
        process.exit(1);
      }
      ijToSFixtures.push({i, j, resolution, orientation, s: Number(s)});
    }
  }
}
console.log(`  pointToS: ${ijToSFixtures.length} cases (all centroid cross-checks verified)`);

// --- tripleInBounds ---
const maxRow = 15; // resolution 4: 2^4 - 1
const boundsCases = [
  {x: 0, y: 0, z: 0, maxRow, expected: true},
  {x: -1, y: 2, z: 0, maxRow, expected: true},
  {x: 0, y: 1, z: 0, maxRow, expected: true},
  {x: -maxRow, y: maxRow, z: 0, maxRow, expected: true},
  {x: 0, y: maxRow, z: -maxRow, maxRow, expected: true},
  {x: 0, y: -1, z: 0, maxRow, expected: false},
  {x: 0, y: maxRow + 1, z: 0, maxRow, expected: false},
  {x: 1, y: 1, z: -1, maxRow, expected: false},
  {x: -1, y: 1, z: 1, maxRow, expected: false},
  {x: 0, y: 2, z: 0, maxRow, expected: false}
];
for (const tc of boundsCases) {
  const actual = tripleInBounds({x: tc.x, y: tc.y, z: tc.z}, tc.maxRow);
  if (actual !== tc.expected) {
    console.error(
      `  ERROR: tripleInBounds({${tc.x},${tc.y},${tc.z}}, ${tc.maxRow}) = ${actual}, expected ${tc.expected}`
    );
    process.exit(1);
  }
}
console.log(`  tripleInBounds: ${boundsCases.length} cases (all verified)`);

const fixtures = {
  sToCell: sToCellFixtures,
  pointToS: ijToSFixtures,
  tripleInBounds: boundsCases
};

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
