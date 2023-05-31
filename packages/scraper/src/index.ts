import { disconnect } from 'node:process'

import { Pool } from 'lightning-pool'

import * as store from '~/store'
import type { Config, Resource, Selector } from '~/types'
import config from '~/config.json' assert {type: 'json'}

import { logger } from './logger'
import { browser } from './browser'

import type { ConsoleMessage, HTTPResponse, Page } from 'puppeteer'

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

    // reload() {
    //   return this.close()
    //     .then(browser.newPage)
    //     .then((page) => {
    //       page.on('pageerror', logger.error)
    //       page.on('error', logger.error)
    //       page.on('console', consoleHandler)
    //     })
    // },

    evaluate(
      url: string,
      selectors: Selector[],
      pageFunction: (selectors: Selector[], resource: Resource) => Resource,
    ) {
      return page.goto(url, {
        timeout: 0,
        waitUntil: 'domcontentloaded',
      })
        .then(responseToResource)
        .then((resource) => {
          return page.evaluate(
            pageFunction,
            selectors,
            resource,
          )
        })
        .then((resource) => {
          logger.debug('resource', resource)
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
    .then(buffer => ({
      ok: response.ok(),
      url: response.url(),
      status: response.status(),
      contentType: matchArr ? matchArr[0] : null,
      buffer,

      links: [],
      data: [],
    }))
}

// function getRedirectResponse(req: HTTPRequest) {
//   const redirectChain = req.redirectChain()
//   if (redirectChain.length > 0) {
//     const next = redirectChain[0].response()
//     if (next)
//       return next
//   }

//   return null
// }

function consoleHandler(msg: ConsoleMessage) {
  for (const msgArg of msg.args())
    logger.debug('DOM console', msgArg.toString())
}

export const resourcePool = new Pool({
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

export function scrape(link: string) {
  return resourcePool.acquire()
    .then((page) => {
      logger.debug('Evaluate', link)
      return page.evaluate(
        link,
        config.selectors as Selector[],
        (selectors, resource) => {
          const encodeLink = (parent: string, uri: string) => [parent, uri].join(' ')
          const decodeLink = (link: string) => link.includes(' ') ? link.split(' ', 2) : ['', link]

          const fetchData = (
            el: HTMLElement,
            p: string,
            d: typeof resource['data'],
          ) => {
            selectors
              .filter(s => s.parentSelectors.includes(p))
              .forEach((s) => {
                el
                  .querySelectorAll<HTMLLinkElement>(s.selector)
                  .forEach((e, i) => {
                    switch (s.type) {
                      case 'SelectorLink':
                        resource.links.push(encodeLink(p, e.href))
                        d[i][s.id] = {
                          text: el.innerText,
                          href: e.href,
                        }
                        break
                      case 'SelectorText':
                        d[i][s.id] = {
                          text: el.innerText,
                        }
                        break

                      case 'SelectorElement':
                        d[i][s.id] = []
                        fetchData(el, s.id, d[i][s.id])
                        break
                    }
                  })
              })
          }

          const [parent] = decodeLink(link)
          fetchData(document.body, parent, resource.data)

          return resource
        },
      )
        .then(() => {
          resourcePool.release(page)
          logger.success(decodeURIComponent(link))
        })
    })
}

async function start(config: Config) {
  await store.connect()

  const { startUrl } = config
  await store.setQueue(startUrl.map(url => ` ${url}`))

  do {
    const urls = await store.fetchQueue(10)
    await Promise.all(urls.map(scrape))
  } while (await store.queueExists())

  await browser.close()

  await disconnect()
}

await start(config as Config)
