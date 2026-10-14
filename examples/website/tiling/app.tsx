// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {OrthographicView, OrbitView} from '@deck.gl/core';
import {PolygonLayer, SolidPolygonLayer} from '@deck.gl/layers';

import {sToCell} from 'a5/lattice';
import {getPentagonVertices, getFaceVertices} from 'a5/core/tiling';
import {origins} from 'a5/core/origin';
import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {toCartesian} from 'a5/core/coordinate-transforms';
import type {Face} from 'a5/core/coordinate-systems';

import {
  type BorderTri3D,
  type FillTri3D,
  type V3,
  INK,
  MORPH_TRANSITION,
  liftToFace,
  pushPasses,
  tint
} from './geometry';
import {Check, MUTED, panelStyle, sectionStyle, useElementSize} from './panel';

type RGBA = [number, number, number, number];

const LINE: RGBA = [235, 235, 235, 255];

// flipY: false keeps math-convention y-up
const VIEW = new OrthographicView({id: 'ortho', flipY: false});
const VIEW_3D = new OrbitView({id: 'orbit'});

type Cell = {
  vertices: [number, number][];
  quintant: number;
};

// One soft tint per quintant so the five-fold structure is visible when fills
// are enabled.
const QUINTANT_FILLS: RGBA[] = [
  [66, 133, 244, 90],
  [219, 68, 55, 90],
  [244, 180, 0, 90],
  [15, 157, 88, 90],
  [171, 71, 188, 90]
];

// Resolution 0 is the dodecahedron itself; from resolution 1 every quintant
// holds 4^(r - 1) pentagons, on the lattice a5 indexes with resolution r - 1
// (sToCell, getPentagonVertices).
const MAX_RESOLUTION = 5;

// Room taken by the control panel (left) and the info panel (right), in CSS
// pixels.
const PANEL_LEFT = 270;
const PANEL_RIGHT = 392;

// The A5 dodecahedron projection (equal-area per spherical triangle). Its
// inverse maps face coordinates to the sphere and correctly handles points
// beyond the pentagonal face outline (the jagged protrusions) by unprojecting
// them onto the neighbouring face's spherical triangle.
const dodecahedron = new DodecahedronProjection();

function projectToSphere(origin: (typeof origins)[number]) {
  return (v: [number, number]): V3 => {
    const c = toCartesian(dodecahedron.inverse(v as Face, origin.id));
    return [c[0], c[1], c[2]];
  };
}

