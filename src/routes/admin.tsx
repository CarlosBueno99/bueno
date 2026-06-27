import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  validateSearch: (search: Record<string, unknown>) => ({
    spotify: search.spotify as string | undefined,
    error: search.error as string | undefined,
  }),
  component: lazyRouteComponent(() => import('./-admin-page')),
})
