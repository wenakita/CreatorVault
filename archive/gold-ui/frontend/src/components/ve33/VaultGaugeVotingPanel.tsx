import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVaultGaugeVoting, useTimeRemaining, formatVotingPower } from '../../hooks/useVaultGaugeVoting'

// Temporary placeholder - replace with actual addresses when deployed
const VAULT_GAUGE_VOTING_ADDRESS = undefined as `0x${string}` | undefined
const VE_AKITA_ADDRESS = undefined as `0x${string}` | undefined

interface VaultVoteAllocation {
  vault: string
  name: string
  weight: number // 0-100
}

interface VaultInfo {
  address: string
  name: string
  tvl?: string
  currentWeightBps?: number
}

interface VaultGaugeVotingPanelProps {
  vaults?: VaultInfo[]
  className?: string
}

export function VaultGaugeVotingPanel({ vaults = [], className = '' }: VaultGaugeVotingPanelProps) {
  const {
    epochInfo,
    totalWeight: _totalWeight,
    whitelistedVaults: _whitelistedVaults,
    userVotes: _userVotes,
    hasVotedThisEpoch,
    votingPowerInfo,
    vote,
    resetVotes,
    isVoting,
    txSuccess,
  } = useVaultGaugeVoting({
    votingAddress: VAULT_GAUGE_VOTING_ADDRESS,
    veAkitaAddress: VE_AKITA_ADDRESS,
  })

  const [allocations, setAllocations] = useState<VaultVoteAllocation[]>([])
  const [showSuccess, setShowSuccess] = useState(false)

  // Initialize allocations from vaults
  useEffect(() => {
    if (vaults.length > 0 && allocations.length === 0) {
      setAllocations(vaults.map(v => ({ vault: v.address, name: v.name, weight: 0 })))
    }
  }, [vaults, allocations.length])

  // Show success message when tx completes
  useEffect(() => {
    if (txSuccess) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
  }, [txSuccess])

  const totalAllocation = useMemo(() => {
    return allocations.reduce((sum, a) => sum + a.weight, 0)
  }, [allocations])

  const timeRemaining = useTimeRemaining(epochInfo?.timeRemaining ?? 0)

  const handleWeightChange = (vaultAddress: string, weight: number) => {
    setAllocations(prev => 
      prev.map(a => a.vault === vaultAddress ? { ...a, weight: Math.max(0, Math.min(100, weight)) } : a)
    )
  }

  const handleVote = async () => {
    const votingVaults = allocations.filter(a => a.weight > 0)
    if (votingVaults.length === 0) return

    try {
      await vote(
        votingVaults.map(v => v.vault),
        votingVaults.map(v => v.weight)
      )
    } catch (err) {
      console.error('Vote failed:', err)
    }
  }

  const handleReset = async () => {
    try {
      await resetVotes()
      setAllocations(prev => prev.map(a => ({ ...a, weight: 0 })))
    } catch (err) {
      console.error('Reset failed:', err)
    }
  }

  // If contracts not deployed, show placeholder
  if (!VAULT_GAUGE_VOTING_ADDRESS || !VE_AKITA_ADDRESS) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 ${className}`}>
        <h3 className="text-xl font-bold text-gold-400 mb-4">ve(3,3) Gauge Voting</h3>
        <div className="text-center py-8">
          <div className="text-zinc-500 mb-2">Coming Soon</div>
          <p className="text-sm text-zinc-600">
            Vote with your veAKITA to direct jackpot probability to your favorite creator vaults.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gold-500/10 to-amber-500/10 border-b border-zinc-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gold-400">ve(3,3) Gauge Voting</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Direct jackpot probability to creator vaults
            </p>
          </div>
          
          {/* Epoch Timer */}
          {epochInfo && (
            <div className="text-right">
              <div className="text-sm text-zinc-500">Epoch {epochInfo.currentEpoch}</div>
              <div className="text-lg font-mono text-gold-400">{timeRemaining}</div>
              <div className="text-xs text-zinc-600">until next epoch</div>
            </div>
          )}
        </div>
      </div>

      {/* Voting Power */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-zinc-400">Your Voting Power</span>
          <span className="text-gold-400 font-mono">
            {votingPowerInfo ? formatVotingPower(votingPowerInfo.userPower) : '—'}
          </span>
        </div>
        
        {votingPowerInfo && !votingPowerInfo.hasActiveLock && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
            Lock wsAKITA to get voting power
          </div>
        )}

        {hasVotedThisEpoch && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400 mt-2">
            ✓ You have voted this epoch
          </div>
        )}
      </div>

      {/* Vault Allocation */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
          <span>Allocate votes to vaults</span>
          <span className={totalAllocation > 100 ? 'text-red-400' : ''}>
            {totalAllocation}% allocated
          </span>
        </div>

        {allocations.map((allocation) => (
          <div key={allocation.vault} className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center">
                  <span className="text-gold-400 text-xs font-bold">
                    {allocation.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-white">{allocation.name}</div>
                  <div className="text-xs text-zinc-500 font-mono">
                    {allocation.vault.slice(0, 6)}...{allocation.vault.slice(-4)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allocation.weight}
                  onChange={(e) => handleWeightChange(allocation.vault, parseInt(e.target.value) || 0)}
                  className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-center text-white focus:border-gold-500 focus:outline-none"
                />
                <span className="text-zinc-500">%</span>
              </div>
            </div>
            
            {/* Weight slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={allocation.weight}
              onChange={(e) => handleWeightChange(allocation.vault, parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
          </div>
        ))}

        {allocations.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No vaults available for voting
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-zinc-900/50 border-t border-zinc-800">
        <div className="flex gap-3">
          <button
            onClick={handleVote}
            disabled={isVoting || totalAllocation === 0 || !votingPowerInfo?.hasActiveLock}
            className="flex-1 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 disabled:from-zinc-600 disabled:to-zinc-700 text-black font-bold py-3 px-6 rounded-xl transition-all disabled:cursor-not-allowed"
          >
            {isVoting ? 'Voting...' : 'Cast Vote'}
          </button>
          
          {hasVotedThisEpoch && (
            <button
              onClick={handleReset}
              disabled={isVoting}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-all disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>

        {totalAllocation > 100 && (
          <p className="text-red-400 text-sm text-center mt-2">
            Total allocation exceeds 100%
          </p>
        )}
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg"
          >
            ✓ Vote submitted successfully!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Compact version for embedding in vault pages
export function VaultGaugeVotingMini({ className = '' }: { className?: string }) {
  const { epochInfo, votingPowerInfo, hasVotedThisEpoch } = useVaultGaugeVoting({
    votingAddress: VAULT_GAUGE_VOTING_ADDRESS,
    veAkitaAddress: VE_AKITA_ADDRESS,
  })

  const timeRemaining = useTimeRemaining(epochInfo?.timeRemaining ?? 0)

  if (!VAULT_GAUGE_VOTING_ADDRESS) {
    return null
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gold-400 text-sm font-medium">ve(3,3)</span>
          {hasVotedThisEpoch && (
            <span className="text-xs text-green-400">✓ Voted</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Epoch {epochInfo?.currentEpoch ?? '—'}</div>
          <div className="text-sm font-mono text-gold-400">{timeRemaining}</div>
        </div>
      </div>
      
      {votingPowerInfo && (
        <div className="mt-2 text-xs text-zinc-500">
          Your power: {formatVotingPower(votingPowerInfo.userPower)} veAKITA
        </div>
      )}
    </div>
  )
}

export default VaultGaugeVotingPanel

