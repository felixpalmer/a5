import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/cells/app';

import {makeExample} from '../components';

class CellsDemo extends Component {
  static title = 'A5 Cells';

  static code = `${GITHUB_TREE}/examples/website/cells`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Click a location on the map to add/remove the cell for that location and resolution.</p>
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

export default makeExample(CellsDemo);
