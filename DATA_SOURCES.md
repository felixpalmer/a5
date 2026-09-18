# Website example data — sources & regeneration

Some website examples ship **precomputed A5 cell data** (baked cell IDs). Those
are **projection-dependent**: switching the projection (e.g. DSEA → ISEA)
reassigns which cell a location maps to, so the baked files must be regenerated.
Examples that compute cells live in the browser (via the `a5-js` webpack alias to
`/modules`) need no action.

Run everything from the repo root. **Build first** so the generators pick up the
current projection:

```bash
yarn build      # generators import ../../../dist/a5.js (ISEA)
```

## Regenerated for ISEA ✅

These have in-repo generators and public/in-repo inputs; regenerated on the
ISEA branch.

### `countries.parquet` — DuckDB Playground (per-country masks), res 9
Compacted A5 cells for every Natural Earth country, res 9 (matches
`population.parquet` so country cells uncompact and join directly).
```bash
node examples/cli/country-polygons/countries.js
# input: website/static/data/ne_50m_countries.geojson  →  countries.parquet
```

### `country-polygons-compacted.parquet` — Country Polygons example, res 8
Compacted A5 cells per country + a 7-colouring index.
```bash
node examples/cli/country-polygons/index.js
# input: website/static/data/ne_50m_countries.geojson  →  country-polygons-compacted.parquet
```

### `london-10km-compacted.parquet` — Compaction example, res 16
Compacted A5 cells covering a 10 km cap around London.
```bash
node examples/cli/compact/index.js \
  --lon -0.1278 --lat 51.5074 --radius 10 --resolution 16 \
  --output "$(pwd)/website/static/data/london-10km-compacted"
# (the CLI appends .parquet)
```

### `heatmap-data.parquet` — Road Safety example, res 13
~140k points from deck.gl's 3d-heatmap demo aggregated to A5 cells (~50k cells).
```bash
curl -sL https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv -o /tmp/heatmap-data.csv
# aggregate CLI deps (root workspace blocks `yarn install` here, so use npm):
( cd examples/cli/aggregate && npm install --no-save csv-parse hyparquet hyparquet-writer )
node examples/cli/aggregate/index.js /tmp/heatmap-data.csv "$(pwd)/website/static/data/heatmap-data.parquet" 13 parquet
```

## Blocked — needs the A5 DuckDB extension rebuilt for ISEA ⚠️

The **DuckDB Playground** data is produced by the DuckDB CLI using the **a5
community extension** (`INSTALL a5 FROM community; a5_lonlat_to_cell(...)`). That
extension is currently **DSEA**, so re-running the prepare scripts as-is would
emit **DSEA cells that mismatch the ISEA library**.

**Prerequisite:** rebuild + publish the `a5` DuckDB extension with the ISEA
projection (separate repo: `duckdb-extension-a5`), or build it locally and swap
`INSTALL a5 FROM community; LOAD a5;` for `LOAD './a5.duckdb_extension';`. Then:

### `population.parquet` — res 9 (Kontur Population, CC BY 4.0)
```bash
cd examples/website/duckdb-playground
curl -LO https://geodata-eu-central-1-kontur-public.s3.eu-central-1.amazonaws.com/kontur_datasets/kontur_population_20231101_r6.gpkg.gz
gunzip kontur_population_20231101_r6.gpkg.gz
duckdb < prepare.sql        # → population.parquet
```

### `places.parquet` — res 9 (Natural Earth 10m populated places, public domain)
```bash
cd examples/website/duckdb-playground
curl -LO https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip
unzip ne_10m_populated_places_simple.zip
duckdb < prepare_places.sql # → places.parquet
```

### `elevation.parquet`, `temperature.parquet` — res 9 (ETOPO 2022 + WorldClim 2.1)
Sampled onto the land cells of `countries.parquet` (regenerate that first).
```bash
cd examples/website/duckdb-playground
python3 prepare_climate.py   # downloads ETOPO + WorldClim → elevation.parquet, temperature.parquet
```

## Blocked — source not recorded in-repo ⚠️

### `restaurants_paris_aggregated.parquet` — Paris Restaurants example
Baked A5 cells (`cell`, `count`) of Paris restaurant density. The original point
dataset and parameters are not documented in the repo. To regenerate, obtain the
source restaurant points (lon/lat CSV) and run `examples/cli/aggregate` at the
example's resolution, e.g.:
```bash
node examples/cli/aggregate/index.js <restaurants.csv> \
  "$(pwd)/website/static/data/restaurants_paris_aggregated.parquet" <res> parquet
```

## No action needed (raw input / computed live)

These are projection-independent and unaffected by the projection change:

- `ne_50m_countries.geojson`, `ne_50m_countries_geom.geojson` — raw geometry.
- `oslo.json`, `malta.json`, `bezier.json` — raw lon/lat coordinates (the Airbnb
  and curve examples index them live in the browser).
- Any example without a `/data/*` A5-cell file computes its cells at runtime and
  is automatically correct under the new projection.

> Reminder: `website/static/data/` is covered by a broad `data/` gitignore rule —
> `git add -f` regenerated files or they stay invisible in `git status`.
