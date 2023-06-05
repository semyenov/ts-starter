import type { Pipelines } from '~/types'

export const pipelines: Pipelines = {
  'web-scraper': (selectors, resource) => {
    const parse = (
      el: HTMLElement,
      p: string,
      d: Array<Record<string, any>>,
    ) => {
      selectors
        .filter(s => s.parentSelectors.includes(p))
        .forEach((s) => {
          el
            .querySelectorAll<HTMLLinkElement>(s.selector)
            .forEach((e, i) => {
              if (typeof d[i] === 'undefined')
                d[i] = Object.create(null)

              const p = s.id.slice(s.id.lastIndexOf(':') + 1)

              switch (s.type) {
                case 'SelectorLink':
                  resource.links.push([e.href, s.id])
                  d[i][p] = e.innerText
                  break
                case 'SelectorText':
                  d[i][p] = e.innerText
                  break
                case 'SelectorHTML':
                  d[i][p] = e.innerHTML
                  break
                case 'SelectorElement':
                  d[i][p] = []
                  parse(e, s.id, d[i][s.id])
                  break
              }
            })
        })
    }

    parse(document.body, resource.parent, resource.data)
    return resource
  },
}
