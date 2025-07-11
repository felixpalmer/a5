import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/area/app';
import BrowserOnly from '@docusaurus/BrowserOnly';

import {makeExample} from '../components';

class AreaDemo extends Component {
  static title = 'Area Variance';

  static code = `${GITHUB_TREE}/examples/website/area`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Area comparison between H3 and A5 tiling systems.</p>
        <p>H3 cells vary in size across the globe, with the ratio between the largest and smallest cell areas being <a href="https://h3geo.org/docs/core-library/restable/#hexagon-min-and-max-areas">roughly 2</a>.</p>
        <p>A5 cells areas are exactly equal for all cells at a given resolution.</p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#111'}}>
        <BrowserOnly>
          {() => {
            const isMobile = window.innerWidth < 480 || window.innerHeight < 480;
            return <App {...this.props} isMobile={isMobile} />;
          }}
        </BrowserOnly>
      </div>
    );
  }
}

export default makeExample(AreaDemo);
