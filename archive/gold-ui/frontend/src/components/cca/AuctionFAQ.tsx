import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  highlight?: boolean
}

const faqItems: FAQItem[] = [
  {
    question: 'How does the auction work?',
    answer: 'The Continuous Clearing Auction (CCA) by Uniswap discovers fair market price through real-time bids. Your bid is spread over time to prevent manipulation. You specify your max price and the amount you want to spend.',
    highlight: true,
  },
  {
    question: 'When do I receive my tokens?',
    answer: 'After the auction graduates (reaches target), you can claim your tokens proportional to your bid. The final clearing price determines exactly how many tokens you receive.',
  },
  {
    question: 'Can I get a refund?',
    answer: 'Yes! If the auction doesn\'t graduate or you change your mind before settlement, you can withdraw your bid. The smart contract is non-custodial, so you always control your funds.',
    highlight: true,
  },
  {
    question: 'What happens to my bid?',
    answer: 'Your bid is locked in the auction contract until graduation. If the price rises above your max price, your bid partially fills. You only pay the final clearing price, not your max.',
  },
  {
    question: 'Is this safe?',
    answer: 'The auction runs on Uniswap\'s battle-tested CCA protocol. Contracts are verified on BaseScan. The mechanism is non-custodial, meaning you control your funds through your wallet.',
  },
  {
    question: 'Why should I bid early?',
    answer: 'Early bids help establish price discovery and often get better avg prices. Plus, you secure your allocation before the auction potentially graduates.',
  },
]

export function AuctionFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-uniswap" />
        <h4 className="headline text-lg">Common Questions</h4>
      </div>

      <div className="divide-y divide-white/10">
        {faqItems.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="bg-transparent"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 group"
            >
              <span className="text-[15px] font-medium text-white group-hover:text-uniswap transition-colors">
                {item.question}
              </span>
              <motion.div
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-zinc-500 group-hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed max-w-prose">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <div className="px-6 py-5 border-t border-white/10">
        <a
          href="/faq"
          className="text-sm text-zinc-400 hover:text-uniswap transition-colors inline-flex items-center gap-2"
        >
          <span>View full FAQ</span>
          <span className="text-zinc-600">→</span>
        </a>
      </div>
    </div>
  )
}

