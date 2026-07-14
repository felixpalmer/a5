const fs = require('fs');
const path = require('path');
const {compatSToCell, compatTripleToS, compatIJToS} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'compat.json');

console.log('Generating lattice/compat fixtures...');

// The compat curve is the ORIGINAL (pre-L-system) A5 curve. Its initial
// correctness was established bit-for-bit against the original engine
// (101k cells + 84k encode points, zero mismatches, all orientations);
// these fixtures pin that behavior against regressions.
const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
const resolutions = [3, 5, 7];

const sToCellFixtures = [];
for (const resolution of resolutions) {
  const numCells = Math.pow(4, resolution);
  const sValues = Array.from({length: 10}, (_, i) => Math.floor((i * numCells) / 10));

  for (const orientation of orientations) {
    for (const s of sValues) {
      const {triple, flavor} = compatSToCell(BigInt(s), resolution, orientation);

      // Verify round-trip
      const roundTrip = compatTripleToS(triple, resolution, orientation);
      if (roundTrip === null || Number(roundTrip) !== s) {
        console.error(
          `  ERROR: compatTripleToS round-trip failed for s=${s}, res=${resolution}, ori=${orientation}: got ${roundTrip}`
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
        flavor
      });
    }
  }
}
console.log(`  compatSToCell: ${sToCellFixtures.length} cases (all round-trips verified)`);

// --- compatIJToS: fractional IJ point -> old-curve s of the containing cell ---
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
      const s = compatIJToS([i, j], resolution, orientation);
      if (s < 0n || s >= BigInt(numCells)) {
        console.error(`  ERROR: compatIJToS(${i},${j}) out of range for res=${resolution}, ori=${orientation}: ${s}`);
        process.exit(1);
      }
      ijToSFixtures.push({i, j, resolution, orientation, s: Number(s)});
    }
  }
}
console.log(`  compatIJToS: ${ijToSFixtures.length} cases`);

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({sToCell: sToCellFixtures, IJToS: ijToSFixtures}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
