import { Pool } from 'lightning-pool'

import * as store from './store'
import * as utils from './utils'
import { logger } from './logger'
import { createBrowser } from './browser'
import config from './config.json' assert {type: 'json'}

import type { Config, Resource, Selector } from './types'
import type { ConsoleMessage, HTTPResponse, Page } from 'puppeteer'

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
      selectors: Selector[],
      pageFunction: (selectors: Selector[], resource: Resource) => Resource,
    ) {
      return page.goto(uri, {
        waitUntil: 'domcontentloaded',
        timeout: 0,
      })
        .then(responseToResource)
        .then((resource) => {
          resource.parent = parent
          return page.evaluate(
            pageFunction,
            selectors,
            resource,
          )
        })
        .then((resource) => {
          logger.trace('resource.status', resource.status)
          logger.trace('resource.url', resource.url)
          logger.trace('resource.links', resource.links)
          logger.trace('resource.data', resource.data)

          return resource
        })
        .then(store.addResource)
    },
  }
}

function responseToResource(response: HTTPResponse | null): Promise<Resource> {
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
        // buffer,

        parent: '',
        links: [],
        data: [],
      }
    })
}

async function start(config: Config) {
  await store.connect()
  const browser = await createBrowser()

  const resourcePool = new Pool({
    async create(_opts) {
      logger.debug('pool:create')
      const page = await browser.newPage()
      return wrapPage(page)
    },
    async destroy(resource) {
      logger.debug('pool:destroy')
      await resource.close()
    },
  },
  {
    max: 120, // maximum size of the pool
    min: 10, // minimum size of the pool
    minIdle: 2, // minimum idle resources
    maxQueue: 1000000,
  })

  function scrape(uri: string, parent: string) {
    return resourcePool.acquire()
      .then((page) => {
        return page.evaluate(
          uri,
          parent,
          config.selectors as Selector[],
          (selectors, resource) => {
            const run = (
              el: HTMLElement,
              p: string,
              d: Array<Record<string, any>>,
            ) => {
              selectors
                .filter(s => s.parentSelectors.includes(p))
                .forEach((s) => {
                  el
                    .querySelectorAll<HTMLLinkElement>(s.selector)
                    .forEach((e, i) => {
                      if (typeof d[i] === 'undefined')
                        d[i] = Object.create(null)

                      switch (s.type) {
                        case 'SelectorLink':
                          resource.links.push([e.href, s.id])

                          d[i][s.id] = e.innerText
                          break
                        case 'SelectorText':
                          d[i][s.id] = e.innerText
                          break
                        case 'SelectorElement':
                          d[i][s.id] = []
                          // run(e, s.id, d[i][s.id])
                          break
                      }
                    })
                })
            }

            run(document.body, resource.parent, resource.data)
            return resource
          },
        )
          .catch(logger.error)
          .then(() => {
            resourcePool.release(page)
            logger.success('Evaluate', [uri, parent].join('@'))
          })
      })
  }

  const { startUrl } = config
  await store.setQueue(startUrl.map(url => utils.encodeLink([url, '_root'])))

  do {
    const links = await store.fetchQueue(10)
    await Promise.all(links.map((link) => {
      const [uri, parent] = utils.decodeLink(link)
      return scrape(uri, parent)
    }))
  } while (await store.queueExists())

  await browser.close()
  await store.disconnect()

  process.exit(0)
}

start(config as Config)
