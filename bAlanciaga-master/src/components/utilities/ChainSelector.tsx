import { ChevronDown, Check } from "lucide-react";

interface ChainSelectorProps {
  chain: number | undefined;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  chains: any[];
  onChainSelect: (chain: number) => void;
  modalName: string,
  page: string,
}

const ChainSelector = ({ page, chain, isOpen, setIsOpen, chains, onChainSelect, modalName }: ChainSelectorProps) => {
  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${
          page === "view"? "bg-cyan-300": chain === undefined ? 'bg-[#FFE804] text-black font-medium hover:bg-[#FFE804]/90' : 'bg-[#0A0A0A] hover:bg-[#1B1B1B]'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {chain !== undefined ? (
          <>
            <img src={chains[chain].icon} alt="chain" className="h-5 w-5 rounded-full" />
            <span className="text-sm font-medium">{chains[chain].name}</span>
          </>
        ) : (
          <span className="text-sm font-medium">{modalName}</span>
        )}
        <ChevronDown className={`h-4 w-4 ${chain === undefined ? 'text-black' : 'text-gray-400'} ml-1`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full mt-1.5 right-0 w-[130px] bg-[#111111] rounded-xl shadow-xl border border-gray-800/30 backdrop-blur-sm">
          <div className="py-1.5">
            {chains.map((chainItem, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 hover:bg-[#1B1B1B] cursor-pointer transition-colors"
                onClick={() => {
                  onChainSelect(index);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <img src={chainItem.icon} alt="icon" className="w-5 h-5 rounded-full" />
                  <span className="text-white text-sm font-medium">{chainItem.name}</span>
                </div>
                {chain === index && <Check className="w-4 h-4 text-blue-500" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChainSelector; 