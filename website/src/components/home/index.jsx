// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {Banner, BannerContainer, HeroExampleContainer, ProjectName, GetStartedLink} from './styled';
import styled from 'styled-components';
import {isMobile} from '../common';

export default function renderPage({HeroExample, children}) {
  const {siteConfig} = useDocusaurusContext();

  // Note: The Layout "wrapper" component adds header and footer etc
  return (
    <>
      <Banner>
        <HeroExampleContainer>{HeroExample && <HeroExample />}</HeroExampleContainer>
        <BannerContainer>
          <ProjectName>{siteConfig.title}</ProjectName>
          <p>{siteConfig.tagline}</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <GetStartedLink href="./docs/">INTRODUCTION</GetStartedLink>
            <GetStartedLink href="./examples/">EXAMPLES</GetStartedLink>
          </div>
        </BannerContainer>
      </Banner>
      {children}
    </>
  );
}
