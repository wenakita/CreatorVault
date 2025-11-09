// slices/index.js
import { combineReducers } from "redux";
import walletAddressSlice from "./walletAddressSlice.ts";

const rootReducer = combineReducers({
  counter: walletAddressSlice,
});

export default rootReducer;
