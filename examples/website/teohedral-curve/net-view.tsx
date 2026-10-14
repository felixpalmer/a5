// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useMemo} from 'react';
import {colorBins} from '@deck.gl/carto';
import {dualCurve, FACE_LAYOUTS, FACE_NAMES, NET, netCells} from './net';
import type {FaceLayout, V2} from './net';

const COLORS = {
  land: '#211f1a',
  ocean: '#1b242c',
  hairline: '#3a4048',
  text: '#e8e5de',
  muted: '#9aa0a8',
  handoff: '#9aa0a8',
  background: '#14171b'
};

const LAYOUT_COLORS: Record<FaceLayout, string> = {
  counterJump: '#7aa5e8',
  clockwiseJump: '#c39be0',
  clockwiseStep: '#e08a52'
};

const LEGEND: [FaceLayout, string][] = [
  ['counterJump', 'jump ↺'],
  ['clockwiseJump', 'jump ↻'],
  ['clockwiseStep', 'step ↻']
];

// Pixels per unit of net coordinates (unit-sphere chord lengths)
const SCALE = 160;
const MARGIN = 24;
// Headroom for the closing arc from the last face back to the first
const TOP_MARGIN = 64;

const xs = NET.flatMap(face => face.poly.map(p => p[0]));
const ys = NET.flatMap(face => face.poly.map(p => p[1]));
const MIN_X = Math.min(...xs);
const MAX_Y = Math.max(...ys);
const WIDTH = (Math.max(...xs) - MIN_X) * SCALE + 2 * MARGIN;
const HEIGHT = (MAX_Y - Math.min(...ys)) * SCALE + MARGIN + TOP_MARGIN;
const toScreen = ([x, y]: V2): V2 => [MARGIN + (x - MIN_X) * SCALE, TOP_MARGIN + (MAX_Y - y) * SCALE];

const points = (p: V2[]) => p.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * The order the curve visits the quintants: the dual curve at resolution 1,
 * where it steps once across each quintant, corner to corner. Per face, the
 * corners in visiting order (entry vertex, ..., exit vertex) drawn inset so the
 * path sits inside the face: vertices are pulled towards the center, and each
 * visit to the center towards the rim vertices it connects.
 */
const FACE_PATHS: V2[][] = (() => {
  const {net} = dualCurve(1);
  return NET.map((face, f) => {
    // Quintant j of face f walks from net[2(5f + j)] to net[2(5f + j) + 1]
    const corners = [net[10 * f], ...[0, 1, 2, 3, 4].map(j => net[10 * f + 2 * j + 1])];
    const isCenter = (p: V2) => Math.hypot(p[0] - face.centroid[0], p[1] - face.centroid[1]) < 1e-6;
    return corners.map((p, i) =>
      isCenter(p) ? lerp(face.centroid, lerp(corners[i - 1], corners[i + 1], 0.5), 0.18) : lerp(p, face.centroid, 0.12)
    );
  });
})();

const Arrow: React.FC<{from: V2; to: V2; color: string}> = ({from, to, color}) => {
  const mid = lerp(from, to, 0.58);
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const s = 6;
  const wing = (da: number): string => `${mid[0] - s * Math.cos(angle + da)} ${mid[1] - s * Math.sin(angle + da)}`;
  return (
    <path
      d={`M ${wing(-0.45)} L ${mid[0]} ${mid[1]} L ${wing(0.45)}`}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  );
};

// The globe's colors for the cell curve, one per face
const faceColor = colorBins({
  attr: (d: {face: number}) => d.face,
  colors: 'Pastel',
  domain: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
}) as unknown as (d: {face: number}) => number[];
const FACE_COLORS = NET.map((_, f) => {
  const [r, g, b] = faceColor({face: f});
  return `rgb(${r},${g},${b})`;
});

/**
 * The A5 curve on the dodecahedron unfolded along its face order: the curve
 * through the cells (as on the globe), and on top the order in which it visits
 * the 60 quintants, colored by how each face is threaded. The range slider
 * reveals both in step with the globe.
 */
