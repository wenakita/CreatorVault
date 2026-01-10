import { createContext, useContext } from 'react'

export type Web3Status = 'disabled' | 'loading' | 'ready'

export type Web3ContextValue = {
  status: Web3Status
  enable: () => void
}

export const Web3Context = createContext<Web3ContextValue | null>(null)

export function useWeb3(): Web3ContextValue {
  const ctx = useContext(Web3Context)
  if (!ctx) throw new Error('useWeb3 must be used within <Web3Context.Provider>')
  return ctx
}


