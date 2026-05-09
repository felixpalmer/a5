const fs = require('fs');
const path = require('path');
const {pointInSphericalPolygon, ringWindingSign} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/geometry');
const outputPath = path.join(outputDir, 'spherical-polygon-primitives.json');

const DEG_TO_RAD = Math.PI / 180;

/** Convert lon/lat (degrees) to unit 3D vector. */
function llToVec(ll) {
  const lat = ll[1] * DEG_TO_RAD;
  const lon = ll[0] * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

// --- pointInSphericalPolygon ---
// Each case: ring (lon/lat polygon, CCW), points (test points in lon/lat).
// prettier-ignore
const pipCases = [
  {
    name: 'simple_quad',
    ring: [[-5, 44], [15, 44], [15, 54], [-5, 54]],
    points: [
      [5, 49],   // inside
      [0, 50],   // inside
      [20, 49],  // outside east
      [-10, 49], // outside west
      [5, 60],   // outside north
      [5, 40]    // outside south
    ]
  },
  {
    name: 'concave_l_shape',
    ring: [[-5, 44], [15, 44], [15, 50], [5, 50], [5, 54], [-5, 54]],
    points: [
      [0, 47],   // inside (lower bar)
      [10, 47],  // inside (lower bar, right)
      [0, 52],   // inside (upper bar)
      [10, 52],  // outside (notch)
      [12, 52],  // outside (notch, right)
      [-10, 49]  // outside
    ]
  },
  {
    name: 'concave_zigzag',
    ring: [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [10, 10], [10, 15], [0, 15]],
    points: [
      [2, 7],  // inside
      [7, 2],  // inside
      [7, 7],  // outside (notch)
      [7, 12], // inside
      [-1, 7]  // outside
    ]
  },
  {
    // Triangle straddling the antimeridian. Verifies the great-circle PIP
    // correctly handles longitudes wrapping past ±180°.
    name: 'antimeridian_triangle',
    ring: [[170, 10], [-170, 10], [-180, -10]],
    points: [
      [180, 0],  // inside (on antimeridian)
      [175, 5],  // inside (near east edge)
      [-175, 5], // inside (near west edge)
      [160, 0],  // outside
      [-160, 0]  // outside
    ]
  },
  {
    // Polygon enclosing the north pole. Sums to ±2π only with proper signed-angle handling.
    name: 'arctic_cap',
    ring: [[0, 75], [120, 75], [-120, 75]],
    points: [
      [0, 89],   // inside (near pole)
      [60, 80],  // inside
      [0, 60],   // outside
      [180, 70]  // outside
    ]
  },
  {
    name: 'tiny_equatorial',
    ring: [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]],
    points: [
      [0.005, 0.005],  // inside
      [0.02, 0.005],   // outside
      [-0.005, 0.005]  // outside
    ]
  }
];

const pipFixtures = pipCases.map(c => {
  const ringVecs = c.ring.map(llToVec);
  return {
    name: c.name,
    ring: c.ring,
    points: c.points.map(p => {
      const v = llToVec(p);
      return {
        lonLat: p,
        vec: v,
        inside: pointInSphericalPolygon(v, ringVecs)
      };
    })
  };
});

// --- ringWindingSign ---
// Same lon/lat ring tested in CCW and CW orientations.
// prettier-ignore
const windingCases = [
  {name: 'quad_ccw', ring: [[-5, 44], [15, 44], [15, 54], [-5, 54]]},
  {name: 'quad_cw',  ring: [[-5, 44], [-5, 54], [15, 54], [15, 44]]},
  {name: 'concave_l_ccw', ring: [[-5, 44], [15, 44], [15, 50], [5, 50], [5, 54], [-5, 54]]},
  {name: 'concave_l_cw',  ring: [[-5, 44], [-5, 54], [5, 54], [5, 50], [15, 50], [15, 44]]},
  {name: 'tiny_equatorial_ccw', ring: [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]]},
  // Triangle on the southern hemisphere — centroid is on the south side
  // but the same CCW-when-viewed-from-outside convention should hold.
  {name: 'southern_triangle_ccw', ring: [[-5, -25], [15, -25], [5, -35]]},
  {name: 'southern_triangle_cw',  ring: [[-5, -25], [5, -35], [15, -25]]}
];

const windingFixtures = windingCases.map(c => {
  const ringVecs = c.ring.map(llToVec);
  return {
    name: c.name,
    ring: c.ring,
    sign: ringWindingSign(ringVecs)
  };
});

// --- Output ---
console.log('Generating geometry/spherical-polygon-primitives fixtures...');
console.log('  pointInSphericalPolygon:');
for (const f of pipFixtures) {
  const inside = f.points.filter(p => p.inside).length;
  console.log(`    ${f.name}: ${f.points.length} points (${inside} inside)`);
}
console.log('  ringWindingSign:');
for (const f of windingFixtures) {
  console.log(`    ${f.name}: sign=${f.sign}`);
}

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      pointInSphericalPolygon: pipFixtures,
      ringWindingSign: windingFixtures
    },
    null,
    2
  )
);
console.log(`  Wrote fixtures to ${outputPath}`);
