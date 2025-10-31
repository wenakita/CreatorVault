import React from 'react';

export function UniswapBadge() {
  return (
    <a 
      href="https://uniswap.org"
      target="_blank" 
      rel="noopener noreferrer"
      className="group"
      title="Uniswap V3"
    >
      <div className="bg-white/40 shadow-neo-inset hover:shadow-neo-hover rounded-lg px-3 py-2 transition-all duration-300 border border-gray-200/50">
        <div className="w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform">
          <img 
            src="https://teal-working-dormouse-113.mypinata.cloud/ipfs/bafkreig3ynkhtw76tekx6lhp7po3xbfy54lg3pvcvvi3mlyhghmzavmlu4"
            alt="Uniswap"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </a>
  );
}

