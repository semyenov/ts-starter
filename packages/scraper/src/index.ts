import { pool, subscriber } from './browser'

const visited: Set<string> = new Set()

export function scrape(url: string) {
  return pool.acquire().then((page) => {
    return page.evaluate(
      url,
      {
        gotoOpts: {
          timeout: 50000,
          waitUntil: 'domcontentloaded',
        },
        pageFunction(args) {
          const urls: string[] = []
          document.querySelectorAll<HTMLLinkElement>(args.selector).forEach(
            (el, _key) => el.href.startsWith('https://ru.wikipedia.org') && urls.push(el.href),
          )

          return {
            urls,
          }
        },
        pageOpts: {
          selector: 'a',
        },
      },
    )
      .catch(console.error)
      .finally(() => pool.destroyAsync(page))
  })
}

await scrape('https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0')

for await (const url of subscriber.sScanIterator('queue')) {
  if (!visited.has(url)) {
    visited.add(url)
    scrape(url)
  }
}

// function delay(ms: number) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }
