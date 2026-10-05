const fs = require('fs');
const path = require('path');
const {sToCell} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'triple-hierarchy.json');

// The cell hierarchy in triple space, taken from the curve itself: a cell's
// children are the 4 cells the curve visits next at the following level
// (4s .. 4s+3). Their order depends on the orientation; the set doesn't, which
// is what tripleChildren / tripleParent compute without the curve.

const key = t => [t.x, t.y, t.z];
const byCoords = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function hierarchyCase(s, hilbertRes, orientation) {
  const cell = sToCell(s, hilbertRes, orientation).triple;
  const children = [0n, 1n, 2n, 3n].map(i => key(sToCell(4n * s + i, hilbertRes + 1, orientation).triple));
  return {hilbertRes, triple: key(cell), children: children.sort(byCoords)};
}

// Deterministic 64-bit LCG, so the sampled deep cells are stable
let state = 12345n;
function random(bits) {
  state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
  return (state >> 8n) & ((1n << BigInt(bits)) - 1n);
}

const cases = [];
// Every cell of the shallow levels
for (let hilbertRes = 0; hilbertRes <= 3; hilbertRes++) {
  for (let s = 0n; s < 1n << BigInt(2 * hilbertRes); s++) cases.push(hierarchyCase(s, hilbertRes, 'uv'));
}
// Random cells down to Hilbert resolution 28 (the parent of A5 resolution 30), across orientations
const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
for (let hilbertRes = 4; hilbertRes <= 28; hilbertRes++) {
  for (let i = 0; i < 12; i++) cases.push(hierarchyCase(random(2 * hilbertRes), hilbertRes, orientations[i % 6]));
}

console.log('Generating traversal/triple-hierarchy fixtures...');
console.log(`  ${cases.length} cases`);
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({cases}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
