import React, { useState } from "react";
import { X, ExternalLink, Check } from "lucide-react";
import Loader from "./Loader";
import FALLBACK_TOKEN from "/token-placeholder.svg";

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  selectToken: {
    name: string;
    symbol: string;
    logoURI: string;
    address: string;
  };
  tokenAmount: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isSuccess?: boolean;
  chainId?: number;
  positionId?: string;
  isDeposit: boolean;
  isApprove: boolean;
  poolAddress: string;
  agentAddress: string;
  setAgentAddress: (address: string) => void;
  setAddress: (address: string) => void;
  handleApprove: () => void;
  handleAddLiquidity: () => void;
  isAgent: boolean;
  setAgent: (isAgent: boolean) => void;
  CreateVault: (address: string) => void;
  progressState: any;
  setProgressState: (state: any) => void;
  setCurrentStep: (step: string) => void;
  handleSendToAgent: (to: string) => void;
}

const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
  event.currentTarget.src = FALLBACK_TOKEN;
};

const PreviewModal = ({
  open,
  onClose,
  selectToken,
  tokenAmount,
  isLoading,
  isSuccess,
  chainId,
  positionId,
  isApprove,
  handleApprove,
  poolAddress,
  progressState,
  setCurrentStep,
}: PreviewModalProps) => {
  if (!open) return null;

  const getUniswapUrl = () => {
    const network = chainId === 8453 ? 'base' : 'arbitrum';
    return `https://app.uniswap.org/pools/${positionId}?chain=${network}`;
  };
  const [isCreate, setIsCreate] = useState<boolean>(false);
  const NextStep = [
    "vault",
    "approve",  
    "maxDeposit",
    "rebalance",
    "deposit",
    "trebalance"
  ];

  const StepNames = [
    "Create Vault",
    "Approve Vault",
    "Initial Deposit",
    "Rebalance Vault (via Agent)",
    "Deposit Remainder",
    "Rebalance Vault (via Agent)",
  ]

  const hanldeCreate = async () => {
    setIsCreate(true);
    if(poolAddress) {
      // handleAgent();
      setCurrentStep("vault");
    }
    else {
      handleApprove();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-md bg-[#1B1B1B] rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {poolAddress?"Create Vault":"Add Liquidity"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-300">Your liquidity position has been created successfully!</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2D2D2D] flex items-center justify-center overflow-hidden">
                <img
                  src={selectToken.logoURI || FALLBACK_TOKEN}
                  alt={selectToken.name}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-white truncate">
                    {tokenAmount}
                  </span>
                  <span className="text-lg font-medium text-white">
                    {selectToken.symbol}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">{selectToken.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCreate?<div className="p-4 border-t border-gray-800">
          {isSuccess ? (
            <div className="space-y-3">
              <a
                href={getUniswapUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#FFE804] text-black font-medium rounded-xl hover:bg-[#FFE804]/90 transition-colors flex items-center justify-center gap-2"
              >
                View on Uniswap <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#2D2D2D] text-white font-medium rounded-xl hover:bg-[#3D3D3D] transition-colors"
              >
                Return to Home
              </button>
            </div>
          ) : (
            <button
              onClick={hanldeCreate}
              disabled={isLoading}
              className="w-full py-3 bg-[#FFE804] text-black font-medium rounded-xl hover:bg-[#FFE804]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader /> : "Create"}
            </button>
          )}
        </div>:
        !poolAddress?
        <div className="p-10 border-t flex flex-col gap-4 border-gray-800">
          <div className="flex justify-between items-center">
            <div className={`${isApprove?"text-blue-500":""} cursor-pointer`}>1. Approve</div> 
            <div className="w-10"> {!isApprove && isLoading ? <Loader /> : isApprove  && <Check className="ml-2" />} </div>
          </div>
          <div className="flex justify-between items-center">
            <div 
              className={`${isSuccess?"text-blue-500":""} cursor-pointer`}
              // onClick={handleAddLiquidity}
            >
              2. Add Liquidity
            </div> 
            <div className="w-10"> {!isSuccess && isLoading && isApprove ? <Loader /> : isSuccess && <Check className="ml-2" />} </div>
          </div>
        </div>
        :
        <div className="p-10 border-t flex flex-col gap-4 border-gray-800">
          {NextStep?.map((step, index) => {
            return (
              // (index===0 || progressState[NextStep[index-1]]) &&
              <div className="flex justify-between items-center cursor-pointer" key={index}
                // onClick={() => setCurrentStep(step)}
              >
                <div className={`${progressState[step]?"text-blue-500":""}`}>{index + 1}. {StepNames[index]}</div>
                <div className="w-10"> {!progressState[step] && (index>0?progressState[NextStep[index-1]]:true) && isLoading ? <Loader /> : progressState[step] && <Check className="ml-2" />} </div>
              </div>
            )
          })}
        </div>
        }
      </div>
    </div>
  );
};

export default PreviewModal;
