import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/lattice/app';

import {makeExample} from '../components';

class LatticeDemo extends Component {
  static title = 'A5 Lattice Explorer';

  static code = `${GITHUB_TREE}/examples/website/lattice`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          Shows the relationship between the triangles in the A5 lattice and the pentagon tiling and how they are
          indexed by the Hilbert curve.
        </p>
        <p>The Hilbert curve is a space-filling curve that maps a one-dimensional line to a two-dimensional plane.</p>
        <p>The order in which the curve visits the cells is related to order of the integer cell ids.</p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#111'}}>
        <App {...this.props} />
      </div>
    );
  }
}

export default makeExample(LatticeDemo);
