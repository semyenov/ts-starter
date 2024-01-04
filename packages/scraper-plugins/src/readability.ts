import {
  Plugin,
} from '@get-set-fetch/scraper'
import {
  Readability,
} from '@mozilla/readability'

import type {
  Project,
  Resource,
} from '@get-set-fetch/scraper'

export class ReadabilityPlugin extends Plugin {
  opts = {
    domRead: true,
  }

  test(project: Project, resource: Resource) {
    if (!resource)
      return false

    console.log(project)

    return (/html/i).test(
      resource.contentType,
    )
  }

  apply(_project: Project, resource: Resource) {
    const article = new Readability(
      document,
    )
      .parse()
    if (article)
      console.log(resource)
  }
}
