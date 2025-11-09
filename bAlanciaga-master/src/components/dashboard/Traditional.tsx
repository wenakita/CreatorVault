/* eslint-disable */
import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import univ3prices from "@thanpolas/univ3prices";
import { getSigner } from "@dynamic-labs/ethers-v6";
import axios from "axios";
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Wallet } from "@dynamic-labs/sdk-react-core";
import { ChevronDown } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { Toaster, toast } from "react-hot-toast";
import Uniswap_LOGO from "/uniswap.webp";
import FALLBACK_TOKEN from "/token-placeholder.svg";
import { TokenList } from "../../utils/tokenList";
import { computeV2PairAddress } from "../../utils/graphQueries";
import SelectTokenModal from "../utilities/SelectTokenModal";
import PreviewModal from "../utilities/PreviewModal";
import Loader from "../utilities/Loader";
import ChainSelector from "../utilities/ChainSelector";
import InteractiveLiquidityVisualization from "../utilities/Motion";
import { truncateString, URL } from "../../utils/setting";
import { Icon } from "../../utils/setting";
import { MainTokens } from "../../utils/setting";
import { BasicTokens } from "../../utils/setting";
import {
  factoryABI,
  nonfungiblePositionManagerABI,
  vaultFactoryABI,
  vaultABI,
  tokenABI,
} from "../../utils/constants";
import Header from "../layout/Header";
// import { SelectedTokenType } from "../../types/token";
// import { DynamicWallet } from "../../types/wallet";

import {
  DynamicWallet,
  ProgressState,
  SelectedTokenType,
  VaultType,
} from "../../types/types";

const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement, Event>
) => {
  event.currentTarget.src = FALLBACK_TOKEN;
};

