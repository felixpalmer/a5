const fs = require('fs');
const path = require('path');

const {
  cellToChildren,
  cellToParent,
  lonLatToCell,
  polygonToCells,
  sphericalCap,
  gridDisk,
  compact,
  uncompact,
  union,
  intersect,
  difference,
  contains,
  overlaps,
  count,
  area,
  cellArea,
  coveringResolution,
  WORLD_CELL,
  u64ToHex
} = require('../../a5-test.cjs');
const {
  compactionMarker,
  isCompactionMarker,
  sortByCurve,
  flatAt,
  sameSet,
  res30Cell,
  throws
} = require('./covering-utils.cjs');

const hex = cells => Array.from(cells, c => u64ToHex(c));
const fail = message => {
  throw new Error(`covering fixtures: ${message}`);
};

// Small coverings, so brute-force checks stay cheap
const rect = (lon0, lat0, lon1, lat1) => [
  [lon0, lat0],
  [lon1, lat0],
  [lon1, lat1],
  [lon0, lat1]
];
const london = lonLatToCell([-0.1276, 51.5074], 9);
const paris = lonLatToCell([2.3522, 48.8566], 7);
const res0 = cellToChildren(WORLD_CELL, 0);
const res1 = cellToChildren(WORLD_CELL, 1);
const leaf35 = res30Cell(35, 123456789n);
const block35 = cellToChildren(cellToParent(leaf35, 27), 30);
const leaf41 = res30Cell(41, 987654321n);

// Set operations need both sets at one resolution (A5 resolutions don't nest),
// so each pair below shares one, across resolutions 0/1, 6-9 and 30
const sets = {
  rectLondon7: polygonToCells(rect(-1, 51, 1, 52.5), 7),
  rectEast7: polygonToCells(rect(0, 51.5, 2, 53), 7),
  capParis7: sphericalCap(paris, 300_000),
  rectLondon9: polygonToCells(rect(-1, 51, 1, 52.5), 9),
  diskLondon9: gridDisk(london, 4),
  rectEast8: polygonToCells(rect(0, 51.5, 2, 53), 8),
  res1Some: compact([...res1.slice(10, 15), res1[30], res1[44]]),
  res1Other: compact([...res0.slice(2, 4).flatMap(c => cellToChildren(c, 1)), res1[44], res1[50]]),
  world: BigUint64Array.from([WORLD_CELL]),
  rectLondon6: polygonToCells(rect(-1, 51, 1, 52.5), 6),
  empty: BigUint64Array.from([compactionMarker(6)]),
  res30a: compact([...block35.slice(5, 40), leaf41]),
  res30b: compact([...block35.slice(30, 64), cellToParent(leaf41, 28)]),
  flatNoMarker: uncompact(polygonToCells(rect(0.5, 51.8, 1.5, 52.2), 8))
};

const pairs = [
  ['rectLondon7', 'rectEast7'],
  ['rectLondon7', 'capParis7'],
  ['diskLondon9', 'rectLondon9'],
  ['res1Some', 'res1Other'],
  ['empty', 'rectLondon6'],
  ['res30a', 'res30b'],
  ['flatNoMarker', 'rectEast8']
];

// Set operations, checked against brute-force sets at the pair's resolution
const setOperations = pairs.map(([nameA, nameB]) => {
  const a = sets[nameA];
  const b = sets[nameB];
  const resolution = coveringResolution(a);
  if (coveringResolution(b) !== resolution) fail(`${nameA} ${nameB} resolutions differ`);
  const A = flatAt(a, resolution);
  const B = flatAt(b, resolution);
  const expected = {
    union: new Set([...A, ...B]),
    intersect: new Set([...A].filter(x => B.has(x))),
    difference: new Set([...A].filter(x => !B.has(x)))
  };
  const results = {union: union(a, b), intersect: intersect(a, b), difference: difference(a, b)};
  for (const op of Object.keys(results)) {
    const result = Array.from(results[op]);
    if (!sameSet(flatAt(result, resolution), expected[op])) fail(`${op} ${nameA} ${nameB}`);
    if (result[result.length - 1] !== compactionMarker(resolution)) fail(`${op} ${nameA} ${nameB} compaction marker`);
    const cells = result.slice(0, -1);
    if (sortByCurve(cells).some((c, i) => c !== cells[i])) fail(`${op} ${nameA} ${nameB} curve order`);
    const again = Array.from(compact(result));
    if (again.length !== result.length || again.some((c, i) => c !== result[i]))
      fail(`${op} ${nameA} ${nameB} not compact`);
  }
  const overlapsExpected = expected.intersect.size > 0;
  if (overlaps(a, b) !== overlapsExpected) fail(`overlaps ${nameA} ${nameB}`);
  return {
    name: `${nameA}_${nameB}`,
    a: hex(a),
    b: hex(b),
    resolution,
    union: hex(results.union),
    intersect: hex(results.intersect),
    difference: hex(results.difference),
    overlaps: overlapsExpected
  };
});

