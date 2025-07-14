import React, { Suspense, useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DoubleSide, TextureLoader, RepeatWrapping, MOUSE, BufferGeometry, BufferAttribute } from 'three';
import { generateWireframe } from 'a5-internal/wireframe';
import { lonLatToFace } from 'a5-internal/helpers';

const RESOLUTION = 4;

// Create a cache outside the component
const geometryCache = new Map<number, BufferGeometry>();

// Create a merged geometry from all pentagons
function createMergedGeometry(resolution: number) {
  const cells = generateWireframe(resolution);
  
  // Arrays to hold all vertices, UVs, and indices
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Process each cell
  cells.forEach((cell, cellIndex) => {
    const center = cell.reduce((sum, p) => {
      return [sum[0] + p[0] / 5, sum[1] + p[1] / 5, sum[2] + p[2] / 5];
    }, [0, 0, 0]);
    
    // Get flat projection vertices
    const vertices = cell.map(lonLat => {
      const face = lonLatToFace(lonLat, resolution, center);
      return [face[0], 0, -face[1]];
    });
    
    // Get UV coordinates
    const cellUvs = cell.map(([lon, lat]) => {
      const u = ((lon - 180) / 360);
      const v = ((lat + 90) / 180);
      return [u, v];
    });
    
    // Add vertices to positions array
    vertices.forEach(vertex => {
      positions.push(...vertex);
    });
    
    // Add UVs to uvs array
    cellUvs.forEach(uv => {
      uvs.push(...uv);
    });
    
    // Add indices for this pentagon
    // Each pentagon starts at vertexOffset
    const vertexOffset = cellIndex * 5;
    
    // Create triangles (0,1,2), (0,2,3), (0,3,4)
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3,
      vertexOffset, vertexOffset + 3, vertexOffset + 4
    );
  });
  
  // Create the merged geometry
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  
  return geometry;
}

function Scene({ lonOffset, resolution }: { lonOffset: number, resolution: number }) {
  const earthTexture = useLoader(TextureLoader, '/textures/bluemarble.jpg');
  earthTexture.offset.x = lonOffset / 360;
  earthTexture.wrapS = earthTexture.wrapT = RepeatWrapping;
  
  // Create merged geometry once, but update when resolution changes
  const mergedGeometry = useMemo(() => {
    if (geometryCache.has(resolution)) return geometryCache.get(resolution)!;
    const geometry = createMergedGeometry(resolution);
    geometryCache.set(resolution, geometry);
    return geometry;
  }, [resolution]);
  
  return (
    <>
      <group position={[-2.6, 0, 3.8]}>
        {/* Single mesh with all pentagons */}
        <mesh geometry={mergedGeometry}>
          <meshBasicMaterial 
            map={earthTexture}
            depthTest={false}
            side={DoubleSide}
          />
        </mesh>
      </group>

      <OrbitControls
        enableDamping
        enableZoom={true}
        enableRotate={false}
        mouseButtons={{ LEFT: MOUSE.PAN }}
        zoomToCursor={true}
      />
    </>
  );
}

const angle = -0.23;
const camera = { position: [0.0, 4.2, 0], up: [-Math.cos(angle), 0, Math.sin(angle)] };
const App: React.FC = () => {
  const [lonOffset, setLonOffset] = useState(0);
  const [resolution, setResolution] = useState(RESOLUTION);

  return (
    <div style={{
      position: 'absolute',
      height: '100%',
      width: '100%',
      top: 0,
      left: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          <input
            type="range"
            min="-180"
            max="180"
            value={lonOffset}
            onChange={(e) => setLonOffset(Number(e.target.value))}
            style={{ width: '300px' }}
          />
          <div style={{ textAlign: 'center', fontSize: '12px' }}>
            Longitude Offset: {lonOffset}°
          </div>
        </div>
      </div>

      {/* Resolution Slider */}
      <div style={{
        position: 'absolute',
        top: '100px',
        left: '20px',
        backgroundColor: '#fff',
        padding: '8px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1,
        textAlign: 'center'
      }}>
        <input
          type="range"
          min="2"
          max="6"
          value={resolution}
          onChange={(e) => setResolution(Number(e.target.value))}
          style={{ width: '300px' }}
        />
        <div style={{ textAlign: 'center', fontSize: '12px' }}>
          Resolution: {resolution}
        </div>
      </div>

      <Canvas camera={camera} >
        <Suspense fallback={null}>
          <Scene lonOffset={lonOffset} resolution={resolution} />
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