import { defineConfig } from 'rollup'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import { nodeResolve } from '@rollup/plugin-node-resolve'

export default defineConfig([{
  input: ['./src/index.ts'],
  plugins: [
    nodeResolve({
      preferBuiltins: false,
    }),
    // dts(),
    alias({
      entries: {
        '@get-set-fetch/scraper': '@get-set-fetch/scraper/dist/esm',
      },
    }),
    commonjs(),
    esbuild({
      tsconfig: './tsconfig.json',
    }),
    json(),
  ],
  treeshake: {
    preset: 'smallest',
  },
  output: [{
    dir: './dist',
    format: 'es',
    preserveModules: true,
    interop: 'auto',
    esModule: true,
    sourcemap: true,
  }],
}])
