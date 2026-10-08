import React from 'react';
import {coveringResolution, getResolution, isCompactionMarker, lonLatToCell} from 'a5';

export interface A5CellInfoBoxProps {
  /** Location [lon, lat] */
  location?: [number, number];
  /** Resolution level */
  resolution?: number;
  /** Value to display instead of location & resolution, e.g. the world cell or a compaction marker */
  cell?: bigint;
  /** Optional children to render below the display */
  children?: React.ReactNode;
  /** Optional style overrides */
  style?: React.CSSProperties;
}

/**
 * Displays A5 cell information with color-coded binary representation showing:
 * - Blue: Origin/Segment bits (top 6 bits)
 * - Black: Space-filling curve position (S)
 * - Pink: Resolution tag
 * - Gray: Trailing zeros
 *
 * For a compaction marker, the black bits are the resolution payload instead.
 *
 * Usage:
 * <A5CellInfoBox location={[-0.1276, 51.5074]} resolution={10} />
 * <A5CellInfoBox cell={0xf00a000000000040n} />
 */
export const A5CellInfoBox: React.FC<A5CellInfoBoxProps> = ({
  location,
  resolution: providedResolution,
  cell,
  children,
  style
}) => {
  const cellId = cell ?? lonLatToCell(location!, providedResolution!);
  const isMarker = isCompactionMarker(cellId);
  const resolution = isMarker ? coveringResolution([cellId]) : getResolution(cellId);

  // Convert cellId to binary string and split into parts
  const binaryCellId = cellId.toString(2).padStart(64, '0');

  // First 6 bits encode origin and segment (none for the world cell)
  const originSegmentBits = resolution >= 0 ? 6 : 0;

  // Then follow bits to encode the position along the space-filling curve
  const curveBits = 2 * Math.max(0, resolution - 1) + originSegmentBits;

  // Then two bits to encode the resolution. For the world cell (resolution -1) the `1` is pushed
  // off the end, so all 64 bits are the tag
  const resolutionBits = resolution >= 0 ? 2 + curveBits : 64;

  // [start bit, end bit, color] counted from the most significant bit
  const sections: [number, number, string][] = isMarker
    ? [
        [0, 6, '#0066FF'], // quintant 60
        [6, 16, '#000000'], // reserved bits, then the resolution byte
        [16, 57, '#999999'], // unused zeros
        [57, 64, '#FF0066'] // marker tag
      ]
    : [
        [0, originSegmentBits, '#0066FF'],
        [originSegmentBits, curveBits, '#000000'],
        [curveBits, resolutionBits, '#FF0066'],
        [resolutionBits, 64, '#999999']
      ];

  const label = isMarker ? 'Compaction marker' : 'Cell ID';
  const lonLat = location ? `Longitude: ${location[0].toFixed(4)}, Latitude: ${location[1].toFixed(4)}` : 'Longitude: N/A, Latitude: N/A';

  return (
    <div>
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
          {label} (binary):{' '}
          {sections.map(([start, end, color]) => (
            <span key={start} style={{fontWeight: 'bold', color}}>
              {binaryCellId.substring(start, end)}
            </span>
          ))}
        </div>
        <div>
          {label} (hex): {`0x${cellId.toString(16).padStart(16, '0')}`}
        </div>
        <div>
          {lonLat}, Resolution: {resolution}
        </div>
        {children}
      </div>
    </div>
  );
};

export default A5CellInfoBox;
