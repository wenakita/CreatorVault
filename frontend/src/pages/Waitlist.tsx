import { Navigate } from 'react-router-dom'
import { isPublicSiteMode } from '@/lib/flags'

export function Waitlist() {
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

