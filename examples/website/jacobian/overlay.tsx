// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import type {Polar} from 'a5/core/coordinate-systems';
import {COLORS} from './components';
import {CHANNEL_INFO, rampCss, rampFraction, rampT} from './deformation';
import type {Extents, RasterQuantity} from './deformation';
import {decompose, deformationValues, polarToSpherical, SPHERE_RADIUS} from './jacobian';
import type {DeformationChannel, FrameJacobian, FrameMode} from './jacobian';
import type {ProjectionMode} from 'a5/projections/projection-mode';

const GAUGE_WIDTH = 72;
const GAUGE_DOT = 8;

/**
 * Where the current value sits in the symmetric range the raster is normalised
 * over. Zero is the centre tick, and the dot takes its colour from the same ramp,
 * so the readout and the raster agree on what the sign means.
 */
function Gauge({value, range, channel}: {value: number; range?: [number, number]; channel: DeformationChannel}) {
  const ready = range && range[1] - range[0] > 0;
  const position = ready ? rampFraction(value, range!) : null;
  const zeroAt = ready ? rampFraction(0, range!) : 0.5;

  return (
    <span style={{position: 'relative', display: 'inline-block', width: GAUGE_WIDTH, height: GAUGE_DOT}}>
      <span
        style={{
          position: 'absolute',
          left: GAUGE_DOT / 2,
          right: GAUGE_DOT / 2,
          top: GAUGE_DOT / 2 - 1,
          height: 2,
          borderRadius: 1,
          background: 'rgba(255,255,255,0.2)'
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: GAUGE_DOT / 2 + zeroAt * (GAUGE_WIDTH - GAUGE_DOT) - 0.5,
          top: 0,
          width: 1,
          height: GAUGE_DOT,
          background: 'rgba(255,255,255,0.35)'
        }}
      />
      {position !== null && (
        <span
          style={{
            position: 'absolute',
            left: position * (GAUGE_WIDTH - GAUGE_DOT),
            top: 0,
            width: GAUGE_DOT,
            height: GAUGE_DOT,
            borderRadius: '50%',
            background: rampCss(rampT(value, range!), channel),
            border: '1px solid rgba(255,255,255,0.45)',
            boxSizing: 'border-box'
          }}
        />
      )}
    </span>
  );
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** How each frame names its own axes, and what its determinant means */
const FRAMES: Record<
  FrameMode,
  {
    symbol: string;
    title: string;
    columns: [string, string];
    rows: [string, string];
    source: [string, string];
    target: [string, string];
    areaLabel: string;
  }
> = {
  chart: {
    symbol: 'J',
    title: 'J = ∂(φ, θ) / ∂(ρ, γ)',
    columns: ['∂ρ', '∂γ'],
    rows: ['∂φ', '∂θ'],
    source: ['γ', 'ρ'],
    target: ['θ', 'φ'],
    areaLabel: 'R²·sin φ·det J / ρ'
  },
  metric: {
    symbol: 'M',
    title: 'M = ∂(R dφ, R sin φ dθ) / ∂(dρ, ρ dγ)',
    columns: ['dρ', 'ρ dγ'],
    rows: ['R dφ', 'R sinφ dθ'],
    source: ['γ̂', 'ρ̂'],
    target: ['θ̂', 'φ̂'],
    areaLabel: 'area ratio'
  }
};

/** Math-space point to SVG space: the diagrams have y pointing up, SVG has it pointing down */
const at = (x: number, y: number) => `${x.toFixed(4)},${(-y).toFixed(4)}`;

const DIAGRAM_VIEW_BOX = '-0.42 -1.42 1.9 1.9';
const DIAGRAM_SIZE = 104;

/**
 * A unit square and its image. The two diagrams share a scale, so the image's
 * rotation, shear and change of area can all be read off directly.
 *
 * `radial` and `azimuthal` are already in plot coordinates, x right and y up,
 * with the radial direction vertical; `axes` is [horizontal, vertical] to match.
 */
function Patch({
  radial,
  azimuthal,
  axes,
  caption
}: {
  radial: [number, number];
  azimuthal: [number, number];
  axes: [string, string];
  caption: string;
}) {
  const corners = [
    at(0, 0),
    at(radial[0], radial[1]),
    at(radial[0] + azimuthal[0], radial[1] + azimuthal[1]),
    at(azimuthal[0], azimuthal[1])
  ];

  return (
    <figure style={{margin: 0, textAlign: 'center', flex: '0 0 auto'}}>
      <svg viewBox={DIAGRAM_VIEW_BOX} width={DIAGRAM_SIZE} height={DIAGRAM_SIZE} style={{overflow: 'visible'}}>
        <g stroke="rgba(255,255,255,0.25)" strokeWidth={0.012}>
          <line x1={-0.3} y1={0} x2={1.35} y2={0} />
          <line x1={0} y1={0.3} x2={0} y2={-1.35} />
        </g>
        <polygon points={corners.join(' ')} fill={COLORS.patch} fillOpacity={0.3} />
        <line
          x1={0}
          y1={0}
          x2={radial[0]}
          y2={-radial[1]}
          stroke={COLORS.radial}
          strokeWidth={0.05}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={0}
          x2={azimuthal[0]}
          y2={-azimuthal[1]}
          stroke={COLORS.azimuthal}
          strokeWidth={0.05}
          strokeLinecap="round"
        />
        <text x={1.38} y={0.16} fill={COLORS.azimuthal} fontSize={0.2} fontFamily={MONO}>
          {axes[0]}
        </text>
        <text x={-0.16} y={-1.38} fill={COLORS.radial} fontSize={0.2} fontFamily={MONO}>
          {axes[1]}
        </text>
      </svg>
      <figcaption style={{fontSize: 11, opacity: 0.65, marginTop: 2, whiteSpace: 'nowrap'}}>{caption}</figcaption>
    </figure>
  );
}

function Matrix({frame}: {frame: FrameJacobian}) {
  const labels = FRAMES[frame.mode];
  const rows: [string, number, number][] = [
    [labels.rows[0], frame.rows[0][0], frame.rows[0][1]],
    [labels.rows[1], frame.rows[1][0], frame.rows[1][1]]
  ];

  return (
    <div style={{display: 'grid', gridTemplateColumns: '68px auto', columnGap: 8, alignItems: 'center'}}>
      <div />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 72px',
          columnGap: 10,
          textAlign: 'center',
          fontSize: 11,
          opacity: 0.65
        }}
      >
        <span style={{color: COLORS.radial}}>{labels.columns[0]}</span>
        <span style={{color: COLORS.azimuthal}}>{labels.columns[1]}</span>
      </div>

      <div
        style={{
          display: 'grid',
          rowGap: 6,
          fontSize: 12,
          opacity: 0.65,
          textAlign: 'right',
          whiteSpace: 'nowrap'
        }}
      >
        {rows.map(([label]) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 72px',
          rowGap: 6,
          columnGap: 10,
          padding: '6px 8px',
          borderLeft: '2px solid rgba(255,255,255,0.45)',
          borderRight: '2px solid rgba(255,255,255,0.45)',
          borderRadius: 3,
          fontFamily: MONO,
          fontSize: 15,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {rows.map(([label, radial, azimuthal]) => (
          <React.Fragment key={label}>
            <span style={{textAlign: 'right'}}>{radial.toFixed(4)}</span>
            <span style={{textAlign: 'right'}}>{azimuthal.toFixed(4)}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Decomposition({
  frame,
  extents,
  quantity
}: {
  frame: FrameJacobian;
  extents: Extents | null;
  quantity: RasterQuantity;
}) {
  const decomposition = decompose(frame);
  const signed = deformationValues(decomposition);
  const {rotation, shear, squash, scale, radial, azimuthal} = decomposition;
  const rows: [DeformationChannel, string, string][] = [
    ['rotation', `${((rotation * 180) / Math.PI).toFixed(2)}°`, 'Angle taking the radial axis onto its image'],
    ['shear', shear.toFixed(3), 'How far the image of the azimuthal axis leans off the other one: shear = tan(lean)'],
    [
      'squash',
      squash.toFixed(4),
      `The two axes scaled against each other: radial x${radial.toFixed(4)}, azimuthal x${azimuthal.toFixed(4)}, ` +
        `squash = sqrt(radial / azimuthal). Above 1 the radial axis is the stretched one`
    ],
    ['scale', scale.toFixed(4), 'Area scale, sqrt|det|. Exactly 1 for an equal-area projection in the intrinsic frame']
  ];

  return (
    <div style={{marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)'}}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `auto 62px ${GAUGE_WIDTH}px`,
          rowGap: 5,
          columnGap: 10,
          alignItems: 'center',
          fontSize: 12
        }}
      >
        {rows.map(([channel, value, hint]) => (
          <React.Fragment key={channel}>
            <span style={{opacity: channel === quantity ? 1 : 0.6}} title={hint}>
              {CHANNEL_INFO[channel].label}
            </span>
            <span
              style={{
                textAlign: 'right',
                fontFamily: MONO,
                fontVariantNumeric: 'tabular-nums',
                opacity: channel === quantity ? 1 : 0.8
              }}
            >
              {value}
            </span>
            <Gauge value={signed[channel]} range={extents?.[channel]} channel={channel} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function JacobianOverlay({
  polar,
  frame,
  projection,
  extents,
  quantity
}: {
  polar: Polar;
  frame: FrameJacobian;
  projection: ProjectionMode;
  extents: Extents | null;
  quantity: RasterQuantity;
}) {
  const [rho, gamma] = polar;
  const [theta, phi] = polarToSpherical(polar, projection);
  const degrees = (radians: number) => `${((radians * 180) / Math.PI).toFixed(2)}°`;
  const labels = FRAMES[frame.mode];

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 20px',
        background: 'rgba(10, 14, 20, 0.82)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        color: '#fff',
        pointerEvents: 'none',
        zIndex: 2
      }}
    >
      {/* Two atomic children, so a narrow viewport can never orphan one diagram */}
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 24}}>
        <div style={{flex: '0 0 auto'}}>
          <div style={{fontSize: 12, opacity: 0.6, marginBottom: 8, fontFamily: MONO, whiteSpace: 'nowrap'}}>
            {labels.title}
          </div>
          <Matrix frame={frame} />
          <Decomposition frame={frame} extents={extents} quantity={quantity} />
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto'}}>
          <Patch radial={[0, 1]} azimuthal={[1, 0]} axes={labels.source} caption="unit patch on the face" />
          <div style={{fontSize: 20, opacity: 0.5}}>→</div>
          <Patch
            radial={[frame.rows[1][0], frame.rows[0][0]]}
            azimuthal={[frame.rows[1][1], frame.rows[0][1]]}
            axes={labels.target}
            caption="its image on the sphere"
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          opacity: 0.6,
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
          lineHeight: 1.7
        }}
      >
        <div>
          det {labels.symbol} = {frame.determinant.toFixed(6)}
          {' '}
          {labels.areaLabel} = {frame.areaRatio.toFixed(6)}
          {' '}R = {SPHERE_RADIUS.toFixed(6)}
        </div>
        <div>
          ρ = {rho.toFixed(4)}, γ = {degrees(gamma)} → θ = {degrees(theta)}, φ = {degrees(phi)}
        </div>
      </div>
    </div>
  );
}
