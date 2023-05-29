import { createClient } from 'redis'

export const publisher = createClient({})
export const subscriber = publisher.duplicate()

await publisher.connect()
await subscriber.connect()
