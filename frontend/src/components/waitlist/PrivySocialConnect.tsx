import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'

type Method = 'google' | 'twitter' | 'telegram'

function extractEmail(user: any): string | null {
  const addr = user?.email?.address
  return typeof addr === 'string' && addr.includes('@') ? addr : null
}

export function PrivySocialConnect(props: {
  disabled?: boolean
  onEmail: (email: string) => void
  onError: (msg: string) => void
}) {
  const { ready, authenticated, user, login } = usePrivy()

  useEffect(() => {
    if (!ready || !authenticated) return
    const email = extractEmail(user)
    if (email) props.onEmail(email)
  }, [authenticated, ready, user]) // eslint-disable-line react-hooks/exhaustive-deps

  function start(method: Method) {
    if (!ready) return
    login({
      loginMethods: [method],
    } as any).catch((e: any) => {
      props.onError(e?.message ? String(e.message) : 'Login failed')
    })
  }

  const disabled = props.disabled || !ready

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-zinc-700">Connect a profile (optional)</div>
      <div className="flex items-center gap-3">
        <button
          className="flex-1 h-12 rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          disabled={disabled}
          onClick={() => start('google')}
          title="Continue with Google"
        >
          <img src="/brands/google.svg" alt="" className="w-5 h-5" />
          <span className="sr-only">Continue with Google</span>
        </button>
        <button
          className="flex-1 h-12 rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          disabled={disabled}
          onClick={() => start('twitter')}
          title="Continue with X"
        >
          <img src="/brands/twitter.svg" alt="" className="w-5 h-5 opacity-90" />
          <span className="sr-only">Continue with X</span>
        </button>
        <button
          className="flex-1 h-12 rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          disabled={disabled}
          onClick={() => start('telegram')}
          title="Continue with Telegram"
        >
          <img src="/brands/telegram.svg" alt="" className="w-5 h-5" />
          <span className="sr-only">Continue with Telegram</span>
        </button>
      </div>

      <div className="text-[11px] text-zinc-700">If the provider doesn’t share your email, you can enter it below.</div>
    </div>
  )
}

