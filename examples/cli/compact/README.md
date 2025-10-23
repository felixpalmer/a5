# A5 Compact CLI

Generate compacted A5 cells for a geographic region defined by a center point and radius.

## Installation

First, build the main A5 library from the repository root:

```bash
# From repository root
yarn build
```

Then install dependencies for the CLI:

```bash
# From examples/cli/compact
yarn install
```

## Usage

```bash
node index.js --lon <longitude> --lat <latitude> --radius <km> --resolution <res> --output <file> [--geojson]
```

### Arguments

- `--lon <longitude>` - Center point longitude in decimal degrees
- `--lat <latitude>` - Center point latitude in decimal degrees
- `--radius <km>` - Radius around center point in kilometers
- `--resolution <res>` - Target A5 resolution (integer)
- `--output <file>` - Output file path (without extension)
- `--geojson` - Also generate GeoJSON output (optional)

### Example

Generate compacted cells for a 10km radius around London (Trafalgar Square) at resolution 13:

```bash
node index.js --lon -0.1278 --lat 51.5074 --radius 10 --resolution 13 --output london
```

This will generate:
- `london.parquet` - Compacted cells in Parquet format with a single `cell_id` column (UINT_64)
- `london.geojson` - GeoJSON visualization (if `--geojson` specified)

### With GeoJSON output

```bash
node index.js --lon -0.1278 --lat 51.5074 --radius 10 --resolution 13 --output london --geojson
```

## Output Format

### Parquet

The Parquet file contains a single column:
- `cell_id` (UINT_64) - The compacted A5 cell ID

The cell IDs are stored as unsigned 64-bit integers using the Parquet UINT_64 logical type. DuckDB reads them directly as UBIGINT, so no casting is needed:

```sql
-- Works directly with DuckDB A5 functions
SELECT a5_cell_to_lonlat(cell_id) FROM 'london.parquet';
```

### GeoJSON (optional)

The GeoJSON file contains a FeatureCollection with polygon features for each compacted cell, including a `cellIdHex` property with the hexadecimal representation of the cell ID.

## How it Works

1. Generates a grid of points covering the specified radius around the center point
2. Converts each point to an A5 cell at the target resolution
3. Compacts the cells to reduce the total count while maintaining complete coverage
4. Outputs the compacted cell IDs in Parquet format (and optionally GeoJSON)

The compaction process can significantly reduce the number of cells needed to represent a region, often achieving compression ratios of 4-10x or more.
