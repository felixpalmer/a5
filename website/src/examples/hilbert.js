import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/hilbert/app';

import {makeExample} from '../components';

class HilbertDemo extends Component {
  static title = 'Global Hilbert Curve';

  static code = `${GITHUB_TREE}/examples/website/hilbert`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Illustration of Hilbert curve across all the cells on the globe</p>
        <p>Individual Hilbert curves for the 60 quintants are stiched together to complete a closed circuit.</p>
        <p>The ordering of the curve is carefully chosen to place the land masses first, followed by the oceans.</p>
        <p>Thus 99.9% of the world's population is contained in the first two thirds of the curve.</p>
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

export default makeExample(HilbertDemo);