function Traditional() {
  const navigate = useNavigate();
  const { primaryWallet } = useDynamicContext() as {
    primaryWallet: DynamicWallet | null;
  };
  const [isSelectChain, setSelectChain] = useState(false);
  const [chain, setChain] = useState<number | undefined>(undefined);
  const [myTokenList, setMyTokenList] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedTokenType | null>(
    null
  );
  const [selectedTokenBalance, setSelectedTokenBalance] = useState("");
  const [show, setShow] = useState(false);
  const [previewShow, setPreviewShow] = useState(false);
  const [amount, setAmount] = useState("");
  const [tokenPrice, setTokenPrice] = useState(0);
  const [vaultAddresses, setVaultAddresses] = useState<string>("");

  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApprove, setIsApprove] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState>({
    vault: false,
    approve: false,
    maxDeposit: false,
    rebalance: false,
    deposit: false,
    trebalance: false,
    success: false,
  });
  const [currentStep, setCurrentStep] = useState<string>("");
  const [isAgent, setAgent] = useState<boolean>(false);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [lowerTick, setLowerTick] = useState<number>(0);
  const [upperTick, setUpperTick] = useState<number>(0);
  const [lowRange] = useState(0.958);
  const [highRange] = useState(3.0);
  const [poolAddress, setAddress] = useState<string>("");
  const [isDeposit, setIsDeposit] = useState<boolean>(false);
  const [agentAddress, setAgentAddress] = useState<string>("");
  const [depositAddress, setDepositAddress] = useState<string>("");
  const [createdPosition, setCreatedPosition] = useState<{
    poolAddress: string;
    positionId: string;
  } | null>(null);
  const [maxClicked, setMaxClicked] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const managerAddress: string = "0xB05Cf01231cF2fF99499682E64D3780d57c80FdD";
  const maxTotalSupply: string =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  const minLimitBalance = 0.00002;
  const [agentBalance, setBalance] = useState<number>(0);
  const [issend, setisSend] = useState<boolean>(false);

  const getButtonStyle = () => {
    if (chain === undefined || !selectedToken || (!amount && !isApprove)) {
      return "bg-[#1B1B1B] text-gray-400 cursor-not-allowed";
    }
    if (isLoading) {
      return "bg-blue-500/90 text-white hover:bg-blue-500";
    }
    if (isApprove || (amount && !isButtonDisabled)) {
      return "bg-[#FFE804] text-black hover:bg-[#FFE804]/90";
    }
    return "bg-[#1B1B1B] text-gray-400 cursor-not-allowed";
  };

  // const getButtonContent = () => {
  //   if (isLoading && !agentAddress) {
  //     return <Loader />;
  //   }
  //   return (
  //     <span>
  //       {agentAddress ? truncateString(agentAddress) : "Create Agent"}
  //     </span>
  //   );
  // };
  const isButtonDisabled1 = () =>
    chain === undefined ||
    !selectedToken ||
    isButtonDisabled ||
    (!amount && !isApprove);

  const closePreviewModal = () => {
    setProgressState({
      agent: false,
      vault: false,
      approve: false,
      maxDeposit: false,
      rebalance: false,
      deposit: false,
      trebalance: false,
      success: false,
    });
    setIsApprove(false);
    setIsLoading(false);
    setCurrentStep("");
    setPreviewShow(false);
    if (isSuccess) {
      setIsSuccess(false);
    }
  };
  const handleButtonClick = () => {
    if (chain === undefined) {
      setSelectChain(true);
    } else if (!selectedToken) {
      setShow(true);
    } else if (amount) {
      setPreviewShow(true);
    }
  };

  const getButtonText = () => {
    if (chain === undefined) return "Select Chain";
    if (!selectedToken) return "Select Token";
    if (amount === "") return "Enter Amount";
    if (isLoading) return <Loader />;
    if (amount) return "Preview";
    return "Approve";
  };

  const handleNextStep = async (step: string) => {
    if (progressState[step]) {
      return;
    }
    switch (step) {
      case "vault":
        await CreateVault(poolAddress);
        break;
      case "approve":
        await handleApprove();
        break;
      case "maxDeposit":
        await handleDeposit();
        break;
      case "rebalance":
        await handleRebalnance();
        break;
      case "deposit":
        await handleDeposit();
        break;
      case "trebalance":
        await handleRebalnance();
        break;
      default:
        break;
    }
  };

  const CreateVault = async (address: string) => {
    if (agentBalance < minLimitBalance) {
      toast.error("Agent balance is low");
      return;
    }
    setIsLoading(true);
    try {
      const signer = await getSigner(primaryWallet as any);
      if (!signer || selectedToken?.address === undefined) {
        console.error("No signer available");
        return false;
      }
      if (chain != 0 && chain != 1) {
        console.error("chain not selected");
        return false;
      }
      const vaultFactoryContract = new ethers.Contract(
        Icon[chain].vaultFactoryAddress,
        vaultFactoryABI,
        signer
      );
      const param = {
        pool: address,
        manager: managerAddress,
        managerFee: 59420,
        rebalanceDelegate: agentAddress,
        maxTotalSupply: BigInt(maxTotalSupply),
        baseThreshold: 5400,
        limitThreshold: 12000,
        fullRangeWeight: 200000,
        period: 3,
        minTickMove: 0,
        maxTwapDeviation: 100,
        twapDuration: 60,
        name: `Charming ${selectedToken?.symbol} by EAGLE`,
        symbol: `v${selectedToken?.symbol}`,
      };
      if (!primaryWallet) return;

      const tx = await vaultFactoryContract.createVault(param);
      const receipt = await tx.wait();
      let vaultAddress1 = "";
      const VaultLog = receipt.logs.find(
        (log: { topics: string[]; Data: any }) =>
          log.topics[0] === ethers.id("NewVault(address)")
      );
      vaultAddress1 = String("0x" + VaultLog.data.slice(-40));
      setVaultAddresses(vaultAddress1);
      let vault: VaultType = {
        poolAddress: address,
        vaultAddress: vaultAddress1,
        agentAddress: agentAddress,
        walletAddress: primaryWallet?.address,
        maxTotalSupply: Number(maxTotalSupply),
        baseToken: selectedToken?.address,
        quoteToken: MainTokens[chain],
        name: param.name,
        symbol: param.symbol,
        chain: chain,
      };
      if (poolAddress) {
        setProgressState({ ...progressState, [currentStep]: true });
      }
      setCurrentStep("approve");
      saveVault(vault);
      toast.success("Successfully created new vault!");
      setIsLoading(false);
      return true;
    } catch (error) {
      if (currentStep == "vault") toast.error("failed!");
      setIsLoading(false);
      console.log(error);
      return false;
    }
  };

  const saveVault = async (vault: VaultType) => {
    try {
      const response = await axios.post(`${URL}/update/vault`, vault);
      console.log(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRebalnance = async () => {
    if (!vaultAddresses) {
      toast.error("Please create vault first");
      return;
    }
    setIsLoading(true);
    console.log("vaultAddresses ------> ", vaultAddresses);
    await axios
      .post(`${URL}/agent/rebalance`, {
        vaultAddress: vaultAddresses,
        metaAddress: primaryWallet?.address,
      })
      .then((res) => {
        if (res.data.state === "success") {
          toast.success("Rebalance success");
          if (currentStep == "trebalance") setCurrentStep("success");
          else setCurrentStep("deposit");
          setProgressState({ ...progressState, [currentStep]: true });
        } else {
          toast.error("Rebalance failed");
        }
      })
      .catch(() => setIsLoading(false));
    let balance = await getTokenBalance(selectedToken?.address as string);
    if (balance) setSelectedTokenBalance(balance);
    setIsLoading(false);
  };

  const getTokenBalance = async (tokenAddress: string) => {
    if (tokenAddress === undefined) return;
    if (!primaryWallet?.address) return "0";
    try {
      const signer = await getSigner(primaryWallet as any);
      if (!signer) {
        console.error("No signer available");
        return "0";
      }
      const contract = new ethers.Contract(tokenAddress, tokenABI, signer);
      const balance1 = await contract.balanceOf(primaryWallet.address);
      const _decimal = await contract.decimals();
      return ethers.formatUnits(balance1, Number(_decimal));
    } catch (error) {
      console.error("Error fetching balance:", error);
      return "0";
    }
  };

  const setSelectedTokenInfo = async (item: SelectedTokenType) => {
    setSelectedToken(item);
    const tokenAddress = item.address;
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setTokenPrice(data.pairs[0].priceUsd);
      })
      .catch((error) => {
        setTokenPrice(0);
        console.log("price error", error);
      });
    let balance = await getTokenBalance(selectedToken?.address as string);
    if (balance) setSelectedTokenBalance(balance);
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.length && value[0] !== ".") {
      const inValue: string = value[value.length - 1];
      if (inValue === "." || (inValue >= "0" && inValue <= "9")) {
        setAmount(value);
        setMaxClicked(false);
      }
    } else {
      setAmount("");
      setIsApprove(false);
      setIsButtonDisabled(true);
      setMaxClicked(false);
    }
  };

  const handleRangeClick = () => {
    if (Number(selectedTokenBalance)) {
      const balance = String(Number(selectedTokenBalance));
      setAmount(balance);
      setMaxClicked(true);
      setIsApprove(approvedAmount >= parseFloat(balance));
      setIsButtonDisabled(false);
    }
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

  const checkPoolExists = async (
    tokenA: string,
    tokenB: string,
    fee: number
  ) => {
    if (chain === undefined) return false;
    const signer = await getSigner(primaryWallet as any);
    const factoryContract = new ethers.Contract(
      Icon[chain].factoryAddress,
      factoryABI,
      signer
    );
    try {
      const poolAddress = await factoryContract.getPool(tokenA, tokenB, fee);
      if (poolAddress === ethers.ZeroAddress) {
        return false;
      } else {
        return poolAddress;
      }
    } catch (error) {
      console.error("Error checking pool:", error);
      return true;
    }
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

  const handleApprove = async () => {
    if (!selectedToken || chain === undefined) return;
    setIsLoading(true);
    if (primaryWallet) {
      try {
        const signer = await getSigner(primaryWallet as any);
        const selectedTokenContract = new ethers.Contract(
          selectedToken.address,
          tokenABI,
          signer
        );
        const _decimal = await selectedTokenContract.decimals();
        let targetAddress = Icon[chain].routerAddress;
        if (poolAddress) targetAddress = vaultAddresses;
        const tx = await selectedTokenContract.approve(
          targetAddress,
          ethers.parseUnits(amount, _decimal)
        );
        await tx.wait();
        toast.success("Successfully approved!");
        setProgressState({ ...progressState, [currentStep]: true });
        if (poolAddress) setCurrentStep("maxDeposit");
        setIsLoading(false);
        if (currentStep == "") {
          setIsApprove(true);
          handleAddLiquidity();
        }
      } catch (err) {
        setIsLoading(false);
        setIsApprove(false);
        if (String(err).includes("Error: user rejected action")) {
          toast.error(`User rejected!`);
        } else {
          toast.error(`Approve failed!`);
        }
      }
    }
  };

  const handleSendToAgent = async (to: string) => {
    if (chain === undefined) return;
    setisSend(true);
    if (primaryWallet) {
      try {
        const signer = await getSigner(primaryWallet as any);
        if (!signer) {
          console.log("signer is null");
          return;
        }
        console.log("signer: ", signer);
        const tx = {
          to: to,
          value: ethers.parseEther("0.0003"),
        };
        const responseTx = await signer.sendTransaction(tx);
        await responseTx.wait();
        toast.success("Successfully approved!");
        setCurrentStep("vault");
        setIsLoading(false);
        fetchAgent();
      } catch (err) {
        if (String(err).includes("Error: user rejected action")) {
          toast.error(`User rejected!`);
        } else {
          console.log("err: ", err);
          toast.error(`Check Your Wallet!`);
        }
      }
    }
    setisSend(false);
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

  const getApprovedAmountOfSelectedToken = async () => {
    if (!selectedToken || chain === undefined) return;
    try {
      const signer = await getSigner(primaryWallet as any);
      const selectedTokenContract = new ethers.Contract(
        selectedToken.address,
        tokenABI,
        signer
      );
      let targetAddress = Icon[chain].routerAddress;
      if (isDeposit) targetAddress = depositAddress;
      const approvedAmount0 = await selectedTokenContract.allowance(
        primaryWallet?.address,
        targetAddress
      );
      const _decimal = await selectedTokenContract.decimals();
      const approvedAmount1 = ethers.formatUnits(approvedAmount0, _decimal);
      setApprovedAmount(Number(approvedAmount1));
    } catch (error) {
      console.error("Error fetching approved amount:", error);
    }
  };

  const handleDeposit = async () => {
    if (!selectedToken || chain === undefined) return;
    try {
      setIsLoading(true);
      const signer = await getSigner(primaryWallet as any);
      if (!signer) {
        toast.error("No signer available");
        return;
      }
      const vaultContract = new ethers.Contract(
        vaultAddresses,
        vaultABI,
        signer
      );
      const token0 = await vaultContract.token0();
      const same = String(token0) == selectedToken.address;
      const selectedTokenContract = new ethers.Contract(
        selectedToken.address,
        tokenABI,
        signer
      );
      const _decimal = await selectedTokenContract.decimals();
      const _amount =
        currentStep === "maxDeposit"
          ? ethers.parseUnits(amount, _decimal) / BigInt(10)
          : (ethers.parseUnits(amount, _decimal) * BigInt(9)) / BigInt(10);
      const tx = await vaultContract.deposit(
        same ? _amount : 0,
        !same ? _amount : 0,
        0,
        0,
        primaryWallet?.address
      );
      await tx.wait();
      saveDeposit(Number(_amount), vaultAddresses);
      setProgressState({ ...progressState, [currentStep]: true });
      if (currentStep === "deposit") setCurrentStep("trebalance");
      else setCurrentStep("rebalance");
      setIsLoading(false);
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  };

  const saveDeposit = (amount: number, vaultAddress: string) => {
    try {
      axios
        .post(`${URL}/update/deposit`, { amount, vaultAddress })
        .then((res) => {
          console.log(res.data);
        });
    } catch {
      console.log("error");
    }
  };
  const handleAddLiquidity = async () => {
    if (!selectedToken || chain === undefined) return;
    setIsLoading(true);
    try {
      // Input validation
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        setIsLoading(false);
        return;
      }
      const signer = await getSigner(primaryWallet as any);
      if (!signer) {
        toast.error("No signer available");
        setIsLoading(false);
        return;
      }

      // Initialize contracts
      const nonfungiblePositionManager = new ethers.Contract(
        Icon[chain].routerAddress,
        nonfungiblePositionManagerABI,
        signer
      );

      // Validate token order
      if (chain === undefined) {
        toast.error("Please select a chain");
        setIsLoading(false);
        return;
      }
      let address1 = selectedToken.address;
      let address2 = MainTokens[chain];
      const fee = BigInt("10000");
      let token0: string, token1: string;
      const isToken0 = address1.toLowerCase() < address2.toLowerCase();
      if (isToken0) {
        token0 = address1;
        token1 = address2;
      } else {
        token0 = address2;
        token1 = address1;
      }

      // Check user's balance
      const tokenContract = new ethers.Contract(
        selectedToken.address,
        tokenABI,
        signer
      );

      // Calculate desired amount with proper decimal handling
      const _decimal = await tokenContract.decimals();
      const desiredAmount = ethers.parseUnits(amount, _decimal);

      const balance = await tokenContract.balanceOf(primaryWallet?.address);
      if (balance < desiredAmount) {
        toast.error("Insufficient balance");
        setIsLoading(false);
        return;
      }

      // Check allowance
      const allowance = await tokenContract.allowance(
        primaryWallet?.address,
        Icon[chain].routerAddress
      );
      if (allowance < desiredAmount) {
        toast.error("Please approve the token first");
        setIsLoading(false);
        return;
      }

      // Check if pool exists and initialize if needed
      const poolExists = await checkPoolExists(token0, token1, Number(fee));
      if (poolExists) {
        toast.error("The position already exist!");
        setIsLoading(false);
        return;
      }
      const [price1, price2] = await calculateTokenPrices(token0, token1);
      let currentPrice = Number(price1) / Number(price2);
      const createFunctionSignature =
        "createAndInitializePoolIfNecessary(address,address,uint24,uint160)";
      // Calculate initial sqrt price based on current price
      const lowerPrice = isToken0
        ? currentPrice * lowRange
        : currentPrice / lowRange;
      const upperPrice = isToken0
        ? currentPrice * highRange
        : currentPrice / highRange;
      const resLower = getPriceAndTickFromValues(lowerPrice);
      const resUpper = getPriceAndTickFromValues(upperPrice);
      const tickLower = isToken0 ? resLower.tick + 200 : resUpper.tick;
      const tickUpper = isToken0 ? resUpper.tick : resLower.tick - 200;
      const sqrtPrice = resLower.price;
      const iface = new ethers.Interface(nonfungiblePositionManagerABI);
      const params1 = [token0, token1, fee, BigInt(sqrtPrice)];
      const data1 = iface.encodeFunctionData(createFunctionSignature, params1);
      const mintFunctionSignature =
        "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))";
      const params2 = [
        {
          token0: token0,
          token1: token1,
          fee: fee,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: isToken0 ? desiredAmount : 0,
          amount1Desired: !isToken0 ? desiredAmount : 0,
          amount0Min: 0,
          amount1Min: 0,
          recipient: primaryWallet?.address,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        },
      ];
      const data2 = iface.encodeFunctionData(mintFunctionSignature, params2);
      const txData = [data1, data2];
      const tx = await nonfungiblePositionManager.multicall(txData);
      toast.loading("Transaction pending...", { id: "tx-pending" });
      const receipt = await tx.wait();
      toast.dismiss("tx-pending");

      // Get position ID from transaction receipt
      const positionId = receipt.logs.find(
        (log: { topics: string[] }) =>
          log.topics[0] ===
          ethers.id("IncreaseLiquidity(uint256,uint128,uint256,uint256)")
      )?.topics[1];

      const factoryContract = new ethers.Contract(
        Icon[chain].factoryAddress,
        factoryABI,
        signer
      );
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      setCreatedPosition({
        poolAddress,
        positionId: positionId || "",
      });

      toast.success("Position created successfully!");
      setSelectedTokenBalance(
        String(Number(selectedTokenBalance) - Number(amount))
      );
      setIsSuccess(true);
    } catch (error: any) {
      console.error("Transaction error:", error);
      if (error.reason) {
        toast.error(`Transaction failed: ${error.reason}`);
      } else if (error.message) {
        toast.error(`Transaction failed: ${error.message}`);
      } else {
        toast.error("Transaction failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculateImpermanentLoss = (priceRatio: number) => {
    const sqrtRatio = Math.sqrt(priceRatio);
    const IL = (2 * sqrtRatio) / (1 + priceRatio) - 1;
    return Math.abs(IL);
  };

  const calculateAPR = () => {
    try {
      if (
        !selectedToken ||
        !amount ||
        !tokenPrice ||
        !upperTick ||
        !lowerTick
      ) {
        return "0";
      }

      const upperPrice = Math.pow(1.0001, upperTick);
      const lowerPrice = Math.pow(1.0001, lowerTick);
      const priceRatio = upperPrice / lowerPrice;

      const positionSize = parseFloat(amount) * tokenPrice;
      if (positionSize <= 0) return "0";

      const minimumYearlyVolume = positionSize * 2;
      const minimumDailyVolume = minimumYearlyVolume / 365;

      const feeTier = 0.01;
      const dailyFeeEarnings = minimumDailyVolume * feeTier;
      const yearlyFeeEarnings = dailyFeeEarnings * 365;

      const feeAPR = (yearlyFeeEarnings / positionSize) * 100;
      const priceReturn = (priceRatio - 1) * 100;
      const impLoss = calculateImpermanentLoss(priceRatio) * 100;

      const apr = feeAPR + priceReturn - impLoss;
      const result = Math.min(Math.max(0, apr), 999.99);

      return result.toFixed(1);
    } catch (error) {
      console.error("APR calculation error:", error);
      return "0";
    }
  };

  const handleAgent = async () => {
    if (agentAddress) {
      toast.error("Already exist");
      return;
    }
    if (!primaryWallet?.address) {
      toast.error("Please connect wallet");
      return;
    }
    setIsLoading(true);
    await axios
      .post(`${URL}/agent/creatagent`, {
        chain: chain,
        metaAddress: primaryWallet?.address,
      })
      .then((res) => {
        if (res.data.state === "success") {
          toast.success("Agent created successfully");
          setBalance(0);
          setAgentAddress(res.data.agentAddress);
          handleSendToAgent(res.data.agentAddress);
        }
      })
      .catch((err) => {
        console.log(err);
      });
    setIsLoading(false);
  };

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

  useEffect(() => {
    handleNextStep(currentStep);
  }, [currentStep]);

  useEffect(() => {
    const updateBalance = async () => {
      if (selectedToken) {
        let balance = await getTokenBalance(selectedToken?.address as string);
        if (balance) setSelectedTokenBalance(balance);
      }
    };
    updateBalance();
  }, [selectedToken, primaryWallet, chain]);

  useEffect(() => {
    if (approvedAmount >= Number(amount) && amount != "") {
      setIsApprove(true);
    } else {
      setIsApprove(false);
    }
  }, [amount]);

  useEffect(() => {
    if (selectedToken) {
      setMaxClicked(false);
      setIsApprove(false);
      setAmount("");
    }
  }, [selectedToken]);

  useEffect(() => {
    if (amount !== "") {
      if (parseFloat(amount) > parseFloat(selectedTokenBalance)) {
        setIsButtonDisabled(true);
      } else {
        setIsButtonDisabled(false);
        if (approvedAmount >= parseFloat(amount)) {
          setIsApprove(true);
        } else {
        }
      }
    } else {
      setIsButtonDisabled(true);
      setIsApprove(false);
    }
  }, [amount, selectedTokenBalance, approvedAmount]);

  useEffect(() => {
    setMyTokenList(TokenList);
  }, []);

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
    if (selectedToken) {
      getApprovedAmountOfSelectedToken();
      setAmount("");
    }
  }, [selectedToken]);

  useEffect(() => {
    fetchAgent();
  }, [primaryWallet?.address, chain]);

  return (
    <div className="w-full h-screen overflow-auto hide-scrollbar bg-[#0A0A0A] text-white">
      <Toaster />
      {/* Title Section with Logo and Wallet */}
      <Header
        // agentAddress={agentAddress}
        // agentBalance={agentBalance}
        handleAgent={handleAgent}
        handleSendToAgent={handleSendToAgent}
        isLoading={isLoading}
        issend={issend}
      />

      {/* Main Content */}
      <div className="mt-4 flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto px-6">
          {/* {createdPosition ? 
          (
            <AnalyticsDashboard
              poolAddress={createdPosition.poolAddress}
              positionId={createdPosition.positionId}
              chainId={chain || 0}
              walletAddress={primaryWallet?.address || ""}
            />
          ) : ( */}
          <div className="bg-[#111111] rounded-2xl border border-gray-800/30 shadow-xl">
            {/* Header with Uniswap branding and chain selector */}
            <div className="p-3 border-b border-gray-800/30 flex justify-between items-center">
              <div className="flex items-center">
                <img src={Uniswap_LOGO} alt="Uniswap" className="h-5 w-5" />
                <span className="text-xs text-gray-400">
                  Powered by Uniswap V3
                </span>
              </div>
              {/* <div className="relative flex">
                <ChainSelector
                  chain={chain}
                  isOpen={isSelectChain}
                  setIsOpen={setSelectChain}
                  chains={Icon}
                  onChainSelect={setChain}
                  modalName="Select Chain"
                  page="home"
                />
              </div> */}
            </div>

            {/* Token Input */}
            <div className="p-3">
              <div className="bg-[#0A0A0A] rounded-xl p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1">Deposit</div>
                    <input
                      type="text"
                      className="w-full text-4xl bg-transparent outline-none font-medium"
                      placeholder="0"
                      value={amount}
                      onChange={handleInputChange}
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      ~${(parseFloat(amount || "0") * tokenPrice).toFixed(2)}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 min-w-[120px] h-[40px] ${
                      selectedToken
                        ? "bg-[#1B1B1B] hover:bg-[#2D2D2D]"
                        : chain === 1
                        ? "bg-[#FFE804] text-black hover:bg-[#FFE804]/90"
                        : chain === 0
                        ? "bg-purple-500 hover:bg-purple-600"
                        : "bg-[#1B1B1B] hover:bg-[#2D2D2D]"
                    }`}
                    onClick={() => {
                      if (chain === undefined) {
                        toast.error("Please Select Chain");
                        return;
                      }
                      setShow(true);
                    }}
                  >
                    {selectedToken ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full bg-[#2D2D2D] flex items-center justify-center overflow-hidden`}
                          >
                            <img
                              src={selectedToken.logoURI || FALLBACK_TOKEN}
                              alt={selectedToken.symbol}
                              className="w-full h-full object-cover"
                              onError={handleImageError}
                            />
                          </div>
                          <span className="font-medium">
                            {selectedToken.symbol}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Select Token</span>
                      </div>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 ml-auto ${
                        selectedToken
                          ? "text-gray-400"
                          : chain !== undefined
                          ? "text-black"
                          : "text-gray-400"
                      }`}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-1.5 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>Balance: {selectedTokenBalance}</span>
                    <button
                      onClick={handleRangeClick}
                      disabled={!selectedToken || maxClicked}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        !selectedToken || maxClicked
                          ? "bg-[#2D2D2D] text-gray-500 cursor-not-allowed"
                          : "bg-[#FFE804] text-black hover:bg-[#FFE804]/90"
                      }`}
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="px-3 pb-3">
              <button
                className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${getButtonStyle()}`}
                onClick={handleButtonClick}
                disabled={isButtonDisabled1()}
              >
                {getButtonText()}
              </button>
            </div>

            {/* Liquidity Visualization */}
            <div className="p-3 border-t border-gray-800/30">
              <InteractiveLiquidityVisualization
                currentTick={currentTick}
                lowerTick={lowerTick}
                upperTick={upperTick}
                amount={amount}
                initialUsdValue={parseFloat(amount || "0") * tokenPrice}
                calculatedAPR={selectedToken ? calculateAPR() : "0%"}
                selectedToken={selectedToken}
                chainId={chain || 0}
                v2PairAddress={
                  selectedToken && chain !== undefined
                    ? computeV2PairAddress(
                        Icon[chain].factoryAddress,
                        selectedToken.address,
                        MainTokens[chain]
                      )
                    : undefined
                }
              />
            </div>
          </div>
          {/* )} */}
        </div>
      </div>

      {/* Token Selector Modal */}
      {show && (
        <SelectTokenModal
          open={show}
          onClose={() => setShow(false)}
          chain={chain ?? -1}
          AllTokenData={myTokenList}
          BasicTokens={BasicTokens}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedTokenInfo}
          setSelectedTokenBalance={setSelectedTokenBalance}
          CreateVault={CreateVault}
          checkPoolExists={checkPoolExists}
          setIsDeposit={setIsDeposit}
          poolAddress={poolAddress}
          setAddress={setAddress}
          setDepositAdress={setDepositAddress}
        />
      )}

      {/* Preview Modal */}
      {previewShow && selectedToken && (
        <PreviewModal
          open={previewShow}
          onClose={() => {
            closePreviewModal();
          }}
          selectToken={selectedToken}
          progressState={progressState}
          tokenAmount={amount}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          isSuccess={isSuccess}
          setProgressState={setProgressState}
          isAgent={isAgent}
          setAgent={setAgent}
          CreateVault={CreateVault}
          setCurrentStep={setCurrentStep}
          handleAddLiquidity={handleAddLiquidity}
          chainId={chain}
          positionId={createdPosition?.positionId}
          isDeposit={isDeposit}
          isApprove={isApprove}
          poolAddress={poolAddress}
          setAddress={setAddress}
          handleApprove={handleApprove}
          agentAddress={agentAddress}
          handleSendToAgent={handleSendToAgent}
          setAgentAddress={setAgentAddress}
        />
      )}

      {/* Add tooltips */}
      <Tooltip id="fee-tooltip" className="max-w-xs">
        <div className="p-2">
          <p className="font-semibold mb-1">Fee Tier: 1%</p>
          <p>
            You earn 1% of all trading volume that occurs within your price
            range.
          </p>
        </div>
      </Tooltip>

      <Tooltip id="range-tooltip" className="max-w-xs">
        <div className="p-2">
          <p className="font-semibold mb-1">Price Range</p>
          <p>
            The price range in which your liquidity is active. You earn fees
            when trades happen within this range.
          </p>
          <p className="mt-1">Lower tick: {lowerTick}</p>
          <p>Upper tick: {upperTick}</p>
        </div>
      </Tooltip>

      <Tooltip id="apr-tooltip" className="max-w-xs">
        <div className="p-2">
          <p className="font-semibold mb-1">Minimum APR Calculation</p>
          <p>Annual rate based on:</p>
          <ul className="list-disc pl-4 mt-1">
            <li>Minimum trading volume needed for full position conversion</li>
            <li>1% fee on all trades</li>
            <li>
              Price movement from {lowerTick} to {upperTick}
            </li>
            <li>Subtracts maximum impermanent loss</li>
          </ul>
          <p className="mt-1 text-sm">
            This is a conservative estimate assuming only minimum required
            trading volume.
          </p>
        </div>
      </Tooltip>
    </div>
  );
}

export default Traditional;
