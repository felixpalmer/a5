const fs = require('fs');
const path = require('path');

const {
  lonLatToCell,
  deserialize,
  serialize,
  segmentToQuintant,
  faceStep,
  sToTriple,
  compatTripleToS,
  u64ToHex,
  FIRST_HILBERT_RESOLUTION
} = require('../../a5-test.cjs');

// Pairs of (v0 id, v1 id) for the same cell. The v1 id comes from lonLatToCell;
// the v0 id is derived independently of migrate() by running the conversion in
// reverse: v1 S -> triple (new curve) -> S on the original curve (compat, which
// is pinned bit-for-bit to the pre-v1 engine by lattice/compat.json), placed in
// the cell's quintant under the v0 face layout.

// v0 face layouts, by origin id (curve order)
const FAN = ['vu', 'uw', 'vw', 'vw', 'vw'];
const COUNTER_STEP = ['wu', 'uv', 'wv', 'wu', 'uw'];
const COUNTER_JUMP = ['vu', 'uv', 'wv', 'wu', 'uw'];
const CLOCKWISE_STEP = ['wu', 'uw', 'vw', 'vu', 'uw'];
const V0_LAYOUTS = [
  [FAN, 4],
  [COUNTER_JUMP, 2],
  [COUNTER_STEP, 3],
  [COUNTER_STEP, 0],
  [CLOCKWISE_STEP, 2],
  [COUNTER_JUMP, 4],
  [CLOCKWISE_STEP, 2],
  [CLOCKWISE_STEP, 2],
  [COUNTER_STEP, 3],
  [COUNTER_JUMP, 0],
  [COUNTER_JUMP, 3],
  [CLOCKWISE_STEP, 0]
].map(([orientation, firstQuintant]) => ({orientation, firstQuintant}));

function toV0(cell) {
  const {origin, segment, S, resolution} = deserialize(cell);
  if (resolution < FIRST_HILBERT_RESOLUTION - 1) return cell;
  const {quintant, orientation} = segmentToQuintant(segment, origin);
  const v0 = V0_LAYOUTS[origin.id];
  const v0FaceRelativeQuintant = (faceStep(origin) * (quintant - v0.firstQuintant) + 10) % 5;
  // serialize() stores the face-relative quintant against the v1 firstQuintant
  const v0Segment = (origin.firstQuintant + v0FaceRelativeQuintant) % 5;
  if (resolution < FIRST_HILBERT_RESOLUTION) return serialize({origin, segment: v0Segment, S: 0n, resolution});
  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const triple = sToTriple(S, hilbertResolution, orientation);
  const oldS = compatTripleToS(triple, hilbertResolution, v0.orientation[v0FaceRelativeQuintant]);
  return serialize({origin, segment: v0Segment, S: oldS, resolution});
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
