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
        <p>Interactive demo of <code>gridDisk</code> and <code>sphericalCap</code>.</p>
        <p>Pan and zoom to explore cells at different resolutions. Toggle <strong>Uncompact</strong> to expand compacted results to individual cells.</p>
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
