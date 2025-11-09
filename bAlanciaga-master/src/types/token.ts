export interface SelectedTokenType {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  chainId?: number;
  priceUsd?: string;
  volume24h?: string;
}

export interface TokenListType {
  tokens: SelectedTokenType[];
}

export interface TokenPriceType {
  pairs?: {
    priceUsd: string;
    volume: {
      h24: string;
    };
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
  }[];
}

export interface CreatedPositionType {
  poolAddress: string;
  positionId: string;
}

export interface TokenState {
  isSelectChain: boolean;
  chain?: number;
  myTokenList: TokenListType | null;
  selectedToken: SelectedTokenType | null;
  selectedTokenBalance: string;
  show: boolean;
  previewShow: boolean;
  amount: string;
  tokenPrice: number;
  isButtonDisabled: boolean;
  isLoading: boolean;
  isApprove: boolean;
  approvedAmount: number;
  currentTick: number;
  lowerTick: number;
  upperTick: number;
  lowRange: number;
  highRange: number;
  createdPosition: CreatedPositionType | null;
} 