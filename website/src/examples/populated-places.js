import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/populated-places/app';

import {makeExample} from '../components';

class PopulatedPlacesDemo extends Component {
  static title = 'Populated Places';

  static code = `${GITHUB_TREE}/examples/website/populated-places`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Populated places aggregated by A5, and drawn as 3D columns at cell centers.</p>
        <p>Switch to cell mode to see aggregation bounds, source points and cell centers.</p>
        <p>
          Data: <a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/">Natural Earth</a>
        </p>
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

export default makeExample(PopulatedPlacesDemo);
