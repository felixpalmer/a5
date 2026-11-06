-- Generates website/static/data/places.parquet
--
-- Source: Natural Earth 1:10m Populated Places (public domain), ~7,300
-- cities and towns with point locations and population estimates:
--   https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/
--
-- Download first (the simple attribute subset is sufficient):
--   curl -LO https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip
--   unzip ne_10m_populated_places_simple.zip
--
-- Then run with the DuckDB CLI:
--   duckdb < prepare_places.sql

INSTALL spatial;
LOAD spatial;

COPY (
  SELECT name, adm0name AS country, longitude, latitude, pop_max AS population, adm0cap = 1 AS capital
  FROM ST_Read('ne_10m_populated_places_simple.shp')
  ORDER BY population DESC
) TO 'places.parquet' (FORMAT parquet, COMPRESSION zstd);
