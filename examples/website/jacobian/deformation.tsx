// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useEffect, useMemo, useState} from 'react';
import {DEFORMATION_CHANNELS, deformationField} from './jacobian';
import {CELL_RESOLUTIONS, PROJECTION_MODES} from './jacobian';
import type {DeformationChannel, DeformationField, FrameMode} from './jacobian';
import type {ProjectionMode} from 'a5/projections/projection-mode';

/** Enough to resolve the cusps without making the one-off sample pass noticeable */
const RASTER_SIZE = 384;

export type ChannelToggles = Record<DeformationChannel, boolean>;

export const ALL_CHANNELS: ChannelToggles = {rotation: true, shear: true, squash: true};

export const CHANNEL_INFO: Record<DeformationChannel, {label: string; swatch: string; unit: string; digits: number}> = {
  rotation: {label: 'rotation', swatch: '#ff4d4d', unit: '°', digits: 2},
  shear: {label: 'shear', swatch: '#4dff88', unit: '', digits: 3},
  squash: {label: 'squash', swatch: '#4d9dff', unit: '', digits: 4}
};

// One field per frame and projection, kept so that flipping a toggle back is instant
const fieldCache = new Map<string, DeformationField>();

/**
 * Samples the deformation field once per frame, after mount. It takes a few
 * hundred milliseconds, so it is kept out of the render pass and out of the
 * server-side build.
 */
export function useDeformationField(mode: FrameMode, projection: ProjectionMode): DeformationField | null {
  const key = `${projection}/${mode}`;
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
      const sampled = deformationField(RASTER_SIZE, mode, projection);
      fieldCache.set(key, sampled);
      setField(sampled);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [key, mode, projection]);

  return field;
}

/**
 * Packs the three channels into RGB, each normalised over its own range across
 * the face. The ranges are narrow — a few percent for the scale — so without the
 * normalisation the variation would not be visible at all.
 */
export function useDeformationRaster(field: DeformationField | null, channels: ChannelToggles): string | null {
  return useMemo(() => {
    if (!field || typeof document === 'undefined') return null;
    const enabled = DEFORMATION_CHANNELS.some(channel => channels[channel]);
    if (!enabled) return null;

    const {size, values, ranges, constant, mask} = field;
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
      for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
        const channel = DEFORMATION_CHANNELS[c];
        if (!channels[channel] || constant[channel]) continue;
        const [min, max] = ranges[channel];
        // Clamped, because the range trims the extremes rather than covering them
        const t = (values[channel][i] - min) / (max - min);
        data[offset + c] = Math.round(255 * Math.max(0, Math.min(1, t)));
      }
      data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }, [field, channels]);
}

const format = (value: number, channel: DeformationChannel) => value.toFixed(CHANNEL_INFO[channel].digits);

/** 'off', or a resolution, as the toggle's string values */
export const CELL_OPTIONS = ['off', ...CELL_RESOLUTIONS.map(String)];

const PROJECTION_TITLES: Record<ProjectionMode, string> = {
  dsea: "Radiates from the dodecahedron face centre. A5's own projection",
  isea: 'Radiates from the dodecahedron corner, the dual icosahedron face centre'
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

const FRAME_LABELS: Record<FrameMode, string> = {chart: 'chart', metric: 'intrinsic'};

const FRAME_TITLES: Record<FrameMode, string> = {
  chart: 'Derivative of the raw coordinates. Both charts are centred on this face, so their own distortion is included',
  metric: 'Derivative in local orthonormal frames. Chart independent, so it mirrors exactly across a face edge'
};

export function DeformationControls({
  field,
  channels,
  mode,
  projection,
  cells,
  onChange,
  onModeChange,
  onProjectionChange,
  onCellsChange
}: {
  field: DeformationField | null;
  channels: ChannelToggles;
  mode: FrameMode;
  projection: ProjectionMode;
  cells: string;
  onChange: (channels: ChannelToggles) => void;
  onModeChange: (mode: FrameMode) => void;
  onProjectionChange: (projection: ProjectionMode) => void;
  onCellsChange: (cells: string) => void;
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
        zIndex: 1
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: '6px 8px',
          alignItems: 'center',
          justifyContent: 'start',
          marginBottom: 10
        }}
      >
        <span style={{opacity: 0.6}}>Projection</span>
        <Toggle
          options={PROJECTION_MODES}
          value={projection}
          titles={PROJECTION_TITLES}
          onChange={onProjectionChange}
        />
        <span style={{opacity: 0.6}}>Frame</span>
        <Toggle
          options={Object.keys(FRAME_LABELS) as FrameMode[]}
          value={mode}
          labels={FRAME_LABELS}
          titles={FRAME_TITLES}
          onChange={onModeChange}
        />
        <span style={{opacity: 0.6}}>Cells</span>
        <Toggle options={CELL_OPTIONS} value={cells} onChange={onCellsChange} />
      </div>
      {DEFORMATION_CHANNELS.map(channel => {
        const {label, swatch, unit} = CHANNEL_INFO[channel];
        const range = field?.ranges[channel];
        return (
          <label
            key={channel}
            style={{display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', lineHeight: 1.9}}
          >
            <input
              type="checkbox"
              checked={channels[channel]}
              onChange={event => onChange({...channels, [channel]: event.target.checked})}
              style={{accentColor: swatch, margin: 0}}
            />
            <span style={{width: 10, height: 10, borderRadius: 2, background: swatch, flex: '0 0 auto'}} />
            <span style={{width: 58}}>{label}</span>
            <span style={{opacity: 0.55, fontVariantNumeric: 'tabular-nums'}}>
              {!range || !Number.isFinite(range[0])
                ? '…'
                : field?.constant[channel]
                  ? `${format(range[1], channel)}${unit} constant`
                  : `${format(range[0], channel)} – ${format(range[1], channel)}${unit}`}
            </span>
          </label>
        );
      })}
    </div>
  );
}
