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
        <p>H3 cells vary in size across the globe, with the ratio between the largest and smallest cell areas being roughly 1.63.</p>
        <p>A5 cells area are more uniform, with the ratio between the largest and smallest cell areas being roughly 1.02.</p>
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
