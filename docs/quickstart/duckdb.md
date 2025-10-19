# DuckDB Quickstart

Get started with A5 in Duckdb by installing the [extension](https://query.farm/duckdb_extension_a5.html) and running a simple example.

## Installation

Install and load the [A5](https://query.farm/duckdb_extension_a5.html) extension with this SQL:

```sql
INSTALL a5 from community;
LOAD a5;

-- Optional: Install spatial extension for geometry operations
INSTALL spatial;
LOAD spatial;
```

## Code Example: Translate Lat/Lon to A5 Cell and back

```sql
-- Get the A5 Cell for London
SELECT a5_lonlat_to_cell(-0.1276, 51.50735, 10) as cell;
┌─────────────────────┐
│        cell         │
│       uint64        │
├─────────────────────┤
│ 7161034019553935360 │
└─────────────────────┘

-- Get the center of the A5 cell previously returned
-- since cells cover a greater area, the returned lon/lat
-- will be different.
SELECT a5_cell_to_lonlat(7161034019553935360) AS lonlat;
┌───────────────────────────────────────────┐
│                  lonlat                   │
│                 double[2]                 │
├───────────────────────────────────────────┤
│ [-0.13854896867275238, 51.50219202041626] │
└───────────────────────────────────────────┘
```


## Code Example: Generate GeoJSON for Cell

To generate a GeoJSON polygon for the A5 cell above use this SQL along with DuckDB's spatial extension:

```sql
SELECT
    ST_AsGeoJSON(
        ST_MakePolygon(
            ST_MakeLine(
                list_transform(
                    a5_cell_to_boundary(
                        a5_lonlat_to_cell(-0.1276, 51.50735, 10)
                    ),
                    x -> ST_Point(x[1], x[2])
                )
            )
        )
    ) as g
```

This produces:

```
{
    "type":"Polygon",
    "coordinates":[
        [
            [-0.19250141916919006,51.51946462334752],
            [-0.20078615946991363,51.47558191837641],
            [-0.13985206278343298,51.484723450471634],
            [-0.11104984728311251,51.524381518108164],
            [-0.1543657759712005,51.55503847320052],
            [-0.19250141916919006,51.51946462334752]
        ]
    ]
}
```

Visualizing that A5 cell shows:

import WireframeDemo from 'website-examples/wireframe/app';

<div style={{margin: '20px 0'}}>
  <WireframeDemo cellIds={[7161034019553935360n]}/>
</div>

## Code Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and creates a Polygon using DuckDB's spatial extension.

```sql
INSTALL spatial;
LOAD spatial;

SELECT unnest(a5_cell_to_children(0, 0)) AS cell_id;
┌─────────────────────┐
│       cell_id       │
│       uint64        │
├─────────────────────┤
│ 144115188075855872  │
│ 432345564227567616  │
│ 720575940379279360  │
│ 1008806316530991104 │
│ 1297036692682702848 │
│ 1585267068834414592 │
│ 1873497444986126336 │
│ 2161727821137838080 │
│ 2449958197289549824 │
│ 2738188573441261568 │
│ 3026418949592973312 │
│ 3314649325744685056 │
├─────────────────────┤
│ 12 rows             │
└─────────────────────┘

-- For each cell now create a polygon for the boundary of the cell
SELECT
    cell_id,
    ST_MakePolygon(
        ST_MakeLine(
            list_transform(
                a5_cell_to_boundary(cell_id),
                x-> ST_Point(x[1], x[2])
            )
        )
    ) AS polygon
FROM (SELECT unnest(a5_cell_to_children(7161034019553935360, 11)) AS cell_id);
┌─────────────────────┬───────────────────────────────────────────────────────────┐
│       cell_id       │                          polygon                          │
│       uint64        │                         geometry                          │
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ 7161033607237074944 │ POLYGON ((-0.200786159469914 51.47558191837641, -0.1864…  │
│ 7161033882114981888 │ POLYGON ((-0.17344169494659 51.53725280984687, -0.18782…  │
│ 7161034156992888832 │ POLYGON ((-0.214181510157616 51.53477935054404, -0.2183…  │
│ 7161034431870795776 │ POLYGON ((-0.151776640306934 51.52192983825872, -0.1559…  │
└─────────────────────┴───────────────────────────────────────────────────────────┘
```

## Code Example: Compare Cell Areas

This example demonstrates how to compare the exact area (from `a5_cell_area`) with the estimated area calculated from the cell boundary.

_Note that cells at the same resolution have the same area_

```sql
-- Compare the exact area (from a5_cell_area) with the estimated area
-- calculated from the cell boundary using ST_Area_Spheroid
WITH cells AS (
  SELECT
    unnest(generate_series(0, 10))::INTEGER AS resolution
),
areas AS (
  SELECT
    resolution,
    a5_lonlat_to_cell(-0.1276, 51.50735, resolution) AS cell,
    a5_cell_area(resolution) AS exact_area, -- Area constant within resolution level
    ST_Area_Spheroid(
      ST_MakePolygon(
        ST_MakeLine(
          list_transform(
            a5_cell_to_boundary(a5_lonlat_to_cell(-0.1276, 51.50735, resolution)),
            x-> ST_Point(x[2], x[1])  -- Swap to [lat, lon] order
          )
        )
      )
    ) as estimated_area -- Quantized boundary will slightly differ from exact area
  FROM cells
)
SELECT
  resolution,
  cell,
  exact_area,
  estimated_area,
  printf('%.4g%%', 100 * (estimated_area - exact_area) / exact_area) as area_error
FROM areas;
┌────────────┬─────────────────────┬────────────────────┬────────────────────┬─────────────┐
│ resolution │        cell         │     exact_area     │   estimated_area   │ area_error  │
│   int32    │       uint64        │       double       │       double       │   varchar   │
├────────────┼─────────────────────┼────────────────────┼────────────────────┼─────────────┤
│          0 │ 1297036692682702848 │  42505468731619.93 │  42505469418157.65 │ 1.615e-06%  │
│          1 │ 6989586621679009792 │  8501093746323.985 │  8501093267808.199 │ -5.629e-06% │
│          2 │ 7169730606773829632 │ 2125273436580.9963 │  2125259982148.427 │ -0.0006331% │
│          3 │ 7160723407519088640 │  531318359145.2491 │ 531312733699.80804 │ -0.001059%  │
│          4 │ 7162975207332773888 │ 132829589786.31229 │ 132841421743.74396 │ 0.008908%   │
│          5 │ 7155656857938296832 │ 33207397446.578068 │ 33204356296.555916 │ -0.009158%  │
│          6 │ 7156079070403362816 │  8301849361.644517 │  8300133697.437225 │ -0.02067%   │
│          7 │ 7161040066867888128 │ 2075462340.4111292 │ 2075718617.1494904 │ 0.01235%    │
│          8 │ 7161031270774865920 │  518865585.1027823 │ 518895962.34988785 │ 0.005855%   │
│          9 │ 7161033469798121472 │ 129716396.27569558 │ 129712619.13629723 │ -0.002912%  │
│         10 │ 7161034019553935360 │ 32429099.068923894 │  32428626.05546379 │ -0.001459%  │
├────────────┴─────────────────────┴────────────────────┴────────────────────┴─────────────┤
│ 11 rows                                                                        5 columns │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Next Steps

- Review the full [A5 SQL API](https://query.farm/duckdb_extension_a5.html)
- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)