import React, {Suspense, useState, useMemo, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useLoader, type ThreeEvent} from '@react-three/fiber';
import {Line, OrbitControls} from '@react-three/drei';
import {DoubleSide, TextureLoader, RepeatWrapping, MOUSE, BufferGeometry, BufferAttribute, Vector3} from 'three';
import {generateWireframe} from 'a5-internal/wireframe';
import {lonLatToFace} from 'a5-internal/helpers';
import type {LonLat} from 'a5/core/coordinate-systems';

const RESOLUTION = 2;
const MAX_RESOLUTION = 5;
const EARTH_TEXTURE = '/textures/bluemarble.jpg';
const A5_GREEN = '#00aa55';
const HIGHLIGHT = '#ffdd00';

type Vec3 = [number, number, number];
const DEG = Math.PI / 180;

// Unit sphere with y up (three.js convention): lon 0 faces the camera, east to the right
function toVector([lon, lat]: LonLat): Vec3 {
  return [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)];
}

function toLonLat([x, y, z]: Vec3): LonLat {
  return [Math.atan2(x, z) / DEG, Math.atan2(y, Math.hypot(x, z)) / DEG] as LonLat;
}

// Cell center as the normalized mean of its boundary on the sphere (averaging
// lon/lat directly breaks for the cells around the poles)
function cellCenter(ring: LonLat[]): LonLat {
  const sum: Vec3 = [0, 0, 0];
  for (const p of ring) {
    const v = toVector(p);
    sum[0] += v[0];
    sum[1] += v[1];
    sum[2] += v[2];
  }
  return toLonLat(sum);
}

const POLE_LATITUDE = 89.999;

interface Geometries {
  solid: BufferGeometry;
  // Cell outlines as pairs of segment endpoints, drawn as wide lines (WebGL
  // ignores the width of plain lines)
  edges: Vec3[];
  net: BufferGeometry;
  netEdges: Vec3[];
  // Cell c owns triangles cellTriangles[c] to cellTriangles[c + 1] of both
  // meshes, and the outline points cellEdges[c] to cellEdges[c + 1]
  cellTriangles: number[];
  cellEdges: number[];
}

// Generated on first use and kept, so revisiting a resolution is instant
const GEOMETRIES: Geometries[] = [];
function getGeometries(resolution: number): Geometries {
  if (GEOMETRIES[resolution]) return GEOMETRIES[resolution];

  // The texture is equirectangular, so it can only be interpolated linearly
  // across small triangles: each fan triangle of a pentagon is split into a
  // grid, finer for the large cells of the coarse resolutions
  const n = Math.max(1, 2 ** (4 - resolution));

  const cells = generateWireframe(resolution);
  const solid = {positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[]};
  const net = {positions: [] as number[], indices: [] as number[]};
  const edges: Vec3[] = [];
  const netEdges: Vec3[] = [];
  const cellTriangles = [0];
  const cellEdges = [0];

  let vertexOffset = 0;
  for (const ring of cells) {
    const vertices = ring.map(toVector);
    const center = cellCenter(ring);
    const apex = [0, 1, 2].map(k => vertices.reduce((s, v) => s + v[k], 0) / vertices.length) as Vec3;

    // Flat normal, so each pentagon of the solid is shaded as one facet
    const [a, b, c] = vertices;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal);

    for (let i = 0; i < vertices.length; i++) {
      const next = vertices[(i + 1) % vertices.length];
      // Longitudes are kept continuous around the middle of the fan triangle, so
      // one crossing the antimeridian does not smear across the whole texture
      // (the texture repeats). A pole has no longitude of its own, so it takes
      // this reference too
      const [refLon] = toLonLat([0, 1, 2].map(k => apex[k] + vertices[i][k] + next[k]) as Vec3);

      // Grid point (j, k) is apex + j/n (vertex - apex) + k/n (next - apex)
      for (let j = 0; j <= n; j++) {
        for (let k = 0; k <= n - j; k++) {
          const p = [0, 1, 2].map(
            m => apex[m] + (j / n) * (vertices[i][m] - apex[m]) + (k / n) * (next[m] - apex[m])
          ) as Vec3;
          const lonLat = toLonLat(p);
          let lon = Math.abs(lonLat[1]) > POLE_LATITUDE ? refLon : lonLat[0];
          lon += 360 * Math.round((refLon - lon) / 360);

          solid.positions.push(...p);
          solid.normals.push(normal[0] / length, normal[1] / length, normal[2] / length);
          solid.uvs.push((lon + 180) / 360, (lonLat[1] + 90) / 180);

          // The same point laid out flat on its face of the unfolded dodecahedron
          const face = lonLatToFace(lonLat, resolution, center);
          net.positions.push(face[0], 0, -face[1]);
        }
      }

      // Row j of the grid starts at offset(j) and holds n - j + 1 points
      const offset = (j: number) => vertexOffset + j * (n + 1) - (j * (j - 1)) / 2;
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < n - j; k++) {
          const p0 = offset(j) + k;
          const p1 = offset(j + 1) + k;
          solid.indices.push(p0, p1, p0 + 1);
          if (k < n - j - 1) solid.indices.push(p0 + 1, p1, p1 + 1);
        }
      }
      vertexOffset += ((n + 1) * (n + 2)) / 2;

      // Outline, pushed slightly off the surface so it is not hidden by the faces
      edges.push(vertices[i].map(x => x * 1.002) as Vec3, next.map(x => x * 1.002) as Vec3);
      const faceA = lonLatToFace(ring[i], resolution, center);
      const faceB = lonLatToFace(ring[(i + 1) % ring.length], resolution, center);
      netEdges.push([faceA[0], 0, -faceA[1]], [faceB[0], 0, -faceB[1]]);
    }
    cellTriangles.push(solid.indices.length / 3);
    cellEdges.push(edges.length);
  }

  const solidGeometry = new BufferGeometry();
  solidGeometry.setAttribute('position', new BufferAttribute(new Float32Array(solid.positions), 3));
  solidGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(solid.normals), 3));
  solidGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(solid.uvs), 2));
  solidGeometry.setIndex(new BufferAttribute(new Uint32Array(solid.indices), 1));

  // The net shares the solid's triangles and texture coordinates
  const netGeometry = new BufferGeometry();
  netGeometry.setAttribute('position', new BufferAttribute(new Float32Array(net.positions), 3));
  netGeometry.setAttribute('uv', solidGeometry.getAttribute('uv'));
  netGeometry.setIndex(solidGeometry.getIndex());
  // Centered, so the camera looks at the middle of the net at every resolution,
  // with its outlines moved along
  netGeometry.computeBoundingBox();
  const netCenter = netGeometry.boundingBox!.getCenter(new Vector3());
  netGeometry.translate(-netCenter.x, -netCenter.y, -netCenter.z);
  for (const p of netEdges) {
    p[0] -= netCenter.x;
    p[1] -= netCenter.y;
    p[2] -= netCenter.z;
  }

  GEOMETRIES[resolution] = {solid: solidGeometry, edges, net: netGeometry, netEdges, cellTriangles, cellEdges};
  return GEOMETRIES[resolution];
}

