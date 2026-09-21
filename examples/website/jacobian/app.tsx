// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Polar} from 'a5/core/coordinate-systems';
import {FaceView, SphereView} from './components';
import {JacobianOverlay} from './overlay';
import {
  CELL_OPTIONS,
  DeformationControls,
  resolveExtents,
  useDeformationField,
  useDeformationRaster,
  useEdgeMetrics,
  useSharedExtents
} from './deformation';
import type {RasterQuantity} from './deformation';
import type {GridSource} from './jacobian';
import {clampToDomain, computeJacobian, decompose, deformationValues, faceCells, toFrame} from './jacobian';
import {DEFAULT_PROJECTION_MODE} from 'a5/projections/projection-mode';
import type {ProjectionMode} from 'a5/projections/projection-mode';

// Off both a cusp and the face center, so the shear terms are visible on arrival
const INITIAL_POLAR = [0.34, Math.PI / 9] as Polar;

const panelStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 0
};

const labelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 20,
  color: '#fff',
  fontSize: 13,
  letterSpacing: 0.4,
  opacity: 0.65,
  pointerEvents: 'none',
  zIndex: 1
};

const App: React.FC = () => {
  const [polar, setPolar] = useState<Polar>(INITIAL_POLAR);
  // Rotation is identically zero per-face under DSEA, so it would open on a blank
  // raster; shear is the quantity with something to show in the default view
  const [quantity, setQuantity] = useState<RasterQuantity>('shear');
  const [projection, setProjection] = useState<ProjectionMode>(DEFAULT_PROJECTION_MODE);
  const [cellOption, setCellOption] = useState<string>(CELL_OPTIONS[0]);
  const [showSag, setShowSag] = useState(false);
  const [relativeScale, setRelativeScale] = useState(false);
  // A5 projects every point from its own face, so that is the default; the single
  // face view is the opt-in, for looking at the seam
  const [singleFace, setSingleFace] = useState(false);
  // The ten triangles that complete each dodecahedron vertex of this face
  const [closed, setClosed] = useState(false);
  // Which side of the projection the grid is drawn from: the side it comes from is
  // the straight one, the other shows the kinks
  const [source, setSource] = useState<GridSource>('plane');
  const ownFrame = !singleFace;
  // Projection independent: the lattice lives in the plane, only its image moves
  const cells = useMemo(() => (cellOption === 'off' ? [] : faceCells(Number(cellOption))), [cellOption]);
  const frame = useMemo(() => toFrame(computeJacobian(polar, projection, ownFrame)), [polar, projection, ownFrame]);
  const field = useDeformationField(projection, ownFrame, closed);
  // Shared by default, so the ramp means the same thing whichever projection is on
  const shared = useSharedExtents(ownFrame, closed);
  const extents = useMemo(() => resolveExtents(field, shared, relativeScale), [field, shared, relativeScale]);
  const raster = useDeformationRaster(field, quantity, extents);
  // What the hovered point reads, so the legend can mark it on the ramp
  const hovered = useMemo(() => deformationValues(decompose(frame)), [frame]);
  const edges = useEdgeMetrics(cells, projection);

  const handleClosedChange = (next: boolean) => {
    setClosed(next);
    // Taking the triangles away shrinks the domain out from under the hovered point
    setPolar(current => clampToDomain(current, next));
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: 'linear-gradient(0, #000, #223)'
      }}
    >
      <div style={{...panelStyle, borderRight: '1px solid rgba(255,255,255,0.12)'}}>
        <div style={labelStyle}>Dodecahedron face and its reflections — polar (ρ, γ)</div>
        <FaceView
          polar={polar}
          raster={raster}
          cells={cells}
          closed={closed}
          ownFrame={ownFrame}
          source={source}
          projection={projection}
          onHover={setPolar}
        />
        <DeformationControls
          field={field}
          quantity={quantity}
          projection={projection}
          cells={cellOption}
          sag={showSag}
          extents={extents}
          relativeScale={relativeScale}
          singleFace={singleFace}
          closed={closed}
          source={source}
          value={quantity === 'off' ? null : hovered[quantity]}
          edges={edges}
          onQuantityChange={setQuantity}
          onProjectionChange={setProjection}
          onCellsChange={setCellOption}
          onSagChange={setShowSag}
          onRelativeScaleChange={setRelativeScale}
          onSingleFaceChange={setSingleFace}
          onClosedChange={handleClosedChange}
          onSourceChange={setSource}
        />
      </div>
      <div style={panelStyle}>
        <div style={labelStyle}>Sphere — spherical (θ, φ)</div>
        <SphereView
          polar={polar}
          projection={projection}
          cells={cells}
          showSag={showSag && cells.length > 0}
          closed={closed}
          ownFrame={ownFrame}
          source={source}
          onHover={setPolar}
        />
      </div>

      <JacobianOverlay polar={polar} frame={frame} projection={projection} extents={extents} quantity={quantity} />
    </div>
  );
};

export default App;

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
