import { Navigate } from 'react-router-dom'

export function Waitlist() {
  // Back-compat: `/waitlist` is now an anchor on the home page.
  // Keep this route to avoid breaking old links / bookmarks.
  return <Navigate to="/#waitlist" replace />
}

