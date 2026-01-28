import { Navigate } from 'react-router-dom'
import { WaitlistFlow } from '@/components/waitlist/WaitlistFlow'
import { isPublicSiteMode } from '@/lib/flags'

export function Waitlist() {
  // Local dev: render the waitlist flow in-app so you can iterate on UI at /waitlist.
  if (import.meta.env.DEV) return <WaitlistFlow variant="page" />

  // Back-compat: waitlist lives on marketing, but public-mode app hosts an embedded waitlist section.
  const publicMode = isPublicSiteMode()
  if (publicMode) return <Navigate to="/#waitlist" replace />

  // Non-public app: send users to the marketing waitlist (4626.fun).
  if (typeof window !== 'undefined') {
    window.location.replace('https://4626.fun')
    return null
  }

  return <Navigate to="/#waitlist" replace />
}

