// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Suspense, useEffect, useId, useMemo, useRef} from 'react';
import {Canvas, ThreeEvent} from '@react-three/fiber';
import {Line, OrbitControls} from '@react-three/drei';
import {BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, SRGBColorSpace} from 'three';
import {toFace, toPolar} from 'a5/core/coordinate-transforms';
import type {Cartesian, Face, Polar} from 'a5/core/coordinate-systems';
import type {ProjectionMode} from 'a5/projections/projection-mode';
import type {DeformationRaster} from './deformation';
import type {GridSource, RayWeight} from './jacobian';
import {
  beyondFaceMesh,
  cartesianToPolar,
  cellOutline,
  cellSagGeometry,
  closedDomainBoundary,
  closedDomainCorners,
  domainBoundary,
  domainCorners,
  domainRasterMesh,
  faceBoundary,
  faceCorners,
  faceMesh,
  DOMAIN_CIRCUMRADIUS,
  gridLines,
  isInDrawnDomain,
  patchOutline,
  polarToCartesian,
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
  ownFrame,
  source,
  projection,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  cells: Face[][];
  closed: boolean;
  ownFrame: boolean;
  source: GridSource;
  projection: ProjectionMode;
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

  // Straight here when the grid comes from the plane, kinked when it comes from
  // the sphere, so both families are drawn as paths
  const grid = useMemo(() => gridLines(closed, ownFrame, source, projection), [closed, ownFrame, source, projection]);
  const rings = useMemo(() => grid.rings.map(arc => toPath(arc, false)), [grid]);
  const rays = useMemo(() => grid.rays.map(({weight, points}) => ({weight, path: toPath(points, false)})), [grid]);

  // Cell edges are straight in the plane, so no subdivision is needed here
  const cellPaths = useMemo(
    () => cells.map(cell => `M${cell.map(v => `${v[0].toFixed(5)},${v[1].toFixed(5)}`).join('L')}Z`),
    [cells]
  );
  const patch = useMemo(
    () => toPath(patchOutline(polar, PATCH_SIZE, source, projection, ownFrame, closed), true),
    [polar, source, projection, ownFrame, closed]
  );
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
            href={raster.url}
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
        {rays.map(({weight, path}, index) => (
          <path
            key={`ray-${index}`}
            d={path}
            fill="none"
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
// The same lift the face view gives its strokes once there is a raster under them
const RAY_OPACITY_OVER_RASTER: Record<RayWeight, number> = {cusp: 0.85, bisector: 0.45, minor: 0.2};
const RING_OPACITY = 0.25;
const RING_OPACITY_OVER_RASTER = 0.45;
const RAY_WEIGHTS: RayWeight[] = ['cusp', 'bisector', 'minor'];

/** Polylines flattened into the pairs of endpoints a segment soup wants */
function segments(lines: [number, number, number][][]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) out.push(line[i], line[i + 1]);
  }
  return out;
}

// Fixed for the life of the scene, and now some hundred separate lines, so it is
// kept out of the hover re-render
const ProjectedGrid = React.memo(function ProjectedGrid({
  projection,
  closed,
  ownFrame,
  source,
  overRaster
}: {
  projection: ProjectionMode;
  closed: boolean;
  ownFrame: boolean;
  source: GridSource;
  overRaster: boolean;
}) {
  const grid = useMemo(() => gridLines(closed, ownFrame, source, projection), [closed, ownFrame, source, projection]);
  // One line-segment soup per style rather than one line object per curve: with
  // every face drawing its own grid there are some three hundred of them
  const rings = useMemo(() => segments(grid.rings.map(arc => lift(arc, 1.001, projection))), [grid, projection]);
  const rays = useMemo(() => {
    const byWeight: Record<RayWeight, [number, number, number][][]> = {cusp: [], bisector: [], minor: []};
    for (const {weight, points} of grid.rays) byWeight[weight].push(lift(points, 1.001, projection));
    return RAY_WEIGHTS.map(weight => ({weight, points: segments(byWeight[weight])}));
  }, [grid, projection]);

  const rayOpacity = overRaster ? RAY_OPACITY_OVER_RASTER : RAY_OPACITY;

  return (
    <>
      {rings.length > 0 && (
        <Line
          points={rings}
          segments
          color="#ffffff"
          transparent
          opacity={overRaster ? RING_OPACITY_OVER_RASTER : RING_OPACITY}
          lineWidth={1}
        />
      )}
      {rays.map(
        ({weight, points}) =>
          points.length > 0 && (
            <Line
              key={weight}
              points={points}
              segments
              color="#ffffff"
              transparent
              opacity={rayOpacity[weight]}
              lineWidth={1}
            />
          )
      )}
    </>
  );
});

/**
 * The deformation raster on the sphere: the very canvas the face view draws as an
 * image, mapped through the projection onto the image of the domain.
 *
 * `toneMapped` is off deliberately. The canvas has the renderer's default filmic
 * tone mapping on it, which greys saturated colour down until the ramp and the
 * legend beside it no longer agree — and at the ends of the ramp, where the
 * colours are strongest, the greying is worst.
 */
function ProjectedRaster({
  raster,
  projection,
  closed
}: {
  raster: DeformationRaster;
  projection: ProjectionMode;
  closed: boolean;
}) {
  const geometry = useMemo(() => {
    const {positions, uvs, indices} = domainRasterMesh(projection, closed);
    const built = new BufferGeometry();
    built.setAttribute('position', new BufferAttribute(positions, 3));
    built.setAttribute('uv', new BufferAttribute(uvs, 2));
    built.setIndex(new BufferAttribute(indices, 1));
    return built;
  }, [projection, closed]);

  // A canvas texture rather than one loaded from the data URL: it is ready on the
  // frame it is made, so there is no pass where the mesh draws untextured
  const texture = useMemo(() => {
    const created = new CanvasTexture(raster.canvas);
    created.colorSpace = SRGBColorSpace;
    return created;
  }, [raster]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  // The field is transparent outside the domain, and the mesh runs a texel or two
  // past it in places. Cutting those out with alphaTest rather than blending them
  // keeps the surface in the opaque pass, where it needs no sorting against itself
  return (
    <mesh geometry={geometry} scale={SPHERE_RADIUS}>
      <meshBasicMaterial map={texture} side={DoubleSide} alphaTest={0.5} toneMapped={false} />
    </mesh>
  );
}

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
  raster,
  projection,
  cells,
  showSag,
  closed,
  ownFrame,
  source,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  closed: boolean;
  ownFrame: boolean;
  source: GridSource;
  onHover: (polar: Polar) => void;
}) {
  const boundary = useMemo(() => lift(faceBoundary(), 1.002, projection), [projection]);
  const outerBoundary = useMemo(() => lift(domainBoundary(), 1.002, projection), [projection]);
  const closedBoundary = useMemo(
    () => (closed ? lift(closedDomainBoundary(), 1.002, projection) : null),
    [closed, projection]
  );
  const patch = useMemo(
    () => lift(patchOutline(polar, PATCH_SIZE, source, projection, ownFrame, closed), 1.003, projection),
    [polar, source, projection, ownFrame, closed]
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

      {/* The flat region colours would tint the ramp, so the raster replaces them */}
      {raster ? (
        <ProjectedRaster raster={raster} projection={projection} closed={closed} />
      ) : (
        <>
          <ProjectedRegion build={faceMesh} projection={projection} color={COLORS.face} opacity={0.25} />
          <ProjectedRegion build={beyondFaceMesh} projection={projection} color={COLORS.beyond} opacity={0.22} />
          {closed && (
            <ProjectedRegion build={vertexMesh} projection={projection} color={COLORS.closing} opacity={0.3} />
          )}
        </>
      )}
      <ProjectedGrid
        projection={projection}
        closed={closed}
        ownFrame={ownFrame}
        source={source}
        overRaster={raster !== null}
      />
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
  raster,
  projection,
  cells,
  showSag,
  closed,
  ownFrame,
  source,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  closed: boolean;
  ownFrame: boolean;
  source: GridSource;
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
          raster={raster}
          projection={projection}
          cells={cells}
          showSag={showSag}
          closed={closed}
          ownFrame={ownFrame}
          source={source}
          onHover={onHover}
        />
      </Suspense>
    </Canvas>
  );
}
