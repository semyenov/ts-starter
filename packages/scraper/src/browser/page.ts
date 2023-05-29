import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { browser } from './browser'
import { publisher } from './storage'

import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page, WaitForOptions } from 'puppeteer'

export interface PluginOptions extends Record<string, any> {
  selector: string
}

const dataPath = await mkdtemp('.scraper-')

export interface ResourceData {
  ok: boolean
  url: string
  status: number
  contentType: string | null
  data: string
}

export interface PageData extends Record<string, any> {
  urls?: string[]
}

export interface EvaluateOptions {
  gotoOpts: WaitForOptions
  pageFunction: (params: PluginOptions) => PageData
  pageOpts: PluginOptions
}

export class BrowserPage {
  public page: Page
  public ready = true

  constructor(page: Page) {
    this.page = page
    this.ready = true
  }

  async reset() {
    this.page = await browser.newPage()
    this.ready = true
  }

  consoleHandler(msg: ConsoleMessage) {
    const msgArgs = msg.args()
    for (const msgArg of msgArgs)
      console.debug(`DOM console: ${msgArg.toString()}`)
  }

  async evaluate(
    url: string,
    opts: EvaluateOptions,
  ) {
    this.ready = false
    // console.debug(url)

    return new Promise<PageData | undefined>((resolve, reject) => {
      const page = this.page

      page.on('pageerror', reject)
      page.on('error', reject)
      // page.on('console', consoleHandler)

      const { gotoOpts } = opts

      return page.goto(url, gotoOpts)
        .then(this.resToJSON)
        .then((resource) => {
          const { pageFunction, pageOpts } = opts
          return page.evaluate(
            pageFunction,
            pageOpts,
          )
            .then(data => this.publish(resource, data))
            .then(resolve)
            .catch(reject)
        })
        .catch(reject)
        .finally(() => {
          page.off('pageerror', reject)
          page.off('error', reject)
          // page.off('console', consoleHandler)

          this.ready = true
        })
    })
  }

  async getRedirectResponse(req: HTTPRequest): Promise<HTTPResponse | null> {
    const redirectChain = req.redirectChain()
    return redirectChain.length > 0
      ? redirectChain[0].response()
      : null
  }

  close() {
    this.ready = true
    return this.page.close()
  }

  async publish(resource?: ResourceData, data?: PageData) {
    if (resource) {
      await publisher.sAdd('queue', data?.urls || []).then(() => {
        const url = new URL(resource.url)
        const path = join(dataPath, decodeURI(url.pathname))

        console.log('New file -', path)
        mkdir(path, { recursive: true })
          .then(
            () => writeFile(join(path, 'index.html'),
              resource?.data || '',
              { flag: 'w+' },
            ),
          )
      })
    }

    return data
  }

  async resToJSON(res: HTTPResponse | null) {
    if (!res)
      return

    const headers = res.headers()
    const matchArr = headers['content-type'] && headers['content-type'].match(/^[^;]+/)

    const buffer = await res.buffer()

    return {
      ok: res.ok(),
      url: res.url(),
      status: res.status(),
      contentType: matchArr ? matchArr[0] : null,
      data: buffer.toString('utf-8'),
    }
  }
}
