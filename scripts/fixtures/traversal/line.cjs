const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  lonLatToCell,
  cellToBoundary,
  u64ToHex,
  lineStringToCells,
  fromLonLat,
  toCartesian
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'line.json');

/**
 * Test whether two great-circle segments intersect on the sphere.
 * Uses opposite-sides test plus a proximity check to reject antipodal false positives.
 */
function segmentsIntersect(av, bv, cv, dv) {
  const n1x = av[1] * bv[2] - av[2] * bv[1];
  const n1y = av[2] * bv[0] - av[0] * bv[2];
  const n1z = av[0] * bv[1] - av[1] * bv[0];
  const cDotN1 = cv[0] * n1x + cv[1] * n1y + cv[2] * n1z;
  const dDotN1 = dv[0] * n1x + dv[1] * n1y + dv[2] * n1z;
  if (cDotN1 * dDotN1 > 0) return false;

  const n2x = cv[1] * dv[2] - cv[2] * dv[1];
  const n2y = cv[2] * dv[0] - cv[0] * dv[2];
  const n2z = cv[0] * dv[1] - cv[1] * dv[0];
  const aDotN2 = av[0] * n2x + av[1] * n2y + av[2] * n2z;
  const bDotN2 = bv[0] * n2x + bv[1] * n2y + bv[2] * n2z;
  if (aDotN2 * bDotN2 > 0) return false;

  // Reject antipodal intersections: the midpoints of the two segments
  // must be in the same hemisphere (dot product > 0)
  const m1x = av[0] + bv[0],
    m1y = av[1] + bv[1],
    m1z = av[2] + bv[2];
  const m2x = cv[0] + dv[0],
    m2y = cv[1] + dv[1],
    m2z = cv[2] + dv[2];
  if (m1x * m2x + m1y * m2y + m1z * m2z < 0) return false;

  return true;
}

// Dense per-edge subdivision. The cell pentagon edges are straight in Face
// coords but curved on the sphere; we need a fine polyline so the great-circle
// intersection test approximates the true projected curve. 64 sub-segments per
// edge is well below cell-radius / 1000 in arc length at the resolutions used.
const BOUNDARY_SEGMENTS = 64;

/**
 * Authoritative brute-force: scan every cell at the given resolution and accept
 * any whose densely-sampled boundary intersects the great-circle segment, or
 * which contains an endpoint. Different code path from the production algorithm
 * (which works in Face coordinates), so it's a genuine cross-check.
 */
function bruteForceLineSegmentToCells(start, end, resolution) {
  const startVec = toCartesian(fromLonLat(start));
  const endVec = toCartesian(fromLonLat(end));
  const startCell = lonLatToCell(start, resolution);
  const endCell = lonLatToCell(end, resolution);

  const allCells = getRes0Cells().flatMap(c => cellToChildren(c, resolution));

  const result = [];
  for (const cellId of allCells) {
    if (cellId === startCell || cellId === endCell) {
      result.push(cellId);
      continue;
    }

    const boundary = cellToBoundary(cellId, {closedRing: true, segments: BOUNDARY_SEGMENTS});
    const boundaryVecs = boundary.map(ll => toCartesian(fromLonLat(ll)));

    let intersects = false;
    for (let i = 0; i < boundaryVecs.length - 1; i++) {
      if (segmentsIntersect(startVec, endVec, boundaryVecs[i], boundaryVecs[i + 1])) {
        intersects = true;
        break;
      }
    }

    if (intersects) {
      result.push(cellId);
    }
  }

  return result.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Generate fixtures ---
console.log('Generating traversal/line fixtures...');

// Use low resolution for brute force (res 3 = 3840 cells)
const resolution = 3;

// --- Line segment test cases ---
const lineSegmentCases = [
  {name: 'short_europe', start: [0, 51], end: [10, 48]},
  {name: 'long_diagonal', start: [-10, 55], end: [20, 40]},
  {name: 'cross_meridian', start: [-5, 50], end: [5, 50]},
  {name: 'near_equator', start: [-10, 2], end: [10, -2]}
];

console.log(`\nLine segment fixtures (res ${resolution}):`);
const lineSegmentFixtures = [];
for (const tc of lineSegmentCases) {
  console.log(`  ${tc.name}...`);
  const expected = bruteForceLineSegmentToCells(tc.start, tc.end, resolution);
  const actual = lineStringToCells([tc.start, tc.end], resolution);
  const actualSorted = [...actual].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  console.log(`    brute-force: ${expected.length}, algorithm: ${actual.length}`);
  lineSegmentFixtures.push({
    name: tc.name,
    start: tc.start,
    end: tc.end,
    resolution,
    cells: expected.map(c => u64ToHex(c))
  });
}

const fixtures = {
  lineSegment: lineSegmentFixtures
};

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`\nWrote line fixtures to ${outputPath}`);
