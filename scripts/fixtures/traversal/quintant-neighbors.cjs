const fs = require('fs');
const path = require('path');
const {sToCell, tripleToS, tripleInBounds, getPentagonVertices} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'quintant-neighbors.json');

const resolution = 7;
const numCells = Math.pow(4, resolution);
const orientations = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];

console.log(`Generating neighbor fixtures at resolution ${resolution}...`);

// Use deterministic cell selection (no random) for reproducible fixtures
const cellsPerOrientation = 10;

// GEOMETRIC brute-force oracle, independent of the neighbor implementation:
// two cells are neighbors iff their pentagons share at least one vertex
// (>= 2 shared: edge neighbor, exactly 1: vertex neighbor). Candidates are
// prefiltered to a ±2 triple window purely as an optimisation — pentagons
// further apart cannot touch (cell diameter < 2 lattice units).
function pentagonOf(cache, s, resolution, orientation) {
  let pent = cache.get(s);
  if (!pent) {
    const {triple, flavor} = sToCell(BigInt(s), resolution, orientation);
    pent = getPentagonVertices(resolution, 0, triple, flavor).getVertices();
    cache.set(s, pent);
  }
  return pent;
}

function sharesVertex(a, b, tol) {
  for (const p of a) {
    for (const q of b) {
      if (Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol) return true;
    }
  }
  return false;
}

const fixtures = [];

for (const orientation of orientations) {
  const testCells = [];
  for (let i = 0; i < cellsPerOrientation; i++) {
    testCells.push(Math.floor((i * numCells) / cellsPerOrientation));
  }

  const pentagonCache = new Map();
  const tol = 1e-7 / 2 ** resolution;

  for (const s of testCells) {
    const {triple} = sToCell(BigInt(s), resolution, orientation);
    const sourcePent = pentagonOf(pentagonCache, s, resolution, orientation);
    const neighbors = [];

    // ±2 triple window around the source cell
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const candidate = {x: triple.x + dx, y: triple.y + dy, z: triple.z + dz};
          const sum = candidate.x + candidate.y + candidate.z;
          if (sum !== 0 && sum !== 1) continue;
          if (!tripleInBounds(candidate, Math.pow(2, resolution) - 1)) continue;
          const candidateS = tripleToS(candidate, resolution, orientation);
          if (candidateS === null || candidateS < 0n || candidateS >= BigInt(numCells)) continue;
          // tripleToS maps out-of-quintant triples onto some in-quintant cell;
          // verify the round trip identifies the same cell
          const back = sToCell(candidateS, resolution, orientation).triple;
          if (back.x !== candidate.x || back.y !== candidate.y || back.z !== candidate.z) continue;
          const candPent = pentagonOf(pentagonCache, Number(candidateS), resolution, orientation);
          if (sharesVertex(sourcePent, candPent, tol)) {
            neighbors.push(Number(candidateS));
          }
        }
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
console.log(
  `Average neighbors per cell: ${(fixtures.reduce((sum, f) => sum + f.output.neighbors.length, 0) / fixtures.length).toFixed(1)}`
);

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Wrote fixtures to ${outputPath}`);
