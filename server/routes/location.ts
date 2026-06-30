import { Hono } from 'hono'
import { ConvexHttpClient } from 'convex/browser'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'

export function registerLocationRoutes(app: Hono) {
  // POST /api/location — Apple Shortcuts location endpoint
  app.post('/api/location', async (c) => {
    try {
      const data = await c.req.json()
      const apiKey = process.env.LOCATION_API_KEY
      if (!apiKey || data.apiKey !== apiKey) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)
      const insertedDate = new Date().toISOString()

      const locationData: any = {
        userId: data.userId as Id<'users'>,
        url: data.url,
        insertedDate,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        displayName: data.full,
      }
      if (data.altitude) locationData.altitude = Number(data.altitude)
      if (data.street) locationData.street = data.street
      if (data.city) locationData.city = data.city
      if (data.state) locationData.state = data.state
      if (data.zip) locationData.zip = data.zip
      if (data.region) locationData.region = data.region
      if (data.phoneNumber) locationData.phoneNumber = data.phoneNumber
      if (data.label) locationData.label = data.label
      if (data.full) locationData.full = data.full

      await convex.mutation(api.locations.addLocation, locationData)
      return c.json({ success: true, data: { insertedDate } })
    } catch (error: unknown) {
      if (error instanceof ConvexError) return c.json({ error: String(error.data) }, 400)
      if (error instanceof Error && error.message.includes('ArgumentValidationError')) return c.json({ error: 'Invalid arguments provided', details: error.message }, 400)
      if (error instanceof Error && error.message.includes('ConvexError')) return c.json({ error: error.message }, 400)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
}