// Per-set measures: resolution, count, area
const measures = Object.entries(sets).map(([name, cells]) => {
  const resolution = coveringResolution(cells);
  const flat = flatAt(cells, resolution);
  if (count(cells) !== BigInt(flat.size)) fail(`count ${name}`);
  const expectedArea = flat.size * cellArea(resolution);
  if (Math.abs(area(cells) - expectedArea) > 1e-9 * expectedArea) fail(`area ${name}`);

  // uncompact: exactly the cells, in curve order
  const sorted = sortByCurve([...flat]);
  const flatResult = Array.from(uncompact(cells));
  if (flatResult.length !== sorted.length || flatResult.some((c, i) => c !== sorted[i])) fail(`uncompact ${name}`);

  return {
    name,
    cells: hex(cells),
    resolution,
    count: count(cells).toString(),
    area: area(cells)
  };
});

// contains: members and nearby cells, all at the set's resolution
const containsCases = ['rectLondon7', 'capParis7', 'res1Some', 'res30a', 'flatNoMarker'].map(name => {
  const cells = sets[name];
  const resolution = coveringResolution(cells);
  const flat = flatAt(cells, resolution);
  const members = [...flat].slice(0, 12);
  const probes = new Set(members);
  if (resolution === 1) {
    for (const c of res1) probes.add(c);
  } else if (resolution === 30) {
    for (const c of block35) probes.add(c);
    probes.add(res30Cell(3, 42n));
  } else {
    for (const c of uncompact(gridDisk(members[0], 3))) probes.add(c);
  }
  return {
    name,
    cells: hex(cells),
    probes: [...probes].map(probe => {
      const expected = flat.has(probe);
      if (contains(cells, probe) !== expected) fail(`contains ${name} ${u64ToHex(probe)}`);
      return {cell: u64ToHex(probe), expected};
    })
  };
});

// contains refuses cells at another resolution (A5 cells don't nest across resolutions)
const mismatchedProbes = ['rectLondon7', 'res30a'].map(name => {
  const cells = sets[name];
  const resolution = coveringResolution(cells);
  const member = [...flatAt(cells, resolution)][0];
  const probes = [cellToParent(member, resolution - 1), cellToParent(member, resolution - 3)];
  if (resolution < 30) probes.push(cellToChildren(member, resolution + 1)[1]);
  for (const probe of probes) {
    if (!throws(() => contains(cells, probe))) fail(`contains ${name} ${u64ToHex(probe)} should throw`);
  }
  return {name, cells: hex(cells), probes: hex(probes)};
});

// isCompactionMarker: every compaction marker, and values that look like one but are not
const res30TopBits60 = res30Cell(30, 42n); // a real cell whose top 6 bits read 60
const res30TopBits61 = res30Cell(30, 1n << 57n); // ... and 61
if (res30TopBits60 >> 58n !== 60n || res30TopBits61 >> 58n !== 61n) fail('res-30 lookalikes');
const prefix = 60n << 58n;
const markerCases = [
  ...Array.from({length: 31}, (_, r) => ({value: u64ToHex(compactionMarker(r)), expected: true, resolution: r})),
  // Bits with no meaning yet are ignored when read
  {value: u64ToHex(compactionMarker(10) | (1n << 57n) | (1n << 20n)), expected: true, resolution: 10},
  {value: u64ToHex(res30TopBits60), expected: false},
  {value: u64ToHex(res30TopBits61), expected: false},
  {value: u64ToHex(prefix | (31n << 48n) | 0x40n), expected: false}, // no resolution 31
  {value: u64ToHex(prefix | (10n << 48n)), expected: false}, // no marker
  {value: u64ToHex(prefix | (10n << 48n) | 0x80n), expected: false}, // marker in the wrong place
  {value: u64ToHex((61n << 58n) | (1n << 39n)), expected: false}, // earlier format, quintant 61
  {value: u64ToHex(WORLD_CELL), expected: false},
  {value: u64ToHex(london), expected: false},
  {value: u64ToHex(leaf41), expected: false}
];
for (const p of markerCases) {
  if (isCompactionMarker(BigInt('0x' + p.value)) !== p.expected) fail(`spec isCompactionMarker ${p.value}`);
}

