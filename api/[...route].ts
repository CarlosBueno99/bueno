import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { clerkMiddleware } from '@clerk/hono'

import { registerCsRoutes } from '../server/routes/cs'
import { registerSpotifyRoutes } from '../server/routes/spotify'
import { registerLocationRoutes } from '../server/routes/location'

const app = new Hono()

const frontendUrl = process.env.FRONTEND_URL
app.use('/api/*', cors({ origin: frontendUrl ?? '*', credentials: true }))
app.use('*', clerkMiddleware())

registerCsRoutes(app)
registerSpotifyRoutes(app)
registerLocationRoutes(app)

export default async function handler(req: any, res: any) {
  const url = new URL(
    req.url || '/',
    `https://${req.headers?.host || 'localhost'}`,
  )

  const headers = new Headers()
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value as string)
    }
  }

  const method = req.method || 'GET'
  let body: BodyInit | null | undefined
  if (method !== 'GET' && method !== 'HEAD' && req.body) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }

  const request = new Request(url, { method, headers, body })
  const response = await app.fetch(request)

  res.status(response.status)
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await response.text())
}
