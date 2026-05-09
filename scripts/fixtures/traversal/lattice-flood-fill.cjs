const fs = require('fs');
const path = require('path');
const {tripleSpaceFloodFill, getLatticeNeighbors, lonLatToCell, u64ToHex} = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/traversal');
const outputPath = path.join(outputDir, 'lattice-flood-fill.json');

const sortHex = a => [...a].map(u64ToHex).sort();

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
      for (const n of getLatticeNeighbors(cell, true)) {
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
  const firewallSnapshot = new Set(firewall);
  const result = tripleSpaceFloodFill(firewall, [center], resolution);
  cases.push({
    name: 'contained_ring_radius3',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewallSnapshot),
    interiorCells: sortHex(result.interiorCells),
    frontierCells: sortHex(result.frontierCellIds)
  });
}

// --- Case 2: layer-limited BFS ---
{
  const resolution = 5;
  const center = lonLatToCell([10, 50], resolution);
  const firewall = buildRingFirewall(center, 6);
  const firewallSnapshot = new Set(firewall);
  const maxLayers = 2;
  const result = tripleSpaceFloodFill(firewall, [center], resolution, maxLayers);
  cases.push({
    name: 'layer_limited_2',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewallSnapshot),
    maxLayers,
    interiorCells: sortHex(result.interiorCells),
    frontierCells: sortHex(result.frontierCellIds)
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
  const firewallSnapshot = new Set(firewall);
  const result = tripleSpaceFloodFill(firewall, seeds, resolution);
  cases.push({
    name: 'multi_seed_cluster',
    resolution,
    seedCells: seeds.map(u64ToHex),
    firewallCells: sortHex(firewallSnapshot),
    interiorCells: sortHex(result.interiorCells),
    frontierCells: sortHex(result.frontierCellIds)
  });
}

// --- Case 4: lower resolution single quintant ---
{
  const resolution = 3;
  const center = lonLatToCell([0, 0], resolution);
  const firewall = buildRingFirewall(center, 2);
  const firewallSnapshot = new Set(firewall);
  const result = tripleSpaceFloodFill(firewall, [center], resolution);
  cases.push({
    name: 'res3_small_ring',
    resolution,
    seedCells: [u64ToHex(center)],
    firewallCells: sortHex(firewallSnapshot),
    interiorCells: sortHex(result.interiorCells),
    frontierCells: sortHex(result.frontierCellIds)
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
