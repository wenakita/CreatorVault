import { useReducer, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { getSigner } from '@dynamic-labs/ethers-v6';
import { Wallet } from '@dynamic-labs/sdk-react-core';
import { liquidityReducer, initialState, LiquidityAction, LiquidityState } from '../store/liquidityReducer';
import { getTokenPrice } from '../utils/api';
import { ERC20_ABI } from '../const';
import { toast } from 'react-hot-toast';

interface UseLiquidityReturn {
  state: LiquidityState;
  dispatch: (action: LiquidityAction) => void;
  handleInputChange: (value: string) => void;
  handleRangeClick: () => void;
  handleApprove: (routerAddress: string) => Promise<void>;
}

export const useLiquidity = (primaryWallet: Wallet<any> | null): UseLiquidityReturn => {
  const [state, dispatch] = useReducer(liquidityReducer, initialState);

  const handleInputChange = useCallback((value: string) => {
    // Only allow numbers and a single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      dispatch({ type: 'SET_AMOUNT', payload: value });
      
      // Reset approval and button state
      if (value === '') {
        dispatch({ type: 'SET_APPROVE', payload: false });
        dispatch({ type: 'SET_BUTTON_DISABLED', payload: true });
      }
    }
  }, []);

  const handleRangeClick = useCallback(() => {
    const balance = Number(state.selectedTokenBalance);
    if (balance > 0) {
      dispatch({ type: 'SET_AMOUNT', payload: balance.toString() });
    }
  }, [state.selectedTokenBalance]);

  const handleApprove = useCallback(async (routerAddress: string) => {
    if (!state.selectedToken || state.chain === undefined || !primaryWallet) {
      toast.error('Please connect wallet and select token');
      return;
    }

    if (!state.amount || Number(state.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const signer = await getSigner(primaryWallet);
      if (!signer) {
        throw new Error('Failed to get signer');
      }

      const selectedTokenContract = new ethers.Contract(
        state.selectedToken.address,
        ERC20_ABI,
        signer
      );
      const decimal = await selectedTokenContract.decimals()
      const amount = ethers.parseUnits(state.amount, decimal);
      const tx = await selectedTokenContract.approve(routerAddress, amount);
      await tx.wait();
      
      toast.success('Successfully approved!');
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_APPROVE', payload: true });
      dispatch({ type: 'SET_APPROVED_AMOUNT', payload: Number(state.amount) });
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_APPROVE', payload: false });
      
      if (err instanceof Error) {
        if (err.message.includes('user rejected action')) {
          toast.error('User rejected transaction');
        } else {
          toast.error(`Approval failed: ${err.message}`);
          console.error('Approval error:', err);
        }
      } else {
        toast.error('Approval failed with unknown error');
        console.error('Unknown approval error:', err);
      }
    }
  }, [state.selectedToken, state.chain, state.amount, primaryWallet]);

  // Effect for handling amount changes
  useEffect(() => {
    if (state.amount !== "") {
      if (parseFloat(state.amount) > parseFloat(state.selectedTokenBalance)) {
        dispatch({ type: 'SET_BUTTON_DISABLED', payload: true });
      } else {
        dispatch({ type: 'SET_BUTTON_DISABLED', payload: false });
      }
    } else {
      dispatch({ type: 'SET_BUTTON_DISABLED', payload: true });
    }
  }, [state.amount, state.selectedTokenBalance]);

  // Effect for handling approval amount changes
  useEffect(() => {
    if (state.approvedAmount >= Number(state.amount) && state.amount !== "") {
      dispatch({ type: 'SET_APPROVE', payload: true });
    } else {
      dispatch({ type: 'SET_APPROVE', payload: false });
    }
  }, [state.amount, state.approvedAmount]);

  // Effect for fetching token price
  useEffect(() => {
    const fetchPrice = async () => {
      if (state.selectedToken) {
        const price = await getTokenPrice(state.selectedToken.address);
        dispatch({ type: 'SET_TOKEN_PRICE', payload: price });
      }
    };
    fetchPrice();
  }, [state.selectedToken]);

  // Effect for checking allowance when token or amount changes
  useEffect(() => {
    const checkAllowance = async () => {
      if (state.selectedToken && primaryWallet && state.amount) {
        try {
          const signer = await getSigner(primaryWallet as any);
          const tokenContract = new ethers.Contract(
            state.selectedToken.address,
            ERC20_ABI,
            signer
          );
          const signerAddress = await signer.getAddress();
          const allowance = await tokenContract.allowance(signerAddress, state.selectedToken.address);
          dispatch({ type: 'SET_APPROVED_AMOUNT', payload: Number(allowance) });
        } catch (err) {
          console.error('Error checking allowance:', err);
        }
      }
    };
    checkAllowance();
  }, [state.selectedToken, state.amount, primaryWallet]);

  return {
    state,
    dispatch,
    handleInputChange,
    handleRangeClick,
    handleApprove
  };
}; 