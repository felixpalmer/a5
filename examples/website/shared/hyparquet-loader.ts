import { parquetRead } from 'hyparquet';

/**
 * Custom loader for Parquet files using hyparquet
 * Compatible with deck.gl's loader system
 */
export const HyparquetLoader = {
  name: 'Hyparquet',
  id: 'hyparquet',
  module: 'hyparquet',
  version: '1.0.0',
  extensions: ['parquet'],
  mimeTypes: ['application/octet-stream'],
  category: 'table',
  parse: async (arrayBuffer: ArrayBuffer) => {
    return new Promise((resolve, reject) => {
      try {
        parquetRead({
          file: arrayBuffer,
          rowFormat: 'object',
          onComplete: (rows) => resolve(rows)
        });
      } catch (error) {
        reject(error);
      }
    });
  }
};
