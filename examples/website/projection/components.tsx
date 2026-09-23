// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Suspense, useEffect, useId, useMemo, useRef} from 'react';
import {Canvas, ThreeEvent} from '@react-three/fiber';
import {Line, OrbitControls} from '@react-three/drei';
import {BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, SRGBColorSpace} from 'three';
import {toFace, toPolar} from 'a5/core/coordinate-transforms';
import type {Cartesian, Face, Polar} from 'a5/core/coordinate-systems';
import type {ProjectionMode} from './projection';
import type {DeformationRaster} from './deformation';
import type {Direction, RayWeight} from './geometry';
import {
  cartesianToPolar,
  cellOutline,
  cellSagGeometry,
  domainBoundary,
  domainCorners,
  domainRasterMesh,
  faceBoundary,
  faceCorners,
  DOMAIN_CIRCUMRADIUS,
  gridLines,
  isInDomain,
  patchOutline,
  polarToCartesian,
  SPHERE_RADIUS
} from './geometry';

export const COLORS = {
  grid: 'rgba(255, 255, 255, 0.2)',
  gridFaint: 'rgba(255, 255, 255, 0.08)',
  cusp: 'rgba(255, 255, 255, 0.5)',
  gridOverRaster: 'rgba(255, 255, 255, 0.4)',
  gridFaintOverRaster: 'rgba(255, 255, 255, 0.16)',
  cuspOverRaster: 'rgba(255, 255, 255, 0.8)',
  outline: '#ffffff',
  domainOutline: 'rgba(255, 255, 255, 0.45)',
  cell: '#4dd0e1',
  sag: '#ff2d55',
  patch: '#ffb400',
  radial: '#d84315',
  azimuthal: '#1565c0'
};

/** Side of the patch drawn at the hovered point, in face units */
export const PATCH_SIZE = 0.09;

const points = (corners: Face[], flipY: boolean) =>
  corners.map(corner => `${corner[0]},${flipY ? -corner[1] : corner[1]}`).join(' ');

// ---------------------------------------------------------------------------
// Face view: the flat dodecahedron face, drawn in its own polar coordinates
// ---------------------------------------------------------------------------

const VIEW_EXTENT = 1.06 * DOMAIN_CIRCUMRADIUS;

/**
 * A quarter turn counterclockwise on screen, so a spike of the star points up
 * rather than right. Both views take it, so that the two keep reading alike.
 *
 * The face view turns the drawing rather than the geometry, and SVG's y points
 * down, so the angle it hands over is the negated one; its pointer is read back
 * through that same group's screen matrix, so the inverse comes for free. The
 * sphere turns the scene about z, the axis through the face centre, and has to
 * undo that on its pointer by hand.
 *
 * The figure repeats every 72 degrees, so this is the same picture as 18.
 */
const VIEW_TURN_DEGREES = 90;
const VIEW_TURN = (VIEW_TURN_DEGREES * Math.PI) / 180;

