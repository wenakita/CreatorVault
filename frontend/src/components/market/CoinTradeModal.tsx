import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useReadContract } from 'wagmi'
import { erc20Abi, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import type { Token } from '@coinbase/onchainkit/token'
import { Swap } from '@coinbase/onchainkit/swap'

import type { ZoraCoin } from '@/lib/zora/types'
import { CONTRACTS } from '@/config/contracts'
import { SmartWalletSwitchNotice } from '@/components/SmartWalletSwitchNotice'

type TradeMode = 'buy' | 'sell'

function safeStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function coinImage(coin: ZoraCoin): string | null {
  return (
    coin.mediaContent?.previewImage?.medium ||
    coin.mediaContent?.previewImage?.small ||
    null
  )
}

export function CoinTradeModal({
  coin,
  open,
  onClose,
}: {
  coin: ZoraCoin | null
  open: boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<TradeMode>('buy')

  // Reset mode when opening a new coin
  useEffect(() => {
    if (!open) return
    setMode('buy')
  }, [open, coin?.address])

  const tokenAddress = coin?.address && isAddress(String(coin.address)) ? (String(coin.address) as Address) : null
  const tokenSymbol = coin?.symbol ? String(coin.symbol) : 'COIN'
  const tokenName = coin?.name ? String(coin.name) : tokenSymbol

  const { data: decimalsRaw } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: !!tokenAddress },
  })

  const decimals = typeof decimalsRaw === 'number' ? decimalsRaw : Number(decimalsRaw ?? 18)

  const token: Token | null = useMemo(() => {
    if (!tokenAddress) return null
    const image = coin ? coinImage(coin) : null
    return {
      address: tokenAddress,
      chainId: base.id,
      decimals: Number.isFinite(decimals) ? decimals : 18,
      image,
      name: tokenName,
      symbol: tokenSymbol,
    }
  }, [coin, decimals, tokenAddress, tokenName, tokenSymbol])

  const eth: Token = useMemo(
    () => ({
      address: '',
      chainId: base.id,
      decimals: 18,
      image: null,
      name: 'Ethereum',
      symbol: 'ETH',
    }),
    [],
  )

  const usdc: Token = useMemo(
    () => ({
      address: CONTRACTS.usdc as Address,
      chainId: base.id,
      decimals: 6,
      image: null,
      name: 'USD Coin',
      symbol: 'USDC',
    }),
    [],
  )

  const [fromTokens, toTokens] = useMemo((): [Token[], Token[]] => {
    if (!token) return [[eth, usdc], [eth, usdc]]
    if (mode === 'buy') return [[eth, usdc], [token]]
    return [[token], [eth, usdc]]
  }, [eth, mode, token, usdc])

  const title = token ? `${mode === 'buy' ? 'Buy' : 'Sell'} ${token.symbol}` : 'Trade'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-x-0 top-10 sm:top-16 px-4">
        <div className="max-w-xl mx-auto rounded-2xl border border-white/10 bg-[#080808]/80 backdrop-blur-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
          <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label">Trade</div>
              <div className="text-zinc-200 text-base sm:text-lg font-light truncate">{title}</div>
              <div className="text-xs text-zinc-600 mt-1 truncate">
                Powered by OnchainKit swap routing on Base.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full border border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-colors flex items-center justify-center"
              aria-label="Close"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('buy')}
                  aria-pressed={mode === 'buy'}
                  className={`h-9 px-4 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    mode === 'buy' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setMode('sell')}
                  aria-pressed={mode === 'sell'}
                  className={`h-9 px-4 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    mode === 'sell' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sell
                </button>
              </div>

              {tokenAddress ? (
                <a
                  href={`https://basescan.org/token/${tokenAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors font-mono"
                  title="View token on BaseScan"
                >
                  {safeStr(tokenAddress)}
                </a>
              ) : null}
            </div>

            <div className="mt-4">
              <SmartWalletSwitchNotice context="market" />
            </div>

            <div className="mt-4 flex justify-center">
              {/* OnchainKit swap UI */}
              <Swap
                title={mode === 'buy' ? 'Buy' : 'Sell'}
                from={fromTokens}
                to={toTokens}
                // Keep it simple and predictable (Base only)
                config={{ maxSlippage: 1 }}
                className="bg-transparent border border-white/10"
              />
            </div>

            <div className="mt-4 text-[11px] text-zinc-600">
              Tip: if a coin is brand new, liquidity may be thin and swaps may fail or quote wide spreads.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


