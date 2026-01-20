import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function extractWalletAddress(user: any): string | null {
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  for (const w of wallets) {
    const addr = typeof w?.address === 'string' ? w.address : null
    if (addr && isValidEvmAddress(addr)) return addr
  }
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  for (const a of linked) {
    const addr = typeof a?.address === 'string' ? a.address : null
    if (addr && isValidEvmAddress(addr)) return addr
  }
  return null
}

export function PrivyEmailLoginButton(props: {
  prefillEmail?: string
  onAutofill: (params: { email?: string; wallet?: string }) => void
  onError: (message: string) => void
}) {
  const { ready, authenticated, user, login, logout } = usePrivy()

  useEffect(() => {
    if (!ready || !authenticated) return
    const email = typeof (user as any)?.email?.address === 'string' ? (user as any).email.address : undefined
    const wallet = extractWalletAddress(user)
    if (email || wallet) props.onAutofill({ email, wallet: wallet ?? undefined })
  }, [authenticated, ready, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
        Continue with email
      </button>
    )
  }

  if (authenticated) {
    const email = typeof (user as any)?.email?.address === 'string' ? (user as any).email.address : null
    return (
      <div className="space-y-2">
        <div className="text-[11px] text-zinc-600">
          Signed in{email ? <> as <span className="font-mono text-zinc-300">{email}</span></> : null}.
        </div>
        <button
          className="btn-primary w-full"
          onClick={() => {
            props.onAutofill({ email: email ?? undefined })
          }}
        >
          Use this email
        </button>
        <button
          className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          onClick={() => logout()}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <button
      className="btn-primary w-full"
      onClick={() => {
        login({
          loginMethods: ['email'],
          ...(props.prefillEmail
            ? { prefill: { type: 'email', value: props.prefillEmail } }
            : {}),
        } as any).catch((e: any) => {
          props.onError(e?.message ? String(e.message) : 'Email login failed')
        })
      }}
    >
      Continue with email
    </button>
  )
}

