import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import RootLayout from './routes/__root'
import HomePage from './routes/index'
import AdminPage from './routes/admin'
import SettingsPage from './routes/settings'
import LocationPage from './routes/location'
import EditorPage from './routes/editor'
import LuckyNumbersPage from './routes/lucky-numbers'
import MatchPage from './routes/match'

export const rootRoute = createRootRoute({ component: RootLayout })

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  validateSearch: (search: Record<string, unknown>) => ({
    spotify: search.spotify as string | undefined,
    error: search.error as string | undefined,
  }),
  component: AdminPage,
})

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

export const locationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/location',
  component: LocationPage,
})

export const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/editor',
  component: EditorPage,
})

export const luckyNumbersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lucky-numbers',
  component: LuckyNumbersPage,
})

export const matchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match',
  component: MatchPage,
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute,
  settingsRoute,
  locationRoute,
  editorRoute,
  luckyNumbersRoute,
  matchRoute,
])
