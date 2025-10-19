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
-- Get the A5 Cell for Spain's Kilometer zero
-- https://en.wikipedia.org/wiki/Kilometre_zero
SELECT a5_lonlat_to_cell(-3.7037, 40.41677, 10) as cell;
┌─────────────────────┐
│        cell         │
│       uint64        │
├─────────────────────┤
│ 5907253213819568128 │
└─────────────────────┘

-- Get the center of the A5 cell previously returned
-- since cells cover a greater area, the returned lon/lat
-- will be different.
SELECT a5_cell_to_lonlat(5907253213819568128);
┌──────────────────────────────────────────┐
│  a5_cell_to_lonlat(5907253213819568128)  │
│                double[2]                 │
├──────────────────────────────────────────┤
│ [-3.6889861184034345, 40.42315634154009] │
└──────────────────────────────────────────┘
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
                        a5_lonlat_to_cell(-3.7037, 40.41677, 10)
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
            [-3.639321611065313,40.44502900567739],
            [-3.6973300524360155,40.44427170464865],
            [-3.7459288918337563,40.424159040292615],
            [-3.70791029038422,40.394201800420205],
            [-3.654438659632305,40.4080830654645],
            [-3.639321611065313,40.44502900567739]
        ]
    ]
}
```

Visualizing that A5 cell shows:

```geojson
{
    "type":"Polygon",
    "coordinates":[
        [
            [-3.639321611065313,40.44502900567739],
            [-3.6973300524360155,40.44427170464865],
            [-3.7459288918337563,40.424159040292615],
            [-3.70791029038422,40.394201800420205],
            [-3.654438659632305,40.4080830654645],
            [-3.639321611065313,40.44502900567739]
        ]
    ]
}
```

## Code Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and creates a Polygon using DuckDB's spatial extension.

```sql
INSTALL spatial;
LOAD spatial;

select unnest(a5_cell_to_children(0, 0));
┌───────────────────────────────────┐
│ unnest(a5_cell_to_children(0, 0)) │
│              uint64               │
├───────────────────────────────────┤
│                144115188075855872 │
│                432345564227567616 │
│                720575940379279360 │
│               1008806316530991104 │
│               1297036692682702848 │
│               1585267068834414592 │
│               1873497444986126336 │
│               2161727821137838080 │
│               2449958197289549824 │
│               2738188573441261568 │
│               3026418949592973312 │
│               3314649325744685056 │
├───────────────────────────────────┤
│              12 rows              │
└───────────────────────────────────┘

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
) FROM (SELECT unnest(a5_cell_to_children(5907253213819568128, 11)) as cell_id);
┌─────────────────────┬───────────────────────────────────────────────────────────┐
│       cell_id       │ st_makepolygon(st_makeline(list_transform(a5_cell_to_b…  │
│       uint64        │                         geometry                          │
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ 5907252801502707712 │ POLYGON ((-3.729164086498955 40.41574337140931, -3.7559…  │
│ 5907253076380614656 │ POLYGON ((-3.700372916722557 40.41267753952052, -3.6736…  │
│ 5907253351258521600 │ POLYGON ((-3.72163324460054 40.434217679467125, -3.6926…  │
│ 5907253626136428544 │ POLYGON ((-3.639321611065313 40.44502900567739, -3.6683…  │
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
    a5_lonlat_to_cell(-3.7037, 40.41677, resolution) AS cell,
    a5_cell_area(resolution) AS exact_area, -- Area constant within resolution level
    ST_Area_Spheroid(
      ST_MakePolygon(
        ST_MakeLine(
          list_transform(
            a5_cell_to_boundary(a5_lonlat_to_cell(-3.7037, 40.41677, resolution)),
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
┌────────────┬─────────────────────┬────────────────────┬────────────────────┬────────────┐
│ resolution │        cell         │     exact_area     │   estimated_area   │ area_error │
│   int32    │       uint64        │       double       │       double       │  varchar   │
├────────────┼─────────────────────┼────────────────────┼────────────────────┼────────────┤
│          0 │ 1297036692682702848 │  42505468731619.93 │  42505469418157.65 │ 1.615e-06% │
│          1 │ 5836665117072162816 │  8501093746323.985 │ 8501094074144.6045 │ 3.856e-06% │
│          2 │ 5872693914091126784 │ 2125273436580.9963 │ 2125324816390.5122 │ 0.002418%  │
│          3 │ 5989787504402759680 │  531318359145.2491 │ 531308810698.25244 │ -0.001797% │
│          4 │ 5983032104961703936 │ 132829589786.31229 │ 132819721996.68843 │ -0.007429% │
│          5 │ 5907033861249826816 │ 33207397446.578068 │  33214561445.47316 │ 0.02157%   │
│          6 │ 5907456073714892800 │  8301849361.644517 │  8305306011.021866 │ 0.04164%   │
│          7 │ 5907280151854448640 │ 2075462340.4111292 │  2075087734.505165 │ -0.01805%  │
│          8 │ 5907288947947470848 │  518865585.1027823 │  518818116.3252411 │ -0.009149% │
│          9 │ 5907295545017237504 │ 129716396.27569558 │ 129710367.99714851 │ -0.004647% │
│         10 │ 5907253213819568128 │ 32429099.068923894 │ 32429865.853837967 │ 0.002364%  │
├────────────┴─────────────────────┴────────────────────┴────────────────────┴────────────┤
│ 11 rows                                                                       5 columns │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Next Steps

- Review the full [A5 SQL API](https://query.farm/duckdb_extension_a5.html)
- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)