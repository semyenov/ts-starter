import { Pool } from 'lightning-pool'

import { BrowserPage } from './page'
import { browser } from './browser'

import type { PoolFactory } from 'lightning-pool'

export * from './browser'
export * from './storage'

const factory: PoolFactory<BrowserPage> = {
  async create(_opts) {
    const page = await browser.newPage()
    return new BrowserPage(page)
  },
  async destroy(resource) {
    await resource.close()
  },
  async reset(resource) {
    await resource.reset()
  },
  validate(resource) {
    if (!resource.ready)
      throw new Error('resource is busy')
  },
}

export const pool = new Pool(factory, {
  maxQueue: 1000000,
  acquireTimeoutMillis: -1,
  idleTimeoutMillis: 10000,
  validation: true,
  max: 100, // maximum size of the pool
  min: 40, // minimum size of the pool
  minIdle: 15, // minimum idle resources
})
