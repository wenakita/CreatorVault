import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatUnits, parseUnits, formatEther } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
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

  const tvl = Number(balances.totalAssets);
  const userVaultValue = Number(balances.vEagle);

  return (
    <div className="h-full bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] overflow-y-auto">
      <div className="container mx-auto px-8 py-8 max-w-7xl">
        {/* Back Button */}
        <motion.button 
          onClick={onNavigateUp}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-gray-400 hover:text-yellow-500 mb-8 transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="text-sm font-medium">Back to Home</span>
        </motion.button>

        {/* Hero Stats - Full Width */}
        <motion.div 
          className="grid grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Total Value Locked */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300" />
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Total Value Locked</p>
                  <p className="text-3xl font-bold text-white">${tvl.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Active</span>
              </div>
            </div>
          </div>

          {/* Your Position */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300" />
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Your vEAGLE Shares</p>
                  <p className="text-3xl font-bold text-white">{userVaultValue.toFixed(4)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect wallet'}
              </p>
            </div>
          </div>

          {/* APY */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300" />
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Current APY</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">22.22%</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">Auto-compounding yield</p>
            </div>
          </div>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Deposit/Withdraw Interface */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 rounded-3xl blur-xl" />
              
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-3xl border border-white/20 p-8">
                {/* Tabs */}
                <div className="flex gap-3 mb-8">
                  <button
                    onClick={() => setTab('deposit')}
                    className={`flex-1 py-4 px-6 rounded-2xl font-semibold transition-all duration-300 ${
                      tab === 'deposit'
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Deposit</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setTab('withdraw')}
                    className={`flex-1 py-4 px-6 rounded-2xl font-semibold transition-all duration-300 ${
                      tab === 'withdraw'
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      <span>Withdraw</span>
                    </div>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {/* Deposit Form */}
                  {tab === 'deposit' && (
                    <motion.div
                      key="deposit"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* WLFI Input */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-gray-300">WLFI Amount</label>
                          <button
                            onClick={() => setWlfiAmount(balances.wlfi)}
                            className="text-sm text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                          >
                            Balance: {Number(balances.wlfi).toFixed(4)}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={wlfiAmount}
                            onChange={(e) => setWlfiAmount(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-black/40 border-2 border-white/10 focus:border-yellow-500/50 rounded-2xl px-6 py-5 text-white text-2xl font-medium focus:outline-none transition-all"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                            <span className="text-sm font-medium">WLFI</span>
                          </div>
                        </div>
                      </div>

                      {/* USD1 Input */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-gray-300">USD1 Amount</label>
                          <button
                            onClick={() => setUsd1Amount(balances.usd1)}
                            className="text-sm text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                          >
                            Balance: {Number(balances.usd1).toFixed(4)}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={usd1Amount}
                            onChange={(e) => setUsd1Amount(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-black/40 border-2 border-white/10 focus:border-yellow-500/50 rounded-2xl px-6 py-5 text-white text-2xl font-medium focus:outline-none transition-all"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                            <span className="text-sm font-medium">USD1</span>
                          </div>
                        </div>
                      </div>

                      {/* Expected Output */}
                      {(wlfiAmount || usd1Amount) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-yellow-200">You will receive (approx)</span>
                            <span className="text-lg font-bold text-yellow-500">~{(Number(wlfiAmount || 0) + Number(usd1Amount || 0)).toFixed(4)} vEAGLE</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Deposit Button */}
                      <button
                        onClick={handleDeposit}
                        disabled={isLoading || (!wlfiAmount && !usd1Amount)}
                        className="w-full py-6 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 disabled:shadow-none"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          'Deposit & Earn Yield'
                        )}
                      </button>
                    </motion.div>
                  )}

                  {/* Withdraw Form */}
                  {tab === 'withdraw' && (
                    <motion.div
                      key="withdraw"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* vEAGLE Input */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-gray-300">vEAGLE Shares</label>
                          <button
                            onClick={() => setWithdrawShares(balances.vEagle)}
                            className="text-sm text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                          >
                            Balance: {Number(balances.vEagle).toFixed(4)}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={withdrawShares}
                            onChange={(e) => setWithdrawShares(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-black/40 border-2 border-white/10 focus:border-yellow-500/50 rounded-2xl px-6 py-5 text-white text-2xl font-medium focus:outline-none transition-all"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                            <span className="text-sm font-medium">vEAGLE</span>
                          </div>
                        </div>
                      </div>

                      {/* Expected Output */}
                      {withdrawShares && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-yellow-200">You will receive (approx)</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">WLFI</span>
                              <span className="text-sm font-bold text-white">~{(Number(withdrawShares) * 0.5).toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-400">USD1</span>
                              <span className="text-sm font-bold text-white">~{(Number(withdrawShares) * 0.5).toFixed(4)}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Withdraw Button */}
                      <button
                        onClick={handleWithdraw}
                        disabled={isLoading || !withdrawShares}
                        className="w-full py-6 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 disabled:shadow-none"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          'Withdraw Assets'
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Information Cards */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* How It Works */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How It Works
              </h3>
              <ul className="space-y-3">
                {[
                  'Deposit WLFI and/or USD1 tokens',
                  'Receive vEAGLE shares instantly',
                  'Vault auto-deploys to strategies',
                  'Earn yield automatically',
                  'Withdraw anytime, no lock-ups'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-yellow-500">{i + 1}</span>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Active Strategy */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Active Strategy
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Protocol</span>
                  <span className="text-sm font-semibold text-white">Charm Finance</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Pool</span>
                  <span className="text-sm font-semibold text-white">WLFI/USD1</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Type</span>
                  <span className="text-sm font-semibold text-white">Uniswap V3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Fee Tier</span>
                  <span className="text-sm font-semibold text-white">1%</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-sm text-gray-400">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-400">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vault Fees */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Fees
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Deposit Fee</span>
                  <span className="text-sm font-semibold text-white">0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Withdrawal Fee</span>
                  <span className="text-sm font-semibold text-white">0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Performance Fee</span>
                  <span className="text-sm font-semibold text-white">10%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Management Fee</span>
                  <span className="text-sm font-semibold text-white">2%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
