// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import styled from 'styled-components';
import {isMobile} from '../common';

export const PanelContainer = styled.div`
  font-size: 14px;
  position: absolute;
  top: 0;
  right: 0;
  width: 344px;
  background: var(--ifm-background-surface-color);
  box-shadow: var(--ifm-global-shadow-lw);
  margin: 24px;
  padding: 10px 24px;
  max-height: 96%;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-y: overlay;
  outline: none;
  z-index: 1;

  ${isMobile} {
    width: auto;
    left: 0;
    padding: 10px 106x;
    ${props =>
      !props.$expanded &&
      `
      background: transparent;
      box-shadow: none;
      pointer-events: none;
    `}
  }
`;

export const PanelExpander = styled.div`
  display: none;
  width: 16px;
  height: 16px;
  font-family: serif;
  font-size: 0.8em;
  text-align: center;
  line-height: 16px;
  border-radius: 50%;
  background: ${props => (props.$expanded ? 'none' : 'var(--ifm-color-gray-900)')};
  color: ${props => (props.$expanded ? 'var(--ifm-color-black)' : 'var(--ifm-color-white)')};
  ${isMobile} {
    display: block;
    position: relative;
    top: ${props => (props.$expanded ? '0' : '-18px')};
    left: ${props => (props.$expanded ? '0' : '24px')};
    width: 32px;
    height: 32px;
    line-height: 24px;
    font-size: 1em;
    background: ${props => (props.$expanded ? 'none' : 'white')};
    color: ${props => (props.$expanded ? 'var(--ifm-color-black)' : 'var(--ifm-color-gray-900)')};
    border-radius: 32px;
    padding: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
  }
`;

export const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: bold 1.25em var(--ifm-font-family-base);
  margin: 8px 0;
  ${isMobile} {
    cursor: pointer;
    ${props =>
      !props.$expanded &&
      `
      > div:first-child {
        display: none;
      }
      justify-content: flex-end;
    `}
  }
`;

export const PanelContent = styled.div`
  div > * {
    vertical-align: middle;
    white-space: nowrap;
  }
  div > label {
    display: inline-block;
    width: 40%;
    margin-right: 10%;
    color: var(--ifm-color-content-secondary);
    margin-top: 2px;
    margin-bottom: 2px;
  }
  div > input,
  div > a,
  div > button,
  div > select {
    font: normal 11px/16px var(--ifm-font-family-base);
    line-height: 20px;
    text-transform: none;
    text-overflow: ellipsis;
    overflow: hidden;
    display: inline-block;
    padding: 0 4px;
    width: 50%;
    height: 20px;
    text-align: left;
  }
  div > button {
    color: initial;
  }
  div > button:disabled {
    color: var(--ifm-color-gray-300);
    cursor: default;
    background: var(--ifm-color-gray-300);
  }
  div > input {
    border: solid 1px var(--ifm-color-gray-300);
    &:disabled {
      background: var(--ifm-color-white);
    }
    &[type='checkbox'] {
      height: auto;
    }
  }
  p {
    margin-bottom: 12px;
    white-space: initial;
  }
  ${isMobile} {
    display: ${props => (props.$expanded ? 'block' : 'none')};
  }
`;

export const SourceLink = styled.a`
  display: block;
  text-align: right;
  margin-top: 8px;
  font: bold 12px/20px var(--ifm-font-family-base);
  color: var(--ifm-color-content-secondary);
  ${isMobile} {
    display: ${props => (props.$expanded ? 'block' : 'none')};
  }
`;
