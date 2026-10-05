import {defineConfig, configDefaults} from 'vitest/config';
import path from 'path';
import BenchTableReporter from './benchmarks/reporter';

// Benchmarks run against a bundle of the library (built by `yarn bench`), as
// the published library is bundled; tests run against the source modules
const BENCH_BUNDLE = path.resolve(__dirname, 'benchmarks/.build/a5-bench.js');

export default defineConfig(({mode}) => ({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/utils/matchers.ts'],
    // .claude/ can contain checkouts of other branches (agent worktrees)
    exclude: [...configDefaults.exclude, '**/.claude/**'],
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
      reporters: [new BenchTableReporter()]
    }
  },
  resolve: {
    alias:
      mode === 'benchmark'
        ? [{find: /^a5(\/.*)?$/, replacement: BENCH_BUNDLE}]
        : {
            a5: path.resolve(__dirname, 'modules'),
            'a5/core': path.resolve(__dirname, 'modules/core'),
            'a5/traversal': path.resolve(__dirname, 'modules/traversal')
          }
  }
}));