/** The cell under the pointer, from the triangle it hit */
function hitCell(event: ThreeEvent<PointerEvent>, cellTriangles: number[]): number | null {
  // Only the nearest hit counts, not the cells behind it
  event.stopPropagation();
  const triangle = event.faceIndex;
  if (triangle === undefined || triangle === null) return null;
  let lo = 0;
  let hi = cellTriangles.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cellTriangles[mid] <= triangle) lo = mid;
    else hi = mid;
  }
  return lo;
}

interface HoverProps {
  hovered: number | null;
  setHovered: (cell: number | null) => void;
}

/** The hovered cell's fill and outline, in the solid or the net */
function Highlight({resolution, net, cell}: {resolution: number; net?: boolean; cell: number}) {
  const geometries = getGeometries(resolution);
  const {cellTriangles, cellEdges} = geometries;
  const geometry = net ? geometries.net : geometries.solid;
  const edges = net ? geometries.netEdges : geometries.edges;
  // The net is flat and drawn without depth, but on the solid a cell on the far
  // side must stay hidden behind the near one (the fill is pulled forward so it
  // wins against its own face)
  const depthTest = !net;
  const fill = useMemo(() => {
    const index = geometry.getIndex()!.array as Uint32Array;
    const fillGeometry = new BufferGeometry();
    fillGeometry.setAttribute('position', geometry.getAttribute('position'));
    fillGeometry.setIndex(new BufferAttribute(index.slice(3 * cellTriangles[cell], 3 * cellTriangles[cell + 1]), 1));
    return fillGeometry;
  }, [geometry, cell]);
  useEffect(() => () => fill.dispose(), [fill]);

  return (
    <>
      <mesh geometry={fill} renderOrder={2} raycast={() => null}>
        <meshBasicMaterial
          color={HIGHLIGHT}
          transparent
          opacity={0.35}
          depthTest={depthTest}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          side={DoubleSide}
        />
      </mesh>
      <Line
        points={edges.slice(cellEdges[cell], cellEdges[cell + 1])}
        segments
        lineWidth={4}
        color={HIGHLIGHT}
        depthTest={depthTest}
        renderOrder={3}
      />
    </>
  );
}

