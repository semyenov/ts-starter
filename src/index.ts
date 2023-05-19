import { openSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ConnectionManager, CsvExporter, PluginStore, PuppeteerClient, ScrapeEvent, Scraper, ZipExporter, setLogger } from '@get-set-fetch/scraper'
import { knex } from 'knex'
import { destination } from 'pino'

const pwd = dirname(fileURLToPath(import.meta.url))
const logPath = join(pwd, process.env.LOG_FILENAME ?? 'scraping.log')
const dbPath = join(pwd, process.env.DB_FILENAME ?? 'test.sqlite')

setLogger({ level: 'info' }, destination({
  dest: logPath,
  fd: openSync(logPath, 'a+'),
}))

const client = new PuppeteerClient({
  headless: 'new',
  executablePath: '/usr/bin/chromium',
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-sandbox',
    '--no-zygote',
  ],
})

const conn = new ConnectionManager(knex({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    // filename: ':memory:'
    filename: dbPath,
  },
}))

await PluginStore.init()
await PluginStore.add('./plugins/readability.js')

const scraper = new Scraper(conn, client)
await scraper.scrape(
  {
    name: 'myScrapeProject',
    pipeline: 'browser-static-content',
    pluginOpts: [
      {
        name: 'BrowserFetchPlugin',
      },
      {
        name: 'ExtractUrlsPlugin',
        domRead: true,
        selectorPairs: [
          {
            urlSelector: 'div.col-md-9, .col-lg-auto a',
            titleSelector: 'div.blocksgreed div.mintitle',
          },
          {
            urlSelector: '.mpk_section a',
          },
          {
            urlSelector: '.mpk_section a',
          },
        ],
      },
      {
        name: 'ExtractHtmlContentPlugin',
        selectorPairs: [
          {
            contentSelector: 'div.blocksgreed div.mintitle',
            label: 'title',
          },
          {
            contentSelector: 'div.mpk_section',
            label: 'code',
          },
          {
            contentSelector: 'div.mpk_section_note',
            label: 'note',
          },
        ],
      },
      {
        name: 'InsertResourcesPlugin',
        maxResources: -1,
      },
      {
        name: 'ReadabilityPlugin',
        after: 'ExtractHtmlContentPlugin',
        domRead: true,
      },
    ],
    resources: [
      {
        url: 'https://www1.fips.ru/publication-web/classification/mpk?view=list&edition=2023',
      },
    ],
  },
  {
    session: {
      maxRequests: 1,
      delay: 500,
    },
  },
)

scraper.on(ScrapeEvent.ProjectScraped, async (project) => {
  const csvExporter = new CsvExporter({ filepath: 'books.csv' })
  await csvExporter.export(project)

  const zipExporter = new ZipExporter({ filepath: 'book-covers.zip' })
  await zipExporter.export(project)
})
