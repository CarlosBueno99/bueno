import { useUser } from '@clerk/react'
import type { AnyRouter } from '@tanstack/react-router'
import posthog from 'posthog-js'
import { type ReactNode, useEffect, useRef } from 'react'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim()
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim()
const analyticsEnabled = Boolean(posthogKey && posthogHost)

if (analyticsEnabled) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageleave: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    respect_dnt: true,
  })
}

function sanitizedUrl(href: string) {
  const url = new URL(href, window.location.origin)
  return `${url.origin}${url.pathname}`
}

function PostHogIdentity() {
  const { isLoaded, user } = useUser()
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!isLoaded) return

    const userId = user?.id ?? null
    const previous = previousUserId.current

    if (userId) {
      if (previous && previous !== userId) posthog.reset()
      if (previous !== userId) posthog.identify(userId)
    } else if (previous) {
      posthog.reset()
    }

    previousUserId.current = userId
  }, [isLoaded, user?.id])

  return null
}

export default function PostHogProvider({
  children,
  router,
}: {
  children: ReactNode
  router: AnyRouter
}) {
  useEffect(() => {
    if (!analyticsEnabled) return

    let lastUrl: string | undefined
    const capturePageview = () => {
      const currentUrl = sanitizedUrl(router.state.location.href)
      if (currentUrl === lastUrl) return

      lastUrl = currentUrl
      posthog.capture('$pageview', { $current_url: currentUrl })
    }

    const unsubscribe = router.subscribe('onResolved', capturePageview)
    capturePageview()
    return unsubscribe
  }, [router])

  return (
    <>
      {analyticsEnabled && <PostHogIdentity />}
      {children}
    </>
  )
}
