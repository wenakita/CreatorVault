import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'

type FaqItem = {
  id: string
  question: string
  answer: React.ReactNode
  search: string
}

type FaqSection = {
  id: string
  title: string
  description?: string
  items: FaqItem[]
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-brand-accent hover:text-brand-400 underline underline-offset-4"
    >
      {children}
    </a>
  )
}

const surface =
  'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

const surfaceInteractive =
  'transition-colors hover:border-white/10 hover:ring-white/10'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      id={`faq-${item.id}`}
      className={`relative ${
        isOpen ? 'bg-white/[0.02]' : 'hover:bg-white/[0.015]'
      } transition-colors`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${item.id}`}
        className="w-full flex items-start justify-between gap-6 px-5 py-5 text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
      >
        <div className="space-y-1">
          <div className="text-white font-light text-base sm:text-lg">{item.question}</div>
        </div>
        <ChevronDown
          className={`w-5 h-5 mt-1 text-zinc-600 group-hover:text-zinc-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={`faq-panel-${item.id}`}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pb-6 px-5">
              <div className="text-sm text-zinc-400/90 font-light leading-relaxed space-y-3">
                {item.answer}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'basics',
    title: 'Basics',
    description: 'What Creator Vaults is (and what it isn’t).',
    items: [
      {
        id: 'what-is-creatorvault',
        question: 'What is Creator Vaults?',
        search: 'creatorvault vault ws token shareoft',
        answer: (
          <>
            <p>
              <span className="text-brand-accent">Creator Vaults</span> is a set of onchain contracts that let a creator coin act like a “vault share token.”
              You deposit the creator coin into its vault and receive a wrapped share token (shown as{' '}
              <span className="mono text-brand-accent">{SHARE_TOKEN}</span>).
            </p>
            <p>
              Holding <span className="mono text-brand-accent">{SHARE_TOKEN}</span> represents a pro‑rata claim on the vault’s assets and whatever the vault earns
              (fees + strategy results). Nothing here is a guaranteed yield product.
            </p>
          </>
        ),
      },
      {
        id: 'what-is-wstoken',
        question: `What is ${SHARE_TOKEN}?`,
        search: 'ws token share token shares redeem burn',
        answer: (
          <>
            <p>
              <span className="mono text-brand-accent">{SHARE_TOKEN}</span> is the vault’s share token. It’s designed to be transferable and usable across the app
              like a “receipt” for your vault position.
            </p>
            <p>
              The share price can move up or down depending on trading activity, strategy performance, and market moves.
            </p>
          </>
        ),
      },
      {
        id: 'is-custodial',
        question: 'Is Creator Vaults custodial?',
        search: 'custodial noncustodial self custody',
        answer: (
          <>
            <p>
              It’s non‑custodial in the sense that you interact from your wallet and the rules are enforced by smart contracts.
              Your assets live in the vault contracts, not on a centralized account.
            </p>
            <p className="text-zinc-600">
              Smart contracts can still fail or be exploited — treat this as experimental unless you have verified audits.
            </p>
          </>
        ),
      },
      {
        id: 'where-to-see-stats',
        question: 'Where can I see vault stats and contract wiring?',
        search: 'stats status basescan',
        answer: (
          <>
            <p>
              Use the <Link to="/dashboard" className="text-brand-accent hover:text-brand-400 underline underline-offset-4">Dashboard</Link> for discovery,
              and each <span className="mono">/vault/:address</span> page for details.
            </p>
            <p>
              For wiring / health checks, use the <Link to="/status" className="text-brand-accent hover:text-brand-400 underline underline-offset-4">Status</Link> page.
              “Fix actions” appear when the connected wallet is the onchain owner.
            </p>
          </>
        ),
      },
      {
        id: 'what-chain',
        question: 'Which chain is this on?',
        search: 'base chain network',
        answer: (
          <p>
            Creator Vaults targets <span className="text-white">Base</span> for production deployments. Always double‑check the network in your wallet
            before signing.
          </p>
        ),
      },
    ],
  },
  {
    id: 'deposits',
    title: 'Deposits & withdrawals',
    description: 'How vault shares mint/burn and what can affect redemptions.',
    items: [
      {
        id: 'deposit',
        question: 'How do deposits work?',
        search: 'deposit mint shares ws token',
        answer: (
          <>
            <p>
              When you deposit the creator coin into its vault, the vault mints you <span className="mono text-brand-accent">{SHARE_TOKEN}</span> shares.
              Those shares represent your ownership percentage of the vault.
            </p>
            <p>
              In early blocks of a brand‑new vault, the first deposit establishes the initial share price. After that, deposits mint shares at the
              current exchange rate.
            </p>
          </>
        ),
      },
      {
        id: 'withdraw',
        question: 'How do withdrawals work?',
        search: 'withdraw redeem burn shares',
        answer: (
          <>
            <p>
              You withdraw by burning <span className="mono text-brand-accent">{SHARE_TOKEN}</span> shares to redeem the underlying creator coin from the vault.
            </p>
            <p>
              Withdrawals depend on available liquidity. If capital is deployed into external strategies, the vault may need to unwind positions first.
            </p>
          </>
        ),
      },
      {
        id: 'min-first-deposit',
        question: 'Is there a minimum deposit?',
        search: 'minimum first deposit 50m',
        answer: (
          <>
            <p>
              Yes — the vault enforces a minimum <span className="text-white">first</span> deposit of <span className="mono">50,000,000</span> creator tokens.
              This is designed to ensure the vault starts with meaningful liquidity.
            </p>
            <p className="text-zinc-600">
              Later deposits can be smaller; the “50M” rule is specifically about initializing a brand‑new vault.
            </p>
          </>
        ),
      },
      {
        id: 'share-price',
        question: `Why does the ${SHARE_TOKEN} exchange rate change?`,
        search: 'exchange rate share price',
        answer: (
          <p>
            The exchange rate reflects the vault’s total assets divided by total shares. If the vault earns fees, realizes profits, or realizes losses,
            that value per share changes.
          </p>
        ),
      },
      {
        id: 'transfer-bridge',
        question: `Can I transfer / bridge ${SHARE_TOKEN}?`,
        search: 'transfer bridge layerzero oft',
        answer: (
          <>
            <p>
              <span className="mono text-brand-accent">{SHARE_TOKEN}</span> is designed to be transferable like a normal token. Some deployments also support omnichain transfers
              via OFT-style bridging.
            </p>
            <p className="text-zinc-600">
              Bridging adds additional trust assumptions and failure modes — treat it as higher risk than a simple L2 transfer.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'launch',
    title: 'Launch & CCA auction (Uniswap)',
    description: 'How the initial auction works and what users can do.',
    items: [
      {
        id: 'what-is-cca',
        question: 'What is the CCA auction?',
        search: 'cca continuous clearing auction uniswap',
        answer: (
          <>
            <p>
              CCA stands for Continuous Clearing Auction — a Uniswap Liquidity Launchpad mechanism for price discovery that reduces timing games.
              Bidders specify a budget and a max price; each block clears at a discovered clearing price.
            </p>
            <p>
              If you want the full mechanism details, see{' '}
              <ExternalLink href="https://docs.uniswap.org/contracts/liquidity-launchpad/Overview">
                Uniswap Liquidity Launchpad docs
              </ExternalLink>
              .
            </p>
          </>
        ),
      },
      {
        id: 'how-to-bid',
        question: 'How do I place a bid?',
        search: 'bid max price budget',
        answer: (
          <>
            <p>
              Open a vault page and use the embedded auction panel, or go to the full-page route:
              <span className="mono"> /auction/bid/&lt;ccaStrategy&gt;</span>.
            </p>
            <p className="text-zinc-600">
              The “simple” flow helps pick a max price; “advanced” lets you set it explicitly. Always sanity-check your max price before signing.
            </p>
          </>
        ),
      },
      {
        id: 'after-auction',
        question: 'What happens when the auction ends?',
        search: 'auction end migrate claim',
        answer: (
          <>
            <p>
              After the auction ends, the system can migrate proceeds into a Uniswap pool to bootstrap liquidity at the discovered price. Participants
              can claim purchased tokens once the auction’s claim block is reached.
            </p>
            <p>
              For the reference UI (and mental model), Uniswap’s public demo is{' '}
              <ExternalLink href="https://cca.uniswap.org/">cca.uniswap.org</ExternalLink>.
            </p>
          </>
        ),
      },
      {
        id: 'fees-during-cca',
        question: 'Do fees accrue during the CCA?',
        search: 'fees during auction',
        answer: (
          <p>
            Trading fees from the post‑launch Uniswap pool only exist once the pool is live. During the auction, there is no live pool yet. The vault
            can still run its internal accounting and strategies (if enabled), but there is no guarantee of yield.
          </p>
        ),
      },
    ],
  },
  {
    id: 'strategies',
    title: 'Strategies, pricing, and oracles',
    description: 'Where yield can come from, and why configuration matters.',
    items: [
      {
        id: 'what-strategies',
        question: 'What strategies can a vault use?',
        search: 'strategy charm ajna lp lending',
        answer: (
          <>
            <p>
              Creator Vaults can wire in multiple strategies. Two core ones in this stack are:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-500">
              <li>
                <span className="text-white">Charm (Uniswap V3 LP)</span>: manages a concentrated liquidity position and rebalances ranges.
              </li>
              <li>
                <span className="text-white">Ajna</span>: collateralized borrowing/lending mechanics (with liquidation risk).
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'strategy-risk',
        question: 'Can strategies lose money?',
        search: 'risk loss impermanent loss liquidation',
        answer: (
          <>
            <p>
              Yes. LP strategies can experience impermanent loss and price‑move risk. Lending/borrowing strategies can face liquidation or bad debt risk.
              External protocol risk is real.
            </p>
            <p className="text-zinc-600">
              The goal is to route fees and deploy capital programmatically — not to promise a specific APY.
            </p>
          </>
        ),
      },
      {
        id: 'oracle',
        question: 'What price data does the system use?',
        search: 'oracle chainlink uniswap twap v3 v4',
        answer: (
          <>
            <p>
              Pricing can reference a combination of Chainlink feeds and Uniswap TWAPs (V3/V4) depending on the component. This is used for
              configuration, safety checks, and strategy parameters.
            </p>
            <p className="text-zinc-600">
              TWAPs require sufficient observation capacity and trading activity; a brand‑new pool may not have enough history immediately.
            </p>
          </>
        ),
      },
      {
        id: 'ajna-bucket',
        question: 'Why might the “Ajna bucket” be unset or delayed?',
        search: 'ajna bucket twap cardinality',
        answer: (
          <>
            <p>
              Ajna configuration is price‑sensitive. If a new Uniswap V3 pool doesn’t yet have enough oracle observations (or meaningful volume),
              a suggested bucket based on TWAP may be unreliable.
            </p>
            <p>
              This is why the Status page surfaces oracle capacity and provides owner-only fix actions (like increasing V3 observation cardinality).
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'safety',
    title: 'Security & governance',
    description: 'Who can change what, and what to assume about risk.',
    items: [
      {
        id: 'who-controls',
        question: 'Who controls a vault after deployment?',
        search: 'owner governance keeper emergency admin',
        answer: (
          <>
            <p>
              Each vault has an onchain owner and operational roles (e.g., keeper/emergency admin) depending on the contract. Those roles can change
              configuration, pause actions (if supported), and run maintenance functions.
            </p>
            <p className="text-zinc-600">
              If you are not the owner, you should assume parameters can change (within whatever constraints the contracts enforce).
            </p>
          </>
        ),
      },
      {
        id: 'audits',
        question: 'Is this audited?',
        search: 'audit security',
        answer: (
          <p>
            Treat this as experimental unless a specific audit report is published for the exact commit + deployed addresses you’re using.
          </p>
        ),
      },
      {
        id: 'main-risks',
        question: 'What are the biggest risks?',
        search: 'risk smart contract oracle external protocol bridge',
        answer: (
          <ul className="list-disc list-inside space-y-1 text-zinc-500">
            <li>Smart contract risk (bugs, upgrade/owner risk, dependency risk)</li>
            <li>Oracle/TWAP edge cases (especially right after launch)</li>
            <li>LP risk (price moves, impermanent loss)</li>
            <li>Lending risk (liquidations, bad debt, market stress)</li>
            <li>Bridge risk (if using omnichain features)</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: 'creators',
    title: 'Creators & deployment',
    description: 'What a creator needs to launch a vault and what gets deployed.',
    items: [
      {
        id: 'what-gets-deployed',
        question: 'What gets deployed when a creator launches a vault?',
        search: 'deploy contracts factory vault wrapper shareoft gauge oracle cca strategy',
        answer: (
          <>
            <p>
              A creator vault launch deploys a per‑creator stack (vault + share token + routing contracts) and wires it together so the app can
              activate the auction and strategies programmatically.
            </p>
            <p className="text-zinc-600">
              Exact contract names can vary by version; after deployment, the “Contracts deployed” panel lists everything with Basescan links.
            </p>
          </>
        ),
      },
      {
        id: 'who-needs-50m',
        question: 'Which wallet needs to hold the 50,000,000 tokens?',
        search: '50m minimum first deposit which wallet owner',
        answer: (
          <>
            <p>
              The vault’s <span className="text-white">owner wallet</span> (the address you choose in the deploy UI) must hold the minimum first deposit,
              because that wallet is the one funding the initial onchain deposit.
            </p>
            <p className="text-zinc-600">
              If you have multiple addresses, you can pick any of them as owner — just make sure the selected owner holds the tokens at deploy time.
            </p>
          </>
        ),
      },
      {
        id: 'one-click',
        question: 'Is deployment really “one click”?',
        search: 'one click deploy batch wallet_sendCalls smart wallet',
        answer: (
          <>
            <p>
              The deploy flow is designed to batch multiple contract calls into a single user approval (including the first deposit and auction launch).
            </p>
            <p className="text-zinc-600">
              Some wallets don’t support call batching. If you see a <span className="mono">wallet_sendCalls</span> error, Creator Vaults will fall back
              to multiple confirmations.
            </p>
            <p className="text-zinc-600">
              If your wallet blocks large transaction payloads (e.g. “oversized data”), Creator Vaults will fall back to multiple confirmations.
            </p>
          </>
        ),
      },
      {
        id: 'after-deploy',
        question: 'What should I do right after deploying?',
        search: 'after deploy status verify share',
        answer: (
          <>
            <ul className="list-disc list-inside space-y-1 text-zinc-500">
              <li>Open the Status page and confirm all checks pass</li>
              <li>Open the vault page and verify the auction panel loads (if configured)</li>
              <li>Share the vault link with your community</li>
            </ul>
            <p className="text-zinc-600">
              If something is miswired and you’re the owner, fix actions appear on the Status page.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common UI and data issues.',
    items: [
      {
        id: 'dexscreener-loading',
        question: 'Dexscreener stats aren’t loading — what should I check?',
        search: 'dexscreener not loading api',
        answer: (
          <>
            <p>
              If market data is missing, first check the Status page (server-side API health) and confirm you’re not hitting a blocked or cached
              response.
            </p>
            <p className="text-zinc-600">
              Ad blockers and aggressive privacy extensions can also block third‑party requests. Try a clean browser profile if it looks “stuck.”
            </p>
          </>
        ),
      },
      {
        id: 'token-images',
        question: 'Token images don’t show up — why?',
        search: 'token image ipfs tokenuri zora',
        answer: (
          <>
            <p>
              Token images can come from a token’s onchain <span className="mono">tokenURI()</span>, Zora metadata, and/or IPFS gateways.
              If your network blocks an IPFS gateway, images may fail to load.
            </p>
            <p className="text-zinc-600">
              We always fall back to a default icon when available — but metadata quality varies by token.
            </p>
          </>
        ),
      },
    ],
  },
]

export function Faq() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [activeSection, setActiveSection] = useState<string>('basics')
  const searchRef = useRef<HTMLInputElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const sections = useMemo(() => {
    if (!normalizedQuery) return FAQ_SECTIONS
    return FAQ_SECTIONS.map((s) => {
      const items = s.items.filter((i) => {
        const haystack = `${i.question} ${i.search}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      return { ...s, items }
    }).filter((s) => s.items.length > 0)
  }, [normalizedQuery])

  const totalResults = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections],
  )

  const visibleItemIds = useMemo(() => sections.flatMap((s) => s.items.map((i) => i.id)), [sections])

  function expandAllVisible() {
    setOpen((prev) => {
      const next = { ...prev }
      for (const id of visibleItemIds) next[id] = true
      return next
    })
  }

  function collapseAll() {
    setOpen({})
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement
        const isTyping =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable)
        if (isTyping) return
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    // Auto-expand filtered results to make search feel "instant answer" instead of "find then click".
    if (!normalizedQuery) return
    const next: Record<string, boolean> = {}
    for (const id of visibleItemIds) next[id] = true
    setOpen(next)
  }, [normalizedQuery, visibleItemIds])

  useEffect(() => {
    // Update active section for the desktop TOC.
    const ids = sections.map((s) => `faq-section-${s.id}`)
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((x): x is HTMLElement => !!x)

    if (els.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))
        const top = visible[0]?.target?.id
        if (!top) return
        const nextId = top.replace('faq-section-', '')
        setActiveSection(nextId)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0.05, 0.1, 0.2] },
    )

    for (const el of els) obs.observe(el)
    return () => obs.disconnect()
  }, [sections])

  useEffect(() => {
    // If filtering changes which sections exist, keep the highlighted section valid.
    if (sections.length === 0) return
    if (sections.some((s) => s.id === activeSection)) return
    setActiveSection(sections[0].id)
  }, [sections, activeSection])

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div>
            <span className="label">FAQ</span>
              <h1 className="headline text-3xl sm:text-5xl mt-4">Frequently asked questions</h1>
              <p className="text-sm text-zinc-500 font-light max-w-prose mt-4">
                Short answers, no fluff. Built for creators launching and users bidding, trading, and holding.
              </p>
            </div>
          </motion.div>

          <div className="mt-10 grid lg:grid-cols-[320px_1fr] gap-8 lg:gap-10">
            {/* Left rail */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              {/* Quick links */}
              <div className={`${surface} ${surfaceInteractive} p-5`}>
                <span className="label">Start here</span>
                <div className="mt-4 space-y-2">
                  <Link to="/faq/how-it-works" className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className="space-y-1">
                      <div className="text-white font-light">How it works</div>
                      <div className="text-xs text-zinc-600 font-light">Deposit → {SHARE_TOKEN} → earn → redeem</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </Link>
                  <Link to="/status" className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className="space-y-1">
                      <div className="text-white font-light">Status & fixes</div>
                      <div className="text-xs text-zinc-600 font-light">Wiring checks + owner-only fix actions</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </Link>
                </div>
              </div>

              {/* Search */}
              <div className={`${surface} ${surfaceInteractive} p-5`}>
                <div className="flex items-center justify-between">
                  <span className="label">Search</span>
                  <span className="hidden sm:inline text-[10px] text-zinc-600 font-mono">Press /</span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-black/30 border border-white/5 px-4 py-3 focus-within:border-white/10 focus-within:ring-1 focus-within:ring-cyan-400/30 transition">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Try: CCA, withdraw, oracle, 50M…"
                      className="w-full bg-transparent outline-none text-sm text-zinc-200 placeholder:text-zinc-700"
                    />
                    {normalizedQuery ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="p-1 rounded-md hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 text-xs text-zinc-600 font-light">
                    {normalizedQuery ? (
                      <>
                        {totalResults} result{totalResults === 1 ? '' : 's'} for “{query.trim()}”
                      </>
                    ) : (
                      <>Browse by section, or search for a keyword.</>
                    )}
                  </div>

                  {!normalizedQuery ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['CCA', 'Withdraw', 'Oracle', '50M', 'Bridge'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setQuery(t)}
                          className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-zinc-400 hover:text-white hover:border-white/10 transition"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Table of contents */}
              <div className={`${surface} ${surfaceInteractive} p-5`}>
                <div className="flex items-center justify-between">
                  <span className="label">Sections</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAllVisible}
                      className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      Expand
                    </button>
                    <span className="text-zinc-800">·</span>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      Collapse
                    </button>
                  </div>
                </div>

                <nav className="mt-4 space-y-1">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#faq-section-${s.id}`}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${
                        activeSection === s.id ? 'bg-white/[0.04] text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="text-sm font-light">{s.title}</span>
                      <span className="text-[11px] text-zinc-600 font-mono">{s.items.length}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main content */}
            <div>
              {sections.length === 0 ? (
                <div className={`${surface} p-8 text-center`}>
                  <div className="headline text-2xl">No matches</div>
                  <p className="text-zinc-600 text-sm font-light mt-3">
                    Try a different keyword, or start with{' '}
                    <Link to="/faq/how-it-works" className="text-brand-accent hover:text-brand-400 underline underline-offset-4">
                      How it works
            </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {sections.map((section) => (
                    <div key={section.id} id={`faq-section-${section.id}`} className="scroll-mt-28">
                      <div className="mb-4">
                        <div className="flex items-end justify-between gap-4">
                          <div className="headline text-2xl sm:text-3xl">{section.title}</div>
                          <div className="text-xs text-zinc-600 font-mono">{section.items.length} questions</div>
                        </div>
                        {section.description ? (
                          <p className="text-zinc-600 text-sm font-light mt-2">{section.description}</p>
                        ) : null}
                      </div>

                      <div className={`${surface} overflow-hidden`}>
                        <div className="divide-y divide-white/5">
                        {section.items.map((item) => (
                          <FaqAccordionItem
                            key={item.id}
                            item={item}
                            isOpen={!!open[item.id]}
                            onToggle={() => setOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          />
                        ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className={`${surface} p-6 sm:p-8`}>
                    <span className="label">Note</span>
                    <p className="text-zinc-500 text-sm font-light mt-3 leading-relaxed">
                      This FAQ is informational only and not financial advice. If you’re unsure about risk, verify the contracts onchain and start small.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="headline text-4xl sm:text-5xl lg:text-6xl mb-8">
              Ready to start earning?
            </h2>
            <Link to="/dashboard" className="btn-accent inline-block">
              Browse Vaults <ArrowRight className="w-4 h-4 inline ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
