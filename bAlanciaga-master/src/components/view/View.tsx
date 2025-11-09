import React, { useEffect } from  "react";
import ChainSelector from "../utilities/ChainSelector";

import { Icon, URL } from "../../utils/setting";
import { getTokenMoreInfo, getTokenPrice } from "../../utils/api";
import { Loader } from "lucide-react";
import { useDynamicContext, Wallet } from "@dynamic-labs/sdk-react-core";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { LOGO } from "../../utils/setting";

type DynamicWallet = Wallet<any>;
interface PoolData {
    baseToken: string,
    quoteToken: string,
    poolAddress: string,
    dexUrl: string,
    poolAmount: number,
    baseUrl: string,
    quoteUrl: string,
    chain:string,
    usdAmount: number,
    tvl: number,
    basePro: number,
    quotePro: number,
    fee: number,    
}

const View = () => {
    const navigate = useNavigate();
    const { primaryWallet } = useDynamicContext() as {
        primaryWallet: DynamicWallet | null;
    };
    const [isSelectChain, setSelectChain] = React.useState<boolean>(false);
    const [chain, setChain] = React.useState<number | undefined>(0);
    const [poolDatas, setPools] = React.useState<PoolData[]>([]);
    const fetchData = async (poolAddress: string, chain: string, baseToken: string, quoteToken: string, poolAmount: number) => {
        let baseTokenInfo: any = await getTokenMoreInfo(baseToken);
        let quoteTokenInfo: any = await getTokenMoreInfo(quoteToken);
        let priceUsd = await getTokenPrice(baseToken);
        console.log("baseToken", baseTokenInfo);
        let newPool: PoolData = {
            baseToken: baseTokenInfo.baseToken.symbol,
            quoteToken: quoteTokenInfo.baseToken.symbol,
            poolAddress: poolAddress,
            dexUrl: "",
            basePro: 60,
            quotePro: 40,
            fee: 1,
            tvl: 5000,
            poolAmount: poolAmount/1e18,
            baseUrl: baseTokenInfo.baseToken.logoURI,
            quoteUrl: quoteTokenInfo.baseToken.logoURI,
            chain: chain,
            usdAmount: (poolAmount/1e18)*priceUsd,
        }
        setPools(prev=> [...prev, newPool]);
    };

    const fetchVault = async () => {
        try {
            const response = await axios.post(`${URL}/load/uniswap`, {walletAddress: primaryWallet?.address as string, chain: chain});
            console.log(response.data);
            if(response.data.state === "success") {
                response.data.vault.forEach((vault: any) => {
                    console.log("vault", vault);
                    fetchData(vault.poolAddress, vault.chain, vault.baseToken, vault.quoteToken, vault.depositAmount);
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };
    useEffect(() => {
        if(chain === undefined) return;
        setPools([]);
        [1,2,3,4,5,6,7,8,9,10].forEach(async () => {
            fetchVault();
        });
        fetchVault();
    }, [chain])

    return (
        <div className="relative w-full overflow-x-hidden">
        <div className="w-full h-screen overflow-auto hide-scrollbar min-h-screen animated-background bg-[#0A0A0A]">
            <div className="flex flex-col px-[400px] xxl:px-[4px] md:text-sm md:px-10 sm:px-[4px] pt-20">
                <div className="text-center text-[#E5E5E5] font-semibold text-3xl">
                    Vault Lists
                </div>
                <div className="mt-5 w-36">
                    <ChainSelector
                        chain={chain}
                        isOpen={isSelectChain}
                        setIsOpen={setSelectChain}
                        chains={Icon}
                        onChainSelect={setChain}
                        modalName="Select Chain"
                        page="view"
                    />
                </div>
                <div className="mt-5 flex flex-col gap-4 ">
                    {poolDatas.length > 0 ? poolDatas.map((pool, index) => {
                        return( 
                        <div key={index} className="flex py-3 text-[#E5E5E5] bg-[#111111] rounded-lg md:text-[10px]  sm:text-[12px] justify-between items-center px-4 cursor-pointer hover:shodow-lg hover:bg-white hover:text-black">
                            <div className="flex justify-between items-center sm:gap-0 gap-2 cursor-pointer w-full"
                                onClick={() => navigate(`/vault/${pool.poolAddress}`)}
                            >
                                <div className="flex flex-col gap-1 w-32 sm:w-20">
                                    <div className="flex gap-1 items-center">
                                        <img src={pool.baseUrl} alt="baseToken" className="w-6 h-6 rounded-full" /> 
                                        <img src={pool.quoteUrl} alt="quoteToken" className="w-6 h-6 rounded-full" />
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <span className="font-medium">{pool.baseToken} / {pool.quoteToken}</span>
                                    </div>
                                </div>
                                <div>
                                    {pool.tvl}
                                </div>
                                {/* <div className="w-32">
                                    ${pool.poolAmount} / {pool.usdAmount.toFixed(2)} USD
                                </div> */}
                                <div>
                                    {pool.basePro} : {pool.quotePro}
                                </div>
                                <div>
                                    <li>Base</li>
                                    <li>Base</li>
                                    <p>FR: 50.0%</p>
                                </div>
                                <div className="w-10">
                                    <img src={LOGO} alt="EAGLE" className="w-6 h-6 min-w-6 min-h-6" />
                                </div>
                                {/* <div className="border-[1px] hover:border-pink-400 py-1 px-4 font-semibold rounded-lg border-blue-500">
                                    show
                                </div> */}
                                <div>
                                    68.3%
                                </div>
                            </div>
                        </div>

                    )}) :
                    (
                        <>{chain !== undefined && <Loader />}</>
                    )}
                </div>
            </div>
        </div>
        </div>
  );
};

export default View;