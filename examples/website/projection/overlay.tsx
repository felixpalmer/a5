// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import {COLORS} from './components';
import {CELL_OPTIONS, CHANNEL_INFO, RASTER_QUANTITIES, rampCss, rampFraction, rampT} from './deformation';
import type {Extents, RasterQuantity} from './deformation';
import {GRID_SOURCES, PROJECTION_MODES, decompose, deformationValues} from './geometry';
import type {DeformationChannel, EdgeMetrics, FrameJacobian, GridSource} from './geometry';
import type {ProjectionMode} from './projection';

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

/** A labelled dropdown, one per row. `labels` is how an option reads, not what it is */
function Select<T extends string>({
  label,
  value,
  options,
  labels,
  titles,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
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
            {labels?.[option] ?? option}
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

const PROJECTION_LABELS: Record<ProjectionMode, string> = {
  dsea: 'DSEA',
  isea: 'ISEA',
  rtsea: 'RTSEA',
  gnomonic: 'Gnomonic'
};

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

// ---------------------------------------------------------------------------
// The Jacobian at the hovered point
// ---------------------------------------------------------------------------

const GAUGE_WIDTH = 58;
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

/** The frame the derivative is written in; only the intrinsic one is offered, see `toFrame` */
const LABELS = {
  symbol: 'J',
  definition: 'J = \u2202(R d\u03c6, R sin \u03c6 d\u03b8) / \u2202(d\u03c1, \u03c1 d\u03b3)',
  source: ['\u03b3\u0302', '\u03c1\u0302'] as [string, string],
  target: ['\u03b8\u0302', '\u03c6\u0302'] as [string, string]
};

/** Math-space point to SVG space: the diagrams have y pointing up, SVG has it pointing down */
const at = (x: number, y: number) => `${x.toFixed(4)},${(-y).toFixed(4)}`;

const DIAGRAM_VIEW_BOX = '-0.42 -1.42 1.9 1.9';
const DIAGRAM_SIZE = 84;

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

/**
 * The unit patch and its image, with the map between them named.
 *
 * Which of the two is the square one is what the grid source sets: reading from
 * the plane, J carries the face's unit patch onto the sphere; reading from the
 * sphere it is the sphere's patch that is square and J's inverse that brings it
 * back, so the arrow turns around with it.
 */
function PatchPair({frame, source}: {frame: FrameJacobian; source: GridSource}) {
  const [[a, b], [c, d]] = frame.rows;
  const unit = {radial: [0, 1] as [number, number], azimuthal: [1, 0] as [number, number]};
  // Plot space is x across and y up, with the radial component vertical, so each
  // column of the matrix is read out bottom entry first
  const forward = {radial: [c, a] as [number, number], azimuthal: [d, b] as [number, number]};
  const det = frame.determinant;
  const backward = {
    radial: [-c / det, d / det] as [number, number],
    azimuthal: [a / det, -b / det] as [number, number]
  };

  const fromPlane = source === 'plane';
  const face = fromPlane ? unit : backward;
  const sphere = fromPlane ? forward : unit;

  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px'}}>
      <Patch radial={face.radial} azimuthal={face.azimuthal} axes={LABELS.source} caption="on the face" />
      <div style={{textAlign: 'center', lineHeight: 1.1}}>
        <div style={{fontSize: '12px', fontFamily: MONO}}>
          {LABELS.symbol}
          {!fromPlane && <sup style={{fontSize: '0.75em'}}>−1</sup>}
        </div>
        <div style={{fontSize: '18px', color: MUTED}}>{fromPlane ? '→' : '←'}</div>
      </div>
      <Patch radial={sphere.radial} azimuthal={sphere.azimuthal} axes={LABELS.target} caption="on the sphere" />
    </div>
  );
}

/**
 * A bracketed 2x2, whose entries may be numbers or the symbols standing for them.
 *
 * The columns size themselves to their contents and nothing is allowed to wrap: a
 * fixed column width has to be wide enough for the longest entry any factor can
 * produce, and anything narrower breaks a value across two lines.
 */
function Matrix2({entries, size = 12}: {entries: [string, string, string, string]; size?: number}) {
  return (
    <span
      style={{
        display: 'inline-grid',
        gridTemplateColumns: 'auto auto',
        columnGap: '5px',
        rowGap: '3px',
        whiteSpace: 'nowrap',
        padding: '4px 4px',
        borderLeft: '2px solid #888',
        borderRight: '2px solid #888',
        borderRadius: '3px',
        fontFamily: MONO,
        fontSize: `${size}px`,
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right'
      }}
    >
      {entries.map((entry, index) => (
        <span key={index}>{entry}</span>
      ))}
    </span>
  );
}

/** One of the factors' names, as M with a subscript */
const Factor = ({name}: {name: string}) => (
  <span style={{whiteSpace: 'nowrap'}}>
    M<sub style={{fontSize: '0.75em'}}>{name}</sub>
  </span>
);

/** toFixed, without the "-0.00" a value rounding to zero from below would give */
const fixed = (value: number, digits: number) => {
  const text = value.toFixed(digits);
  return Number(text) === 0 ? (0).toFixed(digits) : text;
};

const entriesOf = (frame: FrameJacobian): [string, string, string, string] => [
  fixed(frame.rows[0][0], 4),
  fixed(frame.rows[0][1], 4),
  fixed(frame.rows[1][0], 4),
  fixed(frame.rows[1][1], 4)
];

/**
 * How the derivative factors, and what each factor is.
 *
 * This is the Gram-Schmidt factorisation `decompose` performs, written out:
 * rotate, then shear, then scale the two axes against each other, then scale
 * both together. Multiplied back out in that order it reproduces J exactly.
 */
function Factorisation({
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

  const factors: {
    channel: DeformationChannel;
    name: string;
    entries: [string, string, string, string];
    parameter: string;
    hint: string;
  }[] = [
    {
      channel: 'rotation',
      name: 'rotate',
      entries: ['cos α', '−sin α', 'sin α', 'cos α'],
      parameter: `α = ${fixed((rotation * 180) / Math.PI, 2)}°`,
      hint: 'Angle taking the radial axis onto its image'
    },
    {
      channel: 'shear',
      name: 'shear',
      entries: ['1', 's', '0', '1'],
      parameter: `s = ${fixed(shear, 3)}`,
      hint: 'How far the image of the azimuthal axis leans off the other one: s = tan(lean)'
    },
    {
      channel: 'squash',
      name: 'squash',
      entries: ['q', '0', '0', '1/q'],
      parameter: `q = ${fixed(squash, 4)}`,
      hint:
        `The two axes scaled against each other: radial x${radial.toFixed(4)}, azimuthal x${azimuthal.toFixed(4)}, ` +
        `q = sqrt(radial / azimuthal). Above 1 the radial axis is the stretched one`
    },
    {
      channel: 'scale',
      name: 'scale',
      entries: ['k', '0', '0', 'k'],
      parameter: `k = ${fixed(scale, 4)}`,
      hint: 'Area scale, sqrt|det|. Exactly 1 for an equal-area projection in the intrinsic frame'
    }
  ];

  return (
    <>
      <div style={{marginTop: '12px', textAlign: 'center', fontSize: '11px', lineHeight: 1.6}}>
        {LABELS.symbol} ={' '}
        {factors.map(({name}, index) => (
          <React.Fragment key={name}>
            {index > 0 && <span style={{color: MUTED}}> · </span>}
            <Factor name={name} />
          </React.Fragment>
        ))}
      </div>

      {/* All four factors share one grid rather than a flex row each, so that the
          matrices and the gauges line up down the column however wide each matrix
          comes out. Everything is nowrap: the gauge belongs beside its matrix, not
          pushed onto a line beneath it */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto',
          justifyContent: 'start',
          alignItems: 'center',
          columnGap: '4px',
          rowGap: '10px',
          marginTop: '10px',
          whiteSpace: 'nowrap'
        }}
      >
        {factors.map(({channel, name, entries, parameter, hint}) => (
          <React.Fragment key={name}>
            <span
              title={hint}
              style={{
                fontSize: '11px',
                color: channel === quantity ? '#000' : MUTED,
                fontWeight: channel === quantity ? 600 : 400
              }}
            >
              <Factor name={name} /> =
            </span>
            <Matrix2 entries={entries} size={11} />
            <span title={hint} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'}}>
              <Gauge value={signed[channel]} range={extents?.[channel]} channel={channel} />
              <span style={{fontFamily: MONO, fontSize: '11px', fontVariantNumeric: 'tabular-nums'}}>{parameter}</span>
            </span>
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The panel itself
// ---------------------------------------------------------------------------

export function ControlPanel({
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
        width: '250px',
        boxSizing: 'border-box',
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 2,
        fontSize: '12px',
        lineHeight: '1.5',
        color: '#222',
        overflowY: 'auto'
      }}
    >
      <Select
        label="Projection"
        value={projection}
        options={PROJECTION_MODES}
        labels={PROJECTION_LABELS}
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
        <Select label="Raster" value={quantity} options={RASTER_QUANTITIES} onChange={onQuantityChange} />
        <Check
          label="Relative colour scale"
          checked={relativeScale}
          title="Normalise the ramp over this projection's own range instead of the range shared by all of them"
          onChange={onRelativeScaleChange}
        />
        <Legend quantity={quantity} extents={extents} relative={relativeScale} value={value} />
      </div>

      <div style={section}>
        <Select label="Cells" value={cells} options={CELL_OPTIONS} onChange={onCellsChange} />
        {cells !== 'off' && (
          <div style={field}>
            <Check
              label="Fill sag"
              checked={sag}
              title="Fill the gap between each cell edge and the great circle joining its vertices, at true scale"
              onChange={onSagChange}
            />
            <span
              style={{color: MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}
              title="Total area between the cell edges and the great circles joining their vertices, as a fraction of the face"
            >
              {edges ? `sag area ${(100 * edges.sagAreaFraction).toFixed(3)}%` : 'measuring…'}
            </span>
          </div>
        )}
      </div>

      <div style={section}>
        <h3 style={heading}>Jacobian at the cursor</h3>
        <div
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap'}}
          title={LABELS.definition}
        >
          <span style={{fontFamily: MONO, fontSize: '12px'}}>{LABELS.symbol} =</span>
          <Matrix2 entries={entriesOf(frame)} />
        </div>

        <PatchPair frame={frame} source={source} />
        <Factorisation frame={frame} extents={extents} quantity={quantity} />
      </div>
    </div>
  );
}
