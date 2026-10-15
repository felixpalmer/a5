// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {OrbitView, OrthographicView, type View} from '@deck.gl/core';
import {SolidPolygonLayer, TextLayer} from '@deck.gl/layers';

import {
  type BorderTri3D,
  type Cells,
  type FillTri3D,
  INK,
  MORPH_TRANSITION,
  makeWelder,
  tint
} from '../tiling/geometry';
import {Check, MUTED, panelStyle, sectionStyle, useElementSize} from '../tiling/panel';
import {pentakisFaces, subdivideTriangle, pentagonalize, orthoFaces} from './pentagonal';
import {
  GOLDBERG_PENTAGON,
  GOLDBERG_HEXAGON,
  FLAVOR_FILLS,
  geodesicCells,
  goldbergCells,
  pentagonCells,
  orthoCells,
  ORTHO_QUAD
} from './cells';

// The Teohedron, the geodesic polyhedron and its dual Goldberg polyhedron
// (rows) at the first four aperture 4 frequencies n = 1, 2, 4, 8 (columns).
// One deck.gl canvas holds the whole grid — an orbit view per polyhedron, all
// turned together, plus a full-canvas view for the labels.

const FREQUENCIES = [1, 2, 4, 8];

type RowKey = 'teohedron' | 'ortho' | 'geodesic' | 'goldberg';

// Each row is labelled with its Conway expression: u_n subdivides every
// triangle of the pentakis dodecahedron kD into n², and the Teohedron is the
// gyro of the quadrilateral subdivision o_n D. Each cell is labelled with its
// expression expanded for its n = 2ʳ, where oₙ = oʳ and uₙ = uʳ, after the
// polyhedron's own symbol where it has one (the geodesic polyhedron has none
// of the same kind).
const repeat = (letter: string, n: number) => letter.repeat(Math.log2(n));
const ROWS: {key: RowKey; label: string; expression: string; cell: (n: number) => string}[] = [
  {key: 'teohedron', label: 'Teohedron', expression: 'goₙD', cell: n => `T(${n}) = g${repeat('o', n)}D`},
  // Optional: o₂ₙD, face for face the Teohedron above it. Both o and g make one
  // face per corner of oₙD — a kite or a pentagon — and gyro is ortho with
  // each edge-vertex split in two: T(n) = g oₙD = x o₂ₙD.
  {key: 'ortho', label: 'Ortho', expression: 'o₂ₙD', cell: n => `${repeat('o', 2 * n)}D`},
  {key: 'geodesic', label: 'Geodesic', expression: 'uₙkD', cell: n => `${repeat('u', n)}kD`},
  {key: 'goldberg', label: 'Goldberg', expression: 'duₙkD', cell: n => `GP(${n},${n}) = d${repeat('u', n)}kD`}
];

const LABEL: [number, number, number] = [225, 225, 225];
const LABEL_LIGHT: [number, number, number] = [40, 40, 40];

// Space for the labels around the grid, in CSS pixels.
const ROW_LABEL_WIDTH = 100;
const HEADER_HEIGHT = 34;
const CELL_LABEL_HEIGHT = 22;
// Room kept clear for the control panel (left) and the info panel (right)
// when the container is wide enough to place the grid between them.
const PANEL_LEFT = 270;
const PANEL_RIGHT = 392;
const MARGIN = 20;

const DEFAULT_ROTATION = {rotationX: 20, rotationOrbit: -30, zoomOffset: 0};
type Rotation = typeof DEFAULT_ROTATION;

type AppProps = {
  /**
   * Reduced form for embedding in a docs page: only these rows, on a
   * transparent background, with just the project to sphere toggle. The
   * height follows from the width.
   */
  embed?: RowKey[];
  /** Embedded on a dark page: draw the labels light */
  dark?: boolean;
};

