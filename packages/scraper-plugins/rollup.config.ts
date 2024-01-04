// import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import esbuild from 'rollup-plugin-esbuild'
import resolve from '@rollup/plugin-node-resolve'
import postcss from 'rollup-plugin-postcss'
import dts from 'rollup-plugin-dts'
import { defineConfig } from 'rollup'

import pkg from './package.json' assert { type: 'json' }

const inputFileName = 'src/index.ts'
const moduleName = pkg.name.replace(/^@.*\//, '')
const author = pkg.author
const banner = `/**
  * @license
  * author: ${author}
  * ${moduleName} v${pkg.version}
  * Released under the ${pkg.license} license.
  */`

export default defineConfig([
  {
    input: inputFileName,
    external: Object.keys(pkg.peerDependencies),
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
        banner,
      },
      {
        file: pkg.module,
        format: 'esm',
        sourcemap: true,
        banner,
      },
    ],
    plugins: [
      json(),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      esbuild({
        tsconfig: './tsconfig.build.json',
        minify: true,
        optimizeDeps: {
          include: Object.keys(pkg.peerDependencies),
          exclude: [
            'jsdom',
            'playwright-core',
            'better-sqlite3',
            'pg',
            'mysql2',
            'fsevents',
            'mysql',
            'pg-query-stream',
            'tedious',
            'oracledb',
            'mock-aws-s3',
            'aws-sdk',
            'nock',
            'uuid',
          ],
          esbuildOptions: {
            platform: 'node',
            mainFields: ['module', 'main'],
            tsconfig: './tsconfig.build.json',
          },
        },
      }),
      // typescript({
      //   tsconfig: './tsconfig.build.json',
      // }),
      postcss(),
    ],
  },
  {
    input: inputFileName,
    external: [/\.css$/],
    output: [
      {
        file: pkg.types,
        format: 'esm',
      },
    ],
    plugins: [dts()],
  },
])
