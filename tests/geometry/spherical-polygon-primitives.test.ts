import {describe, it, expect} from 'vitest';
import {pointInSphericalPolygon, ringWindingSign} from 'a5/geometry/spherical-polygon';
import type {Cartesian} from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/geometry/spherical-polygon-primitives.json';

type PipFixture = {
  name: string;
  ring: [number, number][];
  points: {lonLat: [number, number]; vec: number[]; inside: boolean}[];
};

type WindingFixture = {
  name: string;
  ring: [number, number][];
  sign: 1 | -1;
};

const DEG_TO_RAD = Math.PI / 180;
function llToVec(ll: [number, number]): Cartesian {
  const lat = ll[1] * DEG_TO_RAD;
  const lon = ll[0] * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)] as Cartesian;
}

describe('pointInSphericalPolygon', () => {
  for (const f of fixtures.pointInSphericalPolygon as PipFixture[]) {
    it(`${f.name}`, () => {
      const ringVecs = f.ring.map(p => llToVec(p));
      for (const p of f.points) {
        const result = pointInSphericalPolygon(p.vec as unknown as Cartesian, ringVecs);
        expect(result).toBe(p.inside);
      }
    });
  }
});

describe('ringWindingSign', () => {
  for (const f of fixtures.ringWindingSign as WindingFixture[]) {
    it(`${f.name}`, () => {
      const ringVecs = f.ring.map(p => llToVec(p));
      expect(ringWindingSign(ringVecs)).toBe(f.sign);
    });
  }
});
