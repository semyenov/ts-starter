// import { mkdtemp } from 'node:fs/promises'

import { launch } from 'puppeteer'
import { createClient } from 'redis'
import { Pool } from 'lightning-pool'
import { LogLevels, createConsola } from 'consola'

import type { ConsoleMessage, HTTPResponse, Page } from 'puppeteer'

export interface PageParams extends Record<string, any> {
  selector: string
  regexp: string
}
export interface PageData extends Record<string, any> {
  urls: string[]
}

export interface ResourceData {
  ok: boolean
  url: string
  status: number
  contentType: string | null
  data: string
}

// const dataPath = await mkdtemp('.scraper-')

// Redis
export const publisher = createClient()
export const subscriber = publisher.duplicate()

await publisher.connect()
await subscriber.connect()

/* Puppeteer dependencies
sudo apt install ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils */
export const browser = await launch({
  headless: 'new',
  // headless: false,
  // devtools: true,
  // args: [
  //   '--no-sandbox',
  //   '--disable-gpu',
  //   '--disable-setuid-sandbox',
  //   '--disable-background-timer-throttling',
  //   '--disable-backgrounding-occluded-windows',
  //   '--disable-renderer-backgrounding',
  // ],
})

const logger = createConsola({
  level: LogLevels.info,
  defaults: { tag: 'Scrapper' },
})

logger.wrapAll()

export class PageWrapper {
  public history: Set<string>
  public page: Page

  constructor(page: Page) {
    this.history = new Set()

    this.page = page
    page.on('pageerror', logger.error)
    page.on('error', logger.error)
    page.on('console', consoleHandler)
  }

  close() {
    const page = this.page
    page.off('pageerror', logger.error)
    page.off('error', logger.error)
    page.off('console', consoleHandler)

    return page.close()
  }

  reload() {
    return this.close()
      .then(browser.newPage)
      .then((page) => {
        this.page = page

        this.page.on('pageerror', logger.error)
        this.page.on('error', logger.error)
        this.page.on('console', consoleHandler)
      })
  }

  evaluate(
    url: string,
    params: PageParams,
    pageFunction: (params: PageParams) => PageData | null,
  ) {
    return this.page.goto(url, {
      timeout: 0,
      waitUntil: 'domcontentloaded',
    })
      .then((response) => {
        return this.page.evaluate(
          pageFunction,
          params,
        )
          .then((data) => {
            if (response && data) {
              responseToResourceData(response)
                .then((resource) => {
                  publish(resource, data)
                })
            }

            return data
          })
      })
  }
}

function publish(resource: ResourceData, data: PageData) {
  if (data.urls.length > 0) {
    return publisher.sRem('queue', resource.url)
      .then(() => publisher.sAdd('queue', data.urls))
      .then(() => publisher.sAdd(`resource:${btoa(resource.url)}`, JSON.stringify(resource)))
  }
}

// .then(() => {
//   const url = new URL(resource.url)
//   const path = join(dataPath, decodeURI(url.pathname))

//   mkdir(path, { recursive: true })
//     .then(() => writeFile(join(path, 'index.html'),
//       resource.data,
//       { flag: 'w+' },
//     ))

//   return data
// })

function responseToResourceData(res: HTTPResponse) {
  const headers = res.headers()
  const matchArr = headers['content-type']
    && headers['content-type'].match(/^[^;]+/)

  return res.buffer()
    .then(buffer => ({
      ok: res.ok(),
      url: res.url(),
      status: res.status(),
      contentType: matchArr ? matchArr[0] : null,
      data: buffer.toString('utf-8'),
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
    return new PageWrapper(page)
  },
  async destroy(resource) {
    logger.debug('pool:destroy')
    await resource.close()
  },
},
{
  max: 120, // maximum size of the pool
  min: 100, // minimum size of the pool
  minIdle: 10, // minimum idle resources
  maxQueue: 1000,
})

export function scrape(url: string) {
  return resourcePool.acquire()
    .then((page) => {
      logger.debug('Evaluate', url)
      return page.evaluate(
        url,
        {
          selector: 'a',
          regexp: '^https:\/\/ru.wikipedia.org\/wiki*\.html',
        },
        ({ selector, regexp }) => {
          const urls: string[] = []

          const r = new RegExp(regexp, 's')
          document
            .querySelectorAll<HTMLLinkElement>(selector)
            .forEach((el, _key) => {
              if (r.test(el.href))
                urls.push(el.href)
            })

          return { urls }
        },
      )
        .catch(logger.error)
        .finally(() => {
          resourcePool.release(page)
          logger.success(decodeURIComponent(url))
        })
    })
}

while (await subscriber.sCard('queue') > 0) {
  const data = await subscriber.sScan('queue', -10)
  await Promise.all(data.members.map(scrape))
}

// function delay(ms: number) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }
