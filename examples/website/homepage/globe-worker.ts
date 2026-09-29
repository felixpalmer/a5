// Computes the globe geometry off the main thread, so the logo can animate in
// meanwhile. Receives the cells, replies with computeGlobe's arrays
import {computeGlobe} from './globe';

self.onmessage = (event: MessageEvent<{cells: BigUint64Array}>) => {
  const {position, center} = computeGlobe(event.data.cells);
  (self as unknown as Worker).postMessage({position, center}, [position.buffer, center.buffer]);
};
