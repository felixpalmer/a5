// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Runs the example snippets inside <CodeTabs> in /docs, in each language:
 *
 *   ts      against the built library (dist/a5.js) — run `yarn build` first
 *   python  against the a5-py checkout (A5_PY_PATH, default ../a5-py)
 *   rust    against the a5-rs checkout (A5_RS_PATH, default ../a5-rs)
 *   sql     with the DuckDB CLI (DUCKDB, default duckdb) and the community a5 extension
 *   r       with Rscript (RSCRIPT, default Rscript) and the installed a5R package
 *
 * Usage: node scripts/verify-snippets.cjs [ts|python|rust|sql|r ...]
 *
 * With no arguments every language is run, skipping any whose toolchain is
 * missing. A language named on the command line must be runnable.
 *
 * Signature blocks (those whose ts snippet starts with `function `) are not
 * runnable and are skipped. A snippet may use the placeholder geometries
 * defined in PRELUDES (`ring`, `mainland`, ...) without declaring them.
 *
 * A snippet marked ```sql unreleased needs a version of its library that is
 * not yet released, so it is expected to fail. One that passes is reported,
 * as its marker can be removed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const LANGUAGES = ['ts', 'python', 'rust', 'sql', 'r'];

const A5_PY_PATH = path.resolve(ROOT, process.env.A5_PY_PATH || '../a5-py');
const A5_RS_PATH = path.resolve(ROOT, process.env.A5_RS_PATH || '../a5-rs');
const DUCKDB = process.env.DUCKDB || 'duckdb';
const RSCRIPT = process.env.RSCRIPT || 'Rscript';

// Placeholder polygons and points the docs examples leave undefined
const RING = [
  [2.25, 48.81],
  [2.42, 48.81],
  [2.42, 48.9],
  [2.25, 48.9]
];
const ISLAND = RING.map(([lon, lat]) => [lon + 1, lat]);
const CAPITAL = [2.35, 48.85];

const PRELUDES = {
  ts: [
    `const ring = ${JSON.stringify(RING)};`,
    `const mainland = ring;`,
    `const franceRing = ring;`,
    `const island = ${JSON.stringify(ISLAND)};`,
    `const capital = ${JSON.stringify(CAPITAL)};`
  ].join('\n'),
  python: [
    `ring = ${pyRing(RING)}`,
    `mainland = ring`,
    `france_ring = ring`,
    `island = ${pyRing(ISLAND)}`,
    `capital = (${CAPITAL.join(', ')})`
  ].join('\n'),
  rust: [
    `let ring = ${rsRing(RING)};`,
    `let mainland = ring.clone();`,
    `let france_ring = ring.clone();`,
    `let island = ${rsRing(ISLAND)};`,
    `let capital = LonLat::new(${CAPITAL.join(', ')});`
  ].join('\n'),
  // Tables the SQL examples select from
  sql: [
    `CREATE TABLE parts AS SELECT ${wkt(RING)}::GEOMETRY AS mainland, ${wkt(ISLAND)}::GEOMETRY AS island;`,
    `CREATE TABLE countries AS SELECT 'France' AS name, ${wkt(RING)}::GEOMETRY AS geom,`,
    `  ${CAPITAL[0]} AS capital_lon, ${CAPITAL[1]} AS capital_lat;`
  ].join('\n'),
  r: [
    `country <- wk::wkt(${wkt(RING)})`,
    `mainland <- country`,
    `france_polygon <- country`,
    `island <- wk::wkt(${wkt(ISLAND)})`,
    `capital_lon <- ${CAPITAL[0]}`,
    `capital_lat <- ${CAPITAL[1]}`
  ].join('\n')
};

function pyRing(ring) {
  return `[${ring.map(([lon, lat]) => `(${lon}, ${lat})`).join(', ')}]`;
}

function rsRing(ring) {
  return `vec![${ring.map(([lon, lat]) => `LonLat::new(${lon}, ${lat})`).join(', ')}]`;
}

// Quoted WKT polygon, closed
function wkt(ring) {
  return `'POLYGON((${[...ring, ring[0]].map(([lon, lat]) => `${lon} ${lat}`).join(', ')}))'`;
}

// Docs files, recursively
function findDocs(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findDocs(file));
    } else if (/\.mdx?$/.test(entry.name)) {
      files.push(file);
    }
  }
  return files;
}

// Runnable snippets, as {language, name, code, unreleased}
function extractSnippets() {
  const snippets = [];
  for (const file of findDocs(DOCS)) {
    const text = fs.readFileSync(file, 'utf8');
    const blocks = text.matchAll(/<CodeTabs>([\s\S]*?)<\/CodeTabs>/g);
    for (const block of blocks) {
      const fences = {};
      for (const [, language, meta, code] of block[1].matchAll(/```(\w+)([^\n]*)\n([\s\S]*?)```/g)) {
        fences[language] = {code, unreleased: meta.split(' ').includes('unreleased')};
      }
      if (fences.ts?.code.startsWith('function ')) {
        continue;
      }
      // Name the snippet after the closest heading above it
      const headings = [...text.slice(0, block.index).matchAll(/^#+ (.*)$/gm)];
      const heading = headings.length ? headings[headings.length - 1][1] : '';
      const line = text.slice(0, block.index).split('\n').length;
      const name = `${path.relative(ROOT, file)}:${line} (${heading})`;
      for (const [language, fence] of Object.entries(fences)) {
        snippets.push({language, name, ...fence});
      }
    }
  }
  return snippets;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options});
  return {ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`};
}

