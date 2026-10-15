const fs = require('fs');
const path = require('path');

const {lonLatToCell, origins, toLonLat, u64ToHex} = require('../../a5-test.cjs');

// A lookup's result must not depend on the lookups before it. lonLatToCell
// reuses the previous lookup's cell when the point projects inside it, and the
// face projection maps points from other faces into the face's frame too (a
// face center onto the antipodal face's center), so the south pole used to come
// back as the north pole's cell. The fixture is a sequence of lookups, to be
// made in order, each with the cell a cold lookup of that point gives.

const MAX_RESOLUTION = 30;

// The poles, then the face centers
const points = [[0, 90], [0, -90], ...origins.map(o => toLonLat(o.axis))];
const FIRST_CENTER = 2;
const numCenters = origins.length;

/**
 * A walk through the face centers taking every ordered pair (a, b), a = b
 * included, as consecutive lookups: an Eulerian circuit of the complete
 * directed graph with self-loops (Hierholzer's algorithm).
 */
function everyOrderedPair(n) {
  const next = new Array(n).fill(0);
  const stack = [0];
  const walk = [];
  while (stack.length > 0) {
    const v = stack[stack.length - 1];
    if (next[v] < n) {
      stack.push(next[v]++);
    } else {
      walk.push(stack.pop());
    }
  }
  return walk.reverse();
}

const centerWalk = everyOrderedPair(numCenters).map(i => FIRST_CENTER + i);
const lookups = [0, 1, ...centerWalk];

// A lookup at another resolution leaves nothing for this one to reuse
const cold = (point, resolution) => {
  lonLatToCell(point, (resolution + 1) % (MAX_RESOLUTION + 1));
  return lonLatToCell(point, resolution);
};

const sequences = [];
for (let resolution = 1; resolution <= MAX_RESOLUTION; resolution++) {
  const expected = points.map(p => cold(p, resolution));
  const cells = [];
  for (const i of lookups) {
    const cell = lonLatToCell(points[i], resolution);
    if (cell !== expected[i]) {
      console.log(`  WARNING: res ${resolution} point ${i} depends on the previous lookup`);
    }
    cells.push(u64ToHex(expected[i]));
  }
  sequences.push({resolution, lookups, cells});
}

const outputDir = path.join(__dirname, '../../../tests/fixtures');
const outputPath = path.join(outputDir, 'lonlat-to-cell-sequence.json');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({points, sequences}, null, 2));
console.log(`Generated ${sequences.length} lonlat-to-cell sequences at: ${outputPath}`);
