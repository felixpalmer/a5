// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useEffect, useMemo, useState} from 'react';
import {deformationField} from './jacobian';
import {
  CELL_RESOLUTIONS,
  DEFORMATION_CHANNELS,
  GRID_SOURCES,
  PROJECTION_MODES,
  cellEdgeMetrics,
  sharedExtents
} from './jacobian';
import type {DeformationChannel, DeformationField, EdgeMetrics, GridSource} from './jacobian';
import type {Face} from 'a5/core/coordinate-systems';
import type {ProjectionMode} from 'a5/projections/projection-mode';

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

/**
 * Diverging ramp, green through black to red, with zero at the midpoint.
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
// instant. All three quantities are sampled together, so switching which one is
// shown costs nothing.
const fieldCache = new Map<string, DeformationField>();

/**
 * Samples the deformation field once per frame and projection, after mount. It
 * takes a few hundred milliseconds, so it is kept out of the render pass and out
 * of the server-side build.
 */
export function useDeformationField(
  projection: ProjectionMode,
  ownFrame: boolean,
  closed: boolean
): DeformationField | null {
  const key = `${projection}/${ownFrame ? 'own' : 'face'}/${closed ? 'closed' : 'star'}`;
  const [field, setField] = useState<DeformationField | null>(() => fieldCache.get(key) ?? null);

  useEffect(() => {
    const cached = fieldCache.get(key);
    if (cached) {
      setField(cached);
      return;
    }
    setField(null);
    // Yield first, so the raster clears and the toggle responds before the
    // sampling pass blocks the main thread
    const handle = window.setTimeout(() => {
      const sampled = deformationField(RASTER_SIZE, projection, ownFrame, closed);
      fieldCache.set(key, sampled);
      setField(sampled);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [key, projection, ownFrame, closed]);

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

/** How far the ramp reaches for each quantity, symmetric about zero */
export type Extents = Record<DeformationChannel, [number, number]>;

const extentsCache = new Map<string, Extents>();

/** The extents every projection shares, so the ramp means the same thing across them */
export function useSharedExtents(ownFrame: boolean, closed: boolean): Extents | null {
  const key = `${ownFrame ? 'own' : 'face'}/${closed ? 'closed' : 'star'}`;
  const [extents, setExtents] = useState<Extents | null>(() => extentsCache.get(key) ?? null);

  useEffect(() => {
    const cached = extentsCache.get(key);
    if (cached) {
      setExtents(cached);
      return;
    }
    const handle = window.setTimeout(() => {
      const sampled = sharedExtents(undefined, ownFrame, closed);
      extentsCache.set(key, sampled);
      setExtents(sampled);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [key, ownFrame, closed]);

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

const format = (value: number, channel: DeformationChannel) => value.toFixed(CHANNEL_INFO[channel].digits);

const PROJECTION_TITLES: Record<ProjectionMode, string> = {
  dsea: "Radiates from the dodecahedron face centre. A5's own projection",
  isea: 'Radiates from the dodecahedron corner, the dual icosahedron face centre',
  rtsea: 'Radiates from the edge midpoint, a face centre of the rhombic triacontahedron',
  gnomonic: 'The plain central projection. Not equal-area, but maps great circles to straight lines'
};

/** A row of buttons acting as a segmented control */
function Toggle<T extends string>({
  options,
  value,
  labels,
  titles,
  onChange
}: {
  options: T[];
  value: T;
  labels?: Record<T, string>;
  titles?: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <span style={{display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.18)'}}>
      {options.map(option => (
        <button
          key={option}
          type="button"
          title={titles?.[option]}
          onClick={() => onChange(option)}
          style={{
            padding: '2px 8px',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 11,
            color: '#fff',
            background: option === value ? 'rgba(255,255,255,0.22)' : 'transparent'
          }}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </span>
  );
}

/** 'off', or a resolution, as the toggle's string values */
export const CELL_OPTIONS = ['off', ...CELL_RESOLUTIONS.map(String)];

const GRID_TITLES: Record<GridSource, string> = {
  plane:
    'Read the projection from the plane: the lines of constant ρ and γ, straight and circular on the face and bent on the sphere, with the raster painted on the sphere alongside them',
  sphere:
    'Read it from the sphere instead: the meridians and parallels of constant θ and φ, straight on the sphere and kinked on the face wherever the projection is, with the raster on the face. Same lines and the same field either way — it is which window the distortion shows up in that changes'
};

const SAG_OPTIONS = ['off', 'on'];

const SAG_TITLES: Record<string, string> = {
  off: 'Hide the gap between each cell edge and the great circle joining its vertices',
  on: 'Fill the gap between each cell edge and the great circle joining its vertices, at true scale'
};

/** The ramp, with the range it currently spans */
function Legend({
  quantity,
  extents,
  relative,
  value
}: {
  quantity: RasterQuantity;
  extents: Extents | null;
  relative: boolean;
  value: number | null;
}) {
  if (quantity === 'off') return null;
  const range = extents?.[quantity];
  const span = range ? range[1] - range[0] : 0;
  const ready = range !== undefined && span > 0;

  // Stops at the ends, plus one where the value crosses zero if it does, so the
  // black point lands exactly there however lopsided the range is
  const zeroAt = ready ? rampFraction(0, range!) : 0.5;
  const breaks = ready ? [0, ...(zeroAt > 0 && zeroAt < 1 ? [zeroAt] : []), 1] : [0, 1];
  const stops = breaks
    .map(f => {
      const at = ready ? range![0] + f * span : 0;
      return `${rampCss(ready ? rampT(at, range!) : 0, quantity)} ${(100 * f).toFixed(2)}%`;
    })
    .join(', ');
  const marker = ready && value !== null ? rampFraction(value, range!) : null;

  return (
    <div style={{marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)'}}>
      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 2,
          background: `linear-gradient(to right, ${stops})`
        }}
      >
        {marker !== null && (
          <span
            style={{
              position: 'absolute',
              left: `${100 * marker}%`,
              top: -2,
              width: 2,
              height: 12,
              marginLeft: -1,
              background: '#fff',
              mixBlendMode: 'difference',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 11,
          opacity: 0.55,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {ready ? (
          <>
            <span>{format(range![0], quantity)}</span>
            <span>{relative ? 'this projection' : 'all projections'}</span>
            <span>
              {range![1] > 0 ? '+' : ''}
              {format(range![1], quantity)}
              {CHANNEL_INFO[quantity].unit}
            </span>
          </>
        ) : (
          <span>{extents ? 'constant' : 'sampling…'}</span>
        )}
      </div>
    </div>
  );
}

/** Edge length and straightness of the drawn cells, under the current projection */
function EdgeStats({metrics}: {metrics: EdgeMetrics | null}) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid rgba(255,255,255,0.12)',
        fontSize: 11,
        lineHeight: 1.7,
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {metrics ? (
        <>
          <div style={{opacity: 0.6}}>{metrics.edges} cell edges, as curves</div>
          <div>
            {metrics.meanKm.toFixed(1)} km mean, spread ±{(100 * metrics.spread).toFixed(2)}%
          </div>
          <div style={{opacity: 0.6}}>
            {metrics.minKm.toFixed(1)} – {metrics.maxKm.toFixed(1)} km
          </div>
          <div title="Greatest angular departure from the great circle through the edge's endpoints">
            bowing {metrics.bowingMeanDeg.toFixed(4)}° mean, {metrics.bowingMaxDeg.toFixed(4)}° max
          </div>
          <div title="Total area between the cell edges and the great circles joining their vertices">
            sag area {(100 * metrics.sagAreaFraction).toFixed(3)}% of the face
          </div>
        </>
      ) : (
        <div style={{opacity: 0.6}}>measuring edges…</div>
      )}
    </div>
  );
}

export function DeformationControls({
  field,
  quantity,
  projection,
  cells,
  sag,
  edges,
  extents,
  relativeScale,
  singleFace,
  closed,
  source,
  value,
  onQuantityChange,
  onProjectionChange,
  onCellsChange,
  onSagChange,
  onRelativeScaleChange,
  onSingleFaceChange,
  onClosedChange,
  onSourceChange
}: {
  field: DeformationField | null;
  quantity: RasterQuantity;
  projection: ProjectionMode;
  cells: string;
  sag: boolean;
  edges: EdgeMetrics | null;
  extents: Extents | null;
  relativeScale: boolean;
  singleFace: boolean;
  closed: boolean;
  source: GridSource;
  value: number | null;
  onQuantityChange: (quantity: RasterQuantity) => void;
  onProjectionChange: (projection: ProjectionMode) => void;
  onCellsChange: (cells: string) => void;
  onSagChange: (sag: boolean) => void;
  onRelativeScaleChange: (relative: boolean) => void;
  onSingleFaceChange: (single: boolean) => void;
  onClosedChange: (closed: boolean) => void;
  onSourceChange: (source: GridSource) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        left: 20,
        padding: '10px 12px',
        background: 'rgba(10, 14, 20, 0.82)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        color: '#fff',
        fontSize: 12,
        minWidth: 208,
        zIndex: 1
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: '6px 8px',
          alignItems: 'center',
          justifyContent: 'start'
        }}
      >
        <span style={{opacity: 0.6}}>Projection</span>
        <Toggle
          options={PROJECTION_MODES}
          value={projection}
          titles={PROJECTION_TITLES}
          onChange={onProjectionChange}
        />
        <span style={{opacity: 0.6}}>Cells</span>
        <Toggle options={CELL_OPTIONS} value={cells} onChange={onCellsChange} />
        {cells !== 'off' && (
          <>
            <span style={{opacity: 0.6}}>Sag</span>
            <Toggle
              options={SAG_OPTIONS}
              value={sag ? 'on' : 'off'}
              titles={SAG_TITLES}
              onChange={value => onSagChange(value === 'on')}
            />
          </>
        )}
        <span style={{opacity: 0.6}}>Raster</span>
        <Toggle options={RASTER_QUANTITIES} value={quantity} onChange={onQuantityChange} />
        <span style={{opacity: 0.6}}>Grid from</span>
        <Toggle options={GRID_SOURCES} value={source} titles={GRID_TITLES} onChange={onSourceChange} />
      </div>

      {cells !== 'off' && <EdgeStats metrics={edges} />}

      <label
        style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer', fontSize: 11}}
        title="Measure the whole domain in this one face's frame. A5 itself projects every point from its own face, so leaving this off is the truer view; turning it on exposes the seam at the face edge"
      >
        <input
          type="checkbox"
          checked={singleFace}
          onChange={event => onSingleFaceChange(event.target.checked)}
          style={{margin: 0}}
        />
        <span style={{opacity: 0.7}}>single face frame</span>
      </label>

      <label
        style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, cursor: 'pointer', fontSize: 11}}
        title="Add the other two triangles each neighbour contributes at a corner, closing every dodecahedron vertex of this face. They are always measured in their own face's frame — this face's chart does not reach them at all"
      >
        <input
          type="checkbox"
          checked={closed}
          onChange={event => onClosedChange(event.target.checked)}
          style={{margin: 0}}
        />
        <span style={{opacity: 0.7}}>close the vertices</span>
      </label>

      <label
        style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, cursor: 'pointer', fontSize: 11}}
        title="Normalise the ramp over this projection's own range instead of the range shared by all of them"
      >
        <input
          type="checkbox"
          checked={relativeScale}
          onChange={event => onRelativeScaleChange(event.target.checked)}
          style={{margin: 0}}
        />
        <span style={{opacity: 0.7}}>relative color scale</span>
      </label>

      <Legend quantity={quantity} extents={extents} relative={relativeScale} value={value} />
    </div>
  );
}