function hasCommand(command) {
  return !spawnSync(command, ['--version'], {encoding: 'utf8'}).error;
}

function tempDir(name) {
  const dir = path.join(os.tmpdir(), 'a5-verify-snippets', name);
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

// Each runner returns null when it can run, or the reason it can't
const RUNNERS = {
  ts: {
    unavailable: () => !fs.existsSync(path.join(ROOT, 'dist/a5.js')) && 'dist/a5.js missing, run `yarn build`',
    // One module per snippet, with the body in a block so it may redeclare
    // the placeholders
    run(snippets) {
      const dir = tempDir('ts');
      const a5 = path.join(ROOT, 'dist/a5.js');
      return snippets.map((snippet, i) => {
        const lines = snippet.code.split('\n');
        const imports = lines.filter(line => line.startsWith('import '));
        const body = lines.filter(line => !line.startsWith('import '));
        const source = [
          ...imports.map(line => line.replace(/from 'a5-js'/, `from '${a5}'`)),
          PRELUDES.ts,
          '{',
          ...body,
          '}'
        ].join('\n');
        const file = path.join(dir, `snippet${i}.mts`);
        fs.writeFileSync(file, source);
        return run(process.execPath, ['--experimental-strip-types', '--no-warnings', file]);
      });
    }
  },

  python: {
    unavailable: () => !fs.existsSync(path.join(A5_PY_PATH, 'a5')) && `a5-py not found at ${A5_PY_PATH}`,
    run(snippets) {
      const dir = tempDir('python');
      const venv = path.join(A5_PY_PATH, '.venv/bin/python');
      const python = process.env.A5_PYTHON || (fs.existsSync(venv) ? venv : 'python3');
      return snippets.map((snippet, i) => {
        const file = path.join(dir, `snippet${i}.py`);
        fs.writeFileSync(file, `${PRELUDES.python}\n${snippet.code}`);
        return run(python, [file], {env: {...process.env, PYTHONPATH: A5_PY_PATH}});
      });
    }
  },

  // A single crate with a function per snippet, so the crate compiles once
  rust: {
    unavailable: () =>
      (!fs.existsSync(path.join(A5_RS_PATH, 'Cargo.toml')) && `a5-rs not found at ${A5_RS_PATH}`) ||
      (!hasCommand('cargo') && 'cargo not found'),
    run(snippets) {
      const dir = tempDir('rust');
      fs.mkdirSync(path.join(dir, 'src'), {recursive: true});
      fs.writeFileSync(
        path.join(dir, 'Cargo.toml'),
        [
          '[package]',
          'name = "a5-snippets"',
          'version = "0.0.0"',
          'edition = "2021"',
          '',
          '[dependencies]',
          `a5 = { path = ${JSON.stringify(A5_RS_PATH)} }`
        ].join('\n')
      );
      const functions = snippets.map(
        (snippet, i) => `fn snippet${i}() -> Result<(), String> {\n${PRELUDES.rust}\n${snippet.code}\nOk(())\n}`
      );
      // Run the snippet named on the command line
      const main = `fn main() {
    let result = match std::env::args().nth(1).unwrap().as_str() {
${snippets.map((_, i) => `        "${i}" => snippet${i}(),`).join('\n')}
        _ => unreachable!(),
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}`;
      const source = ['#![allow(unused)]', 'use a5::LonLat;', ...functions, main].join('\n\n');
      fs.writeFileSync(path.join(dir, 'src/main.rs'), source);

      const build = run('cargo', ['build', '--quiet'], {cwd: dir});
      if (!build.ok) {
        return snippets.map(() => ({ok: false, output: `Rust snippets failed to compile:\n${build.output}`}));
      }
      const binary = path.join(dir, 'target/debug/a5-snippets');
      return snippets.map((_, i) => run(binary, [String(i)]));
    }
  },

  sql: {
    unavailable: () => !hasCommand(DUCKDB) && `${DUCKDB} not found`,
    run(snippets) {
      const install = run(DUCKDB, ['-c', 'INSTALL a5 FROM community;']);
      if (!install.ok) {
        return snippets.map(() => install);
      }
      return snippets.map(snippet => run(DUCKDB, ['-bail'], {input: `LOAD a5;\n${PRELUDES.sql}\n${snippet.code}`}));
    }
  },

  r: {
    unavailable: () => !hasCommand(RSCRIPT) && `${RSCRIPT} not found`,
    run(snippets) {
      const dir = tempDir('r');
      return snippets.map((snippet, i) => {
        const file = path.join(dir, `snippet${i}.R`);
        fs.writeFileSync(file, `${PRELUDES.r}\n${snippet.code}`);
        return run(RSCRIPT, [file]);
      });
    }
  }
};

function main() {
  const requested = process.argv.slice(2);
  for (const language of requested) {
    if (!LANGUAGES.includes(language)) {
      console.error(`Unknown language '${language}', expected one of: ${LANGUAGES.join(', ')}`);
      process.exit(1);
    }
  }
  const languages = requested.length ? requested : LANGUAGES;
  const snippets = extractSnippets();
  let failed = 0;

  for (const language of languages) {
    const selected = snippets.filter(snippet => snippet.language === language);
    const reason = RUNNERS[language].unavailable();
    if (reason) {
      console.log(`\n${language}: ${requested.length ? 'FAILED' : 'skipped'}, ${reason}`);
      if (requested.length) {
        failed++;
      }
      continue;
    }

    console.log(`\n${language}: ${selected.length} snippets`);
    const results = RUNNERS[language].run(selected);
    for (let i = 0; i < selected.length; i++) {
      const {ok, output} = results[i];
      if (selected[i].unreleased) {
        console.log(
          ok
            ? `  ok   ${selected[i].name}, marked unreleased: remove the marker`
            : `  ok   ${selected[i].name}, fails as expected: unreleased`
        );
        continue;
      }
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${selected[i].name}`);
      if (!ok) {
        failed++;
        // The error is at the end, after any output of the statements before it
        const lines = output.trimEnd().split('\n');
        const tail = lines.length > 20 ? ['...', ...lines.slice(-20)] : lines;
        console.log(tail.map(line => `       ${line}`).join('\n'));
      }
    }
  }

  console.log(failed ? `\n${failed} failed` : '\nAll snippets ok');
  process.exit(failed ? 1 : 0);
}

main();
