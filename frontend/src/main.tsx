import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { Web3Gate } from './web3/Web3Gate'
import { initZoraCoinsSdk } from '@/lib/zora/init'
import { PrivyClientProvider } from '@/lib/privy/client'
import '@coinbase/onchainkit/styles.css'
import './index.css'

// Safe to call without a key: the app will use server-side proxy endpoints by default.
void initZoraCoinsSdk()

// NOTE: QueryClientProvider is now inside Web3Providers (required by wagmi v2).
// Wagmi v2 uses TanStack Query internally and expects QueryClientProvider to be
// nested inside WagmiProvider, not outside.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyClientProvider>
      <BrowserRouter>
        <Web3Gate>
          <App />
        </Web3Gate>
      </BrowserRouter>
    </PrivyClientProvider>
  </React.StrictMode>,
)