// Canonical vertex order for a face-space ring: north-most vertex (max y)
// first, then clockwise around the cell center. getPentagonVertices returns
// reversed winding for the reflected flavors; without a fixed invariant, the
// planar and projected rings of tilted edge cells could pair up differently
// and flip through themselves during the morph.
function canonicalizeRing(verts: [number, number][]): [number, number][] {
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    area += x1 * y2 - x2 * y1;
  }
  const ring = area > 0 ? [...verts].reverse() : [...verts];
  let k = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i][1] > ring[k][1] || (ring[i][1] === ring[k][1] && ring[i][0] > ring[k][0])) {
      k = i;
    }
  }
  return [...ring.slice(k), ...ring.slice(0, k)];
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);

  // A5 resolution: resolution 1 is gD, one pentagon per quintant.
  const [level, setLevel] = useState(2);
  const [showFills, setShowFills] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [showAdjacent, setShowAdjacent] = useState(false);
  const [view3D, setView3D] = useState(false);
  const [sphere, setSphere] = useState(false);
  const faceVerts = useMemo(
    () =>
      getFaceVertices()
        .getVertices()
        .map(v => [v[0], v[1]] as [number, number]),
    []
  );

  // Adjacent face in a dodecahedron net: the whole tiling rotated 180° about
  // the midpoint of the shared (rightmost) face edge. Unfolding the net is
  // orientation-preserving in the plane, and every face carries the same
  // pattern, so this rotation is what makes the jagged cell edges of the two
  // faces interlock exactly, as they do on the dodecahedron itself.
  const adjacentTransform = useMemo(() => {
    let mid: [number, number] = [0, 0];
    for (let i = 0; i < 5; i++) {
      const p = faceVerts[i];
      const q = faceVerts[(i + 1) % 5];
      const m: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (m[0] > mid[0]) mid = m;
    }
    return (v: [number, number]): [number, number] => [2 * mid[0] - v[0], 2 * mid[1] - v[1]];
  }, [faceVerts]);

  // The drawing unit is either one face or the meshed pair of faces.
  const transforms = useMemo(() => {
    const identity = (v: [number, number]): [number, number] => v;
    return showAdjacent ? [identity, adjacentTransform] : [identity];
  }, [showAdjacent, adjacentTransform]);

  // Bounding box of the drawing unit, used to space side-by-side copies,
  // centre them, and fit the view.
  const unitBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of transforms) {
      for (const v of faceVerts) {
        const [x, y] = t(v);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return {width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2};
  }, [transforms, faceVerts]);

  // Levels rendered left to right, each with a horizontal offset. In
  // single-level mode this is just the selected level, centred at the origin.
  const shownLevels = useMemo(() => {
    const levels = showAllLevels ? Array.from({length: level}, (_, i) => i + 1) : [level];
    const spacing = unitBounds.width * 1.15;
    return levels.map((lvl, i) => ({level: lvl, offsetX: (i - (levels.length - 1) / 2) * spacing}));
  }, [level, showAllLevels, unitBounds]);

  const place = useMemo(
    () =>
      (t: (v: [number, number]) => [number, number], offsetX: number) =>
      (v: [number, number]): [number, number] => {
        const p = t(v);
        return [p[0] - unitBounds.cx + offsetX, p[1] - unitBounds.cy];
      },
    [unitBounds]
  );

  // One dodecahedron face = 5 quintants; each quintant holds 4^(level - 1)
  // pentagons. getPentagonVertices scales by 1/2^(level - 1) internally, so the
  // face keeps a constant size while the pentagons shrink as the level increases.
  const cells = useMemo<Cell[]>(() => {
    const result: Cell[] = [];
    for (const {level: lvl, offsetX} of shownLevels) {
      const lattice = lvl - 1;
      const perQuintant = 4 ** lattice;
      for (const t of transforms) {
        const placeVertex = place(t, offsetX);
        for (let quintant = 0; quintant < 5; quintant++) {
          for (let s = 0; s < perQuintant; s++) {
            const {triple, flavor} = sToCell(BigInt(s), lattice, 'uv');
            const vertices = getPentagonVertices(lattice, quintant, triple, flavor, false)
              .getVertices()
              .map(v => placeVertex([v[0], v[1]]));
            result.push({vertices, quintant});
          }
        }
      }
    }
    return result;
  }, [shownLevels, transforms, place]);

  // 12 copies of the face tiling, one per dodecahedron face. In planar mode
  // cells whose jagged edges extend beyond the pentagonal face outline simply
  // continue in the face plane, sticking out past the dodecahedron edge. In
  // sphere mode every point (including those protrusions) is projected onto
  // the unit sphere with the A5/DSEA equal-area projection. The geometry does
  // NOT depend on the `sphere` flag; toggling it only switches accessors.
  const geo3D = useMemo(() => {
    const borders: BorderTri3D[] = [];
    const fills: FillTri3D[] = [];
    if (!view3D) return {borders, fills};
    const lattice = level - 1;
    const perQuintant = 4 ** lattice;
    const segments = Math.max(1, 2 ** (5 - level));
    for (const origin of origins) {
      const lift = liftToFace(origin);
      const project = projectToSphere(origin);
      for (let quintant = 0; quintant < 5; quintant++) {
        for (let s = 0; s < perQuintant; s++) {
          const {triple, flavor} = sToCell(BigInt(s), lattice, 'uv');
          const base = canonicalizeRing(
            getPentagonVertices(lattice, quintant, triple, flavor, false)
              .getVertices()
              .map(v => [v[0], v[1]] as [number, number])
          );
          let cx = 0;
          let cy = 0;
          for (let i = 0; i < base.length; i++) {
            cx += base[i][0] / base.length;
            cy += base[i][1] / base.length;
          }
          pushPasses(
            {
              ringPlanar: base.map(lift),
              ringSphere: base.map(project),
              centerPlanar: lift([cx, cy]),
              centerSphere: project([cx, cy])
            },
            segments,
            borders,
            fills,
            {quintant, sides: base.length}
          );
        }
      }
    }
    return {borders, fills};
  }, [view3D, level]);

  // Controlled view state so the camera re-fits when the row of faces grows or
  // the container resizes, while still letting the user pan/zoom freely.
  const [viewState, setViewState] = useState<Record<string, unknown>>({target: [0, 0, 0], zoom: 8});
  useEffect(() => {
    if (!size.width || !size.height) return;
    if (view3D) {
      // Both layouts have circumradius 1 (dodecahedron vertices on the unit
      // sphere), plus a margin for the tiles protruding past the edges.
      const diameter = 2.4;
      const zoom = Math.log2((Math.min(size.width, size.height) * 0.75) / diameter);
      setViewState({target: [0, 0, 0], rotationX: 20, rotationOrbit: -30, zoom});
      return;
    }
    const rowWidth = unitBounds.width * (1.15 * (shownLevels.length - 1) + 1.1);
    const rowHeight = unitBounds.height * 1.35;
    // Fit the row between the control panel (left) and the info panel (right)
    // when the container is wide enough to keep both clear.
    const wide = size.width >= 1000;
    const freeWidth = wide ? size.width - PANEL_LEFT - PANEL_RIGHT : size.width;
    const zoom = Math.min(Math.log2((freeWidth * 0.95) / rowWidth), Math.log2((size.height * 0.85) / rowHeight), 8.2);
    const shift = wide ? (PANEL_RIGHT - PANEL_LEFT) / 2 / 2 ** zoom : 0;
    setViewState({target: [shift, 0, 0], zoom});
  }, [shownLevels.length, unitBounds, view3D, size.width, size.height]);

  const layers = view3D
    ? [
        new SolidPolygonLayer<BorderTri3D>({
          id: 'pentagons-3d-border',
          data: geo3D.borders,
          getPolygon: d => (sphere ? d.sphere : d.planar),
          getFillColor: INK,
          _full3d: true,
          _normalize: false,
          updateTriggers: {getPolygon: [sphere]},
          transitions: {getPolygon: MORPH_TRANSITION}
        }),
        // Opaque fills so near faces occlude far ones, shaded by the face
        // normal so the solid reads as 3D.
        new SolidPolygonLayer<FillTri3D>({
          id: 'pentagons-3d-fill',
          data: geo3D.fills,
          getPolygon: d => (sphere ? d.sphere : d.planar),
          getFillColor: d => {
            const s = sphere ? d.shadeSphere : d.shadePlanar;
            return showFills ? tint(QUINTANT_FILLS[d.quintant], s) : [255 * s, 255 * s, 255 * s, 255];
          },
          _full3d: true,
          _normalize: false,
          // Strong slope-scaled depth bias: during the morph, straight-line
          // vertex paths make ink underlays of neighbouring faces transiently
          // cross the fills at shallow angles; this keeps the fills in front
          // without affecting real occlusion (offsets ≪ scene depth deltas).
          getPolygonOffset: () => [-4, -20000] as [number, number],
          updateTriggers: {getPolygon: [sphere], getFillColor: [sphere, showFills]},
          transitions: {getPolygon: MORPH_TRANSITION, getFillColor: MORPH_TRANSITION}
        })
      ]
    : [
        new PolygonLayer<Cell>({
          id: 'pentagons',
          data: cells,
          getPolygon: d => d.vertices,
          getFillColor: d => (showFills ? QUINTANT_FILLS[d.quintant] : [0, 0, 0, 0]),
          getLineColor: LINE,
          filled: true,
          stroked: true,
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          lineJointRounded: true,
          updateTriggers: {getFillColor: [showFills]}
        })
      ];

  const pentagonCount = view3D ? 12 * 5 * 4 ** (level - 1) : cells.length;

  return (
    <div ref={containerRef} style={{position: 'absolute', inset: 0, background: 'linear-gradient(0, #000, #223)'}}>
      <DeckGL
        views={view3D ? VIEW_3D : VIEW}
        viewState={viewState}
        onViewStateChange={({viewState: vs}) => setViewState(vs as Record<string, unknown>)}
        controller={true}
        layers={layers}
      />

      <div style={panelStyle}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <label style={{whiteSpace: 'nowrap'}}>Resolution: {level}</label>
          <input
            type="range"
            min={1}
            max={MAX_RESOLUTION}
            step={1}
            value={level}
            onChange={e => setLevel(Number(e.target.value))}
            style={{flex: 1, minWidth: 0}}
          />
        </div>
        <div style={{color: MUTED, marginBottom: '6px'}}>
          {pentagonCount} pentagons{' '}
          {view3D ? (
            <>
              (12 × 5 × 4<sup>{level - 1}</sup>)
            </>
          ) : showAllLevels ? (
            <>(res 1–{level})</>
          ) : (
            <>
              (5 × 4<sup>{level - 1}</sup>)
            </>
          )}
        </div>

        <div style={sectionStyle}>
          <Check label="Dodecahedron (3D)" checked={view3D} onChange={setView3D} />
          <div style={{marginLeft: '18px'}}>
            <Check label="Project to sphere" checked={sphere} disabled={!view3D} onChange={setSphere} />
          </div>
          <Check
            label="Show all levels side by side"
            checked={showAllLevels}
            disabled={view3D}
            onChange={setShowAllLevels}
          />
          <Check
            label="Adjacent face (edge meshing)"
            checked={showAdjacent}
            disabled={view3D}
            onChange={setShowAdjacent}
          />
          <Check label="Colour by quintant" checked={showFills} onChange={setShowFills} />
        </div>
      </div>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
