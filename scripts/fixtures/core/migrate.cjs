const fs = require('fs');
const path = require('path');

const {
  lonLatToCell,
  deserialize,
  serialize,
  segmentToQuintant,
  sToTriple,
  compatTripleToS,
  u64ToHex,
  FIRST_HILBERT_RESOLUTION
} = require('../../a5-test.cjs');

// Pairs of (v0 id, v1 id) for the same cell. The v1 id comes from lonLatToCell;
// the v0 id is derived independently of migrate() by running the conversion in
// reverse: v1 S -> triple (new curve) -> S on the original curve (compat, which
// is pinned bit-for-bit to the pre-v1 engine by lattice/compat.json).
function toV0(cell) {
  const {origin, segment, S, resolution} = deserialize(cell);
  if (resolution < FIRST_HILBERT_RESOLUTION) return cell;
  const {orientation} = segmentToQuintant(segment, origin);
  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const triple = sToTriple(S, hilbertResolution, orientation);
  const oldS = compatTripleToS(triple, hilbertResolution, orientation);
  return serialize({origin, segment, S: oldS, resolution});
}

// Deterministic LCG so the fixture is stable across runs
let seed = 42;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

function generateMigrateFixtures() {
  const fixtures = [];
  for (let resolution = 0; resolution <= 30; resolution++) {
    for (let k = 0; k < 10; k++) {
      const lon = random() * 360 - 180;
      const lat = (Math.asin(random() * 2 - 1) * 180) / Math.PI;
      const v1 = lonLatToCell([lon, lat], resolution);
      fixtures.push({v0: u64ToHex(toV0(v1)), v1: u64ToHex(v1)});
    }
  }
  return fixtures;
}

const outputPath = path.join(__dirname, '../../../tests/fixtures/migrate.json');
fs.writeFileSync(outputPath, JSON.stringify(generateMigrateFixtures(), null, 2));
console.log(`Generated migrate fixtures: ${outputPath}`);
