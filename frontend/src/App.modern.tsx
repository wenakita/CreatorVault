import { useState } from 'react';
import { useAccount } from 'wagmi';
import ModernHeader from './components/ModernHeader';
import VaultStats from './components/VaultStats';
import ModernVaultCard from './components/ModernVaultCard';
import VaultTabs from './components/VaultTabs';
import Toast from './components/Toast';
import { useEthersProvider } from './hooks/useEthersProvider';
import { CONTRACTS } from './config/contracts';

function App() {
  const { address: account } = useAccount();
  const provider = useEthersProvider();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; txHash?: string } | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]">
      <ModernHeader />
      
      <main className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Back to Vaults Link */}
        <button className="flex items-center gap-2 text-gray-400 hover:text-yellow-500 mb-8 transition-colors group">
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back to vaults</span>
        </button>

        {/* Vault Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
                alt="Eagle Vault"
                className="w-20 h-20 rounded-2xl"
              />
              <div className="absolute -bottom-2 -right-2 flex gap-1">
                <img 
                  src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreifvnbzrefx4pdd6mr653dmrgkz2bdcamrwdsl334f7ed75miosaxu" 
                  alt="WLFI"
                  className="w-7 h-7 rounded-full border-2 border-[#0a0a0a]"
                />
                <img 
                  src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreic74no55hhm544qjraibffhrb4h7zldae5sfsyipvu6dvfyqubppy" 
                  alt="USD1"
                  className="w-7 h-7 rounded-full border-2 border-[#0a0a0a]"
                />
              </div>
            </div>
            
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">Eagle Vault</h1>
              <p className="text-gray-400 font-mono text-sm">
                {CONTRACTS.VAULT.slice(0, 10)}...{CONTRACTS.VAULT.slice(-8)}
              </p>
            </div>

            <div className="flex gap-3">
              <button className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Key Metrics */}
          <VaultStats provider={provider} account={account || ''} />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Deposit/Withdraw */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">From wallet</h2>
            <ModernVaultCard provider={provider} account={account || ''} onToast={setToast} />
            
            {/* You will receive section */}
            <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">You will receive</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <img 
                      src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
                      alt="vEAGLE"
                      className="w-6 h-6"
                    />
                  </div>
                  <div>
                    <p className="text-white font-medium">vEAGLE</p>
                    <p className="text-xs text-gray-500">Vault Shares</p>
                  </div>
                </div>
                <p className="text-2xl font-mono text-white">0.00</p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">0.88% ⚡</span>
                  <span className="text-gray-400">0.88%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Info Tabs */}
          <div className="lg:col-span-2">
            <VaultTabs />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span>© 2025 Eagle Vault</span>
              <a href="#" className="hover:text-yellow-500 transition-colors">Docs</a>
              <a href="#" className="hover:text-yellow-500 transition-colors">GitHub</a>
              <a href="#" className="hover:text-yellow-500 transition-colors">Twitter</a>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Powered by</span>
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreichw4b4wxvinfu4dmkloxajj4mm7672k6q3nyqzvdnvogvlbbycfq" 
                alt="Uniswap"
                className="h-4 w-4"
              />
              <span>Uniswap</span>
              <span>•</span>
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreid3difftzksqy3xlummzzobhk674ece35d7drmgo3ftt7wrix6dwu" 
                alt="Charm"
                className="h-4 w-4"
              />
              <span>Charm</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          txHash={toast.txHash}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;

