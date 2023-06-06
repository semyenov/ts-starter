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
    async connect() {
      await publisher.connect()
      await subscriber.connect()
    },

    async disconnect() {
      await publisher.disconnect()
      await subscriber.disconnect()
    },

    setQueue,
    remQueue,
    setResource,

    async queueExists() {
      const res = await publisher.exists(sQueue)
      return res !== 0
    },

    async fetchQueue(n: number) {
      const data = await subscriber
        .sScan(sQueue, queueCursor, { COUNT: n })
      queueCursor = data.cursor

      return data.members
    },

    async addResource(resource: Resource) {
      await remQueue([utils.encodeLink([resource.url, resource.parent])])
      await setQueue(resource.links.map(utils.encodeLink))
      await setResource(resource)

      return resource
    },
  }
}
