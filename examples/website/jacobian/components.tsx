// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Suspense, useId, useMemo, useRef} from 'react';
import {Canvas, ThreeEvent} from '@react-three/fiber';
import {Line, OrbitControls} from '@react-three/drei';
import {BufferAttribute, BufferGeometry, DoubleSide} from 'three';
import {toFace, toPolar} from 'a5/core/coordinate-transforms';
import type {Cartesian, Face, Polar, Radians} from 'a5/core/coordinate-systems';
import type {ProjectionMode} from 'a5/projections/projection-mode';
import type {RayWeight} from './jacobian';
import {
  beyondFaceMesh,
  cartesianToPolar,
  cellOutline,
  cellSagGeometry,
  closedDomainBoundary,
  closedDomainCorners,
  domainBoundary,
  domainCorners,
  faceBoundary,
  faceCorners,
  faceMesh,
  DOMAIN_CIRCUMRADIUS,
  GRID_RAYS,
  GRID_RINGS,
  gridRay,
  gridRingArcs,
  isInDrawnDomain,
  patchOutline,
  polarToCartesian,
  rayWeight,
  SPHERE_RADIUS,
  vertexMesh
} from './jacobian';

export const COLORS = {
  face: '#00aa55',
  beyond: '#8866dd',
  closing: '#4488cc',
  grid: 'rgba(255, 255, 255, 0.2)',
  gridFaint: 'rgba(255, 255, 255, 0.08)',
  cusp: 'rgba(255, 255, 255, 0.5)',
  gridOverRaster: 'rgba(255, 255, 255, 0.4)',
  gridFaintOverRaster: 'rgba(255, 255, 255, 0.16)',
  cuspOverRaster: 'rgba(255, 255, 255, 0.8)',
  outline: '#ffffff',
  domainOutline: 'rgba(255, 255, 255, 0.45)',
  cell: '#4dd0e1',
  sag: '#ff0000',
  patch: '#ffb400',
  radial: '#ff7043',
  azimuthal: '#42a5f5'
};

/** Side of the patch drawn at the hovered point, in face units */
export const PATCH_SIZE = 0.09;

const TAU = 2 * Math.PI;

const points = (corners: Face[], flipY: boolean) =>
  corners.map(corner => `${corner[0]},${flipY ? -corner[1] : corner[1]}`).join(' ');

// ---------------------------------------------------------------------------
// Face view: the flat dodecahedron face, drawn in its own polar coordinates
// ---------------------------------------------------------------------------

const VIEW_EXTENT = 1.06 * DOMAIN_CIRCUMRADIUS;

