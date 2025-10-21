import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from 'react';
import { Contract, formatEther } from 'ethers';
import { useAccount } from 'wagmi';
import { useEthersProvider } from '../hooks/useEthersProvider';
import { CONTRACTS } from '../config/contracts';
import { ICONS } from '../config/icons';

const VAULT_ABI = ['function getWLFIPrice() view returns (uint256)', 'function getUSD1Price() view returns (uint256)'];

export default function ModernHeader() {
  const [wlfiPrice, setWlfiPrice] = useState<string>('0.132');
  const [usd1Price, setUsd1Price] = useState<string>('1.000');
  const { isConnected } = useAccount();
  const provider = useEthersProvider();

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        if (!provider) return;
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        const [wlfi, usd1] = await Promise.all([
          vault.getWLFIPrice(),
          vault.getUSD1Price()
        ]);
        setWlfiPrice(Number(formatEther(wlfi)).toFixed(3));
        setUsd1Price(Number(formatEther(usd1)).toFixed(3));
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    if (provider) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 30000);
      return () => clearInterval(interval);
    }
  }, [provider]);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <img 
              src={ICONS.EAGLE} 
              alt="Eagle Vault"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-semibold text-white">Eagle Vault</h1>
              <p className="text-xs text-gray-500">Dual-Asset Yield Strategy</p>
            </div>
          </div>

          {/* Center - Price Tickers */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <img 
                src={ICONS.WLFI} 
                alt="WLFI"
                className="w-5 h-5"
              />
              <span className="text-sm font-mono text-gray-300">${wlfiPrice}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <img 
                src={ICONS.USD1} 
                alt="USD1"
                className="w-5 h-5"
              />
              <span className="text-sm font-mono text-gray-300">${usd1Price}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-emerald-400">Ethereum</span>
            </div>
          </div>

          {/* Connect Button */}
          <ConnectButton 
            chainStatus="icon"
            showBalance={false}
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>
    </header>
  );
}

