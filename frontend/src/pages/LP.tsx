import EagleLP from '../components/EagleLP';
import { BrowserProvider } from 'ethers';

interface Props {
  provider: BrowserProvider | null;
}

export default function LPPage({ provider }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <EagleLP 
        onNavigateDown={() => {}}
        provider={provider}
      />
    </div>
  );
}

