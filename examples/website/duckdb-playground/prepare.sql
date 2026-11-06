-- Generates website/static/data/population.parquet
--
-- Source: Kontur Population (CC BY 4.0), global population density on
-- ~3km H3 hexagons (resolution 6), built from GHSL, HRSL, building
-- footprints and OpenStreetMap:
--   https://data.humdata.org/dataset/kontur-population-dataset-3km
--
-- Download and unpack first:
--   curl -LO https://geodata-eu-central-1-kontur-public.s3.eu-central-1.amazonaws.com/kontur_datasets/kontur_population_20231101_r6.gpkg.gz
--   gunzip kontur_population_20231101_r6.gpkg.gz
--
-- Then run with the DuckDB CLI:
--   duckdb < prepare.sql
-- DuckDB v1.5.6 or a later v1.5 release is needed: older versions load an
-- a5 extension build that still uses the v0 index, and from v2.0 a5 installs
-- from the Query.Farm repository instead (see docs/quickstart/duckdb.md)

INSTALL spatial;
LOAD spatial;
INSTALL h3 FROM community;
LOAD h3;
INSTALL a5 FROM community;
LOAD a5;

-- Regrid H3 -> A5: take each hexagon's center and index it at A5
-- resolution 9 (~130km² cells, ~4 source hexagons per cell)
COPY (
  SELECT
    a5_lonlat_to_cell(h3_cell_to_lng(h3_string_to_h3(h3)), h3_cell_to_lat(h3_string_to_h3(h3)), 9) AS cell,
    ROUND(SUM(population))::BIGINT AS population
  FROM ST_Read('kontur_population_20231101_r6.gpkg')
  GROUP BY cell
  ORDER BY cell
) TO 'population.parquet' (FORMAT parquet, COMPRESSION zstd);
