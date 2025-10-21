import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatUnits, parseUnits, formatEther } from 'ethers';
import { motion } from 'framer-motion';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function deposit(uint256 wlfiAmount, uint256 usd1Amount, address receiver) returns (uint256)',
  'function withdraw(uint256 shares, address receiver, address owner) returns (uint256, uint256)',
  'function previewDeposit(uint256 wlfiAmount, uint256 usd1Amount) view returns (uint256)',
  'function previewWithdraw(uint256 shares) view returns (uint256, uint256)',
];

const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

interface Props {
  provider: BrowserProvider | null;
  account: string;
  onToast: (toast: { message: string; type: 'success' | 'error' | 'info'; txHash?: string }) => void;
  onNavigateUp: () => void;
}

export default function VaultView({ provider, account, onToast, onNavigateUp }: Props) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [wlfiAmount, setWlfiAmount] = useState('');
  const [usd1Amount, setUsd1Amount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [balances, setBalances] = useState({
    wlfi: '0',
    usd1: '0',
    vEagle: '0',
    totalAssets: '0',
    totalSupply: '0',
  });

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!provider || !account) return;
      
      try {
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        const wlfi = new Contract(CONTRACTS.WLFI, TOKEN_ABI, provider);
        const usd1 = new Contract(CONTRACTS.USD1, TOKEN_ABI, provider);

        const [wlfiBal, usd1Bal, vEagleBal, totalAssets, totalSupply] = await Promise.all([
          wlfi.balanceOf(account),
          usd1.balanceOf(account),
          vault.balanceOf(account),
          vault.totalAssets(),
          vault.totalSupply(),
        ]);

        setBalances({
          wlfi: formatEther(wlfiBal),
          usd1: formatUnits(usd1Bal, 18),
          vEagle: formatEther(vEagleBal),
          totalAssets: formatEther(totalAssets),
          totalSupply: formatEther(totalSupply),
        });
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [provider, account]);

  const handleDeposit = async () => {
    if (!provider || !account) {
      onToast({ message: 'Please connect your wallet', type: 'error' });
      return;
    }

    if (!wlfiAmount && !usd1Amount) {
      onToast({ message: 'Please enter an amount', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const signer = await provider.getSigner();
      const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      
      const wlfiAmt = wlfiAmount ? parseUnits(wlfiAmount, 18) : 0n;
      const usd1Amt = usd1Amount ? parseUnits(usd1Amount, 18) : 0n;

      // Approve tokens if needed
      if (wlfiAmt > 0n) {
        const wlfi = new Contract(CONTRACTS.WLFI, TOKEN_ABI, signer);
        const allowance = await wlfi.allowance(account, CONTRACTS.VAULT);
        if (allowance < wlfiAmt) {
          const approveTx = await wlfi.approve(CONTRACTS.VAULT, wlfiAmt);
          await approveTx.wait();
        }
      }

      if (usd1Amt > 0n) {
        const usd1 = new Contract(CONTRACTS.USD1, TOKEN_ABI, signer);
        const allowance = await usd1.allowance(account, CONTRACTS.VAULT);
        if (allowance < usd1Amt) {
          const approveTx = await usd1.approve(CONTRACTS.VAULT, usd1Amt);
          await approveTx.wait();
        }
      }

      const tx = await vault.deposit(wlfiAmt, usd1Amt, account);
      onToast({ message: 'Depositing...', type: 'info', txHash: tx.hash });
      
      const receipt = await tx.wait();
      onToast({ message: 'Deposit successful!', type: 'success', txHash: receipt.hash });
      
      setWlfiAmount('');
      setUsd1Amount('');
    } catch (error: any) {
      console.error('Deposit error:', error);
      onToast({ message: error.message || 'Deposit failed', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!provider || !account) {
      onToast({ message: 'Please connect your wallet', type: 'error' });
      return;
    }

    if (!withdrawShares) {
      onToast({ message: 'Please enter shares amount', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const signer = await provider.getSigner();
      const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      
      const shares = parseUnits(withdrawShares, 18);
      const tx = await vault.withdraw(shares, account, account);
      
      onToast({ message: 'Withdrawing...', type: 'info', txHash: tx.hash });
      const receipt = await tx.wait();
      onToast({ message: 'Withdrawal successful!', type: 'success', txHash: receipt.hash });
      
      setWithdrawShares('');
    } catch (error: any) {
      console.error('Withdraw error:', error);
      onToast({ message: error.message || 'Withdrawal failed', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] overflow-y-auto">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Back Button */}
        <button 
          onClick={onNavigateUp}
          className="flex items-center gap-2 text-gray-400 hover:text-yellow-500 mb-6 transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="text-sm font-medium">Back to Main Floor</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent mb-3">
            Vault Engine
          </h1>
          <p className="text-lg text-gray-400">
            Deposit WLFI + USD1 to receive vEAGLE shares and earn yield
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-sm text-gray-400 mb-2">Total Assets</p>
            <p className="text-3xl font-bold text-white">${Number(balances.totalAssets).toFixed(2)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-sm text-gray-400 mb-2">Your vEAGLE</p>
            <p className="text-3xl font-bold text-yellow-500">{Number(balances.vEagle).toFixed(4)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-sm text-gray-400 mb-2">APY</p>
            <p className="text-3xl font-bold text-emerald-500">22.22%</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/20 p-8">
          {/* Tabs */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setTab('deposit')}
              className={`flex-1 py-4 rounded-xl font-semibold transition-all ${
                tab === 'deposit'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setTab('withdraw')}
              className={`flex-1 py-4 rounded-xl font-semibold transition-all ${
                tab === 'withdraw'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Withdraw
            </button>
          </div>

          {/* Deposit Form */}
          {tab === 'deposit' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">WLFI Amount</label>
                  <button
                    onClick={() => setWlfiAmount(balances.wlfi)}
                    className="text-sm text-yellow-500 hover:text-yellow-400"
                  >
                    Max: {Number(balances.wlfi).toFixed(4)}
                  </button>
                </div>
                <input
                  type="number"
                  value={wlfiAmount}
                  onChange={(e) => setWlfiAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-6 py-4 text-white text-2xl focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">USD1 Amount</label>
                  <button
                    onClick={() => setUsd1Amount(balances.usd1)}
                    className="text-sm text-yellow-500 hover:text-yellow-400"
                  >
                    Max: {Number(balances.usd1).toFixed(4)}
                  </button>
                </div>
                <input
                  type="number"
                  value={usd1Amount}
                  onChange={(e) => setUsd1Amount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-6 py-4 text-white text-2xl focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <button
                onClick={handleDeposit}
                disabled={isLoading || (!wlfiAmount && !usd1Amount)}
                className="w-full py-5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg transition-all"
              >
                {isLoading ? 'Depositing...' : 'Deposit'}
              </button>
            </div>
          )}

          {/* Withdraw Form */}
          {tab === 'withdraw' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">vEAGLE Shares</label>
                  <button
                    onClick={() => setWithdrawShares(balances.vEagle)}
                    className="text-sm text-yellow-500 hover:text-yellow-400"
                  >
                    Max: {Number(balances.vEagle).toFixed(4)}
                  </button>
                </div>
                <input
                  type="number"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-6 py-4 text-white text-2xl focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={isLoading || !withdrawShares}
                className="w-full py-5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg transition-all"
              >
                {isLoading ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">How it Works</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>Deposit WLFI and/or USD1 tokens</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>Receive vEAGLE shares representing your position</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>Vault automatically deploys to yield strategies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>Withdraw anytime by burning vEAGLE shares</span>
              </li>
            </ul>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Current Strategy</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Protocol</span>
                <span className="text-white font-medium">Charm Finance</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pool</span>
                <span className="text-white font-medium">WLFI/USD1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee Tier</span>
                <span className="text-white font-medium">1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-emerald-400 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

