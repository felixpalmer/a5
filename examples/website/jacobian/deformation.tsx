// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useEffect, useMemo, useState} from 'react';
import {DEFORMATION_CHANNELS, deformationField} from './jacobian';
import type {DeformationChannel, DeformationField} from './jacobian';

/** Enough to resolve the cusps without making the one-off sample pass noticeable */
const RASTER_SIZE = 256;

export type ChannelToggles = Record<DeformationChannel, boolean>;

export const ALL_CHANNELS: ChannelToggles = {rotation: true, shear: true, scale: true};

export const CHANNEL_INFO: Record<DeformationChannel, {label: string; swatch: string; unit: string}> = {
  rotation: {label: 'rotation', swatch: '#ff4d4d', unit: '°'},
  shear: {label: 'shear', swatch: '#4dff88', unit: ''},
  scale: {label: 'scale', swatch: '#4d9dff', unit: ''}
};

/**
 * Samples the deformation field once, after mount. It costs a few tens of
 * milliseconds and needs a canvas, so it is kept out of the render pass and out
 * of the server-side build.
 */
export function useDeformationField(): DeformationField | null {
  const [field, setField] = useState<DeformationField | null>(null);
  useEffect(() => {
    setField(deformationField(RASTER_SIZE));
  }, []);
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

    const {size, values, ranges, mask} = field;
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
        if (!channels[channel]) continue;
        const [min, max] = ranges[channel];
        const span = max - min;
        data[offset + c] = span > 0 ? Math.round((255 * (values[channel][i] - min)) / span) : 0;
      }
      data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }, [field, channels]);
}

const format = (value: number, channel: DeformationChannel) =>
  channel === 'rotation' ? value.toFixed(2) : value.toFixed(3);

export function DeformationControls({
  field,
  channels,
  onChange
}: {
  field: DeformationField | null;
  channels: ChannelToggles;
  onChange: (channels: ChannelToggles) => void;
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
      <div style={{opacity: 0.6, marginBottom: 6}}>Deformation</div>
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
              {range && Number.isFinite(range[0])
                ? `${format(range[0], channel)} – ${format(range[1], channel)}${unit}`
                : '…'}
            </span>
          </label>
        );
      })}
    </div>
  );
}
