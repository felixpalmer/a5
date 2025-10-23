import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/compact/app';

import {makeExample} from '../components';

class CompactDemo extends Component {
  static title = 'Compact Cells';

  static code = `${GITHUB_TREE}/examples/website/compact`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Toggle between compacted and uncompacted cells to see how compaction reduces the number of cells needed to represent a region.</p>
        <p>This example loads compacted A5 cells for a 10km radius around London from a Parquet file and allows you to toggle between viewing the compacted representation (128 cells) and the full uncompacted set (638 cells).</p>
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

export default makeExample(CompactDemo);
