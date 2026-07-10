import { useUser } from '@clerk/react'
import type { AnyRouter } from '@tanstack/react-router'
import posthog from 'posthog-js'
import { type ReactNode, useEffect, useRef, useState } from 'react'

type Consent = 'accepted' | 'declined' | null

const consentStorageKey = 'bueno_analytics_consent'
const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim()
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim()
const analyticsConfigured = Boolean(posthogKey && posthogHost)
const doNotTrackEnabled =
  navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes'
let posthogInitialized = false

function sanitizedUrl(href: string) {
  const url = new URL(href, window.location.origin)
  return `${url.origin}${url.pathname}`
}

function sanitizeProperties(properties: Record<string, unknown>) {
  const sanitized = { ...properties }
  for (const key of ['$current_url', '$initial_current_url', '$referrer']) {
    const value = sanitized[key]
    if (typeof value === 'string' && value) sanitized[key] = sanitizedUrl(value)
  }
  return sanitized
}

function initializePostHog() {
  if (posthogInitialized || !posthogKey || !posthogHost) return

  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: false,
    disable_session_recording: false,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    respect_dnt: true,
    sanitize_properties: sanitizeProperties,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
  })
  posthogInitialized = true
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

function ConsentControls({
  consent,
  setConsent,
}: {
  consent: Consent
  setConsent: (consent: Exclude<Consent, null>) => void
}) {
  const [editing, setEditing] = useState(false)

  if (!analyticsConfigured || doNotTrackEnabled) return null

  if (consent && !editing) {
    return (
      <button
        className="fixed bottom-3 left-3 z-50 rounded-md border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
        onClick={() => setEditing(true)}
        type="button"
      >
        Privacy choices
      </button>
    )
  }

  return (
    <div
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-lg border bg-background p-4 text-foreground shadow-lg"
      role="dialog"
    >
      <p className="text-sm font-medium">Help improve Bueno?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        With your permission, PostHog will collect usage analytics and masked
        session replays. You can change this choice at any time.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          onClick={() => {
            setConsent('declined')
            setEditing(false)
          }}
          type="button"
        >
          Decline
        </button>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
          onClick={() => {
            setConsent('accepted')
            setEditing(false)
          }}
          type="button"
        >
          Allow analytics
        </button>
      </div>
    </div>
  )
}

export default function PostHogProvider({
  children,
  router,
}: {
  children: ReactNode
  router: AnyRouter
}) {
  const [consent, setConsentState] = useState<Consent>(() => {
    const stored = localStorage.getItem(consentStorageKey)
    return stored === 'accepted' || stored === 'declined' ? stored : null
  })
  const analyticsActive =
    analyticsConfigured && !doNotTrackEnabled && consent === 'accepted'

  const setConsent = (nextConsent: Exclude<Consent, null>) => {
    localStorage.setItem(consentStorageKey, nextConsent)
    if (nextConsent === 'declined' && posthogInitialized) {
      posthog.opt_out_capturing()
      posthog.stopSessionRecording()
    }
    setConsentState(nextConsent)
  }

  useEffect(() => {
    if (!analyticsActive) return
    initializePostHog()
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()
    posthog.startSessionRecording()
  }, [analyticsActive])

  useEffect(() => {
    if (!analyticsActive) return

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
  }, [analyticsActive, router])

  return (
    <>
      {analyticsActive && <PostHogIdentity />}
      {children}
      <ConsentControls consent={consent} setConsent={setConsent} />
    </>
  )
}
