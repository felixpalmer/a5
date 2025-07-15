#!/bin/bash

AUTHALIC_EARTH_AREA=510065624.77943915
KM_PER_M=0.000001

node index.js $1 cells.geojson

ogrinfo -q -dialect SQLite -sql "
WITH stats AS (
  SELECT
    $KM_PER_M * MIN(ST_Area(geometry,1)) as min_area,
    $KM_PER_M * MAX(ST_Area(geometry,1)) as max_area,
    $AUTHALIC_EARTH_AREA / (
      CASE 
        WHEN $1 = 0 THEN 12
        ELSE 60 * POWER(4, $1 - 1)
      END
    ) as authalic_average
  FROM cells
),
error_calc AS (
  SELECT 
    ROUND(((max_area / authalic_average) - 1) * 100, 5) || '%' as max_error
  FROM stats
)
SELECT * FROM error_calc
" cells.geojson | grep "max_error" | awk -F "= " '{print "Area Error: " $2}'

rm cells.geojson
