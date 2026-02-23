const fs = require('fs');
const path = require('path');
const {
  sToAnchor,
  anchorToTriple,
  tripleToAnchor,
  tripleToS,
  tripleParity,
  tripleInBounds,
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'triple.json');

console.log('Generating lattice/triple fixtures...');

const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
const resolutions = [3, 5, 7];

// --- anchorToTriple + tripleToS round-trip ---
const anchorToTripleFixtures = [];
for (const resolution of resolutions) {
  const numCells = Math.pow(4, resolution);
  const sValues = Array.from({length: 10}, (_, i) => Math.floor(i * numCells / 10));

  for (const orientation of orientations) {
    for (const s of sValues) {
      const anchor = sToAnchor(BigInt(s), resolution, orientation);
      const triple = anchorToTriple(anchor);
      const parity = tripleParity(triple);

      // Verify round-trip: tripleToS should return the original s
      const roundTrip = tripleToS(triple, resolution, orientation);
      if (roundTrip === null || Number(roundTrip) !== s) {
        console.error(`  ERROR: tripleToS round-trip failed for s=${s}, res=${resolution}, ori=${orientation}: got ${roundTrip}`);
        process.exit(1);
      }

      // Verify tripleToAnchor produces a matching anchor
      const anchorBack = tripleToAnchor(triple, resolution, orientation);
      if (!anchorBack ||
          anchorBack.offset[0] !== anchor.offset[0] ||
          anchorBack.offset[1] !== anchor.offset[1] ||
          anchorBack.flips[0] !== anchor.flips[0] ||
          anchorBack.flips[1] !== anchor.flips[1]) {
        console.error(`  ERROR: tripleToAnchor mismatch for s=${s}, res=${resolution}, ori=${orientation}`);
        process.exit(1);
      }

      anchorToTripleFixtures.push({
        s,
        resolution,
        orientation,
        x: triple.x,
        y: triple.y,
        z: triple.z,
        parity,
      });
    }
  }
}
console.log(`  anchorToTriple: ${anchorToTripleFixtures.length} cases (all round-trips verified)`);

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
  {x: 0, y: 2, z: 0, maxRow, expected: false},
];
// Verify
for (const tc of boundsCases) {
  const actual = tripleInBounds({x: tc.x, y: tc.y, z: tc.z}, tc.maxRow);
  if (actual !== tc.expected) {
    console.error(`  ERROR: tripleInBounds({${tc.x},${tc.y},${tc.z}}, ${tc.maxRow}) = ${actual}, expected ${tc.expected}`);
    process.exit(1);
  }
}
console.log(`  tripleInBounds: ${boundsCases.length} cases (all verified)`);

const fixtures = {
  anchorToTriple: anchorToTripleFixtures,
  tripleInBounds: boundsCases,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
