import { memo } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

type PersonaStepProps = {
  onSelectCreator: () => void
  onSelectUser: () => void
}

export const PersonaStep = memo(function PersonaStep({ onSelectCreator, onSelectUser }: PersonaStepProps) {
  return (
    <motion.div
      key="persona"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      <div className="headline text-2xl sm:text-3xl leading-tight">Choose your path</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          onClick={onSelectCreator}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-zinc-100 font-medium">Creator</div>
              <div className="mt-1 text-sm text-zinc-600 font-light">Launch a vault</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                <Check className="w-4 h-4 text-brand-accent" />
              </div>
            </div>
          </div>
        </button>
        <button
          type="button"
          className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          onClick={onSelectUser}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-zinc-100 font-medium">User</div>
              <div className="mt-1 text-sm text-zinc-600 font-light">Join early access</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                <Check className="w-4 h-4 text-brand-accent" />
              </div>
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  )
})
