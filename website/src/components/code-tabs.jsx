// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Children, useState, useSyncExternalStore} from 'react';
import styled from 'styled-components';
import {Highlight} from 'prism-react-renderer';
import {usePrismTheme} from '@docusaurus/theme-common';

// Tab label for each code fence language, in the same order as the homepage
// Quickstart. Write the snippets in markdown as fenced code blocks inside
// <CodeTabs>; any of them may be left out. Mark a snippet that needs an
// unreleased version of its library with ```sql unreleased: its tab is
// starred, with a "Not yet available" tooltip
const ENVIRONMENTS = [
  ['DuckDB', 'sql'],
  ['Python', 'python'],
  ['R', 'r'],
  ['JavaScript', 'ts'],
  ['Rust', 'rust']
];
const ALIASES = {js: 'ts', javascript: 'ts', typescript: 'ts', py: 'python', rs: 'rust'};

// The chosen environment is shared by every <CodeTabs> on the site, and
// remembered between visits
const STORAGE_KEY = 'a5-code-tabs';
const listeners = new Set();
let selected = null;

function getSelected() {
  if (selected === null) {
    try {
      selected = localStorage.getItem(STORAGE_KEY) ?? ENVIRONMENTS[0][0];
    } catch {
      selected = ENVIRONMENTS[0][0];
    }
  }
  return selected;
}

function setSelected(name) {
  selected = name;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Private browsing: the choice lasts until the page is closed
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  // Follow choices made in other browser tabs
  const onStorage = event => {
    if (event.key === STORAGE_KEY && event.newValue) {
      selected = event.newValue;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// MDX renders each fenced code block as <pre><code className="language-x">,
// with the text after the language as the metastring
function getSnippets(children) {
  const snippets = {};
  Children.forEach(children, child => {
    const code = child?.props?.children?.props;
    const language = code?.className?.match(/language-(\w+)/)?.[1];
    if (language) {
      const meta = child.props.metastring ?? code.metastring ?? '';
      snippets[ALIASES[language] ?? language] = {
        code: String(code.children).replace(/\n$/, ''),
        unreleased: meta.split(' ').includes('unreleased')
      };
    }
  });
  return ENVIRONMENTS.map(([name, language]) => ({name, language, ...snippets[language]}));
}

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;

  button {
    padding: 0.25rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: var(--ifm-color-emphasis-700);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  button[aria-selected='true'],
  button.copy {
    border-color: var(--ifm-color-emphasis-300);
    background: var(--ifm-color-emphasis-100);
    color: var(--ifm-color-emphasis-900);
  }
  button.copy {
    margin-left: auto;
  }
`;

const Code = styled.pre`
  font-size: var(--ifm-code-font-size);
  line-height: var(--ifm-pre-line-height);
`;

const Missing = styled.div`
  padding: var(--ifm-pre-padding);
  border-radius: var(--ifm-pre-border-radius);
  background: var(--ifm-color-emphasis-100);
  color: var(--ifm-color-emphasis-700);
  font-size: 0.9rem;
`;

export default function CodeTabs({children}) {
  const snippets = getSnippets(children);
  const name = useSyncExternalStore(subscribe, getSelected, () => ENVIRONMENTS[0][0]);
  const [copied, setCopied] = useState(false);
  const theme = usePrismTheme();
  // Every tab is shown, even without a snippet, so the choice stays put
  // across the page
  const snippet = snippets.find(s => s.name === name) ?? snippets[0];

  const copy = async () => {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="margin-bottom--lg">
      <Tabs role="tablist">
        {snippets.map(s => (
          <button
            key={s.name}
            role="tab"
            aria-selected={s === snippet}
            title={s.unreleased ? 'Not yet available' : undefined}
            onClick={() => setSelected(s.name)}
          >
            {s.unreleased ? `${s.name}*` : s.name}
          </button>
        ))}
        {snippet.code !== undefined && (
          <button className="copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </Tabs>
      {snippet.code === undefined ? (
        <Missing>Not yet available in {snippet.name}</Missing>
      ) : (
        <Highlight theme={theme} code={snippet.code} language={snippet.language}>
          {({className, style, tokens, getLineProps, getTokenProps}) => (
            <Code className={className} style={style}>
              <code>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({line})}>
                    {line.map((token, j) => (
                      <span key={j} {...getTokenProps({token})} />
                    ))}
                  </div>
                ))}
              </code>
            </Code>
          )}
        </Highlight>
      )}
    </div>
  );
}
