import React from 'react';
import { createRoot } from 'react-dom/client';
import { CellIdDisplay } from './cell-id-display';

export interface IndexExampleProps {
  /** Cell ID in hex format (e.g., "0x3000000000000000") or decimal string */
  cellId: string;
  /** Optional description to show above the display */
  description?: string;
}

/**
 * Component for displaying cell ID examples in documentation.
 * Accepts cell IDs as hex strings or decimal strings.
 */
export const IndexExample: React.FC<IndexExampleProps> = ({ cellId, description }) => {
  // Parse the cell ID from hex or decimal string
  let parsedCellId: bigint;
  try {
    if (cellId.startsWith('0x') || cellId.startsWith('0X')) {
      parsedCellId = BigInt(cellId);
    } else {
      parsedCellId = BigInt(cellId);
    }
  } catch (e) {
    return (
      <div style={{ color: 'red', padding: '10px', backgroundColor: '#fee' }}>
        Error: Invalid cell ID "{cellId}"
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {description && (
        <p style={{ marginBottom: '10px', color: '#495057' }}>{description}</p>
      )}
      <CellIdDisplay cellId={parsedCellId} />
    </div>
  );
};

export default IndexExample;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  // Example usage
  root.render(
    <div>
      <IndexExample
        cellId="0x3000000000000000"
        description="Resolution 0: Base pentagon in London"
      />
    </div>
  );
}
