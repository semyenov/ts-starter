#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { argv } from 'node:process'

import { consola } from 'consola'

import { createScraper } from '../dist/esm/index.mjs'

const logger = consola.create({ defaults: { tag: 'scraper-cli' } })

async function run() {
  let configPath = argv[3]

  if (!configPath) {
    configPath = await logger.prompt('Config path', {
      type: 'text',
      default: './config.json',
    })
  }
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const scraper = createScraper(config)
  logger.start(`Scraping ${config._id} project`)
  await scraper.run()
  logger.success('done')
}

run()
