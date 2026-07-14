import {defineConfig, configDefaults} from 'vitest/config';
import path from 'path';
import BenchTableReporter from './benchmarks/reporter';

export default defineConfig({
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
    alias: {
      a5: path.resolve(__dirname, 'modules'),
      'a5/core': path.resolve(__dirname, 'modules/core'),
      'a5/traversal': path.resolve(__dirname, 'modules/traversal')
    }
  }
});
