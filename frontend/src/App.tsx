import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import ModernHeader from './components/ModernHeader';
import EagleEcosystem from './components/EagleEcosystem';
import VaultView from './components/VaultView';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  txHash?: string;
}

export default function App() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount('');
          setProvider(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const provider = new BrowserProvider(window.ethereum);
          setProvider(provider);
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      showToast('Please install MetaMask', 'error');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
      setAccount(accounts[0]);
      showToast('Wallet connected', 'success');
    } catch (error: any) {
      console.error('Connection error:', error);
      showToast(error.message || 'Failed to connect wallet', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info', txHash?: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, txHash }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent" />
      
      {/* Fixed Header */}
      <div className="relative z-20">
        <ModernHeader 
          account={account}
          onConnect={connectWallet}
          provider={provider}
        />
      </div>

      {/* Main Content Area - Full Height Between Header & Footer */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <EagleEcosystem 
          provider={provider}
          account={account}
          onToast={showToast}
          VaultComponent={VaultView}
        />
      </div>

      {/* Fixed Footer */}
      <footer className="relative z-20 border-t border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
                alt="Eagle" 
                className="w-7 h-7"
              />
              <span className="text-sm text-gray-400">
                © 2025 Eagle Vault. All rights reserved.
                </span>
            </div>

            <div className="flex items-center gap-6">
              <a 
                href="https://docs.47eagle.com" 
                          target="_blank"
                          rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-yellow-500 transition-colors"
                        >
                Docs
                        </a>
                        <a 
                href="https://x.com/teameagle47" 
                          target="_blank"
                          rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-yellow-500 transition-colors"
              >
                Twitter
              </a>
              <a 
                href="https://t.me/Eagle_community_47" 
                              target="_blank"
                              rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-yellow-500 transition-colors"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-24 right-6 z-50 space-y-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`
                px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl border
                ${toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50' : ''}
                ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/50' : ''}
                ${toast.type === 'info' ? 'bg-blue-500/20 border-blue-500/50' : ''}
              `}
            >
              <p className="text-sm font-medium text-white">{toast.message}</p>
              {toast.txHash && (
                <a
                  href={`https://etherscan.io/tx/${toast.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                >
                  View on Etherscan →
                </a>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
