import { Pool } from 'lightning-pool'
import { createConsola } from 'consola'

import type { ConfigSelector, PipelineFunc, Resource } from '~/types'

import type { PoolConfiguration } from 'lightning-pool'
import type { Browser, ConsoleMessage, HTTPResponse, Page } from 'puppeteer'

const logger = createConsola({ defaults: { tag: 'scraper/pool' } })

export function createPool(config: PoolConfiguration, browser: Browser) {
  return new Pool({
    async create(_opts) {
      logger.debug('pool:create')
      const page = await browser.newPage()
      return wrapPage(page)
    },
    async destroy(resource) {
      logger.debug('pool:destroy')
      await resource.close()
    },
  }, config)
}

function wrapPage(page: Page) {
  const consoleHandler = (msg: ConsoleMessage) => {
    for (const msgArg of msg.args())
      logger.debug('DOM console', msgArg.toString())
  }

  page.on('pageerror', logger.error)
  page.on('error', logger.error)
  page.on('console', consoleHandler)

  return {
    close() {
      page.off('pageerror', logger.error)
      page.off('error', logger.error)
      page.off('console', consoleHandler)

      return page.close()
    },

    evaluate(
      uri: string,
      parent: string,
      selectors: ConfigSelector[],
      pageFunction: PipelineFunc,
    ) {
      return page.goto(uri, {
        waitUntil: 'domcontentloaded',
        timeout: 0,
      })
        .then(createResource)
        .then((resource) => {
          resource.parent = parent
          return page.evaluate(
            pageFunction,
            selectors,
            resource,
          )
        })
        .then((resource) => {
          logger.trace('resource.url', resource.url)
          logger.trace('resource.status', resource.status)
          logger.trace('resource.links', resource.links)
          logger.trace('resource.data', resource.data)

          return resource
        })
    },
  }
}

function createResource(response: HTTPResponse | null): Promise<Resource> {
  if (response === null)
    throw new Error('Response is null')

  const headers = response.headers()
  const matchArr = headers['content-type']
    && headers['content-type'].match(/^[^;]+/)

  return response.buffer()
    .then((buffer) => {
      return {
        ok: response.ok(),
        url: response.url(),
        status: response.status(),
        contentType: matchArr ? matchArr[0] : null,
        buffer,

        parent: '',
        links: [],
        data: [],
      }
    })
}
