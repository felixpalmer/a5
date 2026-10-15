// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Publishes the docs for AI coding agents, following https://llmstxt.org:
//
//   /llms.txt                   index: what A5 is, then a link to every page
//   /llms-<language>.txt        one file per language: introduction, quickstart
//                               and API reference, with only that language's
//                               <CodeTabs> snippets and function names
//   /docs/<page>.md             each docs page as Markdown, all languages
//
// The files are built from the Markdown sources rather than the rendered
// HTML, as <CodeTabs> only renders the selected language

const fs = require('fs');
const path = require('path');
const {VERSIONS, replaceVersions} = require('../a5-version');

// Same languages as website/src/components/code-tabs.jsx. `name` matches the
// first identifier of the language's signature snippet
const LANGUAGES = [
  {
    id: 'typescript',
    label: 'TypeScript / JavaScript',
    fence: 'ts',
    quickstart: 'quickstart/javascript',
    summary: 'the `a5-js` npm package. Cell IDs are `bigint`',
    name: /^function (\w+)/
  },
  {
    id: 'python',
    label: 'Python',
    fence: 'python',
    quickstart: 'quickstart/python',
    summary: 'the `pya5` PyPI package, imported as `a5`. Cell IDs are `int`',
    name: /^def (\w+)/
  },
  {
    id: 'rust',
    label: 'Rust',
    fence: 'rust',
    quickstart: 'quickstart/rust',
    summary: 'the `a5` crate. Cell IDs are `u64`, and fallible functions return `Result`',
    name: /^pub fn (\w+)/
  },
  {
    id: 'duckdb',
    label: 'DuckDB',
    fence: 'sql',
    quickstart: 'quickstart/duckdb',
    summary: 'the `a5` DuckDB community extension (`INSTALL a5 FROM community; LOAD a5;`). Cell IDs are `UBIGINT`',
    name: /^(\w+)\(/
  },
  {
    id: 'r',
    label: 'R',
    fence: 'r',
    quickstart: null,
    summary: 'the `a5R` CRAN package (docs: https://belian-earth.github.io/a5R/). Cell IDs are `a5_cell` vectors',
    name: /^(\w+)\(/
  }
];
const ALIASES = {js: 'ts', javascript: 'ts', typescript: 'ts', py: 'python', rs: 'rust'};

// Pages in each language file, after its quickstart
const INTRODUCTION = 'README';
const API_REFERENCE = 'api-reference/';

module.exports = function llmsPlugin(context, {docsDir, sidebar, summary}) {
  return {
    name: 'llms-docusaurus-plugin',
    async postBuild({outDir}) {
      const {url, baseUrl} = context.siteConfig;
      writeLlmsFiles({outDir, docsDir, sidebar, summary, siteUrl: url + baseUrl, version: VERSIONS.A5_VERSION});
    }
  };
};

function writeLlmsFiles({outDir, docsDir, sidebar, summary, siteUrl, version}) {
  const pages = loadPages(docsDir, sidebar, siteUrl);
  const names = functionNames(pages);

  for (const page of pages) {
    write(outDir, `${page.route}.md`, toMarkdown(page, null, names));
  }

  const languages = LANGUAGES.map(language => ({...language, file: `llms-${language.id}.txt`}));
  for (const language of languages) {
    write(outDir, language.file, languageFile(pages, language, names, {summary, siteUrl, version}));
  }
  write(outDir, 'llms.txt', indexFile(pages, languages, {summary, siteUrl, version}));
}

function write(outDir, file, text) {
  const target = path.join(outDir, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, text);
}

// Docs pages in sidebar order, with the sidebar category each belongs to
function loadPages(docsDir, sidebar, siteUrl) {
  const pages = [];
  for (const {label, items} of sidebar) {
    for (const id of items) {
      const source = replaceVersions(fs.readFileSync(path.join(docsDir, `${id}.md`), 'utf8'));
      const {frontMatter, body} = splitFrontMatter(source);
      // README is the category index: docs/api-reference/README.md is served at /docs/api-reference
      const route = `docs/${id}`.replace(/\/?README$/, '');
      const title = body.match(/^# (.+)$/m)?.[1] ?? frontMatter.title ?? id;
      pages.push({id, route, category: label, title, url: siteUrl + route, body, description: frontMatter.description});
    }
  }
  return pages;
}

function splitFrontMatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {frontMatter: {}, body: source};
  const frontMatter = {};
  for (const line of match[1].split('\n')) {
    const [, key, value] = line.match(/^(\w+):\s*(.*)$/) ?? [];
    if (key) frontMatter[key] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
  return {frontMatter, body: source.slice(match[0].length)};
}

// Splits a page into prose lines, plain code fences and <CodeTabs> blocks
function parse(body) {
  const blocks = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '<CodeTabs>') {
      const end = lines.indexOf('</CodeTabs>', i);
      blocks.push({type: 'tabs', snippets: parseSnippets(lines.slice(i + 1, end))});
      i = end;
    } else if (line.startsWith('```')) {
      const end = lines.findIndex((l, j) => j > i && l.startsWith('```'));
      blocks.push({type: 'code', text: lines.slice(i, end + 1).join('\n')});
      i = end;
    } else {
      blocks.push({type: 'prose', text: line});
    }
  }
  return blocks;
}

// Fenced code blocks within <CodeTabs>, keyed by fence language
function parseSnippets(lines) {
  const snippets = {};
  for (let i = 0; i < lines.length; i++) {
    const [, language, meta] = lines[i].match(/^```(\w+)\s*(.*)$/) ?? [];
    if (language) {
      const end = lines.findIndex((l, j) => j > i && l.startsWith('```'));
      snippets[ALIASES[language] ?? language] = {
        code: lines.slice(i + 1, end).join('\n'),
        unreleased: meta.split(' ').includes('unreleased')
      };
      i = end;
    }
  }
  return snippets;
}

// Maps each TypeScript function name to its name in every language, read from
// the signature snippets (those whose TypeScript starts with `function `)
function functionNames(pages) {
  const names = {};
  for (const page of pages) {
    for (const block of parse(page.body)) {
      const ts = block.type === 'tabs' && block.snippets.ts?.code.match(LANGUAGES[0].name)?.[1];
      if (ts) {
        for (const language of LANGUAGES) {
          const name = block.snippets[language.fence]?.code.match(language.name)?.[1];
          if (name) (names[language.id] ??= {})[ts] = name;
        }
      }
    }
  }
  return names;
}

// A page as Markdown: MDX removed and links made absolute. With a language,
// only its snippets are kept and functions go by its names; otherwise every
// language is listed
function toMarkdown(page, language, names) {
  const rename = (language && names[language.id]) ?? {};
  const out = [];
  for (const block of parse(page.body)) {
    if (block.type === 'code') {
      out.push(block.text);
    } else if (block.type === 'tabs') {
      out.push(language ? snippetFor(block.snippets, language) : allSnippets(block.snippets));
    } else if (!isMdx(block.text)) {
      out.push(renameFunctions(absoluteLinks(block.text, page), rename));
    }
  }
  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function snippetFor(snippets, language) {
  const snippet = snippets[language.fence];
  if (!snippet) return `_Not available in ${language.label}._`;
  const fence = `\`\`\`${language.fence}\n${snippet.code}\n\`\`\``;
  return snippet.unreleased ? `_Not yet in a released version for ${language.label}._\n\n${fence}` : fence;
}

function allSnippets(snippets) {
  return LANGUAGES.filter(language => snippets[language.fence])
    .map(language => {
      const {code, unreleased} = snippets[language.fence];
      const note = unreleased ? ' (not yet released)' : '';
      return `${language.label}${note}:\n\n\`\`\`${language.fence}\n${code}\n\`\`\``;
    })
    .join('\n\n');
}

// MDX the Markdown can't carry: imports, and JSX such as images and demos
function isMdx(line) {
  return /^(import|export) /.test(line) || /^\s*<\/?(div|img|[A-Z]\w*)\b/.test(line);
}

// Links resolve as on the website, where `./x.md` is relative to the source
// file and `./x` to the page URL. Docs links point at the Markdown pages
function absoluteLinks(text, page) {
  return text.replace(/\]\(([^)\s]+)\)/g, (match, href) => {
    // pathname:// links address static files, such as /llms.txt
    href = href.replace(/^pathname:\/\//, '');
    if (/^(\w+:|#)/.test(href)) return match;
    const [target, hash = ''] = href.split('#');
    const siteUrl = page.url.slice(0, -page.route.length);
    const resolved = target.endsWith('.md')
      ? new URL(path.posix.join('docs', path.posix.dirname(page.id), target.replace(/(\/README)?\.md$/, '')), siteUrl)
      : target.startsWith('/')
        ? new URL(`.${target}`, siteUrl)
        : new URL(target, page.url);
    const url = resolved.href.replace(/\/$/, '');
    const isDoc = /\/docs(\/|$)/.test(resolved.pathname);
    return `](${isDoc ? `${url}.md` : url}${hash ? `#${hash}` : ''})`;
  });
}

// Renames `camelCase` code spans, [camelCase](...) links and ### headings to
// the language's names
function renameFunctions(text, rename) {
  return text
    .replace(/`(\w+)`/g, (match, name) => (rename[name] ? `\`${rename[name]}\`` : match))
    .replace(/\[(\w+)\]\(/g, (match, name) => (rename[name] ? `[${rename[name]}](` : match))
    .replace(/^(###\s+)(\w+)$/, (match, hashes, name) => (rename[name] ? hashes + rename[name] : match));
}

function languageFile(pages, language, names, {summary, siteUrl, version}) {
  const ids = [INTRODUCTION, language.quickstart];
  const selected = pages.filter(page => ids.includes(page.id) || page.id.startsWith(API_REFERENCE));
  const header = [
    `# A5 for ${language.label}`,
    `> ${summary}`,
    `This is the A5 ${version} documentation for ${language.summary}. Code samples are in ${language.label} only, and function headings use the ${language.label} names. Parameter names and types in the descriptions follow the TypeScript API: \`bigint\` is a cell ID, and \`camelCase\` parameters are \`snake_case\` in Python, Rust, DuckDB and R. Documentation for other languages is listed at ${siteUrl}llms.txt.`
  ].join('\n\n');
  const sections = selected.map(page => `---\n\nSource: ${page.url}\n\n${toMarkdown(page, language, names)}`);
  return `${[header, ...sections].join('\n\n')}`;
}

function indexFile(pages, languages, {summary, siteUrl, version}) {
  const lines = [
    '# A5',
    '',
    `> ${summary}`,
    '',
    `Documentation for A5 ${version}. The API is the same in every language, with names in each language's style: \`lonLatToCell\` in TypeScript, \`lonlat_to_cell\` in Python and Rust, \`a5_lonlat_to_cell\` in DuckDB and R. Read the file for the language you are using: it holds the introduction, quickstart and full API reference, with code samples in that language only.`,
    '',
    '## Docs by language',
    '',
    ...languages.map(language => `- [${language.label}](${siteUrl}${language.file}): ${language.summary}`)
  ];
  let category = null;
  for (const page of pages) {
    if (page.category !== category) {
      category = page.category;
      lines.push('', `## ${category}`, '');
    }
    const description = page.description ?? firstSentence(page.body);
    lines.push(`- [${page.title}](${page.url}.md)${description ? `: ${description}` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

// First sentence of the first paragraph, for pages without a description
function firstSentence(body) {
  const paragraph = parse(body).find(
    block => block.type === 'prose' && /^[A-Za-z*_`[]/.test(block.text) && !isMdx(block.text)
  );
  return paragraph?.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').match(/^.*?[.!?](?=\s|$)/)?.[0];
}

module.exports.writeLlmsFiles = writeLlmsFiles;
