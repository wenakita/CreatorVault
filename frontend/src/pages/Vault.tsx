import { Link } from 'react-router-dom';
import VaultView from '../components/VaultView';
import { BrowserProvider } from 'ethers';

interface Props {
  provider: BrowserProvider | null;
  account: string;
  onToast: (toast: { message: string; type: 'success' | 'error' | 'info'; txHash?: string }) => void;
}

export default function VaultPage({ provider, account, onToast }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <VaultView 
        provider={provider}
        account={account}
        onToast={onToast}
        onNavigateUp={() => {}}
      />
    </div>
  );
}

