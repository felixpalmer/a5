import React, { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { ACESFilmicToneMapping, Vector3, Matrix4, Euler, DoubleSide, BackSide } from 'three';
import { generateWireframe } from 'a5-internal/wireframe';
import { fromLonLat, toCartesian } from 'a5/core/coordinate-transforms';

type DimplePosition = { center: Vector3; up: Vector3; };

const dimpleAngle = Math.PI / 40;
const mainSphereRadius = 1.5;
const RESOLUTION = 1; // Gives 4 * 60 = 240 dimples

// Parameters for different dimple types
const dimpleParams = {
  center: { radius: 0.2 / Math.tan(dimpleAngle), squeeze: 0.65 },
  vertex: { radius: 0.13 / Math.tan(dimpleAngle) / RESOLUTION, squeeze: 1.0 }
};

// Convert A5 cells to dimple positions (centers of pentagons)
function getCellCenters(resolution: number): DimplePosition[] {
  const cells = generateWireframe(resolution + 2);
  
  return cells.map(cell => {
    // Calculate center of pentagon
    const points = cell.map(p => toCartesian(fromLonLat(p)));
    const center = points.reduce((sum, p) => {
      return [sum[0] + p[0] / 5, sum[1] + p[1] / 5, sum[2] + p[2] / 5 ];
    }, [0, 0, 0]);

    // Calculate the direction to orient the dimple with
    // Get midpoint of c & d
    const up = new Vector3(...points[2]);
    up.add(new Vector3(...points[3]));
    up.multiplyScalar(0.5);
    
    // Up is from origin to midpoint
    up.sub(new Vector3(...points[0]));
    up.normalize();
    
    return { center, up };
  });
}

// Get unique vertices from all pentagon vertices
function getCellVertices(resolution: number): DimplePosition[] {
  const cells = generateWireframe(resolution + 2);
  
  // Extract all vertices from all pentagons
  const allVertices = cells.flat();
  
  // Create a map to track unique vertices
  const uniqueVerticesMap = new Map();
  
  // Use string representation of coordinates as keys for uniqueness
  allVertices.forEach(vertex => {
    const point = toCartesian(fromLonLat(vertex));
    const key = point.map(p => Math.round(p * 10 * RESOLUTION)).join(',');
    if (!uniqueVerticesMap.has(key)) {
      // Convert to Cartesian coordinates
      
      // Calculate the up vector (normal to the surface)
      const up = new Vector3(0, 1, 0);
      up.normalize();
      
      uniqueVerticesMap.set(key, { 
        center: point, 
        up 
      });
    }
  });
  
  // Convert back to array of vertices
  return Array.from(uniqueVerticesMap.values());
}

// Combine both center and vertex dimples
const centerDimples = getCellCenters(RESOLUTION);
const vertexDimples = getCellVertices(RESOLUTION);

function Scene({ 
  dimplePositions, 
  isZoomedIn, 
  onZoomToggle,
  dimpleRadius,
  dimpleSqueeze,
  useHD
}: { 
  dimplePositions: DimplePosition[],
  isZoomedIn: boolean,
  onZoomToggle: () => void,
  dimpleRadius: number,
  dimpleSqueeze: number,
  useHD: boolean
}) {
  const {camera} = useThree();
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    const position = camera.position.clone();
    position.setLength(isZoomedIn ? 3 : 20);
    camera.position.copy(position);
  }, [isZoomedIn]);

  const ballColor = isHovered ? "#aaa" : "#fff";
  useEffect(() => {
    document.body.style.cursor = isHovered ? 'pointer' : 'auto'
  }, [isHovered])

  // Calculate distance based on current radius (not sure why we need the fudge factors)
  const currentDistance = mainSphereRadius + ((dimpleSqueeze == 1.0 ? 0.995 : 1.01) * dimpleRadius * Math.cos(dimpleAngle));

  return (
    <>
      <Environment 
        files={useHD ? "/textures/spruit_sunrise_4k.hdr.jpg" : "/textures/spruit_sunrise_1k.hdr"}
        background
        backgroundBlurriness={isZoomedIn ? 0.1 : 0}
        backgroundIntensity={isZoomedIn ? 0.6 : 1}
      />
      <directionalLight position={[5, 0, 3]} intensity={1.5} castShadow />
      
      <group position={[0, -1, 0]}>
      {/* Main sphere */}
      <mesh 
        renderOrder={1}
        onClick={onZoomToggle}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <sphereGeometry args={[mainSphereRadius, 128, 128]} />
        <meshPhysicalMaterial 
          color={ballColor}
          metalness={0.01}
          roughness={0.1}
          clearcoat={0.9}
          depthTest={true}
          depthWrite={false}
        />
      </mesh>

      {/* Dimples */}
      {dimplePositions.map(({ center, up }, index) => {
        // Convert to Cartesian coordinates
        const position = new Vector3(...center);
        position.multiplyScalar(currentDistance);
        
        const matrix = new Matrix4();
        matrix.lookAt(position, new Vector3(0, 0, 0), up);

        // Add 90-degree rotation around X axis
        const rotationMatrix = new Matrix4().makeRotationX(-Math.PI/2);
        matrix.multiply(rotationMatrix);
        const rotation = new Euler().setFromRotationMatrix(matrix);

        const dimpleGeometryArgs = [32, 32, 0, 2 * Math.PI, 0, dimpleAngle];
        return (
          <group key={index}>
            {/* Depth mask sphere - block dimples from rear being visible*/}
            <mesh
              renderOrder={1}
              position={position}
              rotation={rotation}
              scale={new Vector3(dimpleSqueeze, 1, 1)}
            >
              <sphereGeometry args={[ dimpleRadius * 1.01, ...dimpleGeometryArgs ]} />
              <meshBasicMaterial color="#f00" colorWrite={false} depthWrite={true} depthTest={true} side={DoubleSide} />
            </mesh>

            {/* Dimples */}
            <mesh
              renderOrder={2}
              castShadow
              position={position}
              rotation={rotation}
              scale={new Vector3(dimpleSqueeze, 1, 1)}
            >
              <sphereGeometry args={[ dimpleRadius, ...dimpleGeometryArgs ]} />
              <meshPhysicalMaterial
                color={ballColor}
                metalness={0.05}
                roughness={0.3}
                clearcoat={0.8}
                clearcoatRoughness={0.1}
                side={BackSide}
                depthTest={true}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
      </group>

      <OrbitControls 
        enableDamping 
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Math.PI}
        maxAzimuthAngle={-Math.PI / 2}
      />
    </>
  );
}

const App: React.FC<{ useHD?: boolean }> = ({ useHD = false }) => {
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [useCenterDimples, setUseCenterDimples] = useState(false);
  const toggleZoom = () => setIsZoomedIn(!isZoomedIn);
  const toggleDimpleType = () => setUseCenterDimples(!useCenterDimples);
  
  // Choose which dimple set to use based on state
  const dimplePositions = useCenterDimples ? centerDimples : vertexDimples;
  
  // Choose appropriate parameters based on dimple type
  const currentParams = useCenterDimples ? dimpleParams.center : dimpleParams.vertex;

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
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        padding: '0 20px',
        width: '100%',
        maxWidth: '400px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={toggleZoom}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            minWidth: '120px',
            whiteSpace: 'nowrap'
          }}
        >
          {isZoomedIn ? 'Zoom Out' : 'Zoom In'}
        </button>
        
        <button 
          onClick={toggleDimpleType}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            minWidth: '120px',
            whiteSpace: 'nowrap'
          }}
        >
          {useCenterDimples ? 'Vertex Dimples' : 'Center Dimples'}
        </button>
      </div>

      <Canvas 
        camera={{ position: [-15, 0, -9] }}
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
          stencil: true,
        }}
      >
        <Suspense fallback={null}>
          <Scene 
            dimplePositions={dimplePositions} 
            isZoomedIn={isZoomedIn}
            onZoomToggle={toggleZoom}
            dimpleRadius={currentParams.radius}
            dimpleSqueeze={currentParams.squeeze}
            useHD={useHD}
          />
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