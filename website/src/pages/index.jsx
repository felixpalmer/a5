// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import {Home} from '../components';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styled from 'styled-components';
import Layout from '@theme/Layout';

import HeroExample from '../examples/home-demo';

const FeatureImage = styled.div`
  position: absolute;
  height: 100%;
  width: 50%;
  top: 0;
  right: 0;
  z-index: -1;
  border-top: solid 200px transparent;
  background-image: url(${props => props.src});
  background-size: contain;
  background-repeat: no-repeat;
  background-position: right top;

  @media screen and (max-width: 768px) {
    display: none;
  }
`;

const TextContainer = styled.div`
  max-width: 800px;
  padding: 64px 112px;
  width: 70%;
  font-size: 14px;

  h2 {
    font: bold 32px/48px;
    margin: 24px 0 16px;
    position: relative;
  }
  h3 {
    font: bold 16px/24px;
    margin: 16px 0 0;
    position: relative;
  }
  h3 > img {
    position: absolute;
    top: 0;
    width: 20px;
    left: -30px;
  }
  hr {
    border: none;
    background: #e1e8f0;
    height: 1px;
    margin: 24px 0 0;
    width: 32px;
    height: 2px;
  }
  @media screen and (max-width: 768px) {
    max-width: 100%;
    width: 100%;
    padding: 48px 48px 48px 80px;
  }
`;

export default function IndexPage() {
  const baseUrl = useBaseUrl('/');

  return (
    <Layout title="Home" description="A5 tiling system">
      <Home HeroExample={HeroExample}>
        <div style={{position: 'relative'}}>
          <FeatureImage src={`${baseUrl}images/maps.jpg`} />
          <TextContainer>
            <h3>
              <img src={`${baseUrl}images/pentagon.svg`} />Pentagonal Discrete Global Grid System
            </h3>
            <p>
              A5 is a global geospatial index. It is the pentagonal equivalent of other DGGSs, like <a href="http://s2geometry.io/">S2</a> or <a href="https://h3geo.org/">H3</a>, but with higher accuracy and lower distortion.
            </p>

            <h3>
              <img src={`${baseUrl}images/pentagon.svg`} />Flexible representation of geospatial data
            </h3>
            <p>
              A5 is used for representing points, lines, and polygons in a unified cell format, which is well suited for combining datasets and aggregating data.
            </p>

            <h3>
              <img src={`${baseUrl}images/pentagon.svg`} />Uniform Cell Sizes with Minimal Distortion
            </h3>
            <p>
              Data from all around the world can be directly compared due to the exactly equal areas of all A5 cells.
            </p>
          </TextContainer>
        </div>
      </Home>
    </Layout>
  );
}
