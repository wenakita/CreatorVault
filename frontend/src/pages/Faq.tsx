import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function Faq() {
  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <span className="label">FAQ</span>
            <h1 className="headline text-3xl sm:text-5xl">Frequently Asked Questions</h1>
            <p className="text-sm text-zinc-500 font-light max-w-prose">
              Short answers, no fluff. If you want to understand the core flow, start here.
            </p>
          </motion.div>

          <div className="mt-10 border-t border-zinc-900/50">
            <Link
              to="/faq/how-it-works"
              className="flex items-center justify-between gap-4 py-6 group border-b border-zinc-900/50"
            >
              <div className="space-y-1">
                <div className="text-white font-light text-lg">How it works</div>
                <div className="text-sm text-zinc-600 font-light">
                  Deposit → receive wsTOKEN → earn from fees → withdraw.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}


