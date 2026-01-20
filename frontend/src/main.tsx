import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import { Web3Gate } from './web3/Web3Gate'
import { initZoraCoinsSdk } from '@/lib/zora/init'
import { PrivyClientProvider } from '@/lib/privy/client'
import '@coinbase/onchainkit/styles.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

// Safe to call without a key: the app will use server-side proxy endpoints by default.
void initZoraCoinsSdk()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrivyClientProvider>
        <BrowserRouter>
          <Web3Gate>
            <App />
          </Web3Gate>
        </BrowserRouter>
      </PrivyClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
