// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Components available in every markdown page without an import
import MDXComponents from '@theme-original/MDXComponents';
import CodeTabs from '../components/code-tabs';
import {ConwayDemo, TilingDemo} from '../components/embedded-demos';

export default {
  ...MDXComponents,
  CodeTabs,
  ConwayDemo,
  TilingDemo
};
