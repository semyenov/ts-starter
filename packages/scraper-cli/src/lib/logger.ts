import { createConsola } from 'consola'

import type { ConsolaInstance } from 'consola'

export const logger: ConsolaInstance = createConsola({
  defaults: { tag: 'scraper-cli' },
  level: 4,
})
