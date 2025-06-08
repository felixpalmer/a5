import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/spherical-polygon/app';

import {makeExample} from '../components';

class SphericalPolygonDemo extends Component {
  static title = 'Spherical Polygon';

  static code = `${GITHUB_TREE}/examples/website/spherical-polygon`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Visualization of a hit-testing of spherical polygons on the globe.</p>
        <p>Rotate the globe to move the hit-testing point.</p>
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

export default makeExample(SphericalPolygonDemo); 