function useEarthTexture() {
  const texture = useLoader(TextureLoader, EARTH_TEXTURE);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** The teohedron as a solid: one flat pentagon per cell, with vertices on the sphere */
function SolidScene({
  resolution,
  showEarth,
  hovered,
  setHovered
}: {resolution: number; showEarth: boolean} & HoverProps) {
  const texture = useEarthTexture();
  const {solid, edges, cellTriangles} = useMemo(() => getGeometries(resolution), [resolution]);

  return (
    <>
      <ambientLight intensity={showEarth ? 1.2 : 0.3} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <directionalLight position={[-10, -10, -10]} intensity={0.8} />

      <mesh
        geometry={solid}
        onPointerMove={e => setHovered(hitCell(e, cellTriangles))}
        onPointerOut={() => setHovered(null)}
      >
        {showEarth ? (
          <meshStandardMaterial key="earth" map={texture} roughness={0.6} side={DoubleSide} />
        ) : (
          <meshPhysicalMaterial
            key="solid"
            color={A5_GREEN}
            roughness={0.2}
            clearcoat={0.5}
            emissive={A5_GREEN}
            emissiveIntensity={0.1}
            side={DoubleSide}
          />
        )}
      </mesh>
      <Line points={edges} segments lineWidth={2} color="#ffffff" transparent opacity={showEarth ? 0.5 : 0.25} />
      {hovered !== null && <Highlight resolution={resolution} cell={hovered} />}

      <OrbitControls enableDamping enablePan={false} minDistance={1.5} maxDistance={8} />
    </>
  );
}

/** The cells laid out flat on the unfolded dodecahedron */
function NetScene({resolution, showEarth, hovered, setHovered}: {resolution: number; showEarth: boolean} & HoverProps) {
  const texture = useEarthTexture();
  const {net, netEdges, cellTriangles} = useMemo(() => getGeometries(resolution), [resolution]);

  return (
    <>
      <mesh
        geometry={net}
        onPointerMove={e => setHovered(hitCell(e, cellTriangles))}
        onPointerOut={() => setHovered(null)}
      >
        {showEarth ? (
          <meshBasicMaterial key="earth" map={texture} depthTest={false} side={DoubleSide} />
        ) : (
          <meshBasicMaterial key="solid" color={A5_GREEN} depthTest={false} side={DoubleSide} />
        )}
      </mesh>
      <Line
        points={netEdges}
        segments
        lineWidth={1.5}
        color="#ffffff"
        transparent
        opacity={0.6}
        depthTest={false}
        renderOrder={1}
      />
      {hovered !== null && <Highlight resolution={resolution} net cell={hovered} />}

      <OrbitControls
        enableDamping
        enableZoom={true}
        enableRotate={false}
        mouseButtons={{LEFT: MOUSE.PAN}}
        zoomToCursor={true}
      />
    </>
  );
}

// Looking down onto the net, rotated so the chain of faces runs left to right
const NET_ANGLE = -0.23;
const NET_CAMERA = {position: [0.0, 4.2, 0], up: [-Math.cos(NET_ANGLE), 0, Math.sin(NET_ANGLE)]} as any;

// Defined outside App so its inputs keep their identity (and a slider drag)
// across the re-renders each change triggers
const Controls: React.FC<{
  resolution: number;
  setResolution: (resolution: number) => void;
  showEarth: boolean;
  setShowEarth: (showEarth: boolean) => void;
}> = ({resolution, setResolution, showEarth, setShowEarth}) => (
  <div
    style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      background: 'white',
      padding: '10px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 1
    }}
  >
    <div style={{marginBottom: '10px'}}>
      <label>
        <input type="checkbox" checked={showEarth} onChange={e => setShowEarth(e.target.checked)} /> Show Earth
      </label>
    </div>
    <label>
      Resolution: {resolution}
      <br />
      <input
        type="range"
        min={0}
        max={MAX_RESOLUTION}
        step={1}
        value={resolution}
        onChange={e => setResolution(Number(e.target.value))}
      />
    </label>
  </div>
);

const App: React.FC = () => {
  const [resolution, setResolution] = useState(RESOLUTION);
  const [showEarth, setShowEarth] = useState(true);
  // Index of the cell under the pointer in either view, highlighted in both
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* The solid in the top half, the same cells unfolded flat below */}
      <div style={{position: 'relative', flex: '1 1 0', minHeight: 0}}>
        <Canvas camera={{position: [0, 0.6, 2.1]}}>
          <Suspense fallback={null}>
            <SolidScene resolution={resolution} showEarth={showEarth} hovered={hovered} setHovered={setHovered} />
          </Suspense>
        </Canvas>
        <Controls
          resolution={resolution}
          setResolution={setResolution}
          showEarth={showEarth}
          setShowEarth={setShowEarth}
        />
      </div>
      <div style={{position: 'relative', flex: '1 1 0', minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.12)'}}>
        <Canvas camera={NET_CAMERA}>
          <Suspense fallback={null}>
            <NetScene resolution={resolution} showEarth={showEarth} hovered={hovered} setHovered={setHovered} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
