import { Plugin } from '@get-set-fetch/scraper'

import type { Project, Resource, SchemaType } from '@get-set-fetch/scraper'

export default class ReadabilityPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Extract Html Content Plugin',
      description: 'Scrapes html content using CSS selectors.',
      properties: {
        test: {
          type: 'string',
          default: 'HELLO',
        },
        domRead: {
          type: 'boolean',
          default: true,
        },
      },
    } as const
  }

  opts: SchemaType<typeof ReadabilityPlugin.schema> = {
    domRead: true,
  }

  constructor(opts: SchemaType<typeof ReadabilityPlugin.schema> = {}) {
    super(opts)
  }

  getContentKeys() {
    return ['article']
  }

  test(_project: Project, resource: Resource) {
    if (!resource)
      return false
    return /html/i.test(resource.contentType)
  }

  apply(_project: Project, _resource: Resource) {
    // const article = new Readability(document).parse()
    // if (article)
    // return { content: [[article.excerpt]] }
  }
}
