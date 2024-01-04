import { atob, btoa } from 'node:buffer'

import type { ResourceLink } from '../types'

export function encodeLink(link: ResourceLink): string {
  return link.map(btoa).join(':')
}

export function decodeLink(link: string) {
  return link.split(':').map(atob) as ResourceLink
}

export function encodeKey(prefix: string, path: string, url: string, ...fields: string[]) {
  return [prefix, path, btoa(url), ...fields].join(':')
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
