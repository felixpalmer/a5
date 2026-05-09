import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/polygons/app';

import {makeExample} from '../components';

class PolygonsDemo extends Component {
  static title = 'Polygons';

  static code = `${GITHUB_TREE}/examples/website/polygons`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Click on the map to place waypoints. Cells along the great-circle arcs between consecutive waypoints are traced and displayed.</p>
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

export default makeExample(PolygonsDemo);
