import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { base } from 'wagmi/chains'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { ConnectButton } from '@/components/ConnectButton'
import { useZoraCoin } from '@/lib/zora/hooks'

const ZORA_COIN_READ_ABI = [
  {
    name: 'payoutRecipient',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

function shortAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function CoinManage() {
  const params = useParams()
  const { address: connectedAddress, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: base.id })

  const coinAddress = (params.address && isAddress(params.address)) ? (params.address as Address) : undefined
  const { data: coinDetails } = useZoraCoin(coinAddress)

  const { data: payoutRecipient } = useReadContract({
    address: coinAddress,
    abi: ZORA_COIN_READ_ABI,
    functionName: 'payoutRecipient',
    query: { enabled: !!coinAddress },
  })

  const [newPayoutRecipient, setNewPayoutRecipient] = useState('')
  const newPayoutIsValid = useMemo(() => isAddress(newPayoutRecipient), [newPayoutRecipient])

  const [newUri, setNewUri] = useState('')
  const uriLooksValid = useMemo(() => newUri.trim().startsWith('ipfs://') || newUri.trim().startsWith('https://'), [newUri])

  const [metaName, setMetaName] = useState('')
  const [metaSymbol, setMetaSymbol] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [metaImageUri, setMetaImageUri] = useState('')
  const [metaCategory, setMetaCategory] = useState('creator')

  const [txError, setTxError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [busy, setBusy] = useState<'payout' | 'uri' | 'upload' | null>(null)

  async function updatePayout() {
    if (!coinAddress || !walletClient || !publicClient || !newPayoutIsValid) return
    setTxError(null)
    setTxHash(null)
    setBusy('payout')

    try {
      const sdk = await import('@zoralabs/coins-sdk')
      const result = await sdk.updatePayoutRecipient(
        {
          coin: coinAddress,
          newPayoutRecipient: newPayoutRecipient as Address,
        },
        walletClient as any,
        publicClient as any,
      )
      setTxHash(result.hash)
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || 'Transaction failed')
    } finally {
      setBusy(null)
    }
  }

  async function updateUri() {
    if (!coinAddress || !walletClient || !publicClient || !uriLooksValid) return
    setTxError(null)
    setTxHash(null)
    setBusy('uri')

    try {
      const uri = newUri.trim()

      // Validate that the URI resolves to a JSON metadata object (not an image).
      const sdk: any = await import('@zoralabs/coins-sdk')
      await sdk.validateMetadataURIContent(uri)

      // Write onchain (allow ipfs:// or https://, as long as content is valid).
      const { coinABI } = await import('@zoralabs/protocol-deployments')
      const hash = await (walletClient as any).writeContract({
        account: (walletClient as any).account,
        chain: base as any,
        address: coinAddress,
        abi: coinABI as any,
        functionName: 'setContractURI',
        args: [uri],
      })

      setTxHash(hash)
      await (publicClient as any).waitForTransactionReceipt({ hash })
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || 'Transaction failed')
    } finally {
      setBusy(null)
    }
  }

  const metadataJson = useMemo(() => {
    const properties: Record<string, unknown> = {}
    if (metaCategory.trim()) properties.category = metaCategory.trim()
    if (metaSymbol.trim()) properties.symbol = metaSymbol.trim()
    if (coinAddress) properties.coinAddress = coinAddress
    if (connectedAddress) properties.editor = connectedAddress

    const baseObj: Record<string, unknown> = {
      name: metaName.trim(),
      description: metaDescription.trim(),
      image: metaImageUri.trim(),
    }
    if (Object.keys(properties).length > 0) baseObj.properties = properties
    return baseObj
  }, [coinAddress, connectedAddress, metaCategory, metaDescription, metaImageUri, metaName, metaSymbol])

  const canBuildMetadataJson = useMemo(() => {
    // Zora validator requires name/description/image to be strings, and image to be a valid URI.
    const nameOk = metaName.trim().length > 0
    const descOk = metaDescription.trim().length > 0
    const img = metaImageUri.trim()
    const imgOk = img.startsWith('ipfs://') || img.startsWith('https://') || img.startsWith('ar://') || img.startsWith('data:')
    return nameOk && descOk && imgOk
  }, [metaDescription, metaImageUri, metaName])

  async function copyMetadataJson() {
    if (!canBuildMetadataJson) return
    setTxError(null)
    setBusy('upload')
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.validateMetadataJSON(metadataJson)
      await navigator.clipboard.writeText(JSON.stringify(metadataJson, null, 2))
    } catch (e: any) {
      setTxError(e?.message || 'Failed to build metadata JSON')
    } finally {
      setBusy(null)
    }
  }

  function downloadMetadataJson() {
    if (!canBuildMetadataJson) return
    const blob = new Blob([JSON.stringify(metadataJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${metaSymbol.trim() || 'coin'}-metadata.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-10">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">Back</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <span className="label">Creator</span>
              <h1 className="headline text-4xl sm:text-6xl">Manage Coin</h1>
              <p className="text-zinc-600 text-sm font-light">
                Updates are wallet-signed and only work if you are an owner of the coin contract.
              </p>
            </div>

            {!coinAddress ? (
              <div className="card p-8 text-sm text-zinc-600">
                Invalid coin address in URL.
              </div>
            ) : !isConnected ? (
              <div className="card p-8 space-y-4">
                <div className="label">Connect required</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Coin summary */}
                <div className="card p-8 space-y-2">
                  <div className="label">Coin</div>
                  <div className="text-white font-light text-xl">
                    {coinDetails?.name ? String(coinDetails.name) : '—'}{' '}
                    <span className="text-zinc-600 font-mono text-sm">
                      {coinDetails?.symbol ? String(coinDetails.symbol) : ''}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono">{coinAddress}</div>
                  {coinDetails?.tokenUri && (
                    <div className="text-xs text-zinc-600">
                      Current URI: <span className="font-mono">{String(coinDetails.tokenUri)}</span>
                    </div>
                  )}
                </div>

                {/* Payout recipient */}
                <div className="card p-8 space-y-4">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="label">Payout recipient</div>
                      <div className="text-sm text-zinc-500 mt-2">
                        Current:{' '}
                        <span className="font-mono text-zinc-300">
                          {payoutRecipient ? shortAddress(String(payoutRecipient)) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="label">New payout recipient</label>
                    <input
                      value={newPayoutRecipient}
                      onChange={(e) => setNewPayoutRecipient(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                  </div>

                  <button
                    onClick={updatePayout}
                    disabled={busy !== null || !newPayoutIsValid}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === 'payout' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Updating…
                      </>
                    ) : (
                      'Update payout recipient'
                    )}
                  </button>
                </div>

                {/* Metadata URI */}
                <div className="card p-8 space-y-4">
                  <div className="label">Metadata</div>

                  <div className="space-y-2">
                    <label className="label">New metadata URI</label>
                    <input
                      value={newUri}
                      onChange={(e) => setNewUri(e.target.value)}
                      placeholder="ipfs://… or https://… (must return JSON)"
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                    <div className="text-xs text-zinc-600">
                      Must point to a valid metadata JSON (not an image). Prefer <span className="font-mono">ipfs://</span>.
                    </div>
                  </div>

                  <button
                    onClick={updateUri}
                    disabled={busy !== null || !uriLooksValid}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === 'uri' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Updating…
                      </>
                    ) : (
                      'Update coin URI'
                    )}
                  </button>

                  <div className="pt-6 border-t border-zinc-900/50 space-y-3">
                    <div className="label">Build metadata JSON (upload to IPFS)</div>
                    <div className="text-xs text-zinc-600">
                      Create a <span className="font-mono">metadata.json</span> file, upload it to IPFS (Pinata), then paste the resulting <span className="font-mono">ipfs://</span> URI above.
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        value={metaName}
                        onChange={(e) => setMetaName(e.target.value)}
                        placeholder="Name"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors"
                      />
                      <input
                        value={metaSymbol}
                        onChange={(e) => setMetaSymbol(e.target.value)}
                        placeholder="Symbol"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors"
                      />
                      <input
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        placeholder="Description"
                        className="sm:col-span-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors"
                      />
                      <input
                        value={metaImageUri}
                        onChange={(e) => setMetaImageUri(e.target.value)}
                        placeholder="Image URI (ipfs://… recommended)"
                        className="sm:col-span-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                      />
                      <input
                        value={metaCategory}
                        onChange={(e) => setMetaCategory(e.target.value)}
                        placeholder="Category (e.g. creator)"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors"
                      />
                      <div className="sm:col-span-1 flex gap-2">
                        <button
                          onClick={() => {
                            try {
                              navigator.clipboard.writeText(JSON.stringify(metadataJson, null, 2))
                            } catch {}
                          }}
                          disabled={!canBuildMetadataJson}
                          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          title="Copies JSON (does not upload)"
                        >
                          Copy JSON
                        </button>
                        <button
                          onClick={downloadMetadataJson}
                          disabled={!canBuildMetadataJson}
                          className="btn-accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          title="Downloads metadata.json (upload it to IPFS)"
                        >
                          Download
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={copyMetadataJson}
                      disabled={busy !== null || !canBuildMetadataJson}
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy === 'upload' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Preparing…
                        </>
                      ) : (
                        'Validate + copy JSON'
                      )}
                    </button>
                  </div>
                </div>

                {/* TX status */}
                {(txError || txHash) && (
                  <div className="card p-6 space-y-2">
                    {txError && <div className="text-sm text-red-400">{txError}</div>}
                    {txHash && (
                      <a
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cyan-400 hover:underline font-mono"
                      >
                        {txHash.slice(0, 10)}…{txHash.slice(-8)}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  )
}