export function FaceView({
  polar,
  raster,
  cells,
  ownFrame,
  direction,
  showGrid,
  projection,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  cells: Face[][];
  ownFrame: boolean;
  direction: Direction;
  showGrid: boolean;
  projection: ProjectionMode;
  onHover: (polar: Polar) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<SVGGElement>(null);
  const clipId = `domain-clip-${useId()}`;

  const outline = useMemo(() => points(faceCorners(), false), []);
  const domainOutline = useMemo(() => points(domainCorners(), false), []);
  // The raster is drawn outside the flipped frame, where y already points down
  const clipOutline = useMemo(() => points(domainCorners(), true), []);

  // Straight here when the grid comes from the plane, kinked when it comes from
  // the sphere, so both families are drawn as paths
  const grid = useMemo(() => gridLines(ownFrame, direction, projection), [ownFrame, direction, projection]);
  const rings = useMemo(() => grid.rings.map(arc => toPath(arc, false)), [grid]);
  const rays = useMemo(() => grid.rays.map(({weight, points}) => ({weight, path: toPath(points, false)})), [grid]);

  // Cell edges are straight in the plane, so no subdivision is needed here
  const cellPaths = useMemo(
    () => cells.map(cell => `M${cell.map(v => `${v[0].toFixed(5)},${v[1].toFixed(5)}`).join('L')}Z`),
    [cells]
  );
  const patch = useMemo(
    () => toPath(patchOutline(polar, PATCH_SIZE, direction, projection), true),
    [polar, direction, projection, ownFrame]
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
    if (isInDomain(hovered)) onHover(hovered);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VIEW_EXTENT} ${-VIEW_EXTENT} ${2 * VIEW_EXTENT} ${2 * VIEW_EXTENT}`}
      onPointerMove={handlePointer}
      style={{width: '100%', height: '100%', display: 'block', touchAction: 'none'}}
    >
      <g transform={`rotate(${-VIEW_TURN_DEGREES})`}>
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
          {showGrid &&
            rings.map((path, index) => (
              <path
                key={`ring-${index}`}
                d={path}
                fill="none"
                stroke={gridStroke}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {showGrid &&
            rays.map(({weight, path}, index) => (
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
  ownFrame,
  direction,
  overRaster
}: {
  projection: ProjectionMode;
  ownFrame: boolean;
  direction: Direction;
  overRaster: boolean;
}) {
  const grid = useMemo(() => gridLines(ownFrame, direction, projection), [ownFrame, direction, projection]);
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
function ProjectedRaster({raster, projection}: {raster: DeformationRaster; projection: ProjectionMode}) {
  const geometry = useMemo(() => {
    const {positions, uvs, indices} = domainRasterMesh(projection);
    const built = new BufferGeometry();
    built.setAttribute('position', new BufferAttribute(positions, 3));
    built.setAttribute('uv', new BufferAttribute(uvs, 2));
    built.setIndex(new BufferAttribute(indices, 1));
    return built;
  }, [projection]);

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
  // constant width however thin the band is, which makes the area impossible to judge.
  // Past the tone mapping too, which was pulling a saturated red down towards the
  // grey of the sphere it has to be read against
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={COLORS.sag} side={DoubleSide} toneMapped={false} />
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
  ownFrame,
  direction,
  showGrid,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  ownFrame: boolean;
  direction: Direction;
  showGrid: boolean;
  onHover: (polar: Polar) => void;
}) {
  const boundary = useMemo(() => lift(faceBoundary(), 1.002, projection), [projection]);
  const outerBoundary = useMemo(() => lift(domainBoundary(), 1.002, projection), [projection]);
  const patch = useMemo(
    () => lift(patchOutline(polar, PATCH_SIZE, direction, projection), 1.003, projection),
    [polar, direction, projection, ownFrame]
  );
  const marker = useMemo(() => lift([polar], 1.004, projection)[0], [polar, projection]);

  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    // The ray hits the scene where it is drawn, so the view turn has to come back
    // out before the point can be read as a point of the projection
    const {x, y, z} = event.point;
    const cos = Math.cos(VIEW_TURN);
    const sin = Math.sin(VIEW_TURN);
    const turned = [x * cos + y * sin, y * cos - x * sin, z];
    const length = Math.hypot(turned[0], turned[1], turned[2]);
    const hovered = cartesianToPolar(turned.map(v => v / length) as Cartesian, projection);
    if (isInDomain(hovered)) onHover(hovered);
  };

  return (
    <>
      {/* Low ambient against a strong key, so the terminator is somewhere to read
          the curvature off rather than a flat disc */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 3, 5]} intensity={1.6} />
      <directionalLight position={[-4, -3, -2]} intensity={0.35} />

      <mesh onPointerMove={handlePointer}>
        <sphereGeometry args={[SPHERE_RADIUS * 0.995, 96, 64]} />
        <meshPhysicalMaterial color="#6e7a8c" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* The face centre projects to the pole, so the axis through it is z, and a
          turn about it spins the figure in view exactly as the face view's own
          does. The lights stay outside, so the shading does not turn with it */}
      <group rotation={[0, 0, VIEW_TURN]}>
        {raster && <ProjectedRaster raster={raster} projection={projection} />}
        {showGrid && (
          <ProjectedGrid
            projection={projection}
            ownFrame={ownFrame}
            direction={direction}
            overRaster={raster !== null}
          />
        )}
        {showSag ? (
          <ProjectedSag cells={cells} projection={projection} />
        ) : (
          <ProjectedCells cells={cells} projection={projection} />
        )}
        <Line
          points={outerBoundary}
          color={COLORS.domainOutline}
          lineWidth={1.5}
          dashed
          dashSize={0.03}
          gapSize={0.02}
        />
        <Line points={boundary} color={COLORS.outline} lineWidth={2} />
        <Line points={patch} color={COLORS.patch} lineWidth={2.5} />
        <mesh position={marker}>
          <sphereGeometry args={[0.011 * SPHERE_RADIUS, 16, 16]} />
          <meshBasicMaterial color={COLORS.patch} />
        </mesh>
      </group>

      {/* Orbit only. With the dolly off the wheel scrolls the page rather than
          the sphere, and the distance limits it used to need go with it */}
      <OrbitControls enableDamping enablePan={false} enableZoom={false} />
    </>
  );
}

/** Pulled back from the 3.18 radii the view opened at, to draw the sphere at 3/4 the size */
const CAMERA_POSITION: [number, number, number] = [0, (-1.3 * 4) / 3, (2.9 * 4) / 3];

export function SphereView({
  polar,
  raster,
  projection,
  cells,
  showSag,
  ownFrame,
  direction,
  showGrid,
  onHover
}: {
  polar: Polar;
  raster: DeformationRaster | null;
  projection: ProjectionMode;
  cells: Face[][];
  showSag: boolean;
  ownFrame: boolean;
  direction: Direction;
  showGrid: boolean;
  onHover: (polar: Polar) => void;
}) {
  return (
    <Canvas
      camera={{
        position: CAMERA_POSITION.map(component => component * SPHERE_RADIUS) as [number, number, number],
        fov: 36,
        near: 0.01,
        far: 100
      }}
      style={{width: '100%', height: '100%'}}
    >
      <Suspense fallback={null}>
        <Scene
          polar={polar}
          raster={raster}
          projection={projection}
          cells={cells}
          showSag={showSag}
          ownFrame={ownFrame}
          direction={direction}
          showGrid={showGrid}
          onHover={onHover}
        />
      </Suspense>
    </Canvas>
  );
}
