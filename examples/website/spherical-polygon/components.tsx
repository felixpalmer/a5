import React, { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, DoubleSide, Vector3, Raycaster, Sphere as ThreeSphere } from 'three';
import { SphericalPentagonShape } from 'a5/core/spherical-pentagon';
import { toCartesian, fromLonLat, toSpherical } from 'a5/core/coordinate-transforms';
import { cellToBoundary } from 'a5/index';
import type { Spherical, Radians, Cartesian } from 'a5/core/coordinate-systems';
import { useThree } from '@react-three/fiber';

export function Sphere({ onSphereClick }: { onSphereClick: (point: Spherical) => void }) {
  const { camera} = useThree();

  const handleClick = (event: { clientX: number; clientY: number }) => {
    const spherical = toSpherical(camera.position.toArray() as Cartesian);
    onSphereClick(spherical);
  };

  return (
    <mesh onClick={handleClick}>
      <sphereGeometry args={[0.999, 64, 64]} />
      <meshPhysicalMaterial 
        color="#00aa55"
        opacity={0.05}
        metalness={0.5}
        roughness={0.7}
        emissive="#00aa55"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

export function PentagonLines(props: { sphericalPentagon: SphericalPentagonShape, disabled: boolean }) {
  const { sphericalPentagon, disabled } = props;
  const geometry = useMemo(() => {
    // Use 20 segments per edge for smooth curves
    const vertices = sphericalPentagon.getBoundary(20);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices.flatMap(p => [...p]), 3));
    return geometry;
  }, [sphericalPentagon]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#ffffff" opacity={0.1} transparent={disabled} linewidth={2} />
    </line>
  );
}

export function sphericalPentagonFromCell(cell: bigint): SphericalPentagonShape {
  const boundary = cellToBoundary(cell);
  const cartesianBoundary = boundary.map(lonlat => toCartesian(fromLonLat(lonlat)));
  return new SphericalPentagonShape(cartesianBoundary);
}

export function A5Pentagon(props: { cell: bigint, disabled: boolean }) {
  const {cell, disabled} = props;
  const a5Pentagon = sphericalPentagonFromCell(cell);
  return <PentagonLines sphericalPentagon={a5Pentagon} disabled={disabled} />;
}

export function Marker(props: { cartesian: Cartesian }) {
  const cartesian = props.cartesian;
  return (
    <mesh position={cartesian}>
      <sphereGeometry args={[0.003, 16, 16]} />
      <meshPhysicalMaterial
        color="#ff0000"
        metalness={0.2}
        roughness={0}
      />
    </mesh>
  );
} 