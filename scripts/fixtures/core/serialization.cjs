const fs = require('fs');
const path = require('path');

const {
  serialize, deserialize, getResolution,
  lonLatToCell, u64ToHex,
  origins, FIRST_HILBERT_RESOLUTION
} = require('../../a5-test.cjs');

const MAX_RESOLUTION = 30;

// Deterministic PRNG (mulberry32)
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const random = mulberry32(42);

// --- Resolution masks ---
// Serialize with origin 0 (firstQuintant=4), segment=4 (segmentN=0), S=0
// at each resolution to get the minimal bit pattern showing only the marker
const origin0 = origins[0];
const maskSegment = (0 + origin0.firstQuintant) % 5;
const resolutionMasks = [];
for (let res = 0; res <= MAX_RESOLUTION; res++) {
  const cell = serialize({ origin: origin0, segment: maskSegment, S: 0n, resolution: res });
  resolutionMasks.push(cell.toString(2).padStart(64, '0'));
}

// --- Test IDs from pseudo-random lon/lat ---
// Generate cells at all resolutions 0-30 from geographic coordinates.
// At res 30, only cells with quintant <= 41 are included (others fall back to res 29).
const testIds = [];

for (let res = 0; res <= MAX_RESOLUTION; res++) {
  const numPoints = res <= 1 ? 4 : 8;
  for (let i = 0; i < numPoints; i++) {
    const lon = random() * 360 - 180;
    const lat = Math.asin(random() * 2 - 1) * (180 / Math.PI); // uniform on sphere
    const cell = lonLatToCell([lon, lat], res);
    const hex = u64ToHex(cell);

    // Verify round-trip during generation
    const deserialized = deserialize(cell);
    const reserialized = serialize(deserialized);
    if (reserialized !== cell) {
      console.error(`ERROR: round-trip failed for [${lon}, ${lat}] at res ${res}: ${hex}`);
      process.exit(1);
    }

    // Skip res 30 cells that fell back to res 29 (quintant > 41)
    if (res === MAX_RESOLUTION && getResolution(cell) !== MAX_RESOLUTION) continue;

    testIds.push(hex);
  }
}

// --- Resolution 30 location tests ---
// Specific geographic locations to test res 30 encoding & out-of-bounds fallback
const res30Points = [
  // Locations that should encode at res 30 (in-bounds quintants 0-41)
  { lon: -0.1276, lat: 51.5074, name: 'London' },
  { lon: -73.9857, lat: 40.7484, name: 'New York' },
  { lon: 139.6917, lat: 35.6895, name: 'Tokyo' },
  { lon: -155.5, lat: 19.9, name: 'Hawaii Big Island' },
  { lon: -157.8, lat: 21.3, name: 'Oahu' },
  // Locations in Antarctica (high-quintant origins, likely out-of-bounds → fall back to res 29)
  { lon: 0, lat: -85, name: 'Antarctica Weddell Sea' },
  { lon: 90, lat: -80, name: 'Antarctica East' },
  { lon: -75, lat: -80, name: 'Antarctica West' },
  { lon: 180, lat: -75, name: 'Antarctica Ross' },
  { lon: -135, lat: -78, name: 'Antarctica Pacific' },
];

const res30Locations = res30Points.map(loc => {
  const cell = lonLatToCell([loc.lon, loc.lat], 30);
  const hex = u64ToHex(cell);
  const resolution = getResolution(cell);
  return { ...loc, hex, resolution };
});

// Report
const inBounds = res30Locations.filter(l => l.resolution === 30);
const outOfBounds = res30Locations.filter(l => l.resolution === 29);
console.log(`Resolution 30 locations: ${inBounds.length} at res 30, ${outOfBounds.length} fell back to res 29`);
res30Locations.forEach(loc => {
  console.log(`  ${loc.name}: res=${loc.resolution} hex=${loc.hex}`);
});

// Verify at least some fall back (otherwise our test coverage is incomplete)
if (outOfBounds.length === 0) {
  console.warn('WARNING: No res 30 locations fell back to res 29 — add more Antarctic points');
}

// --- Write fixture ---
const fixtures = {
  resolutionMasks,
  testIds,
  res30Locations,
};

const outputPath = path.join(__dirname, '../../../tests/fixtures/serialization.json');
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated serialization fixture: ${resolutionMasks.length} masks, ${testIds.length} test IDs, ${res30Locations.length} res30 locations`);
console.log(`Saved to: ${outputPath}`);