const App: React.FC<AppProps> = ({embed, dark = true}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);

  const [sphere, setSphere] = useState(false);
  const [colour, setColour] = useState(true);
  const [labels, setLabels] = useState(true);
  const [showOrtho, setShowOrtho] = useState(false);
  const rows = useMemo(
    () => ROWS.filter(row => (embed ? embed.includes(row.key) : showOrtho || row.key !== 'ortho')),
    [embed, showOrtho]
  );
  const [rotation, setRotation] = useState<Rotation>(DEFAULT_ROTATION);

  // The free region between the panels, and the largest grid that fits it.
  const wide = !embed && size.width >= 1000;
  const regionX = wide ? PANEL_LEFT : embed ? 0 : MARGIN;
  const regionWidth = Math.max(0, size.width - regionX - (wide ? PANEL_RIGHT : embed ? 0 : MARGIN));
  const regionHeight = Math.max(0, size.height - 2 * MARGIN);
  const left = labels ? ROW_LABEL_WIDTH : 0;
  const top = labels ? HEADER_HEIGHT : 0;
  const cell = Math.max(
    40,
    Math.floor(
      embed
        ? (regionWidth - left) / FREQUENCIES.length
        : Math.min((regionWidth - left) / FREQUENCIES.length, (regionHeight - top) / rows.length)
    )
  );
  const width = left + cell * FREQUENCIES.length;
  const height = top + cell * rows.length;

  // All the polyhedra; the readings of one frequency share its subdivided
  // pentakis dodecahedron.
  const meshes = useMemo(() => {
    const faces = pentakisFaces();
    const out: Record<string, Cells & {flavors?: number[]}> = {};
    for (const n of FREQUENCIES) {
      const weld = makeWelder();
      const tris = faces.flatMap(f => subdivideTriangle(f, n, weld));
      // Coarse cells get their edges subdivided so that, on the sphere, they
      // follow it instead of cutting chords (see pushPasses).
      const segments = Math.max(1, Math.round(16 / n));
      out[`geodesic-${n}`] = geodesicCells(tris, segments);
      out[`goldberg-${n}`] = goldbergCells(tris, segments);
      out[`teohedron-${n}`] = pentagonCells(pentagonalize(tris), segments);
      // One step finer: o₂ₙD is read off the (2n,2n) grid.
      const finer = makeWelder();
      out[`ortho-${n}`] = orthoCells(
        orthoFaces(faces.flatMap(f => subdivideTriangle(f, 2 * n, finer))),
        Math.max(1, Math.round(8 / n))
      );
    }
    return out;
  }, []);

  const viewId = (row: RowKey, n: number) => `${row}-${n}`;

  // An orbit view per polyhedron, then the labels on top of everything.
  const views = useMemo(() => {
    const vs: View[] = [];
    rows.forEach((row, i) =>
      FREQUENCIES.forEach((n, j) =>
        vs.push(
          new OrbitView({
            id: viewId(row.key, n),
            x: left + j * cell,
            y: top + i * cell,
            width: cell,
            height: cell,
            // Centre the polyhedron above its label.
            padding: {bottom: labels ? CELL_LABEL_HEIGHT : 0},
            // Embedded, leave the page scroll alone.
            controller: embed ? {scrollZoom: false} : true
          })
        )
      )
    );
    vs.push(new OrthographicView({id: 'labels', controller: false}));
    return vs;
  }, [rows, left, top, cell, labels, embed]);

  // Every polyhedron has circumradius 1; leave room for the cell's label.
  const baseZoom = Math.log2((cell - (labels ? CELL_LABEL_HEIGHT : 0)) / 2.25);
  const viewState = useMemo(() => {
    const flat = {target: [width / 2, height / 2, 0] as [number, number, number], zoom: 0};
    const orbit = {
      target: [0, 0, 0] as [number, number, number],
      rotationX: rotation.rotationX,
      rotationOrbit: rotation.rotationOrbit,
      zoom: baseZoom + rotation.zoomOffset
    };
    const state: Record<string, typeof flat | typeof orbit> = {labels: flat};
    for (const row of rows) for (const n of FREQUENCIES) state[viewId(row.key, n)] = orbit;
    return state;
  }, [rows, width, height, baseZoom, rotation]);

  const fillColour =
    (row: RowKey, cells: Cells & {flavors?: number[]}) =>
    (d: FillTri3D, {index}: {index: number}): [number, number, number, number] => {
      const s = sphere ? d.shadeSphere : d.shadePlanar;
      if (!colour || row === 'geodesic') return [255 * s, 255 * s, 255 * s, 255];
      if (row === 'goldberg') return tint(d.sides === 5 ? GOLDBERG_PENTAGON : GOLDBERG_HEXAGON, s);
      if (row === 'ortho') return tint(ORTHO_QUAD, s);
      return tint(FLAVOR_FILLS[cells.flavors![index]], s);
    };

  const layers = [
    ...rows.flatMap(row =>
      FREQUENCIES.flatMap(n => {
        const id = viewId(row.key, n);
        const cells = meshes[id];
        return [
          new SolidPolygonLayer<BorderTri3D>({
            id: `${id}:border`,
            data: cells.borders,
            getPolygon: d => (sphere ? d.sphere : d.planar),
            getFillColor: INK,
            _full3d: true,
            _normalize: false,
            updateTriggers: {getPolygon: [sphere]},
            transitions: {getPolygon: MORPH_TRANSITION}
          }),
          new SolidPolygonLayer<FillTri3D>({
            id: `${id}:fill`,
            data: cells.fills,
            getPolygon: d => (sphere ? d.sphere : d.planar),
            getFillColor: fillColour(row.key, cells),
            _full3d: true,
            _normalize: false,
            getPolygonOffset: () => [-4, -20000] as [number, number],
            updateTriggers: {getPolygon: [sphere], getFillColor: [sphere, colour]},
            transitions: {getPolygon: MORPH_TRANSITION, getFillColor: MORPH_TRANSITION}
          })
        ];
      })
    ),
    labels &&
      new TextLayer<{text: string; position: [number, number]; anchor: 'start' | 'middle'; size: number}>({
        id: 'labels:text',
        data: [
          ...FREQUENCIES.map((n, j) => ({
            text: `n = ${n}`,
            position: [left + (j + 0.5) * cell, HEADER_HEIGHT / 2] as [number, number],
            anchor: 'middle' as const,
            size: 15
          })),
          ...rows.flatMap((row, i) => [
            {
              text: row.label,
              position: [8, top + (i + 0.5) * cell - 10] as [number, number],
              anchor: 'start' as const,
              size: 15
            },
            {
              text: row.expression,
              position: [8, top + (i + 0.5) * cell + 10] as [number, number],
              anchor: 'start' as const,
              size: 14
            }
          ]),
          ...rows.flatMap((row, i) =>
            FREQUENCIES.map((n, j) => ({
              text: row.cell(n),
              position: [left + (j + 0.5) * cell, top + (i + 1) * cell - CELL_LABEL_HEIGHT / 2] as [number, number],
              anchor: 'middle' as const,
              size: 13
            }))
          )
        ],
        getText: d => d.text,
        getPosition: d => d.position,
        getSize: d => d.size,
        getTextAnchor: d => d.anchor,
        getAlignmentBaseline: 'center',
        getColor: dark ? LABEL : LABEL_LIGHT,
        fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
        characterSet: 'auto'
      })
  ];

  const deck = (
    <DeckGL
      width={width}
      height={height}
      views={views}
      // One state per view id; deck's typing only knows the single-view form.
      viewState={viewState as Record<string, never>}
      onViewStateChange={({viewId: id, viewState: vs}) => {
        if (id === 'labels') return;
        const v = vs as {rotationX: number; rotationOrbit: number; zoom: number};
        setRotation({rotationX: v.rotationX, rotationOrbit: v.rotationOrbit, zoomOffset: v.zoom - baseZoom});
      }}
      layerFilter={({layer, viewport}) => layer.id.startsWith(`${viewport.id}:`)}
      layers={layers}
    />
  );

  if (embed) {
    return (
      <div ref={containerRef}>
        <Check label="Project to sphere" checked={sphere} onChange={setSphere} />
        {size.width > 0 && <div style={{position: 'relative', width, height}}>{deck}</div>}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{position: 'absolute', inset: 0, background: 'linear-gradient(0, #000, #223)'}}>
      {size.width > 0 && (
        <div
          style={{
            position: 'absolute',
            left: regionX + Math.max(0, (regionWidth - width) / 2),
            top: MARGIN + Math.max(0, (regionHeight - height) / 2),
            width,
            height
          }}
        >
          {deck}
        </div>
      )}

      <div style={panelStyle}>
        <Check label="Project to sphere" checked={sphere} onChange={setSphere} />
        <Check
          label="Colour"
          checked={colour}
          title="Goldberg pentagons and hexagons; Teohedron A5 flavors"
          onChange={setColour}
        />
        <Check label="Labels" checked={labels} onChange={setLabels} />
        <Check
          label="o₂ₙD row"
          checked={showOrtho}
          title="Kite for pentagon the Teohedron: T(n) = g oₙD has one face per corner of oₙD, as o₂ₙD = o oₙD does"
          onChange={setShowOrtho}
        />
        <div style={{...sectionStyle, color: MUTED}}>Drag any cell to turn them all.</div>
      </div>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
