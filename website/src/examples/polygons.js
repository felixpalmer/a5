import React, { Component } from "react";
import { GITHUB_TREE } from "../constants/defaults";
import App from "website-examples/polygons/app";

import { makeExample } from "../components";

class PolygonsDemo extends Component {
  static title = "Polygons";

  static code = `${GITHUB_TREE}/examples/website/polygons`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Click on the map to place waypoints, or load a country preset.</p>
        <p>
          Depending on the mode,{" "}
          <a href="/docs/api-reference/regions#polygontocells">
            <code>polygonToCells</code>
          </a>{" "}
          is used to show the cells enclosed, or{" "}
          <a href="/docs/api-reference/traversal#linestringtocells">
            <code>lineStringToCells</code>
          </a>{" "}
          is used to show cells which overlap the outline
        </p>
      </div>
    );
  }

  render() {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          background: "#111",
        }}
      >
        <App {...this.props} />
      </div>
    );
  }
}

export default makeExample(PolygonsDemo);
