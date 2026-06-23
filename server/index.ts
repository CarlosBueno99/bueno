import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { clerkMiddleware } from '@clerk/hono'

import { registerCsRoutes } from './routes/cs'
import { registerSpotifyRoutes } from './routes/spotify'
import { registerLocationRoutes } from './routes/location'

const app = new Hono()

// CORS — allow frontend origin if configured, otherwise permissive
const frontendUrl = process.env.FRONTEND_URL
app.use('/api/*', cors({ origin: frontendUrl ?? '*', credentials: true }))

// Clerk auth middleware — applies to all routes
app.use('*', clerkMiddleware())

// API route groups
registerCsRoutes(app)
registerSpotifyRoutes(app)
registerLocationRoutes(app)

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
})
