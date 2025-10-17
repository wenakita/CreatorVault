interface HeaderProps {
  account: string;
  onConnect: () => void;
}

export default function Header({ account, onConnect }: HeaderProps) {
  return (
    <header className="bg-[#0a0a0a]/95 backdrop-blur-lg border-b border-gray-800">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-7xl">
        <div className="flex items-center gap-4">
          <img 
            src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
            alt="Eagle Finance"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="text-lg font-semibold text-white">47 Eagle Finance</h1>
            <p className="text-xs text-gray-500">Omnichain Vault</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <a href="#" className="px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50">Docs</a>
          <a href="#" className="px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50">Support</a>
          <a href="#" className="px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50">Blog</a>
        </nav>

        <div className="flex items-center gap-3">
          {account ? (
            <div className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/30 font-mono text-sm">
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="px-5 py-2 bg-eagle-gold hover:bg-eagle-gold-dark text-black font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-eagle-gold/20"
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