export function FaceView({
  polar,
  raster,
  cells,
  closed,
  onHover
}: {
  polar: Polar;
  raster: string | null;
  cells: Face[][];
  closed: boolean;
  onHover: (polar: Polar) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<SVGGElement>(null);
  const clipId = `domain-clip-${useId()}`;

  const outline = useMemo(() => points(faceCorners(), false), []);
  const domainOutline = useMemo(() => points(domainCorners(), false), []);
  const closedOutline = useMemo(() => (closed ? points(closedDomainCorners(), false) : null), [closed]);
  // The raster is drawn outside the flipped frame, where y already points down
  const clipOutline = useMemo(() => points(closed ? closedDomainCorners() : domainCorners(), true), [closed]);

  // Rings out to the face circumradius close on themselves; beyond it each
  // survives only as five arcs, one inside each reflected point
  const rings = useMemo(
    () => GRID_RINGS.flatMap(rho => gridRingArcs(rho, closed).map(arc => toPath(arc, false))),
    [closed]
  );
  const rays = useMemo(
    () =>
      Array.from({length: GRID_RAYS}, (_, index) => {
        const gamma = ((TAU * index) / GRID_RAYS) as Radians;
        const ray = gridRay(gamma, closed, 1);
        return {weight: rayWeight(index), end: toFace(ray[ray.length - 1])};
      }),
    [closed]
  );

  // Cell edges are straight in the plane, so no subdivision is needed here
  const cellPaths = useMemo(
    () => cells.map(cell => `M${cell.map(v => `${v[0].toFixed(5)},${v[1].toFixed(5)}`).join('L')}Z`),
    [cells]
  );
  const patch = useMemo(() => toPath(patchOutline(polar, PATCH_SIZE, closed), true), [polar, closed]);
  const marker = toFace(polar);

  const gridStroke = raster ? COLORS.gridOverRaster : COLORS.grid;
  const rayStroke: Record<RayWeight, string> = raster
    ? {cusp: COLORS.cuspOverRaster, bisector: COLORS.gridOverRaster, minor: COLORS.gridFaintOverRaster}
    : {cusp: COLORS.cusp, bisector: COLORS.grid, minor: COLORS.gridFaint};

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
    if (isInDrawnDomain(hovered, closed)) onHover(hovered);
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
              <polygon points={clipOutline} />
            </clipPath>
          </defs>
          <image
            href={raster}
            x={-DOMAIN_CIRCUMRADIUS}
            y={-DOMAIN_CIRCUMRADIUS}
            width={2 * DOMAIN_CIRCUMRADIUS}
            height={2 * DOMAIN_CIRCUMRADIUS}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
          />
        </>
      )}

      {/* SVG y points down, the face coordinate system points up */}
      <g ref={frameRef} transform="scale(1, -1)">
        {!raster && (
          <>
            {closedOutline && <polygon points={closedOutline} fill={COLORS.closing} fillOpacity={0.12} />}
            <polygon points={domainOutline} fill={COLORS.beyond} fillOpacity={0.12} />
            <polygon points={outline} fill={COLORS.face} fillOpacity={0.14} />
          </>
        )}

        {rings.map((path, index) => (
          <path
            key={`ring-${index}`}
            d={path}
            fill="none"
            stroke={gridStroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {rays.map(({weight, end}, index) => (
          <line
            key={`ray-${index}`}
            x2={end[0]}
            y2={end[1]}
            stroke={rayStroke[weight]}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {cellPaths.map((path, index) => (
          <path
            key={`cell-${index}`}
            d={path}
            fill="none"
            stroke={COLORS.cell}
            strokeOpacity={0.85}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {closedOutline && (
          <polygon
            points={closedOutline}
            fill="none"
            stroke={COLORS.closing}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polygon
          points={domainOutline}
          fill="none"
          stroke={COLORS.domainOutline}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
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

function toPath(ring: Polar[], close: boolean): string {
  let path = '';
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = toFace(ring[i]);
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(5)},${y.toFixed(5)} `;
  }
  return close ? `${path}Z` : path.trim();
}

// ---------------------------------------------------------------------------
// Sphere view: the same domain and the same grid, projected
// ---------------------------------------------------------------------------

/** Lift a ring of face points onto the sphere, `clearance` above its surface */
function lift(ring: Polar[], clearance: number, mode: ProjectionMode): [number, number, number][] {
  const radius = SPHERE_RADIUS * clearance;
  const out: [number, number, number][] = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) {
    const point = polarToCartesian(ring[i], mode);
    out[i] = [point[0] * radius, point[1] * radius, point[2] * radius];
  }
  return out;
}

function ProjectedRegion({
  build,
  projection,
  color,
  opacity
}: {
  build: (mode: ProjectionMode) => {positions: Float32Array; indices: Uint32Array};
  projection: ProjectionMode;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const {positions, indices} = build(projection);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    return geometry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection]);

  // The meshes sample the unit sphere, so they are scaled here like everything else
  return (
    <mesh geometry={geometry} scale={SPHERE_RADIUS}>
      <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

const RAY_OPACITY: Record<RayWeight, number> = {cusp: 0.55, bisector: 0.25, minor: 0.1};

// Fixed for the life of the scene, and now some hundred separate lines, so it is
// kept out of the hover re-render
const ProjectedGrid = React.memo(function ProjectedGrid({
  projection,
  closed
}: {
  projection: ProjectionMode;
  closed: boolean;
}) {
  const rings = useMemo(
    () => GRID_RINGS.flatMap(rho => gridRingArcs(rho, closed).map(arc => lift(arc, 1.001, projection))),
    [projection, closed]
  );
  const rays = useMemo(
    () =>
      Array.from({length: GRID_RAYS}, (_, index) => ({
        weight: rayWeight(index),
        points: lift(gridRay(((TAU * index) / GRID_RAYS) as Radians, closed), 1.001, projection)
      })),
    [projection, closed]
  );

  return (
    <>
      {rings.map((points, index) => (
        <Line key={`ring-${index}`} points={points} color="#ffffff" transparent opacity={0.25} lineWidth={1} />
      ))}
      {rays.map(({weight, points}, index) => (
        <Line
          key={`ray-${index}`}
          points={points}
          color="#ffffff"
          transparent
          opacity={RAY_OPACITY[weight]}
          lineWidth={1}
        />
      ))}
    </>
  );
});

/**
 * The gap between each cell edge and the great circle joining its endpoints, filled.
 * The band is what the projection costs in cell shape, at true scale.
 */
function ProjectedSag({cells, projection}: {cells: Face[][]; projection: ProjectionMode}) {
  const geometry = useMemo(() => {
    const sag = cellSagGeometry(cells, projection, SPHERE_RADIUS * 1.0015);
    const built = new BufferGeometry();
    built.setAttribute('position', new BufferAttribute(sag.positions, 3));
    built.setIndex(new BufferAttribute(sag.indices, 1));
    return built;
  }, [cells, projection]);

  if (!geometry.index?.count) return null;
  // Opaque, and drawn without the edges or the great circles beside it. A line has
  // constant width however thin the band is, which makes the area impossible to judge
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={COLORS.sag} side={DoubleSide} />
    </mesh>
  );
}

/** All cell edges as one line-segment soup, so the overlay costs a single draw */
function ProjectedCells({cells, projection}: {cells: Face[][]; projection: ProjectionMode}) {
  const points = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const cell of cells) {
      const ring = lift(cellOutline(cell, 6), 1.0025, projection);
      for (let i = 0; i + 1 < ring.length; i++) {
        out.push(ring[i], ring[i + 1]);
      }
    }
    return out;
  }, [cells, projection]);

  if (!points.length) return null;
  return <Line points={points} segments color={COLORS.cell} transparent opacity={0.85} lineWidth={1.2} />;
}

function Scene({
  polar,
  projection,
  cells,
  showSag,
  closed,
  onHover
}: {
  polar: Polar;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  closed: boolean;
  onHover: (polar: Polar) => void;
}) {
  const boundary = useMemo(() => lift(faceBoundary(), 1.002, projection), [projection]);
  const outerBoundary = useMemo(() => lift(domainBoundary(), 1.002, projection), [projection]);
  const closedBoundary = useMemo(
    () => (closed ? lift(closedDomainBoundary(), 1.002, projection) : null),
    [closed, projection]
  );
  const patch = useMemo(
    () => lift(patchOutline(polar, PATCH_SIZE, closed), 1.003, projection),
    [polar, projection, closed]
  );
  const marker = useMemo(() => lift([polar], 1.004, projection)[0], [polar, projection]);

  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const {x, y, z} = event.point;
    const length = Math.hypot(x, y, z);
    const hovered = cartesianToPolar([x / length, y / length, z / length] as Cartesian, projection);
    if (isInDrawnDomain(hovered, closed)) onHover(hovered);
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

      <ProjectedRegion build={faceMesh} projection={projection} color={COLORS.face} opacity={0.25} />
      <ProjectedRegion build={beyondFaceMesh} projection={projection} color={COLORS.beyond} opacity={0.22} />
      {closed && <ProjectedRegion build={vertexMesh} projection={projection} color={COLORS.closing} opacity={0.3} />}
      <ProjectedGrid projection={projection} closed={closed} />
      {showSag ? (
        <ProjectedSag cells={cells} projection={projection} />
      ) : (
        <ProjectedCells cells={cells} projection={projection} />
      )}
      {closedBoundary && (
        <Line points={closedBoundary} color={COLORS.closing} lineWidth={1.5} dashed dashSize={0.03} gapSize={0.02} />
      )}
      <Line points={outerBoundary} color={COLORS.domainOutline} lineWidth={1.5} dashed dashSize={0.03} gapSize={0.02} />
      <Line points={boundary} color={COLORS.outline} lineWidth={2} />
      <Line points={patch} color={COLORS.patch} lineWidth={2.5} />
      <mesh position={marker}>
        <sphereGeometry args={[0.011 * SPHERE_RADIUS, 16, 16]} />
        <meshBasicMaterial color={COLORS.patch} />
      </mesh>

      <OrbitControls
        enableDamping
        enablePan={false}
        minDistance={1.2 * SPHERE_RADIUS}
        maxDistance={6 * SPHERE_RADIUS}
      />
    </>
  );
}

export function SphereView({
  polar,
  projection,
  cells,
  showSag,
  closed,
  onHover
}: {
  polar: Polar;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  closed: boolean;
  onHover: (polar: Polar) => void;
}) {
  return (
    <Canvas
      camera={{position: [0, -1.3 * SPHERE_RADIUS, 2.9 * SPHERE_RADIUS], fov: 36, near: 0.01, far: 100}}
      style={{width: '100%', height: '100%'}}
    >
      <Suspense fallback={null}>
        <Scene
          polar={polar}
          projection={projection}
          cells={cells}
          showSag={showSag}
          closed={closed}
          onHover={onHover}
        />
      </Suspense>
    </Canvas>
  );
}
