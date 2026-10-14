// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The install commands in the docs name the A5 version the site documents,
// read from the root package.json. Every port is released with the same
// version, so the site, built from the release branch, stays current. Write
// {{A5_VERSION}} in a code block for the npm and crates.io spelling
// (1.0.0-beta.2) and {{A5_PYPI_VERSION}} for PyPI's (1.0.0b2)

const {version} = require('../package.json');

const PEP_440 = {alpha: 'a', beta: 'b', rc: 'rc'};

const VERSIONS = {
  A5_VERSION: version,
  A5_PYPI_VERSION: version.replace(/-(alpha|beta|rc)\.?(\d+)$/, (match, tag, n) => PEP_440[tag] + n)
};

function replaceVersions(text) {
  return text.replace(/\{\{(A5_\w+)\}\}/g, (match, name) => VERSIONS[name] ?? match);
}

// Remark plugin filling in the versions in code blocks and inline code
function remarkA5Version() {
  const visit = node => {
    if (node.type === 'code' || node.type === 'inlineCode') {
      node.value = replaceVersions(node.value);
    }
    node.children?.forEach(visit);
  };
  return visit;
}

module.exports = {VERSIONS, replaceVersions, remarkA5Version};
