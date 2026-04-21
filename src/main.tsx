import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/react'
import ConvexClientProvider from './providers/ConvexClientProvider'
import { routeTree } from './routeTree'
import '../app/globals.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexClientProvider>
        <RouterProvider router={router} />
      </ConvexClientProvider>
    </ClerkProvider>
  </StrictMode>,
)
