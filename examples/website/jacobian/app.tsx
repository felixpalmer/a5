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
  useDeformationField,
  useDeformationRaster,
  useEdgeMetrics
} from './deformation';
import type {RasterQuantity} from './deformation';
import {computeJacobian, faceCells, toFrame} from './jacobian';
import type {FrameMode} from './jacobian';
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
  const [quantity, setQuantity] = useState<RasterQuantity>('rotation');
  const [mode, setMode] = useState<FrameMode>('chart');
  const [projection, setProjection] = useState<ProjectionMode>(DEFAULT_PROJECTION_MODE);
  const [cellOption, setCellOption] = useState<string>(CELL_OPTIONS[0]);
  const [showSag, setShowSag] = useState(false);
  // Projection independent: the lattice lives in the plane, only its image moves
  const cells = useMemo(() => (cellOption === 'off' ? [] : faceCells(Number(cellOption))), [cellOption]);
  const frame = useMemo(
    () => toFrame(computeJacobian(polar, projection), polar, mode, projection),
    [polar, mode, projection]
  );
  const field = useDeformationField(mode, projection);
  const raster = useDeformationRaster(field, quantity);
  const edges = useEdgeMetrics(cells, projection);

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
        <FaceView polar={polar} raster={raster} cells={cells} onHover={setPolar} />
        <DeformationControls
          field={field}
          quantity={quantity}
          mode={mode}
          projection={projection}
          cells={cellOption}
          sag={showSag}
          edges={edges}
          onQuantityChange={setQuantity}
          onModeChange={setMode}
          onProjectionChange={setProjection}
          onCellsChange={setCellOption}
          onSagChange={setShowSag}
        />
      </div>
      <div style={panelStyle}>
        <div style={labelStyle}>Sphere — spherical (θ, φ)</div>
        <SphereView
          polar={polar}
          projection={projection}
          cells={cells}
          showSag={showSag && cells.length > 0}
          onHover={setPolar}
        />
      </div>

      <JacobianOverlay polar={polar} frame={frame} projection={projection} ranges={field?.ranges} quantity={quantity} />
    </div>
  );
};

export default App;

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
