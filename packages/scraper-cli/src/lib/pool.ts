import {
  Pool,
} from 'lightning-pool'

import type {
  ConfigSelector,
  PipelineFunc,
  Resource,
  ResourceLink,
} from '~/types'

import {
  logger,
} from './logger'

import type {
  PoolConfiguration,
} from 'lightning-pool'
import type {
  Browser,
  ConsoleMessage,
  HTTPResponse,
  Page,
} from 'puppeteer'

export function createPool(
  browser: Browser,
  config: PoolConfiguration,
) {
  return new Pool({
    create: async () => {
      logger.info('Creating new page...')
      const page = await browser.newPage()
      return wrapPage(page)
    },
    destroy: async (resource) => {
      logger.info('Destroying page...')
      await resource.close()
    },
  }, config)
}

function wrapPage(page: Page) {
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

    async run(
      [uri, parent]: ResourceLink,
      selectors: ConfigSelector[],
      pageFunction: PipelineFunc,
    ) {
      logger.info(`Requesting ${uri}`)
      const response = await page.goto(uri, {
        waitUntil: 'domcontentloaded',
        timeout: 0,
      })

      if (!response)
        throw new Error(`Failed to request ${uri}`)

      logger.info(`Fetched ${uri} with status (${response.status()})`)
      const resource = await responseToResource(
        response,
        parent,
      )

      return page.evaluate(
        pageFunction,
        selectors,
        resource,
      )
    },
  }
}

async function responseToResource(
  response: HTTPResponse,
  parent: string,
): Promise<Resource> {
  const headers = response.headers()
  const matchArr = headers['content-type']
    && headers['content-type'].match(/^[^;]+/)

  return {
    ok: response.ok(),
    url: response.url(),
    status: response.status(),

    contentType: matchArr
      ? matchArr[0]
      : null,
    buffer: await response.buffer(),

    parent,
    links: [],
    data: [],
  }
}

function consoleHandler(
  msg: ConsoleMessage,
) {
  for (const arg of msg.args())
    logger.debug('DOM console', arg.toString())
}
