import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/road-safety/app';

import {makeExample} from '../components';

class RoadSafetyDemo extends Component {
  static title = 'UK Road Safety Heatmap';

  static code = `${GITHUB_TREE}/examples/website/road-safety`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>3D heatmap of road safety incidents in the UK, aggregated by A5 cells</p>
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

export default makeExample(RoadSafetyDemo);
