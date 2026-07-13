#!/usr/bin/env python3
"""Generates website/static/data/elevation.parquet and temperature.parquet

Elevation and annual mean temperature for every A5 resolution-9 cell covering
land (the cell set is countries.parquet uncompacted to resolution 9, so these
tables join directly against the population and countries tables).

Sources:
  - Elevation: ETOPO 2022 global relief, 60 arc-second surface elevation
    (NOAA, public domain):
      https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/
  - Temperature: WorldClim 2.1 bioclimatic variable BIO1 (annual mean
    temperature, °C), 5 arc-minute resolution (Fick & Hijmans 2017):
      https://worldclim.org/data/worldclim21.html

Method:
  - Elevation is clamped to >= 0 per pixel (sea level) then block-averaged
    from 60 arc-seconds to 6 arc-minutes (~11 km, matching res-9 cells) and
    bilinearly sampled at each cell center. Clamping stops offshore cell
    centers and coastal averages from picking up ocean bathymetry; the cost
    is that land below sea level (Dead Sea, Death Valley) reads as 0.
  - Temperature is sampled bilinearly with nodata-aware weights; cells whose
    entire 2x2 neighbourhood is nodata fall back to the nearest valid pixel
    in a 5x5 window, and cells with no valid pixel at all (Antarctica, some
    small islands) are omitted from temperature.parquet.

Requires: python3 + numpy + GDAL bindings, the duckdb CLI, and curl.

Usage (from the repo root, after countries.parquet has been generated):
  python3 examples/website/population/prepare_climate.py --workdir /tmp/climate
"""

import argparse
import os
import subprocess
import sys

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..'))
DATA_DIR = os.path.join(REPO_ROOT, 'website/static/data')
COUNTRIES = os.path.join(DATA_DIR, 'countries.parquet')
RESOLUTION = 9

ETOPO_URL = (
    'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/'
    '60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif'
)
WORLDCLIM_URL = 'https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_5m_bio.zip'
# Elevation is averaged from 60 arc-seconds down to 6 arc-minutes (~11 km)
ETOPO_BLOCK = 6


def run(cmd, **kwargs):
    print(f'$ {" ".join(cmd)}')
    subprocess.run(cmd, check=True, **kwargs)


def download(workdir):
    etopo = os.path.join(workdir, 'etopo_60s_surface.tif')
    bio1 = os.path.join(workdir, 'wc2.1_5m_bio_1.tif')
    if not os.path.exists(etopo):
        run(['curl', '-sL', '-o', etopo, ETOPO_URL])
    if not os.path.exists(bio1):
        zip_path = os.path.join(workdir, 'wc2.1_5m_bio.zip')
        if not os.path.exists(zip_path):
            run(['curl', '-sL', '-o', zip_path, WORLDCLIM_URL])
        run(['unzip', '-o', '-q', zip_path, 'wc2.1_5m_bio_1.tif', '-d', workdir])
    return etopo, bio1


def export_cell_centers(workdir):
    """Uncompact the countries coverage to res 9 and export cell centers."""
    csv_path = os.path.join(workdir, 'cell_centers.csv')
    if os.path.exists(csv_path):
        return csv_path
    sql = f"""
INSTALL a5 FROM community; LOAD a5;
COPY (
  SELECT cell, a5_cell_to_lonlat(cell)[1] AS lon, a5_cell_to_lonlat(cell)[2] AS lat
  FROM (SELECT unnest(a5_uncompact(list(cell), {RESOLUTION})) AS cell FROM '{COUNTRIES}')
  ORDER BY cell
) TO '{csv_path}' (FORMAT csv, HEADER);
"""
    run(['duckdb', '-c', sql])
    return csv_path


