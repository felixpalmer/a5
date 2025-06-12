import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/hierarchy/app';

import {makeExample} from '../components';

class HierarchyDemo extends Component {
  static title = 'Hierarchy';

  static code = `${GITHUB_TREE}/examples/website/hierarchy`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>A5 cells for a given location on the globe.</p>
        <p>Zoom in/out to change the resolution level of the A5 pentagon at the center of the map.</p>
        <p>Click to see the pentagon hierarchy at that location. Notice how cells at similar locations have similar cell ids.</p>
        <p>Parent cells do not exactly cover children cells, but are guaranteed to overlap.</p>
      </div>
    );
  }

  render() {
    const {Component, ...otherProps} = this.props;
    return <App {...otherProps} />;
  }
}

export default makeExample(HierarchyDemo); 