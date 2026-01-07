import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Calculator, AlertTriangle } from 'lucide-react'

interface InvestmentCalculatorProps {
  currentPrice: number // ETH per token
  tokenSymbol: string
}

export function InvestmentCalculator({ 
  currentPrice, 
  tokenSymbol 
}: InvestmentCalculatorProps) {
  const [investment, setInvestment] = useState('0.1')
  const [priceMultiplier, setPriceMultiplier] = useState(3) // 3x return

  const calculations = useMemo(() => {
    try {
      const investmentAmount = parseFloat(investment) || 0
      const tokens = investmentAmount / currentPrice
      const futurePrice = currentPrice * priceMultiplier
      const futureValue = tokens * futurePrice
      const profit = futureValue - investmentAmount
      const roi = ((profit / investmentAmount) * 100)

      return {
        tokens: tokens.toFixed(2),
        futureValue: futureValue.toFixed(4),
        profit: profit.toFixed(4),
        profitUsd: (profit * 3500).toFixed(0),
        roi: roi.toFixed(0),
        valid: investmentAmount > 0,
      }
    } catch {
      return null
    }
  }, [investment, currentPrice, priceMultiplier])

  const multiplierOptions = [
    { value: 2, label: '2x' },
    { value: 3, label: '3x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' },
  ]

  return (
    <div className="bg-gradient-to-br from-zinc-950/80 via-black/40 to-black/40 border border-zinc-800/50 rounded-xl p-6">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-uniswap/10 rounded-lg">
            <Calculator className="w-5 h-5 text-uniswap" />
          </div>
          <h4 className="headline text-lg">Investment Calculator</h4>
        </div>
        <p className="text-zinc-600 text-xs">
          Calculate potential returns based on different price scenarios
        </p>
      </div>

      <div className="space-y-4">
        {/* Investment amount input */}
        <div>
          <label className="label mb-2 block">Your Investment (ETH)</label>
          <input
            type="text"
            value={investment}
            onChange={(e) => setInvestment(e.target.value)}
            placeholder="0.1"
            className="bg-black/60 border border-zinc-800/50 focus:border-uniswap/50 text-white text-lg px-4 py-3 w-full transition-colors font-mono focus:outline-none rounded-lg"
            inputMode="decimal"
          />
        </div>

        {/* Price multiplier selector */}
        <div>
          <label className="label mb-2 block">Expected Price Growth</label>
          <div className="grid grid-cols-4 gap-2">
            {multiplierOptions.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => setPriceMultiplier(option.value)}
                className={`py-3 px-4 rounded-lg font-medium transition-all ${
                  priceMultiplier === option.value
                    ? 'bg-uniswap/10 border border-uniswap/50 text-uniswap'
                    : 'bg-black/40 border border-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {option.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Results */}
        {calculations?.valid && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 border border-uniswap/20 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">You'll receive</span>
              <span className="text-white font-mono text-lg">
                {calculations.tokens} {tokenSymbol}
              </span>
            </div>

            <div className="border-t border-white/5 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-500 text-sm">
                  Value at {priceMultiplier}x price
                </span>
                <span className="text-uniswap font-mono text-lg font-medium">
                  {calculations.futureValue} ETH
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">Your profit</span>
                <div className="text-right">
                  <div className="text-uniswap font-mono text-xl font-bold">
                    +{calculations.profit} ETH
                  </div>
                  <div className="text-zinc-600 text-xs">
                    ≈ ${calculations.profitUsd} USD
                  </div>
                </div>
              </div>
            </div>

            <motion.div 
              className="bg-uniswap/10 border border-uniswap/20 rounded-lg p-3 flex items-center justify-between"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-uniswap text-sm font-medium">ROI</span>
              <span className="text-uniswap text-2xl font-bold">
                +{calculations.roi}%
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            This is a hypothetical calculation. Actual returns may vary. 
            Cryptocurrency investments carry risk. Do your own research.
          </p>
        </div>
      </div>
    </div>
  )
}

