import React from 'react';

export function UniswapBadge() {
  return (
    <a 
      href="https://uniswap.org"
      target="_blank" 
      rel="noopener noreferrer"
      className="group"
    >
      <div className="bg-white/40 shadow-neo-inset hover:shadow-neo-hover rounded-xl px-4 py-2 transition-all duration-300 border border-gray-200/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors font-medium">
            Powered by
          </span>
          <div className="w-4 h-4 flex items-center justify-center group-hover:scale-110 transition-transform">
            <img 
              src="https://teal-working-dormouse-113.mypinata.cloud/ipfs/bafkreig3ynkhtw76tekx6lhp7po3xbfy54lg3pvcvvi3mlyhghmzavmlu4"
              alt="Uniswap"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </a>
  );
}

