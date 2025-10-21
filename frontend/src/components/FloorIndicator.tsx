import { motion } from 'framer-motion';
import type { Floor } from './EagleEcosystem';

interface Props {
  current: Floor;
  onChange: (floor: Floor) => void;
  isTransitioning: boolean;
}

const floors: Array<{ id: Floor; label: string; icon: JSX.Element; color: string }> = [
  { 
    id: 'lp', 
    label: 'LP Pool', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'from-blue-500 to-purple-500' 
  },
  { 
    id: 'home', 
    label: 'Home', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    color: 'from-yellow-500 to-amber-500' 
  },
  { 
    id: 'vault', 
    label: 'Vault', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'from-yellow-600 to-amber-700' 
  }
];

export default function FloorIndicator({ current, onChange, isTransitioning }: Props) {
  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50">
      <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl">
        <div className="space-y-2">
          {floors.map((floor, index) => {
            const isActive = current === floor.id;
            
            return (
              <div key={floor.id} className="relative">
                <button
                  onClick={() => onChange(floor.id)}
                  disabled={isTransitioning}
                  className={`
                    relative w-12 h-12 rounded-xl
                    transition-all duration-300 group
                    ${isActive 
                      ? `bg-gradient-to-br ${floor.color} shadow-lg` 
                      : 'bg-white/5 hover:bg-white/10'
                    }
                    ${isTransitioning ? 'cursor-wait opacity-50' : 'cursor-pointer'}
                  `}
                  title={floor.label}
                >
                  {/* Active glow effect */}
                  {isActive && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-br ${floor.color} rounded-xl opacity-50 blur-md -z-10`}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.3, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                  
                  <div className={`
                    absolute inset-0 flex items-center justify-center
                    ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}
                    transition-colors
                  `}>
                    {floor.icon}
                  </div>

                  {/* Label tooltip on hover */}
                  <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap">
                    <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 shadow-xl">
                      <p className="text-sm font-medium text-white">{floor.label}</p>
                      {floor.id === 'lp' && (
                        <p className="text-xs text-gray-400 mt-0.5">Coming Soon</p>
                      )}
                      {floor.id === 'vault' && (
                        <p className="text-xs text-emerald-400 mt-0.5">Active</p>
                      )}
                    </div>
                    {/* Arrow */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-[-45deg]"></div>
                  </div>
                </button>

                {/* Connection line between floors */}
                {index < floors.length - 1 && (
                  <div className="absolute left-1/2 -translate-x-1/2 w-px h-2 bg-white/10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Current floor label */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-gray-400 text-center font-medium">
            {floors.find(f => f.id === current)?.label}
          </p>
        </div>
      </div>
    </div>
  );
}
