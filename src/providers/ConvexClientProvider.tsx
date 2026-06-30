import { ReactNode } from 'react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/react'

if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL in your .env file')
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
