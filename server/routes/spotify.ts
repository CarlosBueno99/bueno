import { Hono } from 'hono'
import { getAuth } from '@clerk/hono'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

export function registerSpotifyRoutes(app: Hono) {
  // GET /api/spotify-callback — OAuth callback from Spotify
  app.get('/api/spotify-callback', async (c) => {
    const code = c.req.query('code')
    const frontendUrl = process.env.FRONTEND_URL

    // Fallback to deriving from request headers for backward compat
    const requestUrl = new URL(c.req.url)
    const origin = c.req.header('x-forwarded-proto') || requestUrl.protocol.slice(0, -1)
    const host = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3000'
    const baseUrl = frontendUrl ?? `${origin}://${host}`

    if (!code) return c.redirect(`${baseUrl}/admin?error=no_code_provided`)

    try {
      const auth = getAuth(c)
      if (!auth?.userId) return c.redirect(`${baseUrl}/admin?error=not_authenticated`)

      const jwt = await auth.getToken({ template: 'convex' })
      if (!jwt) return c.redirect(`${baseUrl}/admin?error=auth_error`)

      const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)
      convex.setAuth(jwt)

      // The redirect URI Spotify calls must match the registered app callback (the backend URL)
      const backendOrigin = `${origin}://${host}`
      const redirectUri = `${backendOrigin}/api/spotify-callback`
      const result = await convex.action(api.spotifyActions.exchangeSpotifyCodeForToken, { code, redirectUri })

      if (result.success) return c.redirect(`${baseUrl}/admin?spotify=connected`)
      return c.redirect(`${baseUrl}/admin?error=${result.error}`)
    } catch {
      return c.redirect(`${baseUrl}/admin?error=spotify_auth_failed`)
    }
  })
}
