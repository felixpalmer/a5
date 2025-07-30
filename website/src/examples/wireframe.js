// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Component} from 'react';
import App from 'website-examples/wireframe/app';

import {makeExample} from '../components';

class WireframeDemo extends Component {
  static title = 'A5 Wireframe';

  static renderInfo(meta) {
    return (
      <div>
        <p>
          Interactive wireframe showing A5 cells at different resolutions.
          This demonstrates the same functionality as the CLI example but in an interactive map.
        </p>
        <p>
          Try adjusting the resolution slider to see how A5 cells subdivide the globe at different levels of detail.
        </p>
      </div>
    );
  }

  render() {
    return <App showControls={false}/>;
  }
}

export default makeExample(WireframeDemo, {isInteractive: false});