const NetView: React.FC<{
  resolution: number;
  filterRange: [number, number];
  showPath: boolean;
  showCells: boolean;
}> = ({resolution, filterRange, showPath, showCells}) => {
  const cells = useMemo(() => {
    const {centers, boundaries, faces} = netCells(resolution);
    return {centers: centers.map(toScreen), boundaries: boundaries.map(b => b.map(toScreen)), faces};
  }, [resolution]);
  const cellCount = cells.centers.length;
  const [lo, hi] = filterRange;
  const cellsPerQuintant = cellCount / 60;
  // Quintant g (in curve order) is shown when any of its cells is in range (at
  // resolution 0 a cell spans several quintants)
  const visible = (g: number) => {
    const first = Math.floor(g * cellsPerQuintant);
    const last = Math.max(first, Math.ceil((g + 1) * cellsPerQuintant) - 1);
    return last >= lo && first <= hi;
  };

  // The cell curve through the visible cells, one polyline per face, joined across faces
  const cellRuns: {face: number; pts: V2[]}[] = [];
  const cellHandoffs: [V2, V2][] = [];
  const outlines: string[] = [];
  for (let i = Math.max(0, Math.ceil(lo)); i <= Math.min(cellCount - 1, hi); i++) {
    const face = cells.faces[i];
    const last = cellRuns[cellRuns.length - 1];
    if (last && last.face === face) last.pts.push(cells.centers[i]);
    else {
      if (last) cellHandoffs.push([last.pts[last.pts.length - 1], cells.centers[i]]);
      cellRuns.push({face, pts: [cells.centers[i]]});
    }
    if (showCells) outlines.push(`M${points(cells.boundaries[i]).replace(/ /g, 'L')}Z`);
  }
  const cellWidth = Math.max(0.6, 1.4 - 0.15 * resolution);

  // Per face, the visible run of its path: stop i joins the step into quintant i - 1 and out of quintant i
  const runs = FACE_PATHS.map((path, f) => {
    const shown = [0, 1, 2, 3, 4].filter(j => visible(5 * f + j));
    if (!shown.length) return null;
    return path.slice(shown[0], shown[shown.length - 1] + 2).map(toScreen);
  });
  const handoffs: [V2, V2][] = [];
  for (let f = 0; f < 11; f++) {
    if (visible(5 * f + 4) && visible(5 * f + 5))
      handoffs.push([toScreen(FACE_PATHS[f][5]), toScreen(FACE_PATHS[f + 1][0])]);
  }
  const closing = visible(59) && visible(0) ? [toScreen(FACE_PATHS[11][5]), toScreen(FACE_PATHS[0][0])] : null;

  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{width: '100%', height: '100%', fontFamily: 'system-ui, sans-serif'}}
      >
        {NET.map((face, f) => {
          const center = toScreen(face.centroid);
          return (
            <g key={`face-${f}`}>
              <polygon
                points={points(face.poly.map(toScreen))}
                fill={f < 8 ? COLORS.land : COLORS.ocean}
                stroke={COLORS.hairline}
                strokeWidth={1.2}
              />
              {face.poly.map((p, i) => {
                const v = toScreen(p);
                return (
                  <line
                    key={i}
                    x1={center[0]}
                    y1={center[1]}
                    x2={v[0]}
                    y2={v[1]}
                    stroke={COLORS.hairline}
                    strokeWidth={0.7}
                    strokeDasharray="2 3"
                  />
                );
              })}
            </g>
          );
        })}
        {showCells && <path d={outlines.join('')} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} />}
        {showPath && (
          <g opacity={0.85}>
            {cellHandoffs.map(([p, q], i) => (
              <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={COLORS.handoff} strokeWidth={cellWidth} />
            ))}
            {cellRuns.map((run, i) => (
              <polyline
                key={i}
                points={points(run.pts)}
                fill="none"
                stroke={FACE_COLORS[run.face]}
                strokeWidth={cellWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>
        )}
        {handoffs.map(([a, b], i) => (
          <line
            key={`handoff-${i}`}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={COLORS.handoff}
            strokeWidth={1.4}
          />
        ))}
        {closing && (
          <path
            d={`M ${closing[0][0]} ${closing[0][1]} Q ${(closing[0][0] + closing[1][0]) / 2} ${
              Math.min(closing[0][1], closing[1][1]) - 70
            } ${closing[1][0]} ${closing[1][1]}`}
            fill="none"
            stroke={COLORS.handoff}
            strokeWidth={1.2}
            strokeDasharray="5 5"
          />
        )}
        {runs.map((run, f) => {
          if (!run) return null;
          const color = LAYOUT_COLORS[FACE_LAYOUTS[f]];
          const complete = run.length === 6;
          return (
            <g key={`run-${f}`}>
              <polyline points={points(run)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {run.slice(1).map((p, i) => (
                <Arrow key={i} from={run[i]} to={p} color={color} />
              ))}
              <circle cx={run[0][0]} cy={run[0][1]} r={3.5} fill={color} />
              {complete && (
                <circle
                  cx={run[5][0]}
                  cy={run[5][1]}
                  r={3.5}
                  fill={COLORS.background}
                  stroke={color}
                  strokeWidth={1.6}
                />
              )}
            </g>
          );
        })}
        {NET.map((face, f) => {
          const [cx, cy] = toScreen(face.centroid);
          const halo = {stroke: '#111', strokeWidth: 3, paintOrder: 'stroke'} as const;
          return (
            <g key={`label-${f}`} textAnchor="middle">
              <text x={cx} y={cy + 26} fontSize={15} fontWeight={700} fill={COLORS.text} {...halo}>
                {f}
              </text>
              <text x={cx} y={cy + 41} fontSize={11} fill={COLORS.muted} {...halo}>
                {FACE_NAMES[f]}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 16,
          display: 'flex',
          gap: 16,
          fontSize: 12,
          color: COLORS.muted,
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {LEGEND.map(([layout, label]) => (
          <span key={layout}>
            <span
              style={{
                display: 'inline-block',
                width: 18,
                height: 3,
                borderRadius: 2,
                background: LAYOUT_COLORS[layout],
                verticalAlign: 'middle',
                marginRight: 6
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default NetView;
