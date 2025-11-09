import { SelectedTokenType, TokenListType, CreatedPositionType } from '../types/token';

export interface LiquidityState {
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
  createdPosition: CreatedPositionType | null;
}

export type LiquidityAction =
  | { type: 'SET_CHAIN'; payload: number }
  | { type: 'SET_SELECT_CHAIN'; payload: boolean }
  | { type: 'SET_TOKEN_LIST'; payload: TokenListType | null }
  | { type: 'SET_SELECTED_TOKEN'; payload: SelectedTokenType | null }
  | { type: 'SET_TOKEN_BALANCE'; payload: string }
  | { type: 'SET_SHOW_MODAL'; payload: boolean }
  | { type: 'SET_PREVIEW_SHOW'; payload: boolean }
  | { type: 'SET_AMOUNT'; payload: string }
  | { type: 'SET_TOKEN_PRICE'; payload: number }
  | { type: 'SET_BUTTON_DISABLED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_APPROVE'; payload: boolean }
  | { type: 'SET_APPROVED_AMOUNT'; payload: number }
  | { type: 'SET_TICKS'; payload: { currentTick?: number; lowerTick?: number; upperTick?: number } }
  | { type: 'SET_CREATED_POSITION'; payload: CreatedPositionType | null };

export const initialState: LiquidityState = {
  isSelectChain: false,
  chain: undefined,
  myTokenList: null,
  selectedToken: null,
  selectedTokenBalance: "",
  show: false,
  previewShow: false,
  amount: "",
  tokenPrice: 0,
  isButtonDisabled: false,
  isLoading: false,
  isApprove: false,
  approvedAmount: 0,
  currentTick: 0,
  lowerTick: 0,
  upperTick: 0,
  createdPosition: null,
};

export function liquidityReducer(state: LiquidityState, action: LiquidityAction): LiquidityState {
  switch (action.type) {
    case 'SET_CHAIN':
      return { ...state, chain: action.payload };
    case 'SET_SELECT_CHAIN':
      return { ...state, isSelectChain: action.payload };
    case 'SET_TOKEN_LIST':
      return { ...state, myTokenList: action.payload };
    case 'SET_SELECTED_TOKEN':
      return { ...state, selectedToken: action.payload };
    case 'SET_TOKEN_BALANCE':
      return { ...state, selectedTokenBalance: action.payload };
    case 'SET_SHOW_MODAL':
      return { ...state, show: action.payload };
    case 'SET_PREVIEW_SHOW':
      return { ...state, previewShow: action.payload };
    case 'SET_AMOUNT':
      return { ...state, amount: action.payload };
    case 'SET_TOKEN_PRICE':
      return { ...state, tokenPrice: action.payload };
    case 'SET_BUTTON_DISABLED':
      return { ...state, isButtonDisabled: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_APPROVE':
      return { ...state, isApprove: action.payload };
    case 'SET_APPROVED_AMOUNT':
      return { ...state, approvedAmount: action.payload };
    case 'SET_TICKS':
      return {
        ...state,
        currentTick: action.payload.currentTick ?? state.currentTick,
        lowerTick: action.payload.lowerTick ?? state.lowerTick,
        upperTick: action.payload.upperTick ?? state.upperTick,
      };
    case 'SET_CREATED_POSITION':
      return { ...state, createdPosition: action.payload };
    default:
      return state;
  }
} 