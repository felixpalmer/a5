import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/collections/app';
import BrowserOnly from '@docusaurus/BrowserOnly';

import {makeExample} from '../components';

class CollectionsDemo extends Component {
  static title = 'Collections';

  static code = `${GITHUB_TREE}/examples/website/collections`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          Toggle any selection of countries (each from <code>polygonToCells</code>, merged into one collection) and
          place two spherical caps around European capitals with <code>sphericalCap</code>. Each is a compacted
          collection; combine any two with <code>union</code>, <code>intersect</code> or <code>difference</code>.
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

export default makeExample(CollectionsDemo);
