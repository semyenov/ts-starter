import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {
  nodeResolve,
} from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import {
  defineConfig,
} from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

// import alias from '@rollup/plugin-alias'

export default defineConfig([
  {
    input: ['./src/index.ts'],
    external: ['puppiter', 'pino', 'pino-pretty'],
    plugins: [
      typescript({
        noEmit: true,
      }),
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs({
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
    output: [
      {
        dir: './dist',
        format: 'module',
        interop: 'auto',
        sourcemap: true,
      },
    ],
  },
])
