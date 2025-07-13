import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {'a5': 'modules/index.ts'},
    format: ['cjs', 'esm', 'iife'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: [/^internal/],
    noExternal: ['gl-matrix'],
    globalName: 'A5',
    target: 'es2020',
    esbuildOptions(options) {
      options.supported = {
        'bigint': true
      }
    },
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : format === 'iife' ? '.umd.js' : '.js',
      }
    }
  },
  {
    entry: {'a5-test': 'modules/test-index.ts'},
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: [/^internal/],
    noExternal: ['gl-matrix'],
    target: 'es2020',
    outDir: 'scripts',
    esbuildOptions(options) {
      options.supported = {
        'bigint': true
      }
    },
    outExtension() {
      return { js: '.cjs' }
    }
  }
]) 