def bilinear(grid, geotransform, lons, lats, nodata=None):
    """Bilinear sample with nodata-aware weights; NaN where no valid pixel.

    Longitude wraps around the antimeridian (both rasters are global).
    """
    x0, dx, _, y0, _, dy = geotransform
    height, width = grid.shape
    fx = (lons - x0) / dx - 0.5
    fy = (lats - y0) / dy - 0.5
    ix = np.floor(fx).astype(np.int64)
    iy = np.clip(np.floor(fy).astype(np.int64), 0, height - 2)
    tx = np.clip(fx - ix, 0.0, 1.0)
    ty = np.clip(fy - iy, 0.0, 1.0)

    values = np.zeros(lons.shape, dtype=np.float64)
    weights = np.zeros(lons.shape, dtype=np.float64)
    for oy in (0, 1):
        for ox in (0, 1):
            v = grid[iy + oy, (ix + ox) % width].astype(np.float64)
            w = (tx if ox else 1.0 - tx) * (ty if oy else 1.0 - ty)
            if nodata is not None:
                w = np.where(v == nodata, 0.0, w)
                v = np.where(v == nodata, 0.0, v)
            values += w * v
            weights += w
    with np.errstate(invalid='ignore'):
        out = values / weights
    out[weights <= 1e-9] = np.nan

    if nodata is not None:
        # Nearest valid pixel in a 5x5 window for points whose 2x2
        # neighbourhood is entirely nodata (coastal cells, small islands)
        for i in np.nonzero(np.isnan(out))[0]:
            yy0, yy1 = max(iy[i] - 2, 0), min(iy[i] + 4, height)
            window = grid[yy0:yy1, (np.arange(ix[i] - 2, ix[i] + 4) % width)]
            valid = window != nodata
            if valid.any():
                out[i] = float(window[valid].mean())
    return out


def load_elevation(etopo_path):
    """Load ETOPO, clamp sea to 0, block-average to 6 arc-minutes."""
    ds = gdal.Open(etopo_path)
    x0, dx, r0, y0, r1, dy = ds.GetGeoTransform()
    width, height = ds.RasterXSize, ds.RasterYSize
    band = ds.GetRasterBand(1)
    b = ETOPO_BLOCK
    coarse = np.empty((height // b, width // b), dtype=np.float32)
    for row in range(height // b):
        strip = band.ReadAsArray(0, row * b, width, b).astype(np.float32)
        np.maximum(strip, 0.0, out=strip)
        coarse[row] = strip.reshape(b, width // b, b).transpose(1, 0, 2).reshape(width // b, b * b).mean(axis=1)
    return coarse, (x0, dx * b, r0, y0, r1, dy * b)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workdir', default=os.path.join(REPO_ROOT, 'climate_work'))
    args = parser.parse_args()
    os.makedirs(args.workdir, exist_ok=True)

    etopo_path, bio1_path = download(args.workdir)
    centers_path = export_cell_centers(args.workdir)

    print('Loading cell centers')
    cells = np.loadtxt(centers_path, delimiter=',', skiprows=1, usecols=0, dtype=np.uint64)
    lonlat = np.loadtxt(centers_path, delimiter=',', skiprows=1, usecols=(1, 2), dtype=np.float64)
    lons, lats = lonlat[:, 0], lonlat[:, 1]
    # a5_cell_to_lonlat can return longitudes outside [-180, 180)
    lons = ((lons + 180.0) % 360.0) - 180.0
    print(f'  {len(cells)} cells')

    print('Sampling elevation (ETOPO 2022)')
    elev_grid, elev_gt = load_elevation(etopo_path)
    elevation = np.rint(bilinear(elev_grid, elev_gt, lons, lats)).astype(np.int64)

    print('Sampling temperature (WorldClim BIO1)')
    bio1 = gdal.Open(bio1_path)
    grid = bio1.GetRasterBand(1).ReadAsArray()
    nodata = bio1.GetRasterBand(1).GetNoDataValue()
    temperature = bilinear(grid, bio1.GetGeoTransform(), lons, lats, nodata=nodata)
    print(f'  {np.isnan(temperature).sum()} cells without temperature (omitted)')

    samples_path = os.path.join(args.workdir, 'climate_samples.csv')
    print(f'Writing {samples_path}')
    with open(samples_path, 'w') as f:
        f.write('cell,elevation,temperature\n')
        for i in range(len(cells)):
            t = '' if np.isnan(temperature[i]) else f'{temperature[i]:.1f}'
            f.write(f'{cells[i]},{elevation[i]},{t}\n')

    elevation_out = os.path.join(DATA_DIR, 'elevation.parquet')
    temperature_out = os.path.join(DATA_DIR, 'temperature.parquet')
    sql = f"""
CREATE TABLE samples AS SELECT * FROM read_csv('{samples_path}',
  columns = {{'cell': 'UBIGINT', 'elevation': 'SMALLINT', 'temperature': 'FLOAT'}});
COPY (SELECT cell, elevation FROM samples ORDER BY cell)
  TO '{elevation_out}' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT cell, temperature FROM samples WHERE temperature IS NOT NULL ORDER BY cell)
  TO '{temperature_out}' (FORMAT parquet, COMPRESSION zstd);
"""
    run(['duckdb', '-c', sql])
    for path in (elevation_out, temperature_out):
        print(f'Wrote {path} ({os.path.getsize(path) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
