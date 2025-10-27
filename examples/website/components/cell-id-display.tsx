import React from 'react';
import { getResolution, lonLatToCell } from 'a5';

export interface CellIdDisplayProps {
  /** Cell ID as bigint (if provided directly) */
  cellId?: bigint;
  /** Location [lon, lat] - if provided with resolution, will compute cellId */
  location?: [number, number];
  /** Resolution level - required if location is provided */
  resolution?: number;
  /** Optional description to show above the display */
  description?: string;
  /** Optional children to render below the display */
  children?: React.ReactNode;
  /** Optional style overrides */
  style?: React.CSSProperties;
}

/**
 * Displays a cell ID with color-coded binary representation showing:
 * - Blue: Origin/Segment bits (top 6 bits)
 * - Black: Hilbert curve position (S)
 * - Pink: Resolution marker
 * - Gray: Trailing zeros
 *
 * Usage:
 * - Direct: <CellIdDisplay cellId={123n} />
 * - From location: <CellIdDisplay location={[-0.1276, 51.5074]} resolution={10} />
 */
export const CellIdDisplay: React.FC<CellIdDisplayProps> = ({
  cellId: providedCellId,
  location,
  resolution: providedResolution,
  description,
  children,
  style
}) => {
  // Compute cellId from location if not provided directly
  let cellId: bigint;
  let computedFromLocation = false;

  if (providedCellId !== undefined) {
    cellId = providedCellId;
  } else if (location && providedResolution !== undefined) {
    cellId = lonLatToCell(location, providedResolution);
    computedFromLocation = true;
  } else {
    return (
      <div style={{ color: 'red', padding: '10px', backgroundColor: '#fee' }}>
        Error: Must provide either cellId or (location + resolution)
      </div>
    );
  }

  const resolution = getResolution(cellId);

  // Convert cellId to binary string and split into parts
  const binaryCellId = cellId.toString(2).padStart(64, '0');

  // First 6 bits encode origin and segment
  const originSegmentBits = 6;

  // Then follow bits to encode the position along the hilbert curve
  const hilbertBits = (2 * Math.max(0, resolution - 1)) + originSegmentBits;

  // Then two bits to encode the resolution
  const resolutionBits = 2 + hilbertBits;

  const originSegmentSection = binaryCellId.substring(0, originSegmentBits);
  const hilbertSection = binaryCellId.substring(originSegmentBits, hilbertBits);
  const resolutionSection = binaryCellId.substring(hilbertBits, resolutionBits);
  const zeroSection = binaryCellId.substring(resolutionBits);

  return (
    <div style={{ marginBottom: '20px' }}>
      {description && (
        <p style={{ marginBottom: '10px', color: '#495057' }}>{description}</p>
      )}
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
        <div>Cell ID (Hex): {`0x${cellId.toString(16).padStart(16, '0')}`}</div>
        <div>Resolution: {resolution}</div>
        {location && (
          <div>
            Location: [{location[0].toFixed(4)}, {location[1].toFixed(4)}]
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default CellIdDisplay;
