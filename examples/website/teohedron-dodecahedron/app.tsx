import React, { Suspense, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DoubleSide, BufferGeometry, BufferAttribute, Vector3 } from 'three';
import { generateWireframe } from 'a5-internal/wireframe';

import {fromLonLat, toCartesian} from 'a5/core/coordinate-transforms';

const RESOLUTION = 3;

// Create a cache for geometries
const geometryCache = new Map<number, BufferGeometry>();

// Create a merged geometry from all pentagons
function createMergedGeometry(resolution: number) {
  const cells = generateWireframe(resolution);
  
  // Arrays to hold all vertices, UVs, and indices
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Process each cell
  cells.forEach((cell, cellIndex) => {
    // Convert vertices to Cartesian coordinates
    const vertices = cell.map(lonLat => {
      const cartesian = toCartesian(fromLonLat(lonLat));
      return new Vector3(...cartesian);
    });
    
    // Calculate normal for this pentagon
    const v1 = vertices[1].clone().sub(vertices[0]);
    const v2 = vertices[2].clone().sub(vertices[0]);
    const normal = new Vector3().crossVectors(v1, v2).normalize();
    
    // Add vertices to positions array
    vertices.forEach(vertex => {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
    });
    
    // Add UVs to uvs array (simple mapping for now)
    vertices.forEach((_, i) => {
      const u = i / 5;
      const v = 0;
      uvs.push(u, v);
    });
    
    // Add indices for this pentagon
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
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  
  return geometry;
}

function Scene({ resolution }: { resolution: number }) {
  // Create merged geometry once, but update when resolution changes
  const mergedGeometry = useMemo(() => {
    if (geometryCache.has(resolution)) return geometryCache.get(resolution)!;
    const geometry = createMergedGeometry(resolution);
    geometryCache.set(resolution, geometry);
    return geometry;
  }, [resolution]);
  
  return (
    <>
      {/* Ambient light for overall scene illumination */}
      <ambientLight intensity={0.3} />
      
      {/* Main directional light */}
      <directionalLight 
        position={[10, 10, 10]} 
        intensity={1.5} 
        castShadow
      />
      
      {/* Fill light from the opposite side */}
      <directionalLight 
        position={[-10, -10, -10]} 
        intensity={0.8} 
      />

      <mesh geometry={mergedGeometry}>
        <meshPhysicalMaterial 
          color="#00aa55"
          metalness={0.0}
          roughness={0.2}
          clearcoat={0.5}
          side={DoubleSide}
          emissive="#00aa55"
          emissiveIntensity={0.1}
        />
      </mesh>

      <OrbitControls 
        enableDamping 
        enableZoom={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minDistance={2}
        maxDistance={10}
        enablePan={false}
      />
    </>
  );
}

const App: React.FC = () => {
  const [resolution, setResolution] = useState(RESOLUTION);

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

      <Canvas camera={{ position: [0, 0, 5] }}>
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