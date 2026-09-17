// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Suspense, useId, useMemo, useRef} from 'react';
import {Canvas, ThreeEvent} from '@react-three/fiber';
import {Line, OrbitControls} from '@react-three/drei';
import {BufferAttribute, BufferGeometry, DoubleSide} from 'three';
import {toFace, toPolar} from 'a5/core/coordinate-transforms';
import type {Cartesian, Face, Polar, Radians} from 'a5/core/coordinate-systems';
import {
  cartesianToPolar,
  faceBoundary,
  faceCorners,
  faceMesh,
  FACE_CIRCUMRADIUS,
  GRID_RAYS,
  GRID_RINGS,
  gridRay,
  gridRing,
  isCuspRay,
  isOnFace,
  patchOutline,
  polarToCartesian,
  SPHERE_RADIUS
} from './jacobian';

export const COLORS = {
  face: '#00aa55',
  grid: 'rgba(255, 255, 255, 0.2)',
  cusp: 'rgba(255, 255, 255, 0.5)',
  gridOverRaster: 'rgba(255, 255, 255, 0.4)',
  cuspOverRaster: 'rgba(255, 255, 255, 0.8)',
  outline: '#ffffff',
  patch: '#ffb400',
  radial: '#ff7043',
  azimuthal: '#42a5f5'
};

/** Side of the patch drawn at the hovered point, in face units */
export const PATCH_SIZE = 0.09;

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------
// Face view: the flat dodecahedron face, drawn in its own polar coordinates
// ---------------------------------------------------------------------------

const VIEW_EXTENT = 1.12 * FACE_CIRCUMRADIUS;

export function FaceView({
  polar,
  raster,
  onHover
}: {
  polar: Polar;
  raster: string | null;
  onHover: (polar: Polar) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<SVGGElement>(null);
  const clipId = `face-clip-${useId()}`;

  const corners = useMemo(faceCorners, []);
  const outline = useMemo(() => corners.map(corner => `${corner[0]},${corner[1]}`).join(' '), [corners]);
  // The raster is drawn outside the flipped frame, where y already points down
  const outlineScreen = useMemo(() => corners.map(corner => `${corner[0]},${-corner[1]}`).join(' '), [corners]);
  const rays = useMemo(
    () =>
      Array.from({length: GRID_RAYS}, (_, index) => {
        const gamma = ((TAU * index) / GRID_RAYS) as Radians;
        const ray = gridRay(gamma, 1);
        return {cusp: isCuspRay(index), end: toFace(ray[ray.length - 1])};
      }),
    []
  );

  const patch = useMemo(() => toPath(patchOutline(polar, PATCH_SIZE)), [polar]);
  const marker = toFace(polar);

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const matrix = frameRef.current?.getScreenCTM();
    if (!svgRef.current || !matrix) return;

    // Read the pointer through the frame's own transform, so that the viewBox and
    // the y-flip below are both accounted for and the result is face coordinates
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const {x, y} = point.matrixTransform(matrix.inverse());
    const hovered = toPolar([x, y] as Face);
    if (isOnFace(hovered)) onHover(hovered);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VIEW_EXTENT} ${-VIEW_EXTENT} ${2 * VIEW_EXTENT} ${2 * VIEW_EXTENT}`}
      onPointerMove={handlePointer}
      style={{width: '100%', height: '100%', display: 'block', touchAction: 'none'}}
    >
      {raster && (
        <>
          <defs>
            <clipPath id={clipId}>
              <polygon points={outlineScreen} />
            </clipPath>
          </defs>
          <image
            href={raster}
            x={-FACE_CIRCUMRADIUS}
            y={-FACE_CIRCUMRADIUS}
            width={2 * FACE_CIRCUMRADIUS}
            height={2 * FACE_CIRCUMRADIUS}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
          />
        </>
      )}

      {/* SVG y points down, the face coordinate system points up */}
      <g ref={frameRef} transform="scale(1, -1)">
        {!raster && <polygon points={outline} fill={COLORS.face} fillOpacity={0.12} />}

        {/* Rings stop at the apothem and rays at the boundary, so nothing needs clipping */}
        {GRID_RINGS.map(rho => (
          <circle
            key={rho}
            r={rho}
            fill="none"
            stroke={COLORS.grid}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {rays.map(({cusp, end}, index) => (
          <line
            key={index}
            x2={end[0]}
            y2={end[1]}
            stroke={raster ? (cusp ? COLORS.cuspOverRaster : COLORS.gridOverRaster) : cusp ? COLORS.cusp : COLORS.grid}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <polygon
          points={outline}
          fill="none"
          stroke={COLORS.outline}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        <path
          d={patch}
          fill={COLORS.patch}
          fillOpacity={0.35}
          stroke={COLORS.patch}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={marker[0]} cy={marker[1]} r={0.011} fill={COLORS.patch} />
      </g>
    </svg>
  );
}

function toPath(ring: Polar[]): string {
  let path = '';
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = toFace(ring[i]);
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(5)},${y.toFixed(5)} `;
  }
  return `${path}Z`;
}

