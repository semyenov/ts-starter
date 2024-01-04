import type {
  Pipelines,
  ResourceData,
  ResourceLink,
} from '~/types'

export const pipelines: Pipelines = {
  'web-scraper': (
    selectors,
    resource,
  ) => {
    const parse = (
      rootEl: Element,
      parent: string,
      data: ResourceData[],
      links: ResourceLink[],
    ) => {
      selectors
        .filter(s => s.parentSelectors.includes(parent))
        .forEach((s) => {
          rootEl
            .querySelectorAll(s.selector)
            .forEach((el, i) => {
              if (typeof data[i] === 'undefined')
                data[i] = Object.create(null)

              const key = s.id.slice(
                s.id.lastIndexOf(':') + 1,
              )

              switch (s.type) {
                case 'SelectorLink':
                  if (el instanceof HTMLAnchorElement)
                    links.push([el.href, s.id])

                  data[i][key] = el.textContent
                  break
                case 'SelectorText':
                  data[i][key] = el.textContent
                  break
                case 'SelectorHTML':
                  data[i][key] = el.innerHTML
                  break
                case 'SelectorElement':
                  data[i][key] = []
                  parse(
                    el,
                    s.id,
                    data[i][key] as ResourceData[],
                    links,
                  )
                  break
              }
            })
        })
    }

    parse(
      document.body,
      resource.parent,
      resource.data, // data is mutable
      resource.links, // links is mutable
    )

    return resource
  },
}
