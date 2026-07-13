import {polygonToCells} from '../../../dist/a5.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'website/static/data/ne_50m_countries.geojson');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'website/static/data/countries.parquet');
// Matches the base resolution of population.parquet, so country cells can be
// uncompacted to res 9 and joined directly against the population table.
const DEFAULT_RESOLUTION = 9;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, resolution: DEFAULT_RESOLUTION};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--input') opts.input = args[++i];
    else if (a === '--output') opts.output = args[++i];
    else if (a === '--resolution') opts.resolution = parseInt(args[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(
        `Usage: node countries.js [--input <geojson>] [--output <parquet>] [--resolution <n>]\n\nDefaults:\n  --input ${DEFAULT_INPUT}\n  --output ${DEFAULT_OUTPUT}\n  --resolution ${DEFAULT_RESOLUTION}\n`
      );
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

  // Cell → country name, first country to claim a cell wins so border cells
  // are counted once when aggregating population by country.
  const claim = new Map();
  let totalRings = 0;
  for (const feature of geojson.features) {
    const name = feature.properties.admin;
    for (const ring of extractRings(feature.geometry)) {
      totalRings++;
      const compacted = polygonToCells(ring, opts.resolution);
      for (let i = 0; i < compacted.length; i++) {
        const id = compacted[i];
        if (!claim.has(id)) claim.set(id, name);
      }
    }
  }
  console.log(`Processed ${totalRings} rings`);
  console.log(`Unique compacted cells: ${claim.size}`);

  // Sort by name, then cell id, for deterministic, well-compressing output.
  const entries = Array.from(claim.entries()).sort(([cellA, nameA], [cellB, nameB]) => {
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return cellA < cellB ? -1 : cellA > cellB ? 1 : 0;
  });
  const cells = new BigInt64Array(entries.length);
  const names = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    // Cell ids are unsigned u64 but we store as INT64 with UINT_64 converted_type.
    cells[i] = BigInt.asIntN(64, entries[i][0]);
    names[i] = entries[i][1];
  }

  const {parquetWrite, schemaFromColumnData, fileWriter} = await import('hyparquet-writer');
  const columnData = [
    {name: 'name', data: names},
    {name: 'cell', data: cells}
  ];
  const writer = fileWriter(opts.output);
  parquetWrite({
    writer,
    columnData,
    schema: schemaFromColumnData({
      columnData,
      schemaOverrides: {
        cell: {name: 'cell', type: 'INT64', converted_type: 'UINT_64', repetition_type: 'REQUIRED'}
      }
    })
  });

  const size = fs.statSync(opts.output).size;
  console.log(`\nWrote ${opts.output}`);
  console.log(`  ${(size / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
