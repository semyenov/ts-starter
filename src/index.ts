import {
  mkdtemp,
} from 'node:fs/promises'
import {
  dirname,
  join,
} from 'node:path'
import process from 'node:process'
import {
  fileURLToPath,
} from 'node:url'

import scraper from '@get-set-fetch/scraper'
import {
  destination,
  pino,
} from 'pino'
import pretty from 'pino-pretty'

const pwd = dirname(
  fileURLToPath(import.meta.url),
)

const pluginsPath = join(pwd, 'plugins')
const dataPath = await mkdtemp(
  join(pwd, '.scraper-'),
)

const logDestination = destination({
  dest: join(dataPath, process.env.LOG_FILENAME ?? 'test.debug.log'),
})

await scraper.PluginStore.init()
await scraper.PluginStore.addEntries(
  pluginsPath,
)

scraper.setLogger(
  { base: { dataPath }, level: 'trace' },
  pino.multistream([
    {
      level: 'info',
      stream: pretty.default(),
    },
    {
      level: 'trace',
      stream: logDestination,
    },
  ]),
)

const client = new scraper.PuppeteerClient({
  headless: 'new',
  executablePath: '/snap/bin/chromium',
  ignoreHTTPSErrors: true,
  args: ['--ignore-certificate-errors', '--no-first-run', '--single-process'],
})
// const client = scraper.CheerioClient

const conn = new scraper.ConnectionManager({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: join(dataPath, process.env.DB_FILENAME ?? 'fips.sqlite'),
  },
})

const cli = new scraper.Scraper(conn, client)
await cli.scrape(
  {
    name: 'Fips',
    pipeline: 'browser-static-content',
    pluginOpts: [
      {
        name: 'BrowserFetchPlugin',
      },
      {
        name: 'ExtractUrlsPlugin',
        selectorPairs: [
          {
            urlSelector: 'div.col-md-9, .col-lg-auto a',
            titleSelector: 'div.mintitle',
          },
          {
            urlSelector: '.mpk_section a',
            titleSelector: 'div.mintitle',
          },
        ],
        domRead: true,
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
        name: 'UpsertResourcePlugin',
        keepHtmlData: true,
      }, /* {
        name: 'ReadabilityPlugin',
        after: 'ExtractHtmlContentPlugin',
        domRead: true,
      }, */
    ],
    resources: [
      {
        url: 'https://www1.fips.ru/publication-web/classification/mpk?view=list&edition=2023',
      },
    ],
  },
  /* {
    session: {
      maxRequests: 1,
      delay: 1000,
    },
  }, */
)

cli.on(
  scraper.ScrapeEvent.ProjectScraped,
  async (project) => {
    const csvExporter = new scraper.CsvExporter({
      filepath: join(dataPath, 'fips.csv'),
    })
    await csvExporter.export(project)

    const zipExporter = new scraper.ZipExporter({
      filepath: join(dataPath, 'data.zip'),
    })
    await zipExporter.export(project)
  },
)
