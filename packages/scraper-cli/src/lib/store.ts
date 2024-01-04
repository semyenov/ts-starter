import { createClient } from 'redis'

import * as utils from './utils'

import type { Resource, ResourceLink } from '../types'
import type { RedisClientOptions } from 'redis'

export const QUEUE_KEY = 'queue'
export const RESOURCE_PREFIX = 'resource'

export async function createStore(config: RedisClientOptions) {
  let cursor = 0

  const publisher = createClient(config)
  const subscriber = publisher.duplicate()

  async function connect() {
    await publisher.connect()
    await subscriber.connect()
  }

  async function disconnect() {
    await publisher.disconnect()
    await subscriber.disconnect()
  }

  async function setResource(resource: Resource) {
    const key = utils.encodeKey(RESOURCE_PREFIX, resource.parent, resource.url)

    return publisher.json.set(key, '$', resource)
  }

  async function setQueue(links: ResourceLink[]) {
    if (links.length > 0) {
      const encodedLinks = links.map(utils.encodeLink)
      await publisher.sAdd(QUEUE_KEY, encodedLinks)

      return true
    }

    return false
  }

  async function remQueue(links: ResourceLink[]): Promise<boolean> {
    if (links.length > 0) {
      const encodedLinks = links.map(utils.encodeLink)
      await publisher.sRem(QUEUE_KEY, encodedLinks)

      return true
    }

    return false
  }

  async function queueExists() {
    const exists = await publisher.exists(QUEUE_KEY)

    return exists > 0
  }

  async function fetchQueue(n: number): Promise<ResourceLink[]> {
    const res = await subscriber.sScan(
      QUEUE_KEY,
      cursor,
      { COUNT: n },
    )
    cursor = res.cursor

    return res.members.map(utils.decodeLink)
  }

  async function addResource(resource: Resource) {
    await setResource(resource)
    await setQueue(resource.links)
    await remQueue([[resource.url, resource.parent]])

    return resource
  }

  await connect()

  return {
    connect,
    disconnect,
    setResource,
    setQueue,
    remQueue,
    queueExists,
    fetchQueue,
    addResource,
  }
}
