import React from 'react';

export function CharmBadge() {
  return (
    <a 
      href="https://charm.fi"
      target="_blank" 
      rel="noopener noreferrer"
      className="group"
      title="Charm Finance"
    >
      <div className="bg-white/40 shadow-neo-inset hover:shadow-neo-hover rounded-lg px-3 py-2 transition-all duration-300 border border-gray-200/50">
        <div className="w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform">
          <img 
            src="https://teal-working-dormouse-113.mypinata.cloud/ipfs/bafkreid3difftzksqy3xlummzzobhk674ece35d7drmgo3ftt7wrix6dwu"
            alt="Charm Finance"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </a>
  );
}

