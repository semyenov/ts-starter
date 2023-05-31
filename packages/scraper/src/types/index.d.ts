import type { Buffer } from 'node:buffer'

export type SelectorType =
  'SelectorLink' |
  'SelectorText' |
  'SelectorElement'

export interface Selector {
  id: string
  parentSelectors: string[]
  type: SelectorType
  selector: string
  multiple: boolean
  regex?: string
}

export interface Config {
  _id: string
  startUrl: string[]
  selectors: Selector[]
}

export type ResourceLink = [uri: string, parent: string]

export interface Resource {
  ok: boolean
  url: string
  status: number
  contentType: string | null
  buffer?: Buffer

  parent: string
  links: ResourceLink[]
  data: Record<string, any>[]
}
