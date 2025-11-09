import { Check } from 'lucide-react'

interface ChainItemProps {
  show: boolean;
  onClose: () => void;
  chains: {
    name: string;
    chainId: number;
    routerAddress: string;
    factoryAddress: string;
    EagleTokenAddress: string;
    vaultAddress: string;
    vaultFactoryAddress: string;
  }[];
  selectedChain: number;
  onChainSelect: (chain: number) => void;
}

const ChainItem: React.FC<ChainItemProps> = ({ show, onClose, chains, selectedChain, onChainSelect }) => {
  if (!show) return null;

  return (
    <div className="absolute top-full mt-1 right-0 w-48 bg-[#1B1B1B] rounded-lg shadow-lg border border-gray-800 overflow-hidden">
      <div className="py-1">
        {chains.map((chain, index) => (
          <div
            key={chain.chainId}
            className="flex items-center justify-between px-4 py-2 hover:bg-[#2D2D2D] cursor-pointer"
            onClick={() => {
              onChainSelect(index);
              onClose();
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white">{chain.name}</span>
            </div>
            {selectedChain === index && <Check className="w-4 h-4 text-blue-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChainItem
