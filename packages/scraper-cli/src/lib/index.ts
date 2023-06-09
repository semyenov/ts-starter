import { defu } from 'defu'
import { createConsola } from 'consola'

import * as utils from './utils'
import { createStore } from './store'
import { createBrowser } from './browser'
import { createPool } from './pool'
import { pipelines } from './pipelines'

import type { RedisClientOptions } from 'redis'
import type { PoolConfiguration } from 'lightning-pool'
import type { Config, ConfigSelector, PipelineType } from '../types'
import type { PuppeteerLaunchOptions } from 'puppeteer'

const logger = createConsola({ defaults: { tag: 'scraper' } })

export function createScraper(config: Config) {
  config = defu<
    Config,
    [{
      _id: string
      parallel: number
      timeout: number
      pipeline: PipelineType

      startUrl: string[]
      selectors: ConfigSelector[]

      browser: PuppeteerLaunchOptions
      store: RedisClientOptions
      pool: PoolConfiguration
    }]
  >(
    config,
    {
      _id: 'default',
      parallel: 10,
      timeout: 500,
      pipeline: 'web-scraper',

      startUrl: [],
      selectors: [],

      browser: { headless: 'new' },
      store: {},
      pool: {
        min: 30, // minimum size of the pool
        max: 120, // maximum size of the pool
        minIdle: 15, // minimum idle resources
        maxQueue: 1000000, // maximum queue resources
      },
    },
  )

  return {
    async run() {
      const browser = await createBrowser(config.browser)
      const store = createStore(config.store)
      const pool = createPool(config.pool, browser)

      await store.connect()
      await store.setQueue(
        config.startUrl.map(url =>
          utils.encodeLink([url, '_root']),
        ),
      )

      async function evaluate(uri: string, parent: string) {
        logger.info('Evaluate', [uri, parent].join('@'))
        const page = await pool.acquire()
        const resourse = await page.evaluate(
          uri,
          parent,
          config.selectors as ConfigSelector[],
          pipelines[config.pipeline],
        ).catch(logger.error)

        if (resourse)
          await store.addResource(resourse)

        await pool.releaseAsync(page)

        return resourse
      }

      while (await store.queueExists()) {
        const links = await store.fetchQueue(config.parallel)
        await Promise.all(links.map((link) => {
          const [uri, parent] = utils.decodeLink(link)
          return evaluate(uri, parent)
        }))
        await utils.sleep(config.timeout)
      }

      await pool.closeAsync()
      await browser.close()
      await store.disconnect()
    },
  }
}
