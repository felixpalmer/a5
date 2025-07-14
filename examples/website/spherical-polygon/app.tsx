import React, { Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { cellToChildren } from 'a5/index';
import { A5Pentagon, Marker, Sphere, sphericalPentagonFromCell } from './components';
import { toCartesian } from 'a5/core/coordinate-transforms';
import { Cartesian, Spherical } from 'a5/core/coordinate-systems';
import { vec3 } from 'gl-matrix';

const initialSpherical = [2 * Math.PI * Math.random(), Math.PI * Math.random()] as Spherical;
const initialPoint = toCartesian(initialSpherical);
const camera = toCartesian(initialSpherical);
vec3.scale(camera, camera, 2);

function Scene({ resolution }: { resolution: number }) {
  const [point, setPoint] = useState<Cartesian>(initialPoint);

  // Get cells at current resolution
  const a5cells = cellToChildren(0n, resolution);

  // Filter cells based on current point
  const filteredCells = a5cells.filter(cell => {
    const pentagon = sphericalPentagonFromCell(cell);
    return pentagon.containsPoint(point) > 0;
  });

  const handleSphereClick = (intersection: Spherical) => {
    setPoint(toCartesian(intersection));
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <directionalLight position={[-10, -8, -10]} intensity={0.4} />
      <Sphere onSphereClick={handleSphereClick} />
      {filteredCells.map(cell => <A5Pentagon key={cell.toString()} cell={cell} disabled={false} />)}
      {a5cells.map(cell => <A5Pentagon key={cell.toString()} cell={cell} disabled={true} />)}
      <Marker cartesian={point} />
      <OrbitControls enableDamping enableZoom={true} minPolarAngle={0} maxPolarAngle={Math.PI} minDistance={1.02} maxDistance={10} enablePan={false} />
    </>
  );
}

const App: React.FC = () => {
  const [resolution, setResolution] = useState(2);

  return (
    <div style={{
      position: 'absolute',
      height: '100%',
      width: '100%',
      top: 0,
      left: 0,
      background: 'linear-gradient(0, #000, #223)'
    }}>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1,
        width: '300px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '5px' }}>
          Resolution: {resolution}
        </div>
        <input
          type="range"
          min="1"
          max="5"
          value={resolution}
          onChange={(e) => setResolution(Number(e.target.value))}
          style={{ 
            width: '100%',
            height: '20px',
            WebkitAppearance: 'none',
            background: 'rgba(135, 206, 235, 0.2)',
            borderRadius: '10px',
            outline: 'none'
          }}
        />
      </div>

      <Canvas camera={{ position: camera, near: 0.001, far: 1000 }}>
        <Suspense fallback={null}>
          <Scene resolution={resolution} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
} 