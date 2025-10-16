# Rust Quickstart

Get started with A5 in Duckdb by installing the [extension](https://query.farm/duckdb_extension_a5.html) and running a simple example.

## Installation

Install and load the [A5](https://query.farm/duckdb_extension_a5.html) extension with this SQL:

```sql
INSTALL a5 from community;
LOAD a5;
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
│       cell_id       │ st_makepolygon(st_makeline(list_transform(a5_boundary(c…  │
│       uint64        │                         geometry                          │
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ 5907252801502707712 │ POLYGON ((-3.729164086498955 40.41574337140931, -3.7559…  │
│ 5907253076380614656 │ POLYGON ((-3.700372916722557 40.41267753952052, -3.6736…  │
│ 5907253351258521600 │ POLYGON ((-3.72163324460054 40.434217679467125, -3.6926…  │
│ 5907253626136428544 │ POLYGON ((-3.639321611065313 40.44502900567739, -3.6683…  │
└─────────────────────┴───────────────────────────────────────────────────────────┘
```

## Example Output

The above code will produce a collection of cells that cover the whole world.

_Note that the cells all have the same area, they are just warped by the map projection_

```sql
-- Call ST_Area on each polygon to check its size
SELECT
cell_id,
ST_Area(
    ST_MakePolygon(
        ST_MakeLine(
            list_transform(
                a5_cell_to_boundary(cell_id),
                x-> ST_Point(x[1], x[2])
            )
        )
    )
) as area FROM (SELECT unnest(a5_cell_to_children(5907253213819568128, 11)) as cell_id);
┌─────────────────────┬───────────────────────┐
│       cell_id       │         area          │
│       uint64        │        double         │
├─────────────────────┼───────────────────────┤
│ 5907252801502707712 │ 0.0008601018180336114 │
│ 5907253076380614656 │ 0.0008603089490585902 │
│ 5907253351258521600 │ 0.0008605839802151684 │
│ 5907253626136428544 │ 0.0008604669232268964 │
└─────────────────────┴───────────────────────┘
```

## Next Steps

- Review the full [A5 SQL API](https://query.farm/duckdb_extension_a5.html)
- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)