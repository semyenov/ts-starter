import type { RedisClientOptions } from 'redis'
import type { PuppeteerLaunchOptions } from 'puppeteer'
import type { PoolConfiguration } from 'lightning-pool'
import type { Buffer } from 'node:buffer'

export type PipelineType = 'web-scraper'
export type PipelineFunc = (
  selectors: ConfigSelector[],
  resource: Resource
) => Resource
export type Pipelines = Record<PipelineType, PipelineFunc>

export type ConfigSelectorType =
  'SelectorLink' |
  'SelectorText' |
  'SelectorElement'
export interface ConfigSelector {
  id: string
  parentSelectors: string[]
  type: ConfigSelectorType
  selector: string
  multiple: boolean
  regex?: string
}
export interface Config {
  _id: string
  parallel: number
  pipeline: PipelineType

  startUrl: string[]
  selectors: ConfigSelector[]

  browser: PuppeteerLaunchOptions
  store: RedisClientOptions
  pool: PoolConfiguration
}

export type ResourceLink = [uri: string, parent: string]
export interface Resource {
  ok: boolean
  url: string
  status: number
  contentType: string | null
  buffer: Buffer | null

  parent: string
  links: ResourceLink[]
  data: Record<string, any>[]
}
