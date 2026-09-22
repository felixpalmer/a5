// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {useEffect, useMemo, useState} from 'react';
import {CELL_RESOLUTIONS, DEFORMATION_CHANNELS, cellEdgeMetrics, deformationField, sharedExtents} from './jacobian';
import type {DeformationChannel, DeformationField, EdgeMetrics} from './jacobian';
import type {Face} from 'a5/core/coordinate-systems';
import type {ProjectionMode} from './projection';

/** Enough to resolve the cusps without making the one-off sample pass noticeable */
const RASTER_SIZE = 384;

/** The raster shows one quantity at a time, or none */
export type RasterQuantity = DeformationChannel | 'off';

export const RASTER_QUANTITIES: RasterQuantity[] = ['off', ...DEFORMATION_CHANNELS];

export const CHANNEL_INFO: Record<DeformationChannel, {label: string; unit: string; digits: number}> = {
  rotation: {label: 'rotation', unit: '°', digits: 2},
  shear: {label: 'shear', unit: '', digits: 3},
  squash: {label: 'squash', unit: '', digits: 4},
  scale: {label: 'scale', unit: '', digits: 4}
};

/** 'off', or a resolution, as the cell select's string values */
export const CELL_OPTIONS = ['off', ...CELL_RESOLUTIONS.map(String)];

/**
 * Diverging ramp, black at zero and running out to a colour of its own at each
 * end.
 *
 * Showing one signed quantity this way rather than three magnitudes in RGB is
 * what makes the cusps legible: rotation and shear both flip sign across one, so
 * a cusp is a jump from one extreme to the other. Plotting magnitudes made the
 * two sides identical and hid it completely.
 */
// One pair per quantity, so it is never ambiguous which is on screen
export const RAMPS: Record<DeformationChannel, {negative: number[]; positive: number[]}> = {
  rotation: {negative: [40, 230, 90], positive: [245, 70, 50]},
  shear: {negative: [40, 200, 245], positive: [255, 150, 40]},
  squash: {negative: [90, 130, 255], positive: [250, 220, 60]},
  scale: {negative: [200, 90, 245], positive: [150, 230, 60]}
};

/** The ramp's parameter for a value, with zero pinned to black however lopsided the range */
export function rampT(value: number, range: [number, number]): number {
  const [low, high] = range;
  if (value >= 0) return high > 0 ? Math.min(1, value / high) : 0;
  return low < 0 ? Math.max(-1, -(value / low)) : 0;
}

/** Where a value sits along the bar, 0 at the low end and 1 at the high end */
export function rampFraction(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (!(span > 0)) return 0.5;
  return Math.max(0, Math.min(1, (value - range[0]) / span));
}

export function rampColor(t: number, channel: DeformationChannel): [number, number, number] {
  const clamped = Math.max(-1, Math.min(1, t));
  const intensity = Math.abs(clamped);
  const base = clamped < 0 ? RAMPS[channel].negative : RAMPS[channel].positive;
  return [base[0] * intensity, base[1] * intensity, base[2] * intensity];
}

export const rampCss = (t: number, channel: DeformationChannel) => {
  const [r, g, b] = rampColor(t, channel);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};

// One field per frame and projection, kept so that flipping a toggle back is
// instant. All the quantities are sampled together, so switching which one is
// shown costs nothing.
const fieldCache = new Map<string, DeformationField>();

/**
 * Samples the deformation field once per frame and projection, after mount. It
 * takes a few hundred milliseconds, so it is kept out of the render pass and out
 * of the server-side build.
 */
export function useDeformationField(projection: ProjectionMode, ownFrame: boolean): DeformationField | null {
  const key = `${projection}/${ownFrame ? 'own' : 'face'}`;
  const [field, setField] = useState<DeformationField | null>(() => fieldCache.get(key) ?? null);

  useEffect(() => {
    const cached = fieldCache.get(key);
    if (cached) {
      setField(cached);
      return;
    }
    setField(null);
    // Yield first, so the raster clears and the control responds before the
    // sampling pass blocks the main thread
    const handle = window.setTimeout(() => {
      const sampled = deformationField(RASTER_SIZE, projection, ownFrame);
      fieldCache.set(key, sampled);
      setField(sampled);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [key, projection, ownFrame]);

  return field;
}

/**
 * Edge lengths and bowing for the drawn cells. A few hundred milliseconds at the
 * highest resolution, so it is deferred like the field rather than run in render.
 */
export function useEdgeMetrics(cells: Face[][], projection: ProjectionMode): EdgeMetrics | null {
  const [metrics, setMetrics] = useState<EdgeMetrics | null>(null);

  useEffect(() => {
    if (!cells.length) {
      setMetrics(null);
      return;
    }
    setMetrics(null);
    const handle = window.setTimeout(() => setMetrics(cellEdgeMetrics(cells, projection)), 0);
    return () => window.clearTimeout(handle);
  }, [cells, projection]);

  return metrics;
}

/** How far the ramp reaches for each quantity, low and high taken separately */
export type Extents = Record<DeformationChannel, [number, number]>;

const extentsCache = new Map<string, Extents>();

/** The extents every projection shares, so the ramp means the same thing across them */
export function useSharedExtents(ownFrame: boolean): Extents | null {
  const key = ownFrame ? 'own' : 'face';
  const [extents, setExtents] = useState<Extents | null>(() => extentsCache.get(key) ?? null);

  useEffect(() => {
    const cached = extentsCache.get(key);
    if (cached) {
      setExtents(cached);
      return;
    }
    const handle = window.setTimeout(() => {
      const sampled = sharedExtents(undefined, ownFrame);
      extentsCache.set(key, sampled);
      setExtents(sampled);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [key, ownFrame]);

  return extents;
}

/**
 * Either the extents this projection alone reaches, or the ones shared across all
 * of them. A quantity that is constant has no relative range to speak of, so it
 * drops out; on the shared scale it stays and renders flat, which is the point.
 */
export function resolveExtents(
  field: DeformationField | null,
  shared: Extents | null,
  relative: boolean
): Extents | null {
  if (!relative) return shared;
  if (!field) return null;
  return Object.fromEntries(
    DEFORMATION_CHANNELS.map(channel => [
      channel,
      field.constant[channel] ? ([0, 0] as [number, number]) : field.ranges[channel]
    ])
  ) as Extents;
}

/**
 * The sampled field as pixels, in the two forms the two views want: the face
 * draws it as an SVG image, the sphere textures a mesh with the canvas itself.
 */
export interface DeformationRaster {
  canvas: HTMLCanvasElement;
  url: string;
}

export function useDeformationRaster(
  field: DeformationField | null,
  quantity: RasterQuantity,
  extents: Extents | null
): DeformationRaster | null {
  return useMemo(() => {
    if (!field || quantity === 'off' || !extents || typeof document === 'undefined') return null;

    const {size, values, mask} = field;
    const range = extents[quantity];
    if (!(range[1] - range[0] > 0)) return null;
    const channel = values[quantity];

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const image = context.createImageData(size, size);
    const data = image.data;
    for (let i = 0; i < size * size; i++) {
      const offset = 4 * i;
      if (!mask[i]) continue; // left fully transparent
      // Clamped inside rampColor, since the range trims the extremes
      const [r, g, b] = rampColor(rampT(channel[i], range), quantity);
      data[offset] = Math.round(r);
      data[offset + 1] = Math.round(g);
      data[offset + 2] = Math.round(b);
      data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return {canvas, url: canvas.toDataURL()};
  }, [field, quantity, extents]);
}
