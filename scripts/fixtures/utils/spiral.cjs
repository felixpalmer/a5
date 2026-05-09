const fs = require('fs');
const path = require('path');
const { Spiral, SPIRAL_SAMPLE_COUNT } = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/utils');
const outputPath = path.join(outputDir, 'spiral.json');

// Each case: a center point in spherical (theta, phi) and a scale (radians).
// Scales mimic those used by sphericalToCell at various hilbertResolutions:
// scale = (70° in rad) / 2^hilbertResolution.
const SCALE_BASE = 70 * Math.PI / 180;
const cases = [
  // Equator-ish point (no degenerate orientation).
  {name: 'equator_low_res', center: [0.5, Math.PI / 2], scaleRad: SCALE_BASE},
  {name: 'equator_high_res', center: [0.5, Math.PI / 2], scaleRad: SCALE_BASE / 64},
  // Mid-latitudes.
  {name: 'midlat_north', center: [1.0, Math.PI / 4], scaleRad: SCALE_BASE / 4},
  {name: 'midlat_south', center: [-2.5, 3 * Math.PI / 4], scaleRad: SCALE_BASE / 16},
  // Canonical pole — quat.rotationTo identity case.
  {name: 'north_pole', center: [0, 0.001], scaleRad: SCALE_BASE / 8},
  // Antipode of canonical pole — quat.rotationTo's special-case path.
  {name: 'south_pole', center: [0, Math.PI - 0.001], scaleRad: SCALE_BASE / 8},
  // Right at the pole (numerically): exercises the antipode branch precisely.
  {name: 'south_pole_exact', center: [0, Math.PI], scaleRad: SCALE_BASE / 1024},
];

const fixtures = cases.map(c => {
  const spiral = new Spiral(c.center, c.scaleRad);
  const samples = [];
  for (let i = 0; i < SPIRAL_SAMPLE_COUNT; i++) {
    const s = spiral.sample(i);
    samples.push([s[0], s[1], s[2]]);
  }
  return {
    name: c.name,
    center: c.center,
    scaleRad: c.scaleRad,
    sampleCount: samples.length,
    samples,
  };
});

console.log('Generating utils/spiral fixtures...');
console.log(`  SPIRAL_SAMPLE_COUNT = ${SPIRAL_SAMPLE_COUNT}`);
for (const f of fixtures) {
  console.log(`  ${f.name}: center=[${f.center[0].toFixed(4)}, ${f.center[1].toFixed(4)}] scale=${f.scaleRad.toExponential(2)} samples=${f.sampleCount}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  sampleCount: SPIRAL_SAMPLE_COUNT,
  spiral: fixtures,
}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
