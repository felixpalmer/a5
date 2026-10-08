import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/coverings/app';
import BrowserOnly from '@docusaurus/BrowserOnly';

import {makeExample} from '../components';

class CoveringsDemo extends Component {
  static title = 'Coverings';

  static code = `${GITHUB_TREE}/examples/website/coverings`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          Toggle any selection of countries (each from <code>polygonToCells</code>, merged into one covering) and place
          two spherical caps around European capitals with <code>sphericalCap</code>. Each is a covering; combine any
          two with <code>union</code>, <code>intersect</code> or <code>difference</code>.
        </p>
        <p>
          The set operations work directly on the compacted cells, which cover contiguous runs of the A5 curve, so
          nothing is uncompacted. The result is compacted too: darker cells are coarser.
        </p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#111'}}>
        <BrowserOnly>{() => <App {...this.props} />}</BrowserOnly>
      </div>
    );
  }
}

export default makeExample(CoveringsDemo);
