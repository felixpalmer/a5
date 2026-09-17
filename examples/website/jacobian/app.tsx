// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Polar} from 'a5/core/coordinate-systems';
import {FaceView, SphereView} from './components';
import {JacobianOverlay} from './overlay';
import {ALL_CHANNELS, DeformationControls, useDeformationField, useDeformationRaster} from './deformation';
import type {ChannelToggles} from './deformation';
import {computeJacobian} from './jacobian';

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
  const [channels, setChannels] = useState<ChannelToggles>(ALL_CHANNELS);
  const jacobian = useMemo(() => computeJacobian(polar), [polar]);
  const field = useDeformationField();
  const raster = useDeformationRaster(field, channels);

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
        <div style={labelStyle}>Dodecahedron face — polar (ρ, γ)</div>
        <FaceView polar={polar} raster={raster} onHover={setPolar} />
        <DeformationControls field={field} channels={channels} onChange={setChannels} />
      </div>
      <div style={panelStyle}>
        <div style={labelStyle}>Sphere — spherical (θ, φ)</div>
        <SphereView polar={polar} onHover={setPolar} />
      </div>

      <JacobianOverlay polar={polar} jacobian={jacobian} />
    </div>
  );
};

export default App;

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
