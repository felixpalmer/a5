import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/traversal/app';
import BrowserOnly from '@docusaurus/BrowserOnly';

import {makeExample} from '../components';

class TraversalDemo extends Component {
  static title = 'Traversal';

  static code = `${GITHUB_TREE}/examples/website/traversal`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>The <code>gridDisk</code> and <code>sphericalCap</code> APIs compute neighboring cells, either by number of hops <code>(k)</code> or distance.</p>
        <p>Pan and zoom to explore cells at different resolutions.</p>
        <p>Cells are returned compacted for efficiency, but can be uncompacted for visualization if needed.</p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#111'}}>
        <BrowserOnly>
          {() => <App {...this.props} />}
        </BrowserOnly>
      </div>
    );
  }
}

export default makeExample(TraversalDemo);
