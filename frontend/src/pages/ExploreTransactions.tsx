import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

type Transaction = {
  id: string
  type: 'buy' | 'sell' | 'mint' | 'burn' | 'transfer'
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  amount: string
  valueUsd: string
  from: string
  to: string
  timestamp: number
  txHash: string
}

// Placeholder transactions - will be replaced with real data
const MOCK_TRANSACTIONS: Transaction[] = []

function formatAddress(address: string): string {
  if (!address) return '-'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isBuy = tx.type === 'buy' || tx.type === 'mint'

  return (
    <div className="grid grid-cols-[100px_minmax(150px,1.5fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(120px,1fr)_50px] gap-4 items-center px-4 py-4 hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/50">
      {/* Type */}
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isBuy ? (
            <ArrowDownLeft className="w-3 h-3 text-green-500" />
          ) : (
            <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        <span className={`text-sm font-medium capitalize ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
          {tx.type}
        </span>
      </div>

      {/* Token */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-medium text-zinc-400">{tx.tokenSymbol.slice(0, 2)}</span>
        </div>
        <span className="text-sm text-white truncate">{tx.tokenName}</span>
        <span className="text-xs text-zinc-500">{tx.tokenSymbol}</span>
      </div>

      {/* Amount */}
      <span className="text-sm text-white tabular-nums">{tx.amount}</span>

      {/* Value USD */}
      <span className="text-sm text-zinc-400 tabular-nums">{tx.valueUsd}</span>

      {/* Time */}
      <span className="text-sm text-zinc-500">{formatTimeAgo(tx.timestamp)}</span>

      {/* Account */}
      <span className="text-sm text-zinc-400 font-mono">{formatAddress(tx.from)}</span>

      {/* Link */}
      <a
        href={`https://basescan.org/tx/${tx.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-500 hover:text-white transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}

function TransactionTableHeader() {
  return (
    <div className="grid grid-cols-[100px_minmax(150px,1.5fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(120px,1fr)_50px] gap-4 items-center px-4 py-3 text-xs text-zinc-500 border-b border-zinc-800 bg-zinc-900/30 sticky top-0 z-10">
      <span>Type</span>
      <span>Token</span>
      <span>Amount</span>
      <span>USD</span>
      <span>Time</span>
      <span>Account</span>
      <span></span>
    </div>
  )
}

function TransactionRowSkeleton() {
  return (
    <div className="grid grid-cols-[100px_minmax(150px,1.5fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(120px,1fr)_50px] gap-4 items-center px-4 py-4 border-b border-zinc-800/50">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-zinc-800 animate-pulse" />
        <div className="h-4 w-10 bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-zinc-800 animate-pulse" />
        <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-14 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse" />
    </div>
  )
}

export function ExploreTransactions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [, setSearchQuery] = useState('')

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

  const handleTimeFilterChange = (filter: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('time', filter)
    setSearchParams(newParams, { replace: true })
  }

  const handleSortChange = (sort: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort', sort)
    setSearchParams(newParams, { replace: true })
  }

  // For now, show empty state since we don't have real transaction data
  const transactions = MOCK_TRANSACTIONS
  const isLoading = false

  return (
    <div className="relative pb-24 md:pb-0 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-medium text-white mb-2">
            Recent transactions
          </h1>
          <p className="text-zinc-400 text-sm">
            Global activity across creator coins, content coins, and vault actions.
          </p>
        </motion.div>

        {/* Navigation & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <ExploreSubnav
            searchPlaceholder="Filter by address or token"
            onSearch={setSearchQuery}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
          />
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
        >
          {/* Table Header */}
          <TransactionTableHeader />

          {/* Table Body */}
          <div className="divide-y divide-zinc-800/50">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 10 }).map((_, i) => <TransactionRowSkeleton key={i} />)
            ) : transactions.length === 0 ? (
              // Empty state
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <ArrowUpRight className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-zinc-400 text-sm mb-2">No transactions yet</p>
                <p className="text-zinc-600 text-xs">
                  Transactions will appear here as trading activity occurs.
                </p>
              </div>
            ) : (
              // Transaction rows
              transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))
            )}
          </div>
        </motion.div>

        {/* Info footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-4 text-center text-xs text-zinc-600"
        >
          Transactions are indexed from Zora Protocol on Base
        </motion.div>
      </div>
    </div>
  )
}
