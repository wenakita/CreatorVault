export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  }
];

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1
};

export const MESCHAC_AVATAR = "https://avatars.githubusercontent.com/u/47919550?v=4";
export const BERNARD_AVATAR = "https://avatars.githubusercontent.com/u/31113941?v=4";