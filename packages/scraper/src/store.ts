import { createClient } from 'redis'

import * as utils from './utils'

import type { Resource } from './types'

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

export function setQueue(links: string[]) {
  if (!links.length)
    return Promise.resolve(0)

  return publisher.sAdd(sQueue, links)
}

export function remQueue(links: string[]) {
  if (!links.length)
    return Promise.resolve(0)

  return publisher.sRem(sQueue, links)
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
  return remQueue([utils.encodeLink([resource.url, resource.parent])])
    .then(() => setQueue(resource.links.map(utils.encodeLink)))
    .then(() => setResource(resource))
    .then(() => resource)
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
          return [key, JSON.stringify(val)]
        case 'boolean':
          return [key, +val]
      }

      return [key, val]
    })

  return publisher.hSet(utils.encodeKey(hResource, resource.url), tuples)
}
