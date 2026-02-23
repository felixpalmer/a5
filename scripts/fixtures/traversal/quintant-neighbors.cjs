const fs = require('fs');
const path = require('path');
const { sToAnchor, anchorToTriple, tripleToAnchor, isNeighbor } = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'quintant-neighbors.json');

const resolution = 7;
const numCells = Math.pow(4, resolution);
const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];

console.log(`Generating neighbor fixtures at resolution ${resolution}...`);

// Use deterministic cell selection (no random) for reproducible fixtures
// Pick 20 evenly-spaced cells per orientation
const cellsPerOrientation = 10;

// Pre-build uv anchor cache: s -> triple -> uv anchor
// Since triple coordinates are orientation-independent, for any orientation
// we can get the triple, then use the uv anchor for isNeighbor validation.
// This is because isNeighbor's NEIGHBORS patterns are defined in uv/raw space.
const uvAnchors = new Map(); // triple key -> uv anchor
const sToTriple = new Map(); // `${s},${orientation}` -> triple key

for (const orientation of orientations) {
  for (let s = 0; s < numCells; s++) {
    const anchor = sToAnchor(BigInt(s), resolution, orientation);
    const triple = anchorToTriple(anchor);
    const tripleKey = `${triple.x},${triple.y},${triple.z}`;
    sToTriple.set(`${s},${orientation}`, tripleKey);

    // Build uv anchor for this triple if not already cached
    if (!uvAnchors.has(tripleKey)) {
      // Use tripleToAnchor to get the uv anchor from the triple.
      const uvAnchorObj = tripleToAnchor(triple, resolution, 'uv');
      if (uvAnchorObj) {
        uvAnchors.set(tripleKey, uvAnchorObj);
      }
    }
  }
}

const fixtures = [];

for (const orientation of orientations) {
  const testCells = [];
  for (let i = 0; i < cellsPerOrientation; i++) {
    testCells.push(Math.floor(i * numCells / cellsPerOrientation));
  }

  for (const s of testCells) {
    const tripleKey = sToTriple.get(`${s},${orientation}`);
    const uvAnchor = uvAnchors.get(tripleKey);
    const neighbors = [];

    // Brute force: check all cells using uv anchors for isNeighbor
    for (let candidateS = 0; candidateS < numCells; candidateS++) {
      if (candidateS === s) continue;
      const candidateTriple = sToTriple.get(`${candidateS},${orientation}`);
      const uvCandidate = uvAnchors.get(candidateTriple);
      if (uvAnchor && uvCandidate && isNeighbor(uvAnchor, uvCandidate)) {
        neighbors.push(candidateS);
      }
    }

    neighbors.sort((a, b) => a - b);

    fixtures.push({
      input: {
        s,
        resolution,
        orientation
      },
      output: {
        neighbors
      }
    });
  }

  console.log(`  ${orientation}: ${testCells.length} cells generated`);
}

// Sort by orientation then s value for deterministic output
fixtures.sort((a, b) => {
  const oCmp = a.input.orientation.localeCompare(b.input.orientation);
  if (oCmp !== 0) return oCmp;
  return a.input.s - b.input.s;
});

console.log(`Generated ${fixtures.length} test cases across ${orientations.length} orientations`);
console.log(`Average neighbors per cell: ${(fixtures.reduce((sum, f) => sum + f.output.neighbors.length, 0) / fixtures.length).toFixed(1)}`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Wrote fixtures to ${outputPath}`);
