# DuckDB Quickstart

Get started with A5 in DuckDB by installing the [extension](https://query.farm/products/extensions/a5/) and running a simple example.

## Installation

Install and load the [A5](https://query.farm/products/extensions/a5/) extension with this SQL:

```sql
INSTALL a5 from community;
LOAD a5;

-- Optional: Install spatial extension for geometry operations
INSTALL spatial;
LOAD spatial;
```

A5 v1 needs DuckDB v1.5.6 or later: on older versions of DuckDB, `INSTALL a5` gets an earlier build of the extension, which uses the legacy v0 cell IDs (see the [Upgrade Guide](https://a5geo.org/next/docs/upgrade-guide.md)). Check with `SELECT version();`, and run `FORCE INSTALL a5 FROM community;` after upgrading DuckDB to replace a previously installed build.

## Example: Translate Lat/Lon to A5 Cell and back

```sql
-- Get the A5 Cell for London
SELECT a5_lonlat_to_cell(-0.1276, 51.50735, 10) as cell;
┌─────────────────────┐
│        cell         │
│       uint64        │
├─────────────────────┤
│ 7176244663412588544 │
└─────────────────────┘

-- Get the center of the A5 cell previously returned
-- since cells cover a greater area, the returned lon/lat
-- will be different.
SELECT a5_cell_to_lonlat(7176244663412588544) AS lonlat;
┌──────────────────────────────────────────┐
│                  lonlat                  │
│                double[2]                 │
├──────────────────────────────────────────┤
│ [-0.15971839880376137, 51.5118429215134] │
└──────────────────────────────────────────┘
```

## Example: Generate GeoJSON for Cell

To generate a GeoJSON polygon for the A5 cell above use this SQL along with DuckDB's spatial extension:

```sql
SELECT
    ST_AsGeoJSON(
        ST_MakePolygon(
            ST_MakeLine(
                list_transform(
                    a5_cell_to_boundary(7176244663412588544),
                    lambda x: ST_Point(x[1], x[2])
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
      [-0.19250141916919006, 51.51946462334752],
      [-0.20078615946991363, 51.47558191837641],
      [-0.13985206278343298, 51.48472345047163],
      [-0.11104984728311251, 51.52438151810816],
      [-0.15436577597120050, 51.55503847320052],
      [-0.19250141916919006, 51.51946462334752]
    ]
  ]
}
```

Visualizing that A5 cell shows:

## Example: Generate A5 Cells

Here's a complete example that generates the A5 cells at a specified resolution.

```sql

SELECT unnest(a5_cell_to_children(7176244663412588544, 13)) AS cell_id;
┌─────────────────────┐
│       cell_id       │
│       uint64        │
├─────────────────────┤
│ 7176244122246709248 │
│ 7176244139426578432 │
│ 7176244156606447616 │
│ 7176244173786316800 │
│ 7176244190966185984 │
│ 7176244208146055168 │
│ ...                 │
├─────────────────────┤
│ 64 rows             │
└─────────────────────┘
```

## Example: Compare Cell Areas

This example shows how to obtain the cell area, cross-checking against the value from `ST_Area_Spheroid()`.

_Note that all cells at the same resolution have the exact same area. In general `a5_cell_area()` should always be used rather than manually computing the area_

```sql
-- Compare the exact area (from a5_cell_area) with the estimated area
-- calculated from the cell boundary using ST_Area_Spheroid
SET geometry_always_xy = true; -- Points are [lon, lat]

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
            lambda x: ST_Point(x[1], x[2])
          )
        )
      )
    ) as estimated_area -- Quantized boundary will yield only estimate of area
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
│          0 │ 1297036692682702848 │  42505468731619.93 │  42505469418157.66 │ 1.615e-06%  │
│          1 │ 6989586621679009792 │  8501093746323.985 │  8501093314364.704 │ -5.081e-06% │
│          2 │ 7169730606773829632 │ 2125273436580.9963 │ 2125259982148.4292 │ -0.0006331% │
│          3 │ 7178737806028570624 │  531318359145.2491 │ 531312733699.80945 │ -0.001059%  │
│          4 │ 7176486006214885376 │ 132829589786.31227 │ 132841421743.74414 │ 0.008908%   │
│          5 │ 7183804355609362432 │ 33207397446.578068 │  33204356296.55568 │ -0.009158%  │
│          6 │ 7184226568074428416 │  8301849361.644517 │  8300133697.437454 │ -0.02067%   │
│          7 │ 7176239715610263552 │ 2075462340.4111292 │  2075718617.149704 │ 0.01235%    │
│          8 │ 7176248511703285760 │  518865585.1027823 │ 518895962.34994984 │ 0.005855%   │
│          9 │ 7176246312680030208 │ 129716396.27569558 │    129712619.13624 │ -0.002912%  │
│         10 │ 7176244663412588544 │ 32429099.068923894 │  32428626.05548477 │ -0.001459%  │
└────────────┴─────────────────────┴────────────────────┴────────────────────┴─────────────┘
  11 rows                                                                        5 columns
```

## Next Steps

- Review the full [A5 SQL API](https://query.farm/products/extensions/a5/)
- Learn more about [A5 indexing](https://a5geo.org/next/docs/api-reference/indexing.md)
- Explore [cell hierarchy](https://a5geo.org/next/docs/api-reference/hierarchy.md)
- Check out more [examples](https://a5geo.org/next/examples)
