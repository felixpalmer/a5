import {polygonToCells} from '../../../dist/a5.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'website/static/data/ne_50m_countries.geojson');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'website/static/data/country-polygons-compacted.parquet');
const DEFAULT_RESOLUTION = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, resolution: DEFAULT_RESOLUTION};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--input') opts.input = args[++i];
    else if (a === '--output') opts.output = args[++i];
    else if (a === '--resolution') opts.resolution = parseInt(args[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node index.js [--input <geojson>] [--output <parquet>] [--resolution <n>]\n\nDefaults:\n  --input ${DEFAULT_INPUT}\n  --output ${DEFAULT_OUTPUT}\n  --resolution ${DEFAULT_RESOLUTION}\n`);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function extractRings(geometry) {
  const rings = [];
  if (geometry.type === 'Polygon') rings.push(geometry.coordinates[0]);
  else if (geometry.type === 'MultiPolygon') for (const part of geometry.coordinates) rings.push(part[0]);
  return rings
    .map(ring => {
      const last = ring[ring.length - 1];
      return last[0] === ring[0][0] && last[1] === ring[0][1] ? ring.slice(0, -1) : ring;
    })
    .filter(r => r.length >= 3);
}

async function main() {
  const opts = parseArgs();
  console.log(`Loading ${opts.input}`);
  const geojson = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
  console.log(`  ${geojson.features.length} features`);
  console.log(`Resolution: ${opts.resolution}`);

  // Capture Natural Earth's precomputed `mapcolor7` property: a valid
  // 7-coloring of the country adjacency graph (no two neighbours share a
  // value), in the range 1..7. We just pass this index through to the runtime,
  // which uses it to look up a palette entry.
  const colorByCountry = new Map();
  for (const feature of geojson.features) {
    const p = feature.properties;
    const v = typeof p.mapcolor7 === 'number' && p.mapcolor7 > 0 ? p.mapcolor7 : 0;
    colorByCountry.set(p.admin, v);
  }

  // Build cell → country claim map (first country to claim a cell wins,
  // matching the runtime behaviour for stable border colouring).
  const claim = new Map();
  let totalRings = 0;
  let totalCompacted = 0;
  for (const feature of geojson.features) {
    const name = feature.properties.admin;
    for (const ring of extractRings(feature.geometry)) {
      totalRings++;
      const compacted = polygonToCells(ring, opts.resolution);
      totalCompacted += compacted.length;
      for (const id of compacted) {
        if (!claim.has(id)) claim.set(id, name);
      }
    }
  }
  console.log(`Processed ${totalRings} rings, ${totalCompacted} compacted cells across all rings`);
  console.log(`Unique compacted cells: ${claim.size}`);

  // Sort by cell id for deterministic, well-compressing output.
  const entries = Array.from(claim.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const cellIds = new BigInt64Array(entries.length);
  const colors = new Int8Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    // Cell ids are unsigned u64 but we store as INT64 with UINT_64 converted_type.
    cellIds[i] = BigInt.asIntN(64, entries[i][0]);
    colors[i] = colorByCountry.get(entries[i][1]) ?? 0;
  }

  const {parquetWrite, schemaFromColumnData, fileWriter} = await import('hyparquet-writer');
  const columnData = [
    {name: 'cell_id', data: cellIds},
    {name: 'color', data: colors},
  ];
  const writer = fileWriter(opts.output);
  parquetWrite({
    writer,
    columnData,
    schema: schemaFromColumnData({
      columnData,
      schemaOverrides: {
        cell_id: {name: 'cell_id', type: 'INT64', converted_type: 'UINT_64', repetition_type: 'REQUIRED'},
      },
    }),
  });

  const size = fs.statSync(opts.output).size;
  console.log(`\nWrote ${opts.output}`);
  console.log(`  ${(size / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
