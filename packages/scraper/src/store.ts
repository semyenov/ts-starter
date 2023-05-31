import { btoa } from 'node:buffer'

import { stringify } from 'devalue'
import { createClient } from 'redis'

import type { Resource, ResourceLink } from 'src/types'

export const sQueue = 'queue' as const
export const hResource = 'resource' as const

export const publisher = createClient()
export const subscriber = publisher.duplicate()

export function connect() {
  return Promise.all([
    publisher.connect(),
    subscriber.connect(),
  ])
}

export function disconnect() {
  return Promise.all([
    publisher.disconnect(),
    subscriber.disconnect(),
  ])
}

export function queueExists() {
  return publisher.exists(sQueue)
    .then((res) => {
      console.log(res)
      return res !== 0
    })
}

export function setQueue(links: ResourceLink[]) {
  if (!links.length)
    return Promise.resolve(0)

  return publisher.sAdd(sQueue, links.map(encodeLink))
}

export function remQueue(links: ResourceLink[]) {
  if (!links.length)
    return Promise.resolve(0)

  return publisher.sRem(sQueue, links.map(encodeLink))
}

let queueCursor = 0
export function fetchQueue(n: number) {
  return subscriber
    .sScan(sQueue, queueCursor, { COUNT: n })
    .then((data) => {
      queueCursor = data.cursor
      return data.members
    })
}

export function addResource(resource: Resource) {
  return remQueue([resource.url])
    .then(() => setQueue(resource.links))
    .then(() => setResource(resource))
}

function setResource(resource: Resource, fields?: string[]) {
  const keys = fields || Object.keys(resource)
  const tuples = keys
    .flatMap((key) => {
      const val = resource[key as keyof Resource] || null
      if (val == null)
        return []

      switch (typeof val) {
        case 'object':
          return [key, stringify(val)]
        case 'boolean':
          return [key, +val]
      }

      return [key, val]
    })

  return publisher.hSet(encodeKey(resource.url), tuples)
}

function encodeLink(link: ResourceLink): string {
  return link.map(btoa).join(':')
}

function decodeLink(link: string) {
  return link.split(':').map(atob)
}

function encodeKey(url: string, ...fields: string[]) {
  return [hResource, btoa(url), ...fields].join(':')
}
