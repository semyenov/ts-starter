import { createClient } from 'redis'

import * as utils from './utils'

import type { RedisClientOptions } from 'redis'
import type { Resource } from '../types'

export const sQueue = 'queue' as const
export const hResource = 'resource' as const

export function createStore(config: RedisClientOptions) {
  let queueCursor = 0

  const publisher = createClient(config)
  const subscriber = publisher.duplicate()

  const setQueue = (links: string[]) => {
    if (!links.length)
      return Promise.resolve(0)

    return publisher.sAdd(sQueue, links)
  }

  const remQueue = (links: string[]) => {
    if (!links.length)
      return Promise.resolve(0)

    return publisher.sRem(sQueue, links)
  }

  const setResource = (resource: Resource, fields?: string[]) => {
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

  return {
    connect() {
      return Promise.all([
        publisher.connect(),
        subscriber.connect(),
      ])
    },

    disconnect() {
      return Promise.all([
        publisher.disconnect(),
        subscriber.disconnect(),
      ])
    },

    setQueue,
    remQueue,
    setResource,

    queueExists() {
      return publisher.exists(sQueue)
        .then(res => res !== 0)
    },

    fetchQueue(n: number) {
      return subscriber
        .sScan(sQueue, queueCursor, { COUNT: n })
        .then((data) => {
          queueCursor = data.cursor
          return data.members
        })
    },

    addResource(resource: Resource) {
      return remQueue([utils.encodeLink([resource.url, resource.parent])])
        .then(() => setQueue(resource.links.map(utils.encodeLink)))
        .then(() => setResource(resource))
        .then(() => resource)
    },
  }
}
