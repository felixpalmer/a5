# Paris Restaurant Density

This recipe demonstrates how to use A5 to fetch, aggregate, and visualize geospatial data from [Overture Maps](https://overturemaps.org/). We'll work with restaurant locations in Paris, showing how A5 enables efficient spatial aggregation and visualization.

Thanks to the flexibility of Overture Maps, the recipe can easily be modified to fetch data from a different region, or from a different category (see the [Overture Schema](https://github.com/OvertureMaps/schema/blob/main/docs/schema/concepts/by-theme/places/overture_categories.csv)).

## Overview

In this example, we:
1. Use DuckDB to fetch restaurant data from Overture Maps for the Paris region
2. Aggregate the data using the [A5 DuckDB extension](https://query.farm/duckdb_extension_a5.html) 
3. Save the aggregated data efficiently as a [Parquet](https://parquet.apache.org/) file
4. Visualize the data with the [A5Layer](https://deck.gl/docs/api-reference/geo-layers/a5-layer) in [deck.gl](https://deck.gl/)

## Step 1: Download Restaurant Data

First, we fetch restaurant locations from [Overture Maps using DuckDB](https://docs.overturemaps.org/getting-data/duckdb/). This query filters for restaurants within the Greater Paris area.

```sql
-- Load spatial extension
INSTALL spatial;
LOAD spatial;
SET s3_region='us-west-2';

-- Download all restaurants from Overture Maps to a parquet file in Greater Paris area
COPY (
    SELECT
        id,
        categories.primary AS category,
        ST_X(geometry) AS lon,
        ST_Y(geometry) AS lat
    FROM read_parquet('s3://overturemaps-us-west-2/release/2025-10-22.0/theme=places/type=place/*', filename=true, hive_partitioning=1)
    WHERE categories.primary = 'restaurant'
        AND bbox.xmin BETWEEN 2 AND 3
        AND bbox.ymin BETWEEN 48 AND 49
        AND geometry IS NOT NULL
) TO 'restaurants_paris.parquet' (FORMAT PARQUET);
```

This produces a parquet file with restaurant locations including their coordinates.

## Step 2: Aggregate Using A5

Next, we aggregate the restaurants by A5 cells. This groups nearby restaurants together and counts them, making the data much more efficient to visualize and analyze.

```sql
-- Install and load the A5 extension
INSTALL a5 FROM community;
LOAD a5;

-- Aggregate restaurants by A5 cells at resolution 15 (neighborhood analysis)
-- Resolution 15 provides cells of approximately 2 square kilometers
-- Save the aggregated results to a parquet file
COPY (
    SELECT
        a5_lonlat_to_cell(lon, lat, 15) as a5,
        COUNT(*)::INTEGER as count
    FROM read_parquet('restaurants_paris.parquet')
    GROUP BY a5
    ORDER BY count DESC
) TO 'restaurants_paris_aggregated.parquet' (FORMAT PARQUET);
```

This produces an aggregated dataset where each row represents an A5 cell and the count of restaurants in that cell.


### Optional: JSON output

Note that it would also be possible to write out as JSON, however the cell ids would need to be converted to hexidecimal strings as JSON doesn't support 64-bit integers. This is not recommended, as the file size is 7x the size of Parquet, but for completeness to save as JSON query needs to be modified as follows:

```sql
-- Save to JSON with a5 as hex string
COPY (
    SELECT
        printf('%016x', a5_lonlat_to_cell(lon, lat, 15)) as a5,
        COUNT(*)::INTEGER as count
    ...
) TO 'restaurants_paris_aggregated.json' (FORMAT JSON, ARRAY true);

```

## Step 3: Save the Data

At this stage the data is ready, as can be verified by loading into DuckDB:

```sql
SELECT * FROM 'restaurants_paris_aggregated.parquet' LIMIT 5;
┌─────────────────────┬───────┐
│         a5          │ count │
│       uint64        │ int32 │
├─────────────────────┼───────┤
│ 7188322375052558336 │    14 │
│ 7188321642760634368 │    13 │
│ 7188322431960875008 │    12 │
│ 7188322455583195136 │    12 │
│ 7188321635244441600 │    11 │
├─────────────────────┴───────┤
│ 5 rows            2 columns │
└─────────────────────────────┘
```

## Step 4: Visualize the Data

Finally, we visualize the aggregated data using [deck.gl](https://deck.gl/) and the [A5Layer](https://deck.gl/docs/api-reference/geo-layers/a5-layer). The visualization uses a color gradient (inspired by the French tricolor) to show restaurant density, with denser areas appearing in red.

import ParisRestaurantsDemo from 'website-examples/paris-restaurants/app';

<div style={{margin: '20px 0', height: '500px', position: 'relative'}}>
  <ParisRestaurantsDemo />
</div>

The visualization clearly shows:
- High restaurant density in central Paris (red cells)
- Medium density in surrounding neighborhoods (blue cells)
- Lower density in outer areas (white cells)

### Source

Below is a the source for the above visualization. It is written as a standalone deck.gl [Scripting App](https://deck.gl/docs/get-started/using-standalone#using-the-scripting-api), so it just needs to be hosted on a static web server - no build step necessary. Just copy the code to a file called `index.html` in the same directory as the data files produced above and then run in a terminal:

```bash
python3 -m http.server 8000
```

The app will then be accessible in a web broswer at `http://localhost:8000`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paris Restaurants - A5 Visualization</title>
  <script src="https://unpkg.com/deck.gl@latest/dist.min.js"></script>
  <script src="https://unpkg.com/maplibre-gl@5.10.0/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@5.10.0/dist/maplibre-gl.css" rel="stylesheet" />
  <style>body {width: 100vw; height: 100vh; margin: 0; padding: 0;}</style>
</head>
<body>
  <script type="text/javascript">
    const {DeckGL, A5Layer} = deck;

    const data = new Promise(async onComplete => {
      const url = 'restaurants_paris_aggregated.parquet';
      const {asyncBufferFromUrl, parquetRead} = await import('https://cdn.jsdelivr.net/npm/hyparquet@1.20.1/src/index.js');
      const file = await asyncBufferFromUrl({url});
      parquetRead({file, rowFormat: 'object', onComplete});
    });

    const restaurants = new A5Layer({
      id: 'a5-layer',
      data,

      getPentagon: d => d.a5,
      getFillColor: d => {
        const value = Math.min(d.count / 14, 1);  // Normalize by max count

        // Color based on restaurant count (French tricolor: white -> blue -> red)
        if (value < 0.5) {
          const t = value * 2;  // 0 to 1
          return [255 - 255 * t, 255 - 220 * t, 255 - 113 * t];
        } else {
          const t = (value - 0.5) * 2;  // 0 to 1
          return [0 + 255 * t, 35 - 35 * t, 142 - 142 * t];
        }
      },

      filled: true,
      stroked: false,
      pickable: true,
    })

    // Create the deck.gl visualization
    const deckgl = new DeckGL({
      controller: true,
      mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
      initialViewState: { longitude: 2.35, latitude: 48.85, zoom: 10 },
      layers: [restaurants],
      getTooltip: ({object}) => object && `${object.count} restaurants`
    });
  </script>
</body>
</html>
```

## Next Steps

- Try different resolutions (13-17) to see different levels of aggregation
- Apply this pattern to other Overture Maps datasets (buildings, cities, etc.)
- Try combining multiple datasets, JOINing them by the A5 cell id