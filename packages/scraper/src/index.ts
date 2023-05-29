import { pool, storage } from './browser'

export async function scrape(url: string) {
  // const ps = await browser.pages()

  // console.log({ acquired: pool.acquired, available: pool.available, pending: pool.pending, ps, l: ps.length, ready: page.ready })

  const page = await pool.acquire()
  const data = await page.evaluate(
    url,
    {
      gotoOpts: {
        timeout: 5000,
        waitUntil: 'domcontentloaded',
      },
      pageFunction(args) {
        const urls: string[] = []
        document.querySelectorAll<HTMLLinkElement>(args.selector).forEach(
          (el, _key) => urls.push(el.href),
        )

        return {
          ...args,
          urls,
        }
      },
      pageOpts: {
        selector: 'a',
      },
    },
  )
    .catch(console.error)

  pool.destroyAsync(page)

  return data
}

const visited: Set<string> = new Set()

async function start() {
  const urls = Array.from(storage.values())
    .flatMap(item => item.urls || [])
    .filter(url => url.startsWith('https://ru.wikipedia.org/wiki/'))
    .filter(url => !visited.has(url))

  for (const url of urls) {
    visited.add(url)
    await scrape(url)
  }

  await start()
}

start()

process.on('SIGINT', () => JSON.stringify(storage))
