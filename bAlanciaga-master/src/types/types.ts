import { Wallet } from "@dynamic-labs/sdk-react-core";

export type DynamicWallet = Wallet<any>;

export interface SelectedTokenType {
  name: string;
  symbol: string;
  logoURI: string;
  address: string;
  decimals: number;
}
export interface ProgressState {
  vault: boolean;
  approve: boolean;
  maxDeposit: boolean;
  rebalance: boolean;
  deposit: boolean;
  trebalance: boolean;
  success: boolean;
  [key: string]: boolean; // Add index signature
}

export interface VaultType {
  poolAddress: string;
  vaultAddress: string;
  walletAddress: string;
  agentAddress: string;
  maxTotalSupply: number;
  name: string;
  symbol: string;
  chain: number;
  quoteToken: string;
  baseToken: string;
}
