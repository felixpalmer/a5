const fs = require('fs');
const path = require('path');
const {sampleGreatCircleArc, greatCircleDistance} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/utils');
const outputPath = path.join(outputDir, 'great-circle.json');

const DEG_TO_RAD = Math.PI / 180;

function llToVec(ll) {
  const lat = ll[1] * DEG_TO_RAD;
  const lon = ll[0] * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

// Each case: two endpoints (lon/lat) + sample interval (meters).
const cases = [
  // Short hop; should produce few or zero interior samples.
  {name: 'short_hop_10km', a: [0, 0], b: [0.1, 0], sampleInterval: 5_000},
  // Sub-interval distance: numSegments=1, no interior samples.
  {name: 'sub_interval', a: [0, 0], b: [0.001, 0], sampleInterval: 50_000},
  // Equatorial 1000km arc.
  {name: 'equator_1000km', a: [0, 0], b: [9, 0], sampleInterval: 100_000},
  // North-south meridian.
  {name: 'meridian', a: [0, -10], b: [0, 10], sampleInterval: 250_000},
  // Slanted long arc spanning 60 degrees.
  {name: 'slanted_long', a: [-30, -20], b: [30, 40], sampleInterval: 500_000},
  // Antimeridian crossing.
  {name: 'antimeridian', a: [170, 5], b: [-170, -5], sampleInterval: 200_000},
  // Polar arc (great circle through both poles).
  {name: 'over_pole', a: [0, 80], b: [180, 80], sampleInterval: 500_000}
];

const fixtures = cases.map(c => {
  const aVec = llToVec(c.a);
  const bVec = llToVec(c.b);
  const samples = sampleGreatCircleArc(aVec, bVec, c.sampleInterval);
  const distance = greatCircleDistance(aVec, bVec);
  return {
    name: c.name,
    a: c.a,
    b: c.b,
    aVec,
    bVec,
    sampleInterval: c.sampleInterval,
    distance,
    sampleCount: samples.length,
    samples: samples.map(s => [s[0], s[1], s[2]])
  };
});

console.log('Generating utils/great-circle fixtures...');
for (const f of fixtures) {
  console.log(`  ${f.name}: dist=${(f.distance / 1000).toFixed(1)}km samples=${f.sampleCount}`);
}

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({sampleGreatCircleArc: fixtures}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
