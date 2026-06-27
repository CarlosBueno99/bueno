import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/location')({
  component: lazyRouteComponent(() => import('./-location-page')),
})
