const fs = require('fs');
const path = require('path');
const {lsystemSToCell, lsystemTripleToS, lsystemIJToS, tripleParity} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'lsystem.json');

console.log('Generating lattice/lsystem fixtures...');

// The non-self-intersecting L-system curve — the planned FUTURE canonical
// curve (a breaking change of all cell IDs). Pinned here so its behavior is
// locked in ahead of the canonical swap; these values must not change when
// the swap happens (curve.json will simply be regenerated to equal them).
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
      const {triple, flavor} = lsystemSToCell(BigInt(s), resolution, orientation);
      const parity = tripleParity(triple);

      // Verify round-trip: tripleToS should return the original s
      const roundTrip = lsystemTripleToS(triple, resolution, orientation);
      if (roundTrip === null || Number(roundTrip) !== s) {
        console.error(
          `  ERROR: lsystemTripleToS round-trip failed for s=${s}, res=${resolution}, ori=${orientation}: got ${roundTrip}`
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
console.log(`  lsystemSToCell: ${sToCellFixtures.length} cases (all round-trips verified)`);

// --- IJToS: fractional IJ point -> s of the containing cell ---
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
      const s = lsystemIJToS([i, j], resolution, orientation);
      if (s < 0n || s >= BigInt(numCells)) {
        console.error(`  ERROR: lsystemIJToS(${i},${j}) out of range for res=${resolution}, ori=${orientation}: ${s}`);
        process.exit(1);
      }
      // Cross-check: the containing cell's centroid must map back to the same s
      // (triple -> IJ centroid: parity 0 -> (x+y+1/3, -x+1/3), parity 1 -> (x+y-1/3, -x+2/3))
      const {triple} = lsystemSToCell(s, resolution, orientation);
      const parity = tripleParity(triple);
      const ci = triple.x + triple.y + (parity === 0 ? 1 / 3 : -1 / 3);
      const cj = -triple.x + (parity === 0 ? 1 / 3 : 2 / 3);
      const sCentroid = lsystemIJToS([ci, cj], resolution, orientation);
      if (sCentroid !== s) {
        console.error(
          `  ERROR: lsystemIJToS centroid cross-check failed for (${i},${j}) res=${resolution}, ori=${orientation}: ${s} vs ${sCentroid}`
        );
        process.exit(1);
      }
      ijToSFixtures.push({i, j, resolution, orientation, s: Number(s)});
    }
  }
}
console.log(`  lsystemIJToS: ${ijToSFixtures.length} cases (all centroid cross-checks verified)`);

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({sToCell: sToCellFixtures, IJToS: ijToSFixtures}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
