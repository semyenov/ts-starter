import { LogLevels, createConsola } from 'consola'

export const logger = createConsola({
  level: LogLevels.debug,
  defaults: { tag: 'Scraper' },
})

// logger.wrapAll()
