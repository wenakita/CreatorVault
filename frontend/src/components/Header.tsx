import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Contract, formatEther } from 'ethers';
import { useAccount } from 'wagmi';
import { useEthersProvider } from '../hooks/useEthersProvider';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = ['function getWLFIPrice() view returns (uint256)'];

export default function Header() {
  const [wlfiPrice, setWlfiPrice] = useState<string>('0.130');
  const { isConnected } = useAccount();
  const provider = useEthersProvider();

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        if (!provider) return;
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        const price = await vault.getWLFIPrice();
        setWlfiPrice(Number(formatEther(price)).toFixed(3));
      } catch (error) {
        console.error('Error fetching WLFI price:', error);
      }
    };

    if (isConnected && provider) {
      fetchPrice();
      const interval = setInterval(fetchPrice, 30000); // Update every 30s
      return () => clearInterval(interval);
    }
  }, [isConnected, provider]);

  return (
    <header className="relative bg-gradient-to-r from-[#0f1118] to-[#1a1d2e] border-b border-gray-800/50 backdrop-blur-sm z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-lg flex items-center justify-center text-2xl shadow-lg">
              🦅
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 text-transparent bg-clip-text">
                Eagle Vault
              </h1>
              <p className="text-xs text-gray-500">Dual-Asset Yield Aggregator</p>
            </div>
          </div>

          {/* Center Info */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#0f1118] rounded-lg border border-gray-800">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">Ethereum Mainnet</span>
            </div>
            {isConnected && (
              <div className="px-4 py-2 bg-[#0f1118] rounded-lg border border-gray-800">
                <div className="text-xs text-gray-400">WLFI Price</div>
                <div className="text-sm font-semibold text-white">${wlfiPrice}</div>
              </div>
            )}
          </div>

          {/* Right Side - Connect Button */}
          <div className="flex items-center gap-4">
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
      </div>
    </header>
  );
}
