import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/compaction/app';

import {makeExample} from '../components';

class CompactionDemo extends Component {
  static title = 'Compaction';

  static code = `${GITHUB_TREE}/examples/website/compaction`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>When cells have a common parent, they can be "compacted", that is represented solely by their parent cell. To retrieve the original cells, the compacted cells are uncompacted</p>
        <p>The gaps in the compacted view are expected, as compacted cells represent children logically, not spatially.</p>
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

export default makeExample(CompactionDemo);
