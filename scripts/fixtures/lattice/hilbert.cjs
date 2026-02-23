const fs = require('fs');
const path = require('path');
const { sToAnchor, anchorToS } = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'hilbert.json');

console.log('Generating lattice/hilbert fixtures...');

const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
const resolutions = [3, 5, 7];

// --- sToAnchor + anchorToS round-trip ---
const sToAnchorFixtures = [];
for (const resolution of resolutions) {
  const numCells = Math.pow(4, resolution);
  // Pick 10 evenly-spaced s-values per (resolution, orientation)
  const sValues = Array.from({length: 10}, (_, i) => Math.floor(i * numCells / 10));

  for (const orientation of orientations) {
    for (const s of sValues) {
      const anchor = sToAnchor(BigInt(s), resolution, orientation);
      const roundTrip = Number(anchorToS(anchor, resolution, orientation));

      if (roundTrip !== s) {
        console.error(`  ERROR: sToAnchor round-trip failed for s=${s}, res=${resolution}, ori=${orientation}: got ${roundTrip}`);
        process.exit(1);
      }

      sToAnchorFixtures.push({
        s,
        resolution,
        orientation,
        q: anchor.q,
        offset: [anchor.offset[0], anchor.offset[1]],
        flips: [anchor.flips[0], anchor.flips[1]],
      });
    }
  }
}
console.log(`  sToAnchor: ${sToAnchorFixtures.length} cases (all round-trips verified)`);

const fixtures = {
  sToAnchor: sToAnchorFixtures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
