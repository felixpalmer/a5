import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/accuracy/app';

import {makeExample} from '../components';

class AccuracyDemo extends Component {
  static title = 'Grid Resolution Comparison';

  static code = `${GITHUB_TREE}/examples/website/accuracy`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>At maximum resolution: A5 & S2 have ~1cm cells, which can be used to represent real-world point data, while H3 has ~1m cells</p>
        <p>H3 can only roughly represent the center circle, and fails to capture the number 5. A5 & S2 are very close to the source vector data.</p>
        <p>Image: <a href="https://map.openaerialmap.org/#/-73.92253071069717,40.8216810899207,18/user/6823ee81856aeb5fdd315d2e/689ab0d36e42196664e6bf6f">Open Imagery Network</a> (CC-BY 4.0)</p>
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

export default makeExample(AccuracyDemo);
