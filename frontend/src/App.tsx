import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BrowserProvider } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import ModernHeader from './components/ModernHeader';
import EagleEcosystemWithRoutes from './components/EagleEcosystemWithRoutes';
import { Showcase } from './pages/Showcase';
import { ICONS } from './config/icons';
import { SafeProvider } from './components/SafeProvider';
import { useSafeApp } from './hooks/useSafeApp';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  txHash?: string;
}

function AppContent() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Safe App detection
  const { isSafeApp, safeAddress, sdk } = useSafeApp();

  useEffect(() => {
    const checkConnection = async () => {
      // If running as Safe App, use Safe address and SDK
      if (isSafeApp && safeAddress) {
        console.log('🔐 Running as Safe App:', safeAddress);
        setAccount(safeAddress);
        
        // Create a provider using Safe Apps SDK
        try {
          const safeProvider = new BrowserProvider(sdk.safe as any);
          setProvider(safeProvider);
          showToast({
            message: '🔐 Connected via Safe App',
            type: 'success'
          });
        } catch (error) {
          console.error('Error creating Safe provider:', error);
        }
        return;
      }

      // Standard MetaMask/wallet connection
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

    checkConnection();

    // Only set up listeners for standard wallet (not Safe App)
    if (!isSafeApp && window.ethereum) {
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
      if (!isSafeApp && window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [isSafeApp, safeAddress, sdk]);

  const showToast = (toast: { message: string; type: 'success' | 'error' | 'info'; txHash?: string }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <div className="h-screen flex flex-col bg-neo-bg-light dark:bg-neo-bg-dark transition-colors duration-300">
      {/* Fixed Header */}
      <div className="relative z-20 flex-shrink-0">
        <ModernHeader />
      </div>

      {/* Main Content - 3-Floor Navigation */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <EagleEcosystemWithRoutes 
          provider={provider}
          account={account}
          onToast={showToast}
        />
      </div>

      {/* Fixed Footer */}
      <footer className="relative z-20 flex-shrink-0 border-t border-gray-300 dark:border-gray-700 bg-neo-bg-light dark:bg-neo-bg-dark shadow-neo-pressed dark:shadow-neo-pressed-dark transition-colors duration-300">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <img 
                src={ICONS.EAGLE} 
                alt="Eagle" 
                className="w-5 h-5 sm:w-6 sm:h-6"
              />
              <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium text-center">
                © 2025 Eagle Vault. All rights reserved.
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              <a 
                href="https://docs.47eagle.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 hover:text-eagle-gold dark:hover:text-eagle-gold-light transition-colors font-medium"
              >
                Docs
              </a>
              <a 
                href="https://x.com/teameagle47" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 hover:text-eagle-gold dark:hover:text-eagle-gold-light transition-colors font-medium"
              >
                Twitter
              </a>
              <a 
                href="https://t.me/Eagle_community_47" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 hover:text-eagle-gold dark:hover:text-eagle-gold-light transition-colors font-medium"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-16 sm:bottom-24 right-3 sm:right-6 z-50 space-y-2 sm:space-y-3 max-w-[calc(100vw-1.5rem)] sm:max-w-md">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`
                px-3 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl backdrop-blur-xl border
                ${toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50' : ''}
                ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/50' : ''}
                ${toast.type === 'info' ? 'bg-blue-500/20 border-blue-500/50' : ''}
              `}
            >
              <p className="text-xs sm:text-sm font-medium text-white break-words">{toast.message}</p>
              {toast.txHash && (
                <a
                  href={`https://etherscan.io/tx/${toast.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block break-all"
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

export default function App() {
  return (
    <SafeProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </SafeProvider>
  );
}
