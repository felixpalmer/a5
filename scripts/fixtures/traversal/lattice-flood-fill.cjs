const fs = require('fs');
const path = require('path');
const {
  tripleSpaceFloodFill,
  cellIdsToTriples,
  forEachLatticeNeighbor,
  tripleCellToId,
  tripleCellsToIds,
  getResolution,
  FIRST_HILBERT_RESOLUTION,
  lonLatToCell,
  u64ToHex
} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'lattice-flood-fill.json');

const sortHex = a => [...a].map(u64ToHex).sort();

/** Encode flood-fill cells (triple space) at `resolution` as cell IDs. */
const ids = (cells, resolution) => tripleCellsToIds(cells, resolution - FIRST_HILBERT_RESOLUTION + 1, resolution);

/** The lattice neighbors of a cell — the flood fill's connectivity — as cell IDs. */
function latticeNeighbors(cell) {
  const resolution = getResolution(cell);
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const [originId, quintant, x, y, z] = cellIdsToTriples([cell]);
  const out = [];
  forEachLatticeNeighbor(originId, quintant, x, y, z, (1 << hilbertRes) - 1, (o, q, nx, ny, nz) => {
    out.push(tripleCellToId(o, q, nx, ny, nz, hilbertRes, resolution));
  });
  return out;
}

/**
 * Build a firewall ring around a center cell at edge-only distance `ringRadius`.
 * The flood-fill seeded inside should be confined to a small finite region.
 */
function buildRingFirewall(center, ringRadius) {
  const visited = new Set([center]);
  const layers = [[center]];
  for (let r = 0; r < ringRadius; r++) {
    const next = [];
    for (const cell of layers[r]) {
      for (const n of latticeNeighbors(cell)) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.push(n);
      }
    }
    layers.push(next);
  }
  // The outer-most layer becomes the firewall.
  return new Set(layers[ringRadius]);
}

const cases = [];

// --- Case 1: small contained flood inside a firewall ring ---
{
  const resolution = 5;
  const center = lonLatToCell([10, 50], resolution);
  const firewall = buildRingFirewall(center, 3);
  const result = tripleSpaceFloodFill(cellIdsToTriples(firewall), cellIdsToTriples([center]), resolution);
  cases.push({
    name: 'contained_ring_radius3',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewall),
    interiorCells: sortHex(ids(result.interior, resolution)),
    frontierCells: sortHex(ids(result.frontier, resolution))
  });
}

// --- Case 2: layer-limited BFS ---
{
  const resolution = 5;
  const center = lonLatToCell([10, 50], resolution);
  const firewall = buildRingFirewall(center, 6);
  const maxLayers = 2;
  const result = tripleSpaceFloodFill(cellIdsToTriples(firewall), cellIdsToTriples([center]), resolution, maxLayers);
  cases.push({
    name: 'layer_limited_2',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewall),
    maxLayers,
    interiorCells: sortHex(ids(result.interior, resolution)),
    frontierCells: sortHex(ids(result.frontier, resolution))
  });
}

// --- Case 3: multi-quintant seeds (apex-touching) ---
{
  // Three points clustered near an icosa face center to trip multi-quintant seeding.
  const resolution = 5;
  const seeds = [
    lonLatToCell([10, 50], resolution),
    lonLatToCell([10.5, 50.2], resolution),
    lonLatToCell([9.7, 49.8], resolution)
  ];
  const firewall = new Set();
  for (const seed of seeds) {
    for (const ring of buildRingFirewall(seed, 2)) firewall.add(ring);
  }
  const result = tripleSpaceFloodFill(cellIdsToTriples(firewall), cellIdsToTriples(seeds), resolution);
  cases.push({
    name: 'multi_seed_cluster',
    resolution,
    seedCells: seeds.map(u64ToHex),
    firewallCells: sortHex(firewall),
    interiorCells: sortHex(ids(result.interior, resolution)),
    frontierCells: sortHex(ids(result.frontier, resolution))
  });
}

// --- Case 4: lower resolution single quintant ---
{
  const resolution = 3;
  const center = lonLatToCell([0, 0], resolution);
  const firewall = buildRingFirewall(center, 2);
  const result = tripleSpaceFloodFill(cellIdsToTriples(firewall), cellIdsToTriples([center]), resolution);
  cases.push({
    name: 'res3_small_ring',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewall),
    interiorCells: sortHex(ids(result.interior, resolution)),
    frontierCells: sortHex(ids(result.frontier, resolution))
  });
}

console.log('Generating traversal/lattice-flood-fill fixtures...');
for (const c of cases) {
  console.log(
    `  ${c.name} (res ${c.resolution}): firewall=${c.firewallCells.length} interior=${c.interiorCells.length} frontier=${c.frontierCells.length}`
  );
}

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify({cases}, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
