import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { clerkMiddleware } from '@clerk/hono'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { registerCsRoutes } from './routes/cs'
import { registerSpotifyRoutes } from './routes/spotify'
import { registerLocationRoutes } from './routes/location'

const app = new Hono()

const frontendUrl = process.env.FRONTEND_URL
app.use('/api/*', cors({ origin: frontendUrl ?? '*', credentials: true }))

app.use('*', clerkMiddleware())

registerCsRoutes(app)
registerSpotifyRoutes(app)
registerLocationRoutes(app)

const staticDir = 'dist/static'
let indexHtml = ''
try { indexHtml = readFileSync(join(staticDir, 'index.html'), 'utf-8') } catch {}
if (indexHtml) {
  const mime: Record<string, string> = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
  app.get('/*', (c) => {
    if (c.req.path.startsWith('/api')) return c.notFound()
    const p = c.req.path === '/' ? '/index.html' : c.req.path
    try { return c.body(readFileSync(join(staticDir, p)), 200, { 'content-type': mime[p.match(/\.\w+$/)?.[0] || ''] || 'application/octet-stream' }) }
    catch { return c.html(indexHtml) }
  })
}

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
