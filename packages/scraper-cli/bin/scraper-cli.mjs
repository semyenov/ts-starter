#!/usr/bin/env node

import {
  readFile,
} from 'node:fs/promises'
import {
  argv,
} from 'node:process'

import {
  consola,
} from 'consola'

import {
  scrape,
} from '../dist/esm/index.mjs'

const logger = consola.create({ defaults: { tag: 'scraper-cli' } })

logger
  .prompt('Config path', {
    type: 'text',
    default: argv[2] || './config.json',
  })
  .then(configPath => readFile(configPath, 'utf8'))
  .then(configFile => JSON.parse(configFile))
  .then(config => scrape(config))
  .catch((err) => {
    logger.error(err)
    exit(1)
  })
