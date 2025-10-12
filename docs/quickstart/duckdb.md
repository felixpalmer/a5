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
SELECT a5_cell(-3.7037, 40.41677, 10);
┌────────────────────────────────┐
│ a5_cell(-3.7037, 40.41677, 10) │
│             uint64             │
├────────────────────────────────┤
│      5907253213819568128       │
│       (5.91 quintillion)       │
└────────────────────────────────┘

-- Get the center of the A5 cell previously returned
-- since cells cover a greater area, the returned lon/lat
-- will be different.
SELECT a5_lon_lat();
┌──────────────────────────────────────────┐
│     a5_lon_lat(5907253213819568128)      │
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
                    a5_boundary(
                        a5_cell(-3.7037, 40.41677, 10)
                    ),
                    x -> ST_Point(x[1], x[2])
                )
            )
        )
    );
{"type":"Polygon","coordinates":[[[-3.639321611065313,40.44502900567739],[-3.6973300524360155,40.44427170464865],[-3.7459288918337563,40.424159040292615],[-3.70791029038422,40.394201800420205],[-3.654438659632305,40.4080830654645],[-3.639321611065313,40.44502900567739]]]}
```

```geojson
{"type":"Polygon","coordinates":[[[-3.639321611065313,40.44502900567739],[-3.6973300524360155,40.44427170464865],[-3.7459288918337563,40.424159040292615],[-3.70791029038422,40.394201800420205],[-3.654438659632305,40.4080830654645],[-3.639321611065313,40.44502900567739]]]}
```

## Code Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and creates a Polygon using DuckDB's spatial extension.

```sql
INSTALL spatial;
LOAD spatial;

select unnest(a5_children(0, 1));
┌───────────────────────────┐
│ unnest(a5_children(0, 0)) │
│          uint64           │
├───────────────────────────┤
│        144115188075855872 │
│        432345564227567616 │
│        720575940379279360 │
│       1008806316530991104 │
│       1297036692682702848 │
│       1585267068834414592 │
│       1873497444986126336 │
│       2161727821137838080 │
│       2449958197289549824 │
│       2738188573441261568 │
│       3026418949592973312 │
│       3314649325744685056 │
├───────────────────────────┤
│          12 rows          │
└───────────────────────────┘

-- For each cell now create a polygon for the boundary of the cell
SELECT
cell_id,
ST_MakePolygon(
    ST_MakeLine(
        list_transform(
            a5_boundary(cell_id),
            x-> ST_Point(x[1], x[2])
        )
    )
) FROM (SELECT unnest(a5_children(0, 1)) as cell_id);
┌─────────────────────┬────────────────────────────────────────────────────────┐
│       cell_id       │ st_makepolygon(st_makeline(list_transform(a5_boundar…  │
│       uint64        │                        geometry                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│  144115188075855872 │ POLYGON ((-129 52.746330162624965, -128.079352783421…  │
│  432345564227567616 │ POLYGON ((-93.00000000000001 -10.859711056432344, -9…  │
│  720575940379279360 │ POLYGON ((-93 -52.74633016262496, -92.07935278342177…  │
│ 1008806316530991104 │ POLYGON ((-21 -10.859711056432356, -20.9999999999999…  │
│ 1297036692682702848 │ POLYGON ((-57 10.859711056432356, -56.43574517002803…  │
│ 1585267068834414592 │ POLYGON ((15 52.746330162624965, 15.000000000000014 …  │
│ 1873497444986126336 │ POLYGON ((159 52.746330162624965, 158.07935278342174…  │
│ 2161727821137838080 │ POLYGON ((195 -10.859711056432369, 194.4357451700280…  │
│ 2449958197289549824 │ POLYGON ((87 10.859711056432344, 86.43574517002804 1…  │
│ 2738188573441261568 │ POLYGON ((123 -52.74633016262496, 122.07935278342177…  │
│ 3026418949592973312 │ POLYGON ((-93 -52.74633016262496, -93 -52.1064042154…  │
│ 3314649325744685056 │ POLYGON ((-129 10.859711056432356, -129 11.503027285…  │
├─────────────────────┴────────────────────────────────────────────────────────┤
│ 12 rows                                                            2 columns │
└──────────────────────────────────────────────────────────────────────────────┘
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
                a5_boundary(cell_id),
                x-> ST_Point(x[1], x[2])
            )
        )
    )
) FROM (SELECT unnest(a5_children(0, 1)) as cell_id);
┌─────────────────────┬────────────────────┐
│       cell_id       │        area        │
│       uint64        │       double       │
├─────────────────────┼────────────────────┤
│  144115188075855872 │  647.4427187808409 │
│  432345564227567616 │ 4074.8849897945665 │
│  720575940379279360 │ 4074.8849897945693 │
│ 1008806316530991104 │  4074.884989794573 │
│ 1297036692682702848 │ 4074.8849897945693 │
│ 1585267068834414592 │ 4074.8849897945674 │
│ 1873497444986126336 │ 4074.8849897945697 │
│ 2161727821137838080 │  4074.884989794576 │
│ 2449958197289549824 │ 4074.8849897945643 │
│ 2738188573441261568 │  647.4427187808438 │
│ 3026418949592973312 │  4074.884989794567 │
│ 3314649325744685056 │ 4074.8849897945756 │
├─────────────────────┴────────────────────┤
│ 12 rows                        2 columns │
└──────────────────────────────────────────┘
```

## Next Steps

- Review the full [A5 SQL API](https://query.farm/duckdb_extension_a5.html)
- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)