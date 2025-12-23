import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { base } from 'wagmi/chains'

import App from './App'
import { wagmiConfig } from './config/wagmi'
import './index.css'

// Polyfill Buffer for WalletConnect
import { Buffer } from 'buffer'
window.Buffer = Buffer

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={base}
          apiKey={import.meta.env.VITE_CDP_API_KEY}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)

