// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Polar} from 'a5/core/coordinate-systems';
import {FaceView, SphereView} from './components';
import {ControlPanel} from './overlay';
import {
  CELL_OPTIONS,
  resolveExtents,
  useDeformationField,
  useDeformationRaster,
  useEdgeMetrics,
  useSharedExtents
} from './deformation';
import type {RasterQuantity} from './deformation';
import type {GridSource} from './geometry';
import {computeJacobian, decompose, deformationValues, faceCells, toFrame} from './geometry';
import {DEFAULT_PROJECTION_MODE} from './projection';
import type {ProjectionMode} from './projection';

// Off both a cusp and the face center, so the shear terms are visible on arrival
const INITIAL_POLAR = [0.34, Math.PI / 9] as Polar;

/** One of the two stacked views, each taking half the height */
const viewStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 0
};

const captionText: React.CSSProperties = {
  color: '#fff',
  fontSize: 13,
  letterSpacing: 0.4,
  opacity: 0.65,
  textAlign: 'center',
  pointerEvents: 'none'
};

// Both captions meet in the middle of the page, the face's below its diagram and
// the sphere's above its own, with the rule that divides the two views between
// them. Each label is then against the view it names.
const faceCaption: React.CSSProperties = {...captionText, flex: '0 0 auto', padding: '0 0 8px'};

const sphereCaption: React.CSSProperties = {
  ...captionText,
  flex: '0 0 auto',
  padding: '8px 0 0',
  borderTop: '1px solid rgba(255,255,255,0.12)'
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
  // Which side of the projection the grid is drawn from: the side it comes from is
  // the straight one, the other shows the kinks
  const [source, setSource] = useState<GridSource>('plane');
  const ownFrame = !singleFace;
  // Projection independent: the lattice lives in the plane, only its image moves
  const cells = useMemo(() => (cellOption === 'off' ? [] : faceCells(Number(cellOption))), [cellOption]);
  const frame = useMemo(() => toFrame(computeJacobian(polar, projection, ownFrame)), [polar, projection, ownFrame]);
  const field = useDeformationField(projection, ownFrame);
  // Shared by default, so the ramp means the same thing whichever projection is on
  const shared = useSharedExtents(ownFrame);
  const extents = useMemo(() => resolveExtents(field, shared, relativeScale), [field, shared, relativeScale]);
  const raster = useDeformationRaster(field, quantity, extents);
  // The grid source is the frame of reference the Jacobian is read from, and the
  // raster measures what the projection does to it — so it belongs on the far side
  // of the map, drawn on the image rather than on the domain
  const faceRaster = source === 'sphere' ? raster : null;
  const sphereRaster = source === 'plane' ? raster : null;
  // What the hovered point reads, so the legend can mark it on the ramp
  const hovered = useMemo(() => deformationValues(decompose(frame)), [frame]);
  const edges = useEdgeMetrics(cells, projection);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(0, #000, #223)'
      }}
    >
      <div style={viewStyle}>
        <FaceView
          polar={polar}
          raster={faceRaster}
          cells={cells}
          ownFrame={ownFrame}
          source={source}
          projection={projection}
          onHover={setPolar}
        />
      </div>
      <div style={faceCaption}>Dodecahedron face and its reflections — polar (ρ, γ)</div>
      <div style={sphereCaption}>Sphere — spherical (θ, φ)</div>
      <div style={viewStyle}>
        <SphereView
          polar={polar}
          raster={sphereRaster}
          projection={projection}
          cells={cells}
          showSag={showSag && cells.length > 0}
          ownFrame={ownFrame}
          source={source}
          onHover={setPolar}
        />
      </div>

      <ControlPanel
        frame={frame}
        projection={projection}
        quantity={quantity}
        extents={extents}
        relativeScale={relativeScale}
        singleFace={singleFace}
        source={source}
        cells={cellOption}
        sag={showSag}
        edges={edges}
        value={quantity === 'off' ? null : hovered[quantity]}
        onQuantityChange={setQuantity}
        onProjectionChange={setProjection}
        onCellsChange={setCellOption}
        onSagChange={setShowSag}
        onRelativeScaleChange={setRelativeScale}
        onSingleFaceChange={setSingleFace}
        onSourceChange={setSource}
      />
    </div>
  );
};

export default App;

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
