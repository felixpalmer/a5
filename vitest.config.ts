import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/utils/matchers.ts']
  },
  resolve: {
    alias: {
      'a5': path.resolve(__dirname, 'modules'),
      'a5/core': path.resolve(__dirname, 'modules/core'),
      'a5/traversal': path.resolve(__dirname, 'modules/traversal')
    }
  }
}) 