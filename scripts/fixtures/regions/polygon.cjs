const fs = require('fs');
const path = require('path');
const {
  getRes0Cells,
  cellToChildren,
  lonLatToCell,
  cellToLonLat,
  cellToBoundary,
  u64ToHex,
  SphericalPolygonShape,
  polygonToCells,
  sphericalCap,
  uncompact,
  estimateCellRadius
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/regions');
const outputPath = path.join(outputDir, 'polygon.json');

const DEG_TO_RAD = Math.PI / 180;
const AUTHALIC_RADIUS = 6371007.2;

/** Convert lon/lat (degrees) to unit 3D vector */
function toVec3(ll) {
  const lat = ll[1] * DEG_TO_RAD;
  const lon = ll[0] * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

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

/**
 * Spherical point-in-polygon via spherical angle summation.
 * Computes the signed solid angle subtended by the polygon as seen from the point.
 * Uses the formula: for each edge (A,B), compute atan2 of the triple product
 * and dot product relative to P. If the total winding is ±2π, P is inside.
 * Works for concave polygons and across the antimeridian.
 */
function pointInPolygonSpherical(point, ring) {
  const pv = toVec3(point);
  let angleSum = 0;
  for (let i = 0; i < ring.length; i++) {
    const av = toVec3(ring[i]);
    const bv = toVec3(ring[(i + 1) % ring.length]);
    // Vectors from P to A and B (on the unit sphere tangent plane at P)
    // Project A and B onto the tangent plane at P
    const dotPA = pv[0] * av[0] + pv[1] * av[1] + pv[2] * av[2];
    const dotPB = pv[0] * bv[0] + pv[1] * bv[1] + pv[2] * bv[2];
    // Tangent-plane projections: A' = A - (A·P)P, B' = B - (B·P)P
    const apx = av[0] - dotPA * pv[0],
      apy = av[1] - dotPA * pv[1],
      apz = av[2] - dotPA * pv[2];
    const bpx = bv[0] - dotPB * pv[0],
      bpy = bv[1] - dotPB * pv[1],
      bpz = bv[2] - dotPB * pv[2];
    // Cross product A' × B' dotted with P gives sin of the angle
    const crossX = apy * bpz - apz * bpy;
    const crossY = apz * bpx - apx * bpz;
    const crossZ = apx * bpy - apy * bpx;
    const sinAngle = crossX * pv[0] + crossY * pv[1] + crossZ * pv[2];
    // Dot product A' · B' gives cos of the angle
    const cosAngle = apx * bpx + apy * bpy + apz * bpz;
    angleSum += Math.atan2(sinAngle, cosAngle);
  }
  // Inside if winding number is ±1 (angle sum ≈ ±2π)
  return Math.abs(angleSum) > Math.PI;
}

/**
 * Brute-force: test if a cell should be in the polygon.
 * A cell is included if and only if its center is inside the outer ring
 * and outside every hole ring.
 * This ensures non-overlapping coverage for adjacent polygons.
 */
function cellInPolygonBruteForce(cellId, rings) {
  const center = cellToLonLat(cellId);
  if (!pointInPolygonSpherical(center, rings[0])) return false;
  for (let r = 1; r < rings.length; r++) {
    if (pointInPolygonSpherical(center, rings[r])) return false;
  }
  return true;
}

/**
 * Brute-force polygonToCells using a spherical cap to limit candidate cells.
 * The cap is centered on the outer-ring centroid with radius = max vertex distance * 1.5.
 * `rings` is GeoJSON-style: [outer, ...holes].
 */
function bruteForcePolygonToCells(rings, resolution) {
  const ring = rings[0];

  // Compute centroid and max distance for the spherical cap
  const centroidLl = ring.reduce((acc, ll) => [acc[0] + ll[0], acc[1] + ll[1]], [0, 0]);
  centroidLl[0] /= ring.length;
  centroidLl[1] /= ring.length;
  const centroidCell = lonLatToCell(centroidLl, resolution);

  // Max great-circle distance from centroid to any vertex (in meters)
  const centroidVec = toVec3(centroidLl);
  let maxDist = 0;
  for (const ll of ring) {
    const v = toVec3(ll);
    const dot = centroidVec[0] * v[0] + centroidVec[1] * v[1] + centroidVec[2] * v[2];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    maxDist = Math.max(maxDist, angle * AUTHALIC_RADIUS);
  }
  // Cap must extend beyond polygon by at least one cell radius to catch
  // cells whose centers are far but edges still intersect the polygon
  const cellRadius = estimateCellRadius(resolution);
  const capRadius = Math.max(maxDist * 1.5, maxDist + cellRadius * 2);

  const candidateCells = uncompact(sphericalCap(centroidCell, capRadius), resolution);
  console.log(
    `    ${candidateCells.length} candidate cells (cap r=${(capRadius / 1000).toFixed(0)}km at res ${resolution})`
  );

  const result = [];
  for (const cellId of candidateCells) {
    if (cellInPolygonBruteForce(cellId, rings)) {
      result.push(cellId);
    }
  }

  return result.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Generate fixtures ---
console.log('Generating traversal/polygon fixtures...');

// --- Polygon test cases ---
// Mix of shapes and scales: simple convex, concave, continent, city
// prettier-ignore
const polygonCases = [
  // Simple convex shapes (original 4)
  {name: 'southern_triangle', ring: [[-5, -25], [15, -25], [5, -35]], resolution: 5},
  {name: 'africa_triangle', ring: [[10, 5], [30, 5], [20, -10]], resolution: 5},
  {name: 'europe_quad', ring: [[-5, 54], [15, 54], [15, 44], [-5, 44]], resolution: 5},
  {name: 'europe_pentagon', ring: [[0, 52], [5, 54], [10, 52], [8, 47], [2, 47]], resolution: 6},
  // Continent scale
  {name: 'europe_large', ring: [[-10, 60], [30, 60], [30, 35], [-10, 35]], resolution: 4},
  {name: 'australia_rect', ring: [[115, -12], [150, -12], [150, -38], [115, -38]], resolution: 4},
  {name: 'antimeridian', ring: [[-221.147986, 37.41521], [-122.277467, 40.460106], [-175.995484, 9.639218]], resolution: 3},
  // Concave / complex shapes
  {name: 'l_shape', ring: [[-5, 54], [5, 54], [5, 50], [15, 50], [15, 44], [-5, 44]], resolution: 6},
  {name: 'u_shape', ring: [[-5, 54], [15, 54], [15, 44], [10, 44], [10, 50], [0, 50], [0, 44], [-5, 44]], resolution: 5},
  {name: 'concave_notch', ring: [[0, 54], [12, 54], [12, 46], [7, 46], [7, 50], [0, 50]], resolution: 6},
  {name: 'narrow_waist', ring: [[-5, 54], [5, 54], [2, 50], [5, 46], [-5, 46], [-2, 50]], resolution: 7},
  {name: 'portugal_thin', ring: [[-8.458673, 39.072679], [-8.238947, 43.207335], [-6.041681, 43.239358]], resolution: 4},
  {name: 'mozambique_sliver', ring: [[22.290485, -24.500092], [113.84265, -18.1778], [113.559645, -17.234216]], resolution: 3},
  // Irregular convex blob
  {name: 'irregular_blob', ring: [[-3, 53], [2, 55], [8, 54], [12, 51], [10, 47], [4, 45], [-2, 47], [-5, 50]], resolution: 6},
  // Hook / crescent
  {name: 'hook', ring: [[0, 52], [5, 54], [10, 52], [10, 46], [5, 44], [0, 46], [3, 48], [3, 50]], resolution: 7},
  {
    name: 'thin_crescent',
    ring: [[-5.699132, 50.011763], [1.435294, 51.012732], [1.105231, 53.104092], [-6.536982, 52.210893], [-6.460814, 52.03943], [0.851337, 52.87484], [1.1814, 51.124413], [-5.826079, 50.255881]],
    resolution: 6
  },
  // City scale
  {name: 'london_rect', ring: [[-1, 51.8], [0.5, 51.8], [0.5, 51.2], [-1, 51.2]], resolution: 9},
  {name: 'nyc_rect', ring: [[-74.2, 40.9], [-73.7, 40.9], [-73.7, 40.5], [-74.2, 40.5]], resolution: 10},
  // Difficult lattice locations
  {name: 'dodecahedron_face_center', ring: [[11.320708, -28.426323], [16.366366, -30.021687], [18.194503, -26.741263], [15.342609, -24.166513], [11.759461, -25.030859]], resolution: 3},
  // Highly concave polygon with multiple interior regions separated by narrow boundary passages
  {name: 'concave_zigzag', ring: [[2.177734, 47.952439], [10.219727, 55.422181], [28.500977, 48.070034], [6.923828, 43.635312], [-1.425781, 41.565353], [14.746094, 46.791816], [18.771639, 49.542909], [21.163759, 49.899795], [19.875694, 48.181157], [23.969899, 47.996786], [23.18786, 49.988607], [18.909646, 51.358685]], resolution: 7},
  // Stress cases — chosen to hit specific code paths in polygonToCells:
  // Tiny polygon entirely inside a single cell (interiorSeeds-empty path).
  {name: 'tiny_inside_one_cell', ring: [[10, 50], [10.0001, 50], [10.0001, 50.0001], [10, 50.0001]], resolution: 5},
  // Sliver polygon — boundary cells only, no PIP-inside shell cells.
  {name: 'no_interior_sliver', ring: [[0, 0], [0.4, 0], [0.4, 0.05]], resolution: 5},
  // Resolution 30 micro polygon — exercises the MAX_RESOLUTION fallback in
  // floodInterior (skips the coarse phase for res 30's special encoding).
  {name: 'res30_micro', ring: [[10, 50], [10.0000001, 50], [10.0000001, 50.0000001], [10, 50.0000001]], resolution: 30},
  // Polygons with holes (GeoJSON-style: outer ring + hole rings)
  {name: 'donut', ring: [[-5, 54], [15, 54], [15, 44], [-5, 44]], holes: [[[2, 51], [8, 51], [8, 47], [2, 47]]], resolution: 6},
  {name: 'two_holes', ring: [[-10, 58], [20, 58], [20, 40], [-10, 40]], holes: [[[-4, 53], [2, 53], [2, 48], [-4, 48]], [[8, 52], [14, 52], [14, 46], [8, 46]]], resolution: 5},
  // Hole smaller than a cell — no cell center falls inside, result matches the unholed polygon.
  {name: 'tiny_hole_no_effect', ring: [[-5, 54], [15, 54], [15, 44], [-5, 44]], holes: [[[4, 49], [4.05, 49], [4.05, 49.05], [4, 49.05]]], resolution: 5},
  // Concave outer ring with a hole in the bottom strip of the L.
  {name: 'l_shape_with_hole', ring: [[-5, 54], [5, 54], [5, 50], [15, 50], [15, 44], [-5, 44]], holes: [[[-3, 47], [3, 47], [3, 45], [-3, 45]]], resolution: 6},
  // Large hole leaving only a thin rim — boundary and hole firewall nearly touch.
  {name: 'donut_thin_rim', ring: [[0, 52], [10, 52], [10, 44], [0, 44]], holes: [[[1, 51], [9, 51], [9, 45], [1, 45]]], resolution: 6},
  // Big enough interior to trigger the hierarchical coarse flood phase with a hole present.
  {name: 'donut_coarse_phase', ring: [[-10, 55], [15, 55], [15, 40], [-10, 40]], holes: [[[-2, 50], [7, 50], [7, 45], [-2, 45]]], resolution: 7},
  // GeoJSON-style closed rings (first vertex repeated) — must match `donut` exactly.
  {name: 'closed_ring_donut', ring: [[-5, 54], [15, 54], [15, 44], [-5, 44], [-5, 54]], holes: [[[2, 51], [8, 51], [8, 47], [2, 47], [2, 51]]], resolution: 6}
];

console.log('\nPolygon fixtures:');
const polygonFixtures = [];
for (const tc of polygonCases) {
  console.log(`  ${tc.name} (res ${tc.resolution})...`);
  const rings = [tc.ring, ...(tc.holes || [])];
  const expected = bruteForcePolygonToCells(rings, tc.resolution);
  const actualCompact = polygonToCells(rings, tc.resolution);
  const actual = uncompact(actualCompact, tc.resolution);
  const actualSorted = [...actual].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Compare
  const expectedSet = new Set(expected.map(c => c.toString()));
  const actualSet = new Set(actualSorted.map(c => c.toString()));
  const missing = expected.filter(c => !actualSet.has(c.toString()));
  const extra = actualSorted.filter(c => !expectedSet.has(c.toString()));
  if (missing.length > 0 || extra.length > 0) {
    console.log(`    WARNING: mismatch! missing=${missing.length}, extra=${extra.length}`);
  }

  console.log(`    brute-force: ${expected.length}, algorithm (compact): ${actualCompact.length} → ${actual.length}`);
  polygonFixtures.push({
    name: tc.name,
    polygon: rings,
    resolution: tc.resolution,
    cells: expected.map(c => u64ToHex(c))
  });
}

// --- Country polygon test cases (from Natural Earth 50m) ---
const geojsonPath = path.join(__dirname, '../../../website/static/data/ne_50m_countries.geojson');
const countryFixtures = [];

if (fs.existsSync(geojsonPath)) {
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

  // Select countries with diverse geometries
  const countrySelection = [
    'France',
    'Italy',
    'Japan',
    'Brazil',
    'Australia',
    'New Zealand',
    'South Africa',
    'United Kingdom',
    'Chile',
    'Indonesia',
    'Russia',
    'Fiji',
    'United States of America',
    'India',
    'Egypt'
  ];
  const countryResolution = 3;

  /** Remove the closing vertex if the ring is closed */
  const stripClosing = coords =>
    coords[coords.length - 1][0] === coords[0][0] && coords[coords.length - 1][1] === coords[0][1]
      ? coords.slice(0, -1)
      : coords;

  /** Extract the mainland part of a country as [outer, ...holes] rings */
  const countryRings = name => {
    const feature = geojson.features.find(f => f.properties.admin === name);
    if (!feature) return null;
    const g = feature.geometry;
    let part;
    if (g.type === 'Polygon') {
      part = g.coordinates;
    } else if (g.type === 'MultiPolygon') {
      // Pick the part with the most outer-ring vertices (mainland)
      part = g.coordinates[0];
      for (const p of g.coordinates) {
        if (p[0].length > part[0].length) part = p;
      }
    } else return null;
    return part.map(stripClosing);
  };

  // Mainland (incl. holes) at res 3, plus South Africa at res 6 where the
  // Lesotho hole is large enough to exclude cell centers.
  const countryCases = [
    ...countrySelection.map(name => ({name, resolution: countryResolution})),
    {name: 'South Africa', resolution: 6}
  ];

  console.log(`\nCountry fixtures:`);
  for (const tc of countryCases) {
    const rings = countryRings(tc.name);
    if (!rings) {
      console.log(`  ${tc.name}: NOT FOUND`);
      continue;
    }

    console.log(`  ${tc.name} (res ${tc.resolution}, ${rings[0].length} vertices, ${rings.length - 1} holes)...`);
    const expected = bruteForcePolygonToCells(rings, tc.resolution);
    const actualCompact = polygonToCells(rings, tc.resolution);
    const actual = uncompact(actualCompact, tc.resolution);
    const actualSorted = [...actual].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const expectedSet = new Set(expected.map(c => c.toString()));
    const actualSet = new Set(actualSorted.map(c => c.toString()));
    const missing = expected.filter(c => !actualSet.has(c.toString()));
    const extra = actualSorted.filter(c => !expectedSet.has(c.toString()));
    if (missing.length > 0 || extra.length > 0) {
      console.log(`    WARNING: mismatch! missing=${missing.length}, extra=${extra.length}`);
    }

    console.log(`    brute-force: ${expected.length}, algorithm (compact): ${actualCompact.length} → ${actual.length}`);
    countryFixtures.push({
      name: tc.name,
      polygon: rings,
      resolution: tc.resolution,
      cellCount: expected.length
    });
  }
} else {
  console.log('\nSkipping country fixtures (ne_50m_countries.geojson not found)');
}

const fixtures = {
  polygon: polygonFixtures,
  country: countryFixtures
};

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`\nWrote polygon fixtures to ${outputPath}`);
