let initPromise: Promise<void> | null = null

/**
 * Initializes the Zora Coins SDK with a public (browser) API key.
 *
 * Notes:
 * - This key is public by design. Restrict Allowed Origins in Zora Developer Settings.
 * - We lazy-load the SDK to avoid inflating the initial bundle.
 */
export function initZoraCoinsSdk(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const key = import.meta.env.VITE_ZORA_PUBLIC_API_KEY
    if (!key) return

    const { setApiKey } = await import('@zoralabs/coins-sdk')
    setApiKey(key)
  })()

  return initPromise
}