// Sets at different resolutions can't be combined
const mismatchedResolutions = [
  ['rectLondon7', 'rectEast8'],
  ['res1Some', 'rectLondon6'],
  ['res30a', 'diskLondon9'],
  ['world', 'rectLondon6']
].map(([nameA, nameB]) => {
  for (const operation of [union, intersect, difference, overlaps]) {
    if (!throws(() => operation(sets[nameA], sets[nameB]))) fail(`${operation.name} ${nameA} ${nameB} should throw`);
  }
  return {name: `${nameA}_${nameB}`, a: hex(sets[nameA]), b: hex(sets[nameB])};
});

// Values that are not cells: every function taking cells must refuse them, while
// the valid values at the edges of the encoding pass
const tagAt = r => (r === 0 ? 1n << 57n : r === 1 ? 1n << 56n : 1n << BigInt(59 - 2 * r));
const invalidCells = [
  (5n << 58n) | (1n << 6n), // a tag at an even bit, which no resolution uses
  1n << 58n, // a tag above res 0's
  1n << 63n,
  (12n << 58n) | tagAt(0), // res 0, origin 12 (only 0-11 exist)
  (63n << 58n) | tagAt(0),
  (60n << 58n) | tagAt(1), // res 1, quintant 60 (only 0-59 exist)
  (63n << 58n) | tagAt(12), // res 12, quintant 63
  (60n << 58n) | (31n << 48n) | 0x40n // a compaction marker for resolution 31, which doesn't exist
];
const validEdgeCells = [
  (11n << 58n) | tagAt(0),
  (59n << 58n) | tagAt(1),
  (59n << 58n) | tagAt(2),
  (59n << 58n) | tagAt(29),
  res30Cell(0, 0n),
  res30Cell(31, (1n << 58n) - 1n),
  res30Cell(39, 5n),
  res30Cell(41, 7n)
];
const cellOperations = {
  compact: cells => compact(cells),
  uncompact: cells => uncompact(cells),
  count: cells => count(cells),
  area: cells => area(cells),
  union: cells => union(cells, cells),
  contains: cells => contains(cells, cells[0])
};
for (const cell of invalidCells) {
  if (isCompactionMarker(cell)) fail(`${u64ToHex(cell)} is a compaction marker`);
  for (const [name, operation] of Object.entries(cellOperations)) {
    if (!throws(() => operation([cell]))) fail(`${name} ${u64ToHex(cell)} should throw`);
  }
}
for (const cell of validEdgeCells) {
  for (const [name, operation] of Object.entries(cellOperations)) {
    if (throws(() => operation([cell]))) fail(`${name} ${u64ToHex(cell)} should not throw`);
  }
}

const output = {
  setOperations,
  mismatchedResolutions,
  measures,
  contains: containsCases,
  mismatchedProbes,
  isCompactionMarker: markerCases,
  invalidCells: hex(invalidCells),
  validEdgeCells: hex(validEdgeCells)
};
const outputPath = path.join(__dirname, '../../../tests/fixtures/covering.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Generated covering fixtures: ${outputPath}`);
console.log(`  - ${setOperations.length} set operation cases`);
console.log(`  - ${mismatchedResolutions.length} mismatched resolution cases`);
console.log(`  - ${measures.length} measure cases`);
console.log(`  - ${containsCases.length} contains cases`);
console.log(`  - ${mismatchedProbes.length} mismatched probe cases`);
console.log(`  - ${markerCases.length} isCompactionMarker cases`);
console.log(`  - ${invalidCells.length} invalid and ${validEdgeCells.length} valid edge cells`);
