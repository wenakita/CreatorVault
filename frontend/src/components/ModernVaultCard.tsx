import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = [
  'function depositDual(uint256 wlfiAmount, uint256 usd1Amount, address receiver) returns (uint256)',
  'function withdrawDual(uint256 shares, address receiver) returns (uint256, uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

interface Props {
  provider: BrowserProvider | null;
  account: string;
  onToast: (toast: { message: string; type: 'success' | 'error' | 'info'; txHash?: string }) => void;
}

export default function ModernVaultCard({ provider, account, onToast }: Props) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [wlfiAmount, setWlfiAmount] = useState('');
  const [usd1Amount, setUsd1Amount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState({ wlfi: '0', usd1: '0', vEagle: '0' });

  useEffect(() => {
    const fetchBalances = async () => {
      if (!provider || !account) return;
      
      try {
        const wlfi = new Contract(CONTRACTS.WLFI, ERC20_ABI, provider);
        const usd1 = new Contract(CONTRACTS.USD1, ERC20_ABI, provider);
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        
        const [wlfiB, usd1B, vEagleB] = await Promise.all([
          wlfi.balanceOf(account),
          usd1.balanceOf(account),
          vault.balanceOf(account),
        ]);
        
        setBalances({
          wlfi: formatEther(wlfiB),
          usd1: formatEther(usd1B),
          vEagle: formatEther(vEagleB),
        });
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };
    
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [provider, account]);

  const handleDeposit = async () => {
    if (!provider || !account) {
      onToast({ message: 'Please connect your wallet', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      const signer = await provider.getSigner();
      
      const wlfiAmt = wlfiAmount ? parseEther(wlfiAmount) : 0n;
      const usd1Amt = usd1Amount ? parseEther(usd1Amount) : 0n;
      
      // Approve tokens
      if (wlfiAmt > 0n) {
        const wlfi = new Contract(CONTRACTS.WLFI, ERC20_ABI, signer);
        const allowance = await wlfi.allowance(account, CONTRACTS.VAULT);
        if (allowance < wlfiAmt) {
          onToast({ message: 'Approving WLFI...', type: 'info' });
          const tx = await wlfi.approve(CONTRACTS.VAULT, wlfiAmt);
          await tx.wait();
        }
      }
      
      if (usd1Amt > 0n) {
        const usd1 = new Contract(CONTRACTS.USD1, ERC20_ABI, signer);
        const allowance = await usd1.allowance(account, CONTRACTS.VAULT);
        if (allowance < usd1Amt) {
          onToast({ message: 'Approving USD1...', type: 'info' });
          const tx = await usd1.approve(CONTRACTS.VAULT, usd1Amt);
          await tx.wait();
        }
      }
      
      // Deposit
      const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.depositDual(wlfiAmt, usd1Amt, account);
      onToast({ message: 'Depositing...', type: 'info', txHash: tx.hash });
      
      await tx.wait();
      onToast({ message: 'Deposit successful!', type: 'success', txHash: tx.hash });
      
      setWlfiAmount('');
      setUsd1Amount('');
    } catch (error: any) {
      console.error('Deposit error:', error);
      onToast({ message: error.message || 'Deposit failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!provider || !account) {
      onToast({ message: 'Please connect your wallet', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      const signer = await provider.getSigner();
      const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      
      const shares = parseEther(withdrawAmount);
      const tx = await vault.withdrawDual(shares, account);
      onToast({ message: 'Withdrawing...', type: 'info', txHash: tx.hash });
      
      await tx.wait();
      onToast({ message: 'Withdrawal successful!', type: 'success', txHash: tx.hash });
      
      setWithdrawAmount('');
    } catch (error: any) {
      console.error('Withdraw error:', error);
      onToast({ message: error.message || 'Withdrawal failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl border border-white/10 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
            activeTab === 'deposit'
              ? 'bg-white/10 text-white border-b-2 border-yellow-500'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
            activeTab === 'withdraw'
              ? 'bg-white/10 text-white border-b-2 border-yellow-500'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Withdraw
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'deposit' ? (
          <div className="space-y-4">
            {/* WLFI Input */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">WLFI Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={wlfiAmount}
                  onChange={(e) => setWlfiAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 font-mono"
                />
                <button
                  onClick={() => setWlfiAmount(balances.wlfi)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yellow-500 hover:text-yellow-400"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Balance: {Number(balances.wlfi).toFixed(4)} WLFI</p>
            </div>

            {/* USD1 Input */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">USD1 Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={usd1Amount}
                  onChange={(e) => setUsd1Amount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 font-mono"
                />
                <button
                  onClick={() => setUsd1Amount(balances.usd1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yellow-500 hover:text-yellow-400"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Balance: {Number(balances.usd1).toFixed(4)} USD1</p>
            </div>

            <button
              onClick={handleDeposit}
              disabled={loading || !account || (!wlfiAmount && !usd1Amount)}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all"
            >
              {loading ? 'Depositing...' : 'Deposit'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Withdraw Input */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">vEAGLE Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 font-mono"
                />
                <button
                  onClick={() => setWithdrawAmount(balances.vEagle)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yellow-500 hover:text-yellow-400"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Balance: {Number(balances.vEagle).toFixed(2)} vEAGLE</p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={loading || !account || !withdrawAmount}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all"
            >
              {loading ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

