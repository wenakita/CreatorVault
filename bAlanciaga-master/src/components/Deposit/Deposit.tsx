import { Card } from "primereact/card";
import React from "react";
import { useParams } from "react-router-dom";
import { InputNumber } from 'primereact/inputnumber';
import { FaArrowDownLong } from "react-icons/fa6";

const Deposit = () => {
    const {vaultaddress} = useParams();
    console.log(vaultaddress);
    const [state, setState] = React.useState<string>("Deposit");
    const [value2, setValue2] = React.useState<any>();
    const [value3, setValue3] = React.useState<any>();
  return (
    <div className="flex xl:flex-col sm:flex-col xl:items-center sm:px-4 pt-20 px-20 bg-[#0A0A0A] justify-between h-screen">
      {/* <Card className="bg-[#111111]">
      </Card>   */}
      <div></div>
      <Card className="w-[450px] mb-4 h-[600px] md:w-[320px] rounded-2xl flex flex-col gap-4 p-2 bg-[#111111] text-[#E5E5E5] text-justify">
        <div className="flex py-0.5 pl-0.5 pr-0.5 shadow-2xl  justify-between rounded-2xl bg-[#0A0A0A] w-[196px] mb-4">
            <div 
                className={`${state === "Deposit" ? "bg-[#111111] font-semibold" : "font-normal text-[#E5E5E5]"} transition-bg cursor-pointer rounded-2xl px-4 py-1`}
                onClick={() => setState("Deposit")}
            >
                Deposit
            </div>
            <div 
                className={`${state === "Withdraw" ? "bg-[#111111] font-semibold" : "font-normal text-[#E5E5E5]"} transition-bg cursor-pointer rounded-2xl px-4 py-1`}
                onClick={() => setState("Withdraw")}
            >
                Withdraw
            </div>
        </div>
        {state === "Deposit" && <div>
        Note that deposits are in the same ratio as the vault’s current holdings, and are therefore not necessarily in a 1:1 ratio.
        </div>}
        {state === "Deposit" ?
        (<>
            <div className="flex justify-between items-center gap-2">
                <div className="font-semibold">
                    WETH
                </div>
                <div>
                    <p className="text-right">balance</p>
                    <InputNumber 
                        inputId="withoutgrouping" 
                        value={value2} 
                        onValueChange={(e) => setValue2(e.value)} 
                        useGrouping={false}
                        className="focus-within:border-pink-400 transition-colors w-full border border-blue-300 rounded-lg focus:border-red-300"
                        inputClassName="font-medium outline-none p-2 m-[1px] bg-[#111111]"
                        placeholder="0.0"
                        // min={0} max={100}
                    />
                </div>
            </div>
            <div className="flex justify-between items-center gap-2">
                <div className="font-semibold">
                    WETH
                </div>
                <div>
                    <p className="text-right">balance</p>
                    <InputNumber 
                        inputId="withoutgrouping" 
                        value={value3} 
                        onValueChange={(e) => setValue3(e.value)} 
                        useGrouping={false}
                        className="focus-within:border-pink-400 transition-colors w-full border border-blue-300 rounded-lg focus:border-red-300"
                        inputClassName="font-medium p-2 m-[1px]  bg-[#111111] "
                        placeholder="0.0"
                    />
                </div>
            </div>
            <div className="flex justify-between mt-8 px-4 items-center gap-2">
                <button className="rounded-lg font-semibold text-[#E5E5E5] border-[1px] border-blue-300 p-2 w-[50%]">Approve WETH</button>
                <button className="rounded-lg font-semibold text-[#E5E5E5] border-[1px] border-blue-300 p-2 w-[50%]">Approve WETH</button>
            </div>
            <div className="flex justify-center mt-2 px-4 items-center gap-2">
                <button className="rounded-lg font-semibold text-[#E5E5E5] border-[1px] border-blue-300 p-2 w-[50%]">Deposit</button>
            </div>
        </>)
        :
        (
            <div>
                <div className="flex justify-between items-center gap-2">
                    <div className="font-semibold">
                        Vault Shares
                    </div>
                    <div>
                        <p className="text-right">balance</p>
                        <InputNumber 
                            inputId="withoutgrouping" 
                            value={value3} 
                            onValueChange={(e) => setValue3(e.value)} 
                            useGrouping={false}
                            className="w-full border border-blue-300 rounded-lg"
                            inputClassName="font-medium focus:border-blue-500 p-2 m-[1px] bg-[#0A0A0A]"
                            placeholder="0.0"
                        />
                    </div>
                </div>
                <div className="my-4">
                    You will receive:
                </div>
                <FaArrowDownLong className="mx-auto text-3xl text-blue-500 mb-2"/>
                <div className="flex justify-between items-center mb-4 gap-2">
                    <div className="font-semibold">
                        WETH
                    </div>
                    <div>
                        <InputNumber 
                            inputId="withoutgrouping" 
                            value={value3} 
                            onValueChange={(e) => setValue3(e.value)} 
                            useGrouping={false}
                            className="w-full border-none  rounded-lg hover:bg-slate-500"
                            inputClassName="font-medium bg-[#0A0A0A] focus:border-blue-500 p-2"
                            placeholder="0.0"
                            disabled
                        />
                    </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                    <div className="font-semibold">
                        WETH
                    </div>
                    <div>
                        <InputNumber 
                            inputId="withoutgrouping" 
                            value={value3} 
                            onValueChange={(e) => setValue3(e.value)} 
                            useGrouping={false}
                            className="w-full border-none rounded-lg hover:bg-slate-500"
                            inputClassName="p-2 font-medium bg-[#0A0A0A] focus:border-blue-500"
                            placeholder="0.0"
                            disabled
                        />
                    </div>
                </div>

                <button className="rounded-lg mx-[25%] mt-2 font-semibold text-[#E5E5E5] border-[1px] border-blue-300 p-2 w-[50%]">Withdraw</button>
            </div>
        )}
      </Card>
    </div>
  );
};

export default Deposit;