// ---------------------------------------------------------------------------
// Sphere view: the same face and the same grid, projected
// ---------------------------------------------------------------------------

/** Lift a ring of face points onto the sphere, `clearance` above its surface */
function lift(ring: Polar[], clearance: number): [number, number, number][] {
  const radius = SPHERE_RADIUS * clearance;
  const out: [number, number, number][] = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) {
    const point = polarToCartesian(ring[i]);
    out[i] = [point[0] * radius, point[1] * radius, point[2] * radius];
  }
  return out;
}

function ProjectedFace() {
  const geometry = useMemo(() => {
    const {positions, indices} = faceMesh();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    return geometry;
  }, []);

  // faceMesh samples the unit sphere, so it is scaled here like everything else
  return (
    <mesh geometry={geometry} scale={SPHERE_RADIUS}>
      <meshBasicMaterial color={COLORS.face} transparent opacity={0.25} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function ProjectedGrid() {
  const rings = useMemo(() => GRID_RINGS.map(rho => lift(gridRing(rho), 1.001)), []);
  const rays = useMemo(
    () =>
      Array.from({length: GRID_RAYS}, (_, index) => ({
        cusp: isCuspRay(index),
        points: lift(gridRay(((TAU * index) / GRID_RAYS) as Radians), 1.001)
      })),
    []
  );

  return (
    <>
      {rings.map((points, index) => (
        <Line key={`ring-${index}`} points={points} color="#ffffff" transparent opacity={0.25} lineWidth={1} />
      ))}
      {rays.map(({cusp, points}, index) => (
        <Line
          key={`ray-${index}`}
          points={points}
          color="#ffffff"
          transparent
          opacity={cusp ? 0.55 : 0.25}
          lineWidth={1}
        />
      ))}
    </>
  );
}

function Scene({polar, onHover}: {polar: Polar; onHover: (polar: Polar) => void}) {
  const boundary = useMemo(() => lift(faceBoundary(), 1.002), []);
  const patch = useMemo(() => lift(patchOutline(polar, PATCH_SIZE), 1.003), [polar]);
  const marker = useMemo(() => lift([polar], 1.004)[0], [polar]);

  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const {x, y, z} = event.point;
    const length = Math.hypot(x, y, z);
    const hovered = cartesianToPolar([x / length, y / length, z / length] as Cartesian);
    if (isOnFace(hovered)) onHover(hovered);
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 5]} intensity={1.2} />
      <directionalLight position={[-4, -3, -2]} intensity={0.4} />

      <mesh onPointerMove={handlePointer}>
        <sphereGeometry args={[SPHERE_RADIUS * 0.995, 96, 64]} />
        <meshPhysicalMaterial color="#1b2330" roughness={0.65} metalness={0.1} />
      </mesh>

      <ProjectedFace />
      <ProjectedGrid />
      <Line points={boundary} color={COLORS.outline} lineWidth={2} />
      <Line points={patch} color={COLORS.patch} lineWidth={2.5} />
      <mesh position={marker}>
        <sphereGeometry args={[0.011 * SPHERE_RADIUS, 16, 16]} />
        <meshBasicMaterial color={COLORS.patch} />
      </mesh>

      <OrbitControls
        enableDamping
        enablePan={false}
        minDistance={1.6 * SPHERE_RADIUS}
        maxDistance={6 * SPHERE_RADIUS}
      />
    </>
  );
}

export function SphereView({polar, onHover}: {polar: Polar; onHover: (polar: Polar) => void}) {
  return (
    <Canvas
      camera={{position: [0, -1.15 * SPHERE_RADIUS, 2.6 * SPHERE_RADIUS], fov: 32, near: 0.01, far: 100}}
      style={{width: '100%', height: '100%'}}
    >
      <Suspense fallback={null}>
        <Scene polar={polar} onHover={onHover} />
      </Suspense>
    </Canvas>
  );
}
