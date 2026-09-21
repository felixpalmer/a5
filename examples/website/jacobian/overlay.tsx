// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import type {Polar} from 'a5/core/coordinate-systems';
import {COLORS} from './components';
import {CELL_OPTIONS, CHANNEL_INFO, RASTER_QUANTITIES, rampCss, rampFraction, rampT} from './deformation';
import type {Extents, RasterQuantity} from './deformation';
import {
  GRID_SOURCES,
  PROJECTION_MODES,
  SPHERE_RADIUS,
  decompose,
  deformationValues,
  polarToSpherical
} from './jacobian';
import type {DeformationChannel, EdgeMetrics, FrameJacobian, GridSource} from './jacobian';
import type {ProjectionMode} from 'a5/projections/projection-mode';

// ---------------------------------------------------------------------------
// Panel furniture, following the white control panel the other examples use
// ---------------------------------------------------------------------------

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const RULE = '1px solid #ccc';
const MUTED = '#666';

const section: React.CSSProperties = {marginTop: 12, paddingTop: 12, borderTop: RULE};
const heading: React.CSSProperties = {margin: '0 0 8px', fontSize: '14px'};
const field: React.CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'};
const check: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'};

/** A labelled dropdown, one per row */
function Select<T extends string>({
  label,
  value,
  options,
  titles,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  titles?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) {
  return (
    <div style={{...field, marginBottom: '8px'}}>
      <label>{label}:</label>
      {/* Also on the control itself, so the current choice explains itself on hover */}
      <select
        value={value}
        title={titles?.[value]}
        onChange={e => onChange(e.target.value as T)}
        style={{padding: '3px'}}
      >
        {options.map(option => (
          <option key={option} value={option} title={titles?.[option]}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Check({
  label,
  checked,
  title,
  onChange
}: {
  label: string;
  checked: boolean;
  title?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={check} title={title}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{margin: 0}} />
      {label}
    </label>
  );
}

const PROJECTION_TITLES: Record<ProjectionMode, string> = {
  dsea: "Radiates from the dodecahedron face centre. A5's own projection",
  isea: 'Radiates from the dodecahedron corner, the dual icosahedron face centre',
  rtsea: 'Radiates from the edge midpoint, a face centre of the rhombic triacontahedron',
  gnomonic: 'The plain central projection. Not equal-area, but maps great circles to straight lines'
};

const GRID_TITLES: Record<GridSource, string> = {
  plane:
    'Read the projection from the plane: the lines of constant rho and gamma, straight and circular on the face and bent on the sphere, with the raster painted on the sphere alongside them',
  sphere:
    'Read it from the sphere instead: the meridians and parallels of constant theta and phi, straight on the sphere and kinked on the face wherever the projection is, with the raster on the face. Same lines and the same field either way, it is which window the distortion shows up in that changes'
};

// ---------------------------------------------------------------------------
// The ramp, and the quantities read off it
// ---------------------------------------------------------------------------

const format = (value: number, channel: DeformationChannel) => value.toFixed(CHANNEL_INFO[channel].digits);

/** The ramp, with the range it currently spans and the hovered value marked on it */
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
    <div style={{marginTop: '8px'}}>
      <div
        style={{
          position: 'relative',
          height: '8px',
          borderRadius: '2px',
          background: `linear-gradient(to right, ${stops})`
        }}
      >
        {marker !== null && (
          <span
            style={{
              position: 'absolute',
              left: `${100 * marker}%`,
              top: '-2px',
              width: '2px',
              height: '12px',
              marginLeft: '-1px',
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
          marginTop: '4px',
          fontSize: '11px',
          color: MUTED,
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
    <div style={section}>
      <h3 style={heading}>Cell edges</h3>
      {metrics ? (
        <div style={{fontVariantNumeric: 'tabular-nums'}}>
          <div style={{color: MUTED}}>{metrics.edges} cell edges, as curves</div>
          <div>
            {metrics.meanKm.toFixed(1)} km mean, spread ±{(100 * metrics.spread).toFixed(2)}%
          </div>
          <div style={{color: MUTED}}>
            {metrics.minKm.toFixed(1)} – {metrics.maxKm.toFixed(1)} km
          </div>
          <div title="Greatest angular departure from the great circle through the edge's endpoints">
            bowing {metrics.bowingMeanDeg.toFixed(4)}° mean, {metrics.bowingMaxDeg.toFixed(4)}° max
          </div>
          <div title="Total area between the cell edges and the great circles joining their vertices">
            sag area {(100 * metrics.sagAreaFraction).toFixed(3)}% of the face
          </div>
        </div>
      ) : (
        <div style={{color: MUTED}}>measuring edges…</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Jacobian at the hovered point
// ---------------------------------------------------------------------------

const GAUGE_WIDTH = 64;
const GAUGE_DOT = 8;

/**
 * Where the current value sits in the range the raster is normalised over. Zero is
 * the centre tick, and the dot takes its colour from the same ramp, so the readout
 * and the raster agree on what the sign means.
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
          background: '#ddd'
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: GAUGE_DOT / 2 + zeroAt * (GAUGE_WIDTH - GAUGE_DOT) - 0.5,
          top: 0,
          width: 1,
          height: GAUGE_DOT,
          background: '#aaa'
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
            border: '1px solid rgba(0,0,0,0.35)',
            boxSizing: 'border-box'
          }}
        />
      )}
    </span>
  );
}

/** The frame's axis names. Only the intrinsic frame is offered; see `toFrame` */
const LABELS = {
  symbol: 'M',
  title: 'M = ∂(R dφ, R sin φ dθ) / ∂(dρ, ρ dγ)',
  columns: ['dρ', 'ρ dγ'] as [string, string],
  rows: ['R dφ', 'R sinφ dθ'] as [string, string],
  source: ['γ̂', 'ρ̂'] as [string, string],
  target: ['θ̂', 'φ̂'] as [string, string]
};

/** Math-space point to SVG space: the diagrams have y pointing up, SVG has it pointing down */
const at = (x: number, y: number) => `${x.toFixed(4)},${(-y).toFixed(4)}`;

const DIAGRAM_VIEW_BOX = '-0.42 -1.42 1.9 1.9';
const DIAGRAM_SIZE = 96;

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
        <g stroke="#ccc" strokeWidth={0.012}>
          <line x1={-0.3} y1={0} x2={1.35} y2={0} />
          <line x1={0} y1={0.3} x2={0} y2={-1.35} />
        </g>
        <polygon
          points={corners.join(' ')}
          fill={COLORS.patch}
          fillOpacity={0.45}
          stroke={COLORS.patch}
          strokeWidth={0.02}
        />
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
      <figcaption style={{fontSize: '11px', color: MUTED, marginTop: '2px'}}>{caption}</figcaption>
    </figure>
  );
}

const MATRIX_COLUMN = 64;

function Matrix({frame}: {frame: FrameJacobian}) {
  const rows: [string, number, number][] = [
    [LABELS.rows[0], frame.rows[0][0], frame.rows[0][1]],
    [LABELS.rows[1], frame.rows[1][0], frame.rows[1][1]]
  ];
  const columns = `${MATRIX_COLUMN}px ${MATRIX_COLUMN}px`;

  return (
    <div style={{display: 'grid', gridTemplateColumns: '58px auto', columnGap: '6px', alignItems: 'center'}}>
      <div />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          columnGap: '8px',
          textAlign: 'center',
          fontSize: '11px'
        }}
      >
        <span style={{color: COLORS.radial}}>{LABELS.columns[0]}</span>
        <span style={{color: COLORS.azimuthal}}>{LABELS.columns[1]}</span>
      </div>

      <div
        style={{
          display: 'grid',
          rowGap: '6px',
          fontSize: '11px',
          color: MUTED,
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
          gridTemplateColumns: columns,
          rowGap: '6px',
          columnGap: '8px',
          padding: '6px 6px',
          borderLeft: '2px solid #888',
          borderRight: '2px solid #888',
          borderRadius: '3px',
          fontFamily: MONO,
          fontSize: '13px',
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `auto 56px ${GAUGE_WIDTH}px`,
        rowGap: '5px',
        columnGap: '8px',
        alignItems: 'center',
        marginTop: '10px'
      }}
    >
      {rows.map(([channel, value, hint]) => (
        <React.Fragment key={channel}>
          <span
            style={{color: channel === quantity ? '#000' : MUTED, fontWeight: channel === quantity ? 600 : 400}}
            title={hint}
          >
            {CHANNEL_INFO[channel].label}
          </span>
          <span style={{textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums'}}>{value}</span>
          <Gauge value={signed[channel]} range={extents?.[channel]} channel={channel} />
        </React.Fragment>
      ))}
    </div>
  );
}

/** The frame free numbers, and where on the two charts the hovered point sits */
function Readouts({polar, frame, projection}: {polar: Polar; frame: FrameJacobian; projection: ProjectionMode}) {
  const [rho, gamma] = polar;
  const [theta, phi] = polarToSpherical(polar, projection);
  const degrees = (radians: number) => `${((radians * 180) / Math.PI).toFixed(2)}°`;

  // Frame free, so it is the one number here that any observer would agree on
  const {scale, squash, shear} = decompose(frame);
  const a = scale * squash;
  const b = scale / squash;
  const k = shear * b;
  const half = (a * a + k * k + b * b) / 2;
  const root = Math.sqrt(Math.max(0, half * half - (a * b) ** 2));
  const anisotropy = Math.sqrt((half + root) / (half - root));

  const rows: [string, string][] = [
    [`det ${LABELS.symbol}`, frame.determinant.toFixed(6)],
    ['σ₁/σ₂', anisotropy.toFixed(6)],
    ['R', SPHERE_RADIUS.toFixed(6)],
    ['ρ, γ', `${rho.toFixed(4)}, ${degrees(gamma)}`],
    ['θ, φ', `${degrees(theta)}, ${degrees(phi)}`]
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        rowGap: '3px',
        columnGap: '10px',
        marginTop: '10px',
        fontSize: '11px',
        fontFamily: MONO,
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <span style={{color: MUTED}}>{label}</span>
          <span style={{textAlign: 'right'}}>{value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The panel itself
// ---------------------------------------------------------------------------

export function ControlPanel({
  polar,
  frame,
  projection,
  quantity,
  extents,
  relativeScale,
  singleFace,
  source,
  cells,
  sag,
  edges,
  value,
  onQuantityChange,
  onProjectionChange,
  onCellsChange,
  onSagChange,
  onRelativeScaleChange,
  onSingleFaceChange,
  onSourceChange
}: {
  polar: Polar;
  frame: FrameJacobian;
  projection: ProjectionMode;
  quantity: RasterQuantity;
  extents: Extents | null;
  relativeScale: boolean;
  singleFace: boolean;
  source: GridSource;
  cells: string;
  sag: boolean;
  edges: EdgeMetrics | null;
  value: number | null;
  onQuantityChange: (quantity: RasterQuantity) => void;
  onProjectionChange: (projection: ProjectionMode) => void;
  onCellsChange: (cells: string) => void;
  onSagChange: (sag: boolean) => void;
  onRelativeScaleChange: (relative: boolean) => void;
  onSingleFaceChange: (single: boolean) => void;
  onSourceChange: (source: GridSource) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        bottom: '20px',
        width: '300px',
        boxSizing: 'border-box',
        background: 'white',
        padding: '12px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 2,
        fontSize: '12px',
        lineHeight: '1.5',
        color: '#222',
        overflowY: 'auto'
      }}
    >
      <h3 style={heading}>Projection</h3>
      <Select
        label="Mode"
        value={projection}
        options={PROJECTION_MODES}
        titles={PROJECTION_TITLES}
        onChange={onProjectionChange}
      />
      <Select label="Grid from" value={source} options={GRID_SOURCES} titles={GRID_TITLES} onChange={onSourceChange} />
      <Check
        label="Single face frame"
        checked={singleFace}
        title="Measure the whole domain in this one face's frame. A5 itself projects every point from its own face, so leaving this off is the truer view; turning it on exposes the seam at the face edge"
        onChange={onSingleFaceChange}
      />

      <div style={section}>
        <h3 style={heading}>Deformation raster</h3>
        <Select label="Quantity" value={quantity} options={RASTER_QUANTITIES} onChange={onQuantityChange} />
        <Check
          label="Relative colour scale"
          checked={relativeScale}
          title="Normalise the ramp over this projection's own range instead of the range shared by all of them"
          onChange={onRelativeScaleChange}
        />
        <Legend quantity={quantity} extents={extents} relative={relativeScale} value={value} />
      </div>

      <div style={section}>
        <h3 style={heading}>Cells</h3>
        <Select label="Resolution" value={cells} options={CELL_OPTIONS} onChange={onCellsChange} />
        {cells !== 'off' && (
          <Check
            label="Fill the sag"
            checked={sag}
            title="Fill the gap between each cell edge and the great circle joining its vertices, at true scale"
            onChange={onSagChange}
          />
        )}
      </div>

      {cells !== 'off' && <EdgeStats metrics={edges} />}

      <div style={section}>
        <h3 style={heading}>Jacobian at the cursor</h3>
        <div style={{fontSize: '11px', color: MUTED, marginBottom: '8px', fontFamily: MONO}}>{LABELS.title}</div>
        <Matrix frame={frame} />

        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px'}}>
          <Patch radial={[0, 1]} azimuthal={[1, 0]} axes={LABELS.source} caption="on the face" />
          <div style={{fontSize: '18px', color: MUTED}}>{'→'}</div>
          <Patch
            radial={[frame.rows[1][0], frame.rows[0][0]]}
            azimuthal={[frame.rows[1][1], frame.rows[0][1]]}
            axes={LABELS.target}
            caption="on the sphere"
          />
        </div>

        <Decomposition frame={frame} extents={extents} quantity={quantity} />
        <Readouts polar={polar} frame={frame} projection={projection} />
      </div>
    </div>
  );
}
