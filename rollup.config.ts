import { defineConfig } from 'rollup'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'

// import alias from '@rollup/plugin-alias'

export default defineConfig([{
  input: ['./src/index.ts'],
  external: ['puppiter', 'pino', 'pino-pretty'],
  plugins: [
    typescript({
      noEmit: true,
    }),
    nodeResolve({
      preferBuiltins: true,
    }),
    // alias({
    //   entries: {
    //     '@get-set-fetch/scraper': '@get-set-fetch/scraper/dist/esm',
    //   },
    // }),
    commonjs({
      // transformMixedEsModules: true,
      sourceMap: true,
    }),
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
    format: 'module',
    interop: 'auto',
    sourcemap: true,
  }],
}])
