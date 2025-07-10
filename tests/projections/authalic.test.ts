import { describe, it, expect } from 'vitest'
import { AuthalicProjection } from '../../modules/projections/authalic'
import type { Radians } from 'a5/core/coordinate-systems'

describe('Authalic Conversion', () => {
  const authalic = new AuthalicProjection();
    describe('geodeticToAuthalic', () => {
        it('converts zero latitude', () => {
            const result = authalic.forward(0 as Radians)
            expect(result).toBeCloseTo(0, 10)
        })

        it('converts small latitudes', () => {
            const input = Math.PI / 180 as Radians // 1 degree
            const result = authalic.forward(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts medium latitudes', () => {
            const input = Math.PI / 4 as Radians // 45 degrees
            const result = authalic.forward(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts large latitudes', () => {
            const input = Math.PI / 2 as Radians // 90 degrees
            const result = authalic.forward(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts negative latitudes', () => {
            const input = -Math.PI / 4 as Radians // -45 degrees
            const result = authalic.forward(input)
            expect(result).toBeCloseTo(input, 2)
        })
    })

    describe('authalicToGeodetic', () => {
        it('converts zero latitude', () => {
            const result = authalic.inverse(0 as Radians)
            expect(result).toBeCloseTo(0, 10)
        })

        it('converts small latitudes', () => {
            const input = Math.PI / 180 as Radians // 1 degree
            const result = authalic.inverse(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts medium latitudes', () => {
            const input = Math.PI / 4 as Radians // 45 degrees
            const result = authalic.inverse(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts large latitudes', () => {
            const input = Math.PI / 2 as Radians // 90 degrees
            const result = authalic.inverse(input)
            expect(result).toBeCloseTo(input, 2)
        })

        it('converts negative latitudes', () => {
            const input = -Math.PI / 4 as Radians // -45 degrees
            const result = authalic.inverse(input)
            expect(result).toBeCloseTo(input, 2)
        })
    })

    describe('round-trip conversion', () => {
        it('preserves latitude through geodetic->authalic->geodetic conversion for all latitudes', () => {
            for (let deg = -90; deg <= 90; deg++) {
                const lat = (deg * Math.PI / 180) as Radians
                const authalicLat = authalic.forward(lat)
                const geodetic = authalic.inverse(authalicLat)
                expect(geodetic).toBeCloseTo(lat, 15)
            }
        })

        it('preserves latitude through authalic->geodetic->authalic conversion for all latitudes', () => {
            for (let deg = -90; deg <= 90; deg++) {
                const lat = (deg * Math.PI / 180) as Radians
                const geodetic = authalic.inverse(lat)
                const authalicLat = authalic.forward(geodetic)
                expect(authalicLat).toBeCloseTo(lat, 15)
            }
        })
    })

    describe('specific conversion values', () => {
        it('matches reference conversion values', () => {
            const testCases = [
                { geodetic: -90, authalic: -90.0000 },
                { geodetic: -67.5, authalic: -67.4092 },
                { geodetic: -45, authalic: -44.8717 },
                { geodetic: -22.5, authalic: -22.4094 },
                { geodetic: 0, authalic: 0 },
                { geodetic: 22.5, authalic: 22.4094 },
                { geodetic: 45, authalic: 44.8717 },
                { geodetic: 67.5, authalic: 67.4092 },
                { geodetic: 90, authalic: 90.0000 }
            ]

            testCases.forEach(({ geodetic, authalic: expectedAuthalic }) => {
                const geodeticRad = (geodetic * Math.PI / 180) as Radians
                const authalicRad = (expectedAuthalic * Math.PI / 180) as Radians
                const result = authalic.forward(geodeticRad)
                expect(result).toBeCloseTo(authalicRad, 5)
            })
        })
    })
}) 