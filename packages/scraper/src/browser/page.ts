import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { nanoid } from 'nanoid'

import { browser } from './browser'
import { storage } from './storage'

import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page, WaitForOptions } from 'puppeteer'

export interface PluginOptions extends Record<string, any> {
  selector: string
}

const pwd = dirname(fileURLToPath(import.meta.url))
export const dataPath = join(pwd, `.data-${nanoid()}`)
await mkdir(dataPath, { recursive: true })

export interface PluginData extends Record<string, any> {
  urls?: string[]
  res?: {
    ok: boolean
    url: string
    status: number
    contentType: string | null
    data: string
  }
}

export interface EvaluateOptions {
  gotoOpts: WaitForOptions
  pageFunction: (args: PluginOptions & PluginData) => PluginData
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

    return new Promise<PluginData>((resolve, reject) => {
      const page = this.page

      page.on('pageerror', reject)
      page.on('error', reject)
      // page.on('console', consoleHandler)

      const { gotoOpts } = opts

      return page.goto(url, gotoOpts)
        .then(this.resToJSON)
        .then((res) => {
          const { pageFunction, pageOpts: args } = opts
          return page.evaluate(
            pageFunction,
            Object.assign({
              res,
              urls: [],
            }, args))
            .then(this.save)
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

  save(data: PluginData) {
    const url = new URL(data.res!.url.replace('https://ru.wikipedia.org/wiki', 'file://'))
    storage.set(url.href, data)

    const path = join(dataPath, 'wiki', decodeURI(url.pathname))
    console.log('New url -', path)

    mkdir(path, { recursive: true }).then(
      () => writeFile(join(path, 'index.html'),
        data.res?.data || '',
        { flag: 'w+' },
      ),
    )

    return data
  }

  async resToJSON(res: HTTPResponse | null) {
    if (!res)
      return

    const headers = res.headers()
    const matchArr = headers['content-type'].match(/^[^;]+/)
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
