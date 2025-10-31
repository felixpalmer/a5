import React from 'react';
import { getResolution, lonLatToCell } from 'a5';

export interface A5CellInfoBoxProps {
  /** Location [lon, lat] */
  location: [number, number];
  /** Resolution level */
  resolution: number;
  /** Optional children to render below the display */
  children?: React.ReactNode;
  /** Optional style overrides */
  style?: React.CSSProperties;
}

/**
 * Displays A5 cell information with color-coded binary representation showing:
 * - Blue: Origin/Segment bits (top 6 bits)
 * - Black: Hilbert curve position (S)
 * - Pink: Resolution marker
 * - Gray: Trailing zeros
 *
 * Usage:
 * <A5CellInfoBox location={[-0.1276, 51.5074]} resolution={10} />
 */
export const A5CellInfoBox: React.FC<A5CellInfoBoxProps> = ({
  location,
  resolution: providedResolution,
  children,
  style
}) => {
  const cellId = lonLatToCell(location, providedResolution);
  const resolution = getResolution(cellId);

  // Convert cellId to binary string and split into parts
  const binaryCellId = cellId.toString(2).padStart(64, '0');

  // First 6 bits encode origin and segment
  const originSegmentBits = 6;

  // Then follow bits to encode the position along the hilbert curve
  const hilbertBits = (2 * Math.max(0, resolution - 1)) + originSegmentBits;

  // Then two bits to encode the resolution (not shown for resolution -1)
  const resolutionBits = resolution >= 0 ? 2 + hilbertBits : hilbertBits;

  const originSegmentSection = binaryCellId.substring(0, originSegmentBits);
  const hilbertSection = binaryCellId.substring(originSegmentBits, hilbertBits);
  const resolutionSection = binaryCellId.substring(hilbertBits, resolutionBits);
  const zeroSection = binaryCellId.substring(resolutionBits);

  const [longitude, latitude] = location;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          backgroundColor: 'white',
          color: 'black',
          padding: '10px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          ...style
        }}
      >
        <div>
          Cell ID (binary):{' '}
          <span style={{ fontWeight: 'bold', color: '#0066FF' }}>{originSegmentSection}</span>
          <span style={{ fontWeight: 'bold', color: '#000000' }}>{hilbertSection}</span>
          <span style={{ fontWeight: 'bold', color: '#FF0066' }}>{resolutionSection}</span>
          <span style={{ fontWeight: 'bold', color: '#999999' }}>{zeroSection}</span>
        </div>
        <div>Cell ID (hex): {`0x${cellId.toString(16).padStart(16, '0')}`}</div>
        <div>
          Longitude: {longitude.toFixed(4)}, Latitude: {latitude.toFixed(4)}, Resolution: {resolution}
        </div>
        {children}
      </div>
    </div>
  );
};

export default A5CellInfoBox;
