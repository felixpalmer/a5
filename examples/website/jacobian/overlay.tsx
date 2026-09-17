// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import type {Polar} from 'a5/core/coordinate-systems';
import {COLORS} from './components';
import {CHANNEL_INFO} from './deformation';
import {decompose, polarToSpherical, SPHERE_RADIUS} from './jacobian';
import type {Jacobian} from './jacobian';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Math-space point to SVG space: the diagrams have y pointing up, SVG has it pointing down */
const at = (x: number, y: number) => `${x.toFixed(4)},${(-y).toFixed(4)}`;

const DIAGRAM_VIEW_BOX = '-0.42 -1.42 1.9 1.9';
const DIAGRAM_SIZE = 104;

/**
 * A unit square and its image. The two diagrams share a scale, so the image's
 * rotation, shear and change of area can all be read off directly.
 */
function Patch({
  columns,
  axes,
  caption
}: {
  columns: [[number, number], [number, number]];
  axes: [string, string];
  caption: string;
}) {
  const [radial, azimuthal] = columns;
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
        <text x={1.38} y={0.16} fill={COLORS.radial} fontSize={0.2} fontFamily={MONO}>
          {axes[0]}
        </text>
        <text x={-0.16} y={-1.38} fill={COLORS.azimuthal} fontSize={0.2} fontFamily={MONO}>
          {axes[1]}
        </text>
      </svg>
      <figcaption style={{fontSize: 11, opacity: 0.65, marginTop: 2, whiteSpace: 'nowrap'}}>{caption}</figcaption>
    </figure>
  );
}

function Matrix({jacobian}: {jacobian: Jacobian}) {
  const rows: [string, number, number][] = [
    ['∂φ', jacobian.dPhiDRho, jacobian.dPhiDGamma],
    ['∂θ', jacobian.dThetaDRho, jacobian.dThetaDGamma]
  ];

  return (
    <div style={{display: 'grid', gridTemplateColumns: '24px auto', columnGap: 8, alignItems: 'center'}}>
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
        <span style={{color: COLORS.radial}}>∂ρ</span>
        <span style={{color: COLORS.azimuthal}}>∂γ</span>
      </div>

      <div style={{display: 'grid', rowGap: 6, fontSize: 13, opacity: 0.65, textAlign: 'right'}}>
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
        {rows.map(([label, dRho, dGamma]) => (
          <React.Fragment key={label}>
            <span style={{textAlign: 'right'}}>{dRho.toFixed(4)}</span>
            <span style={{textAlign: 'right'}}>{dGamma.toFixed(4)}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Decomposition({jacobian}: {jacobian: Jacobian}) {
  const {rotation, shear, scale} = decompose(jacobian);
  const rows: [keyof typeof CHANNEL_INFO, string][] = [
    ['rotation', `${((rotation * 180) / Math.PI).toFixed(2)}°`],
    ['shear', shear.toFixed(3)],
    ['scale', scale.toFixed(4)]
  ];

  return (
    <div style={{marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'auto 66px', rowGap: 5, columnGap: 10, fontSize: 12}}>
        {rows.map(([channel, value]) => (
          <React.Fragment key={channel}>
            <span style={{display: 'flex', alignItems: 'center', gap: 7, opacity: 0.75}}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: CHANNEL_INFO[channel].swatch,
                  flex: '0 0 auto'
                }}
              />
              {channel}
            </span>
            <span
              style={{
                textAlign: 'right',
                fontFamily: MONO,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {value}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function JacobianOverlay({polar, jacobian}: {polar: Polar; jacobian: Jacobian}) {
  const [rho, gamma] = polar;
  const [theta, phi] = polarToSpherical(polar);
  const degrees = (radians: number) => `${((radians * 180) / Math.PI).toFixed(2)}°`;

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
          <div style={{fontSize: 12, opacity: 0.6, marginBottom: 8, fontFamily: MONO}}>J = ∂(φ, θ) / ∂(ρ, γ)</div>
          <Matrix jacobian={jacobian} />
          <Decomposition jacobian={jacobian} />
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto'}}>
          <Patch
            columns={[
              [1, 0],
              [0, 1]
            ]}
            axes={['ρ', 'γ']}
            caption="unit patch on the face"
          />
          <div style={{fontSize: 20, opacity: 0.5}}>→</div>
          <Patch
            columns={[
              [jacobian.dPhiDRho, jacobian.dThetaDRho],
              [jacobian.dPhiDGamma, jacobian.dThetaDGamma]
            ]}
            axes={['φ', 'θ']}
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
          det J = {jacobian.determinant.toFixed(4)}
          {' '}
          R²·sin φ·det J / ρ = {jacobian.areaRatio.toFixed(6)}
          {' '}R = {SPHERE_RADIUS.toFixed(6)}
        </div>
        <div>
          ρ = {rho.toFixed(4)}, γ = {degrees(gamma)} → θ = {degrees(theta)}, φ = {degrees(phi)}
        </div>
      </div>
    </div>
  );
}
