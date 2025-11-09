import { useNavigate } from "react-router-dom";
import {
  Icon,
  LOGO,
  MainTokens,
  minLimitBalance,
  truncateString,
} from "../../utils/setting";
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import Loader from "../utilities/Loader";
import ChainSelector from "../utilities/ChainSelector";
import { useEffect, useState } from "react";
import { DynamicWallet, SelectedTokenType } from "../../types/types";
import axios from "axios";
import { toast } from "react-hot-toast";
import { calculateTokenPrices } from "../../utils/price";
import univ3prices from "@thanpolas/univ3prices";

const Header = ({
  isLoading,
  // agentAddress,
  issend,
  handleAgent,
  handleSendToAgent,
}: // agentBalance,
{
  isLoading: boolean;
  issend: boolean;
  // agentAddress: string;
  handleAgent: () => Promise<void>;
  handleSendToAgent: (to: string) => Promise<void>;
  // agentBalance: number;
}) => {
  const navigate = useNavigate();
  const { primaryWallet } = useDynamicContext() as {
    primaryWallet: DynamicWallet | null;
  };
  const [chain, setChain] = useState<number | undefined>(undefined);
  const [isSelectChain, setSelectChain] = useState(false);
  const [agentBalance, setBalance] = useState<number>(0);
  const [agentAddress, setAgentAddress] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<SelectedTokenType | null>(
    null
  );

  const [lowRange] = useState(0.958);
  const [highRange] = useState(3.0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [lowerTick, setLowerTick] = useState<number>(0);
  const [upperTick, setUpperTick] = useState<number>(0);
  const [selectedTokenBalance, setSelectedTokenBalance] = useState("");

  const fetchAgent = async () => {
    if (!primaryWallet?.address) return;
    if (chain === undefined) return;
    await axios
      .post(`${URL}/agent/getagent`, {
        address: primaryWallet?.address,
        chain: chain,
      })
      .then((res) => {
        if (res.data.state === "success") {
          setAgentAddress(res.data.wallet.addresses[0].id);
          setBalance(res.data.balance);
        } else setAgentAddress("");
      })
      .catch(() => setAgentAddress(""));
  };

  const getPriceAndTickFromValues = (price: number) => {
    const _tempPrice = Math.sqrt(2 ** 192 * price);
    let _tick = univ3prices.tickMath.getTickAtSqrtRatio(_tempPrice);
    _tick = _tick - (_tick % 200);
    const _price = BigInt(
      univ3prices.tickMath.getSqrtRatioAtTick(_tick).toString()
    );
    return { tick: _tick, price: _price };
  };

  const getRecentPrice = async (address: string) => {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    try {
      const response = await axios.get(url);
      const priceUsd = response.data.pairs[0].priceUsd;
      return priceUsd;
    } catch (error) {
      return 0;
    }
  };

  const calculateTokenPrices = async (address1: string, address2: string) => {
    const price1 = await getRecentPrice(address1);
    const price2 = await getRecentPrice(address2);
    return [price1, price2];
  };

  const switchNetwork = async () => {
    try {
      if (!primaryWallet || chain === undefined) return;
      if (primaryWallet?.connector.supportsNetworkSwitching()) {
        await primaryWallet.switchNetwork(Icon[chain].chainId);
        setSelectedToken(null);
        setSelectedTokenBalance("");
      }
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  const handleNetworkSwitch = async () => {
    try {
      if (!primaryWallet) {
        return;
      }
      await switchNetwork();
    } catch (error) {
      console.error("Error switching network:", error);
    }
  };

  useEffect(() => {
    handleNetworkSwitch();
  }, [chain, primaryWallet]);

  useEffect(() => {
    const updatePricesAndTicks = async () => {
      if (!selectedToken || chain === undefined) {
        return;
      }
      if (chain === undefined) {
        toast.error("Please select Chain!");
        return;
      }
      try {
        let address1 = selectedToken.address;
        let address2 = MainTokens[chain];
        let token0: string, token1: string;
        if (address1.toLowerCase() < address2.toLowerCase()) {
          token0 = address1;
          token1 = address2;
        } else {
          token0 = address2;
          token1 = address1;
        }
        const [price1, price2] = await calculateTokenPrices(token0, token1);
        if (!price1 || !price2) {
          console.error("Failed to fetch token prices");
          return;
        }
        let currentPrice = Number(price1) / Number(price2);
        const state = token0 === address1;
        // Calculate price ranges
        const lowerPrice = state
          ? currentPrice * lowRange
          : currentPrice / lowRange;
        const upperPrice = state
          ? currentPrice * highRange
          : currentPrice / highRange;
        // Calculate ticks
        const resLower = getPriceAndTickFromValues(lowerPrice);
        const resUpper = getPriceAndTickFromValues(upperPrice);
        const resCurrent = getPriceAndTickFromValues(currentPrice);
        if (
          resLower.tick !== undefined &&
          resUpper.tick !== undefined &&
          resCurrent.tick !== undefined
        ) {
          const tickSpacing = 200; // Use 200 for this pool
          // Adjust ticks based on token order and spacing
          const baseTickLower = state ? resLower.tick : -resUpper.tick;
          const baseTickUpper = state ? resUpper.tick : -resLower.tick;
          // Round to nearest valid tick
          const normalizedLowerTick =
            Math.ceil(baseTickLower / tickSpacing) * tickSpacing;
          const normalizedUpperTick =
            Math.floor(baseTickUpper / tickSpacing) * tickSpacing;
          setLowerTick(normalizedLowerTick);
          setUpperTick(normalizedUpperTick);
          setCurrentTick(resCurrent.tick);
        }
      } catch (error) {
        console.error("Error updating prices and ticks:", error);
      }
    };

    updatePricesAndTicks();
  }, [selectedToken, chain, lowRange, highRange]);
  useEffect(() => {
    fetchAgent();
  }, [primaryWallet?.address, chain]);
  return (
    <div className="relative flex items-center justify-between p-4 border-b border-gray-800/30">
      <div className="flex gap-8 md:gap-1 items-center md:flex-col font-medium text-sm">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src={LOGO} alt="Logo" className="h-8 w-8" />
          <span className="font-medium text-lg">EAGLE</span>
        </button>
        <button className="text-lg" onClick={() => navigate("view")}>
          View Vault
        </button>
      </div>
      <div className="flex sm:flex-col gap-2 font-medium text-sm  items-center">
        {/* <button
          className={`bg-slate-500 rounded-lg w-28 truncate ${
            isLoading && !agentAddress ? "p-0.5" : "p-2"
          }`}
          onClick={handleAgent}
        >
          {isLoading && !agentAddress ? (
            <Loader />
          ) : (
            <span>
              {agentAddress ? truncateString(agentAddress) : "Create Agent"}
            </span>
          )}
        </button> */}
        <div className="relative flex">
          <ChainSelector
            chain={chain}
            isOpen={isSelectChain}
            setIsOpen={setSelectChain}
            chains={Icon}
            onChainSelect={setChain}
            modalName="Select Chain"
            page="home"
          />
        </div>
        {agentAddress && (
          <button
            className={`bg--slate-500 rounded-lg w-28 truncate ${
              issend ? "" : "p-2"
            }`}
            onClick={() => handleSendToAgent(agentAddress)}
          >
            {issend ? (
              <Loader />
            ) : (
              <span>
                {agentBalance < minLimitBalance
                  ? "Fund Balance"
                  : Number(agentBalance).toFixed(6) + "ETH"}
              </span>
            )}
          </button>
        )}
        <DynamicWidget />
      </div>
    </div>
  );
};

export default Header;
