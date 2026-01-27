import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { Web3Providers } from './web3/Web3Providers'
import { PrivyClientProvider } from '@/lib/privy/client'
import './index.css'

/**
 * Minimal provider stack:
 * 
 * PrivyClientProvider (social auth only)
 *   └── BrowserRouter
 *         └── Web3Providers (wagmi + react-query)
 *               └── App
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyClientProvider>
      <BrowserRouter>
        <Web3Providers>
          <App />
        </Web3Providers>
      </BrowserRouter>
    </PrivyClientProvider>
  </React.StrictMode>,
)
