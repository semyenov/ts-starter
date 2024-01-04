import { createBrowser } from './browser'
import { createConfig } from './config'
import { logger } from './logger'
import { pipelines } from './pipelines'
import { createPool } from './pool'
import { createStore } from './store'
import * as utils from './utils'

import type { Config, ResourceLink } from '../types'

export async function scrape(config: Config) {
  const {
    selectors,
    parallel,
    timeout,
    startUrl: s,
    pipeline: p,
    store: storeConfig,
    browser: browserConfig,
    pool: poolConfig,
  } = createConfig(config)

  const pipeline = pipelines[p]
  const startLinks = s.map(url =>
    [url, '$'] as ResourceLink,
  )

  const store = await createStore(storeConfig)
  await store.setQueue(startLinks)

  const browser = await createBrowser(browserConfig)
  const pagesPool = createPool(browser, poolConfig)

  while (await store.queueExists()) {
    const links = await store.fetchQueue(parallel)
    await Promise.all(links.map(async (link) => {
      const page = await pagesPool.acquire()
      try {
        const resource = await page.run(
          link,
          selectors,
          pipeline,
        )

        await store.addResource(resource)
      }
      catch (err) {
        logger.error(err)
      }
      finally {
        pagesPool.release(page)
      }
    }))

    await utils.sleep(timeout)
  }

  pagesPool.close()
  await browser.close()
  await store.disconnect()
}
