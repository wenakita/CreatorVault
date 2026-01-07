import { motion } from 'framer-motion'
import { TrendingUp, Users, Activity, Target } from 'lucide-react'

interface ParticipationStatsProps {
  totalBids: number
  totalRaised: number
  uniqueBidders: number
  targetRaise?: number
}

export function ParticipationStats({
  totalBids,
  totalRaised,
  uniqueBidders,
  targetRaise = 50, // Default target 50 ETH
}: ParticipationStatsProps) {
  const progressPercentage = Math.min((totalRaised / targetRaise) * 100, 100)
  const momentum = totalBids > 30 ? 'High' : totalBids > 15 ? 'Medium' : 'Building'
  const momentumColor = 'text-uniswap'

  return (
    <div className="bg-gradient-to-br from-zinc-950/80 via-black/40 to-black/40 border border-zinc-800/50 rounded-xl p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-uniswap" />
          <h4 className="headline text-lg">Live Participation</h4>
        </div>
        <p className="text-zinc-600 text-xs">
          Real-time auction momentum and community engagement
        </p>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <motion.div
          className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-uniswap" />
            <span className="text-zinc-600 text-xs uppercase tracking-wider">Bidders</span>
          </div>
          <div className="text-white text-2xl font-bold">{uniqueBidders}</div>
          <div className="text-zinc-600 text-[10px] mt-1">Active participants</div>
        </motion.div>

        <motion.div
          className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-uniswap" />
            <span className="text-zinc-600 text-xs uppercase tracking-wider">Total Bids</span>
          </div>
          <div className="text-white text-2xl font-bold">{totalBids}</div>
          <div className="text-zinc-600 text-[10px] mt-1">Price discovery events</div>
        </motion.div>
      </div>

      {/* Momentum indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-500 text-sm">Auction Momentum</span>
          <span className={`font-bold text-sm ${momentumColor}`}>{momentum}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-uniswap"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalBids / 50) * 100, 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <span className="text-zinc-600 text-xs font-mono">{totalBids}/50</span>
        </div>
      </motion.div>

      {/* Progress to target */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-uniswap" />
          <span className="text-uniswap text-sm font-medium">Raise Progress</span>
        </div>
        
        <div className="mb-2">
          <div className="flex items-end gap-2 mb-1">
            <span className="text-white text-2xl font-bold">{totalRaised.toFixed(2)}</span>
            <span className="text-zinc-600 text-sm mb-1">/ {targetRaise} ETH</span>
          </div>
          <div className="h-3 bg-black/60 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-uniswap"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600">{progressPercentage.toFixed(1)}% complete</span>
          <span className="text-uniswap">{(targetRaise - totalRaised).toFixed(2)} ETH to go</span>
        </div>
      </motion.div>

      {/* Social proof message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 text-center"
      >
        <p className="text-zinc-500 text-xs">
          <span className="text-uniswap font-medium">{uniqueBidders} investors</span> trust this auction
          {totalBids > 20 && (
            <span className="ml-1">
              • <span className="text-uniswap">High demand</span>
            </span>
          )}
        </p>
      </motion.div>
    </div>
  )
}

