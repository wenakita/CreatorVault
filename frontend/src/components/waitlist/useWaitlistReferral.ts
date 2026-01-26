import { useCallback, useEffect, useMemo, useRef } from 'react'
import { INVITE_COPY, REFERRAL_TWEET_TEMPLATES, fillTweetTemplate } from '@/components/waitlist/referralsCopy'

type ApiFetch = (path: string, init?: RequestInit & { withCredentials?: boolean }) => Promise<Response>

type Params = {
  locationSearch: string
  shareBaseUrl: string
  inviteTemplateIdx: number
  miniAppIsMiniApp: boolean
  referralCode: string | null
  markAction: (action: string) => void
  setInviteTemplateIdx: (next: number) => void
  setInviteToast: (toast: string | null) => void
  apiFetch: ApiFetch
}

export function useWaitlistReferral({
  locationSearch,
  shareBaseUrl,
  inviteTemplateIdx,
  miniAppIsMiniApp,
  referralCode,
  markAction,
  setInviteTemplateIdx,
  setInviteToast,
  apiFetch,
}: Params) {
  const referralSessionIdRef = useRef<string | null>(null)
  const queryParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch])
  const refParam = useMemo(() => {
    const raw = (queryParams.get('ref') ?? '').trim()
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    return cleaned.length > 0 ? cleaned : null
  }, [queryParams])

  function getOrCreateReferralSessionId(): string {
    if (referralSessionIdRef.current) return referralSessionIdRef.current
    try {
      const k = 'cv_ref_session'
      const existing = localStorage.getItem(k)
      if (existing && existing.trim()) {
        referralSessionIdRef.current = existing.trim()
        return referralSessionIdRef.current
      }
      const randomHex = (bytes = 16) => {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      const v = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${randomHex(16)}${randomHex(16)}`
      localStorage.setItem(k, v)
      referralSessionIdRef.current = v
      return v
    } catch {
      const randomHex = (bytes = 16) => {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      const v = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${randomHex(16)}${randomHex(16)}`
      referralSessionIdRef.current = v
      return v
    }
  }

  function storeReferralCode(code: string | null) {
    try {
      if (!code) {
        localStorage.removeItem('cv_ref_code')
        return
      }
      localStorage.setItem('cv_ref_code', code)
    } catch {
      // ignore
    }
  }

  // If user arrives with ?ref=CODE, store it and record a click.
  useEffect(() => {
    if (!refParam) return
    storeReferralCode(refParam)
    void (async () => {
      try {
        await apiFetch('/api/referrals/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            referralCode: refParam,
            sessionId: getOrCreateReferralSessionId(),
            landingUrl: typeof window !== 'undefined' ? window.location.href : null,
          }),
        })
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam])

  const handleNextInviteTemplate = useCallback(() => {
    setInviteTemplateIdx((inviteTemplateIdx + 1) % REFERRAL_TWEET_TEMPLATES.length)
  }, [inviteTemplateIdx, setInviteTemplateIdx])

  const referralLink = useMemo(() => {
    if (referralCode) {
      return `${shareBaseUrl}/?ref=${encodeURIComponent(referralCode)}#waitlist`
    }
    return `${shareBaseUrl}/#waitlist`
  }, [referralCode, shareBaseUrl])

  const handleShareX = useCallback(() => {
      const template =
        REFERRAL_TWEET_TEMPLATES[inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length] || REFERRAL_TWEET_TEMPLATES[0]
      const text = fillTweetTemplate(template, referralLink)
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`
      if (miniAppIsMiniApp) {
        void (async () => {
          try {
            const { sdk } = await import('@farcaster/miniapp-sdk')
            if (sdk?.actions?.openUrl) {
              await sdk.actions.openUrl(url)
              markAction('shareX')
              return
            }
          } catch {
            // fall through
          }
          window.location.href = url
          markAction('shareX')
        })()
        return
      }
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        window.location.href = url
      }
      markAction('shareX')
    }, [inviteTemplateIdx, markAction, miniAppIsMiniApp, referralLink])

  const handleCopyReferral = useCallback(() => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(referralLink)
        markAction('copyLink')
        setInviteToast(INVITE_COPY.copiedToast)
        window.setTimeout(() => setInviteToast(null), 1800)
      } catch {
        setInviteToast('Copy failed.')
        window.setTimeout(() => setInviteToast(null), 1800)
      }
    })()
  }, [markAction, referralLink, setInviteToast])

  const shareHostLabel = useMemo(() => shareBaseUrl.replace(/^https?:\/\//, ''), [shareBaseUrl])

  return {
    referralLink,
    shareHostLabel,
    handleShareX,
    handleCopyReferral,
    handleNextInviteTemplate,
  } as const
}

export function getStoredReferralCode(): string | null {
  try {
    const v = localStorage.getItem('cv_ref_code')
    const t = typeof v === 'string' ? v.trim().toUpperCase() : ''
    return t ? t : null
  } catch {
    return null
  }
}
