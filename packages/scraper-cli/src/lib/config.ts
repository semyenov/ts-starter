import defu from 'defu'

import type { Config } from '~/types'

import { pipelines } from './pipelines'

export const defaultConfig = {
  _id: 'default',

  parallel: 10,
  timeout: 500,
  pipeline: 'web-scraper',

  browser: {
    headless: 'new',
  },
  pool: {
    min: 30, // minimum size of the pool
    max: 120, // maximum size of the pool
    minIdle: 15, // minimum idle resources
    maxQueue: 1000000, // maximum queue resources
  },
} as const

export function createConfig(config: Config) {
  if (!config.startUrl.length)
    throw new Error('No start URLs provided')

  if (!config.selectors.length)
    throw new Error('No selectors provided')

  if (!pipelines[config.pipeline])
    throw new Error(`Unknown pipeline: ${config.pipeline}`)

  return defu<Config, Partial<Config>[]>(
    config,
    defaultConfig,
  )
}
