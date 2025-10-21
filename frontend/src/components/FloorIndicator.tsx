import { motion } from 'framer-motion';
import type { Floor } from './EagleEcosystem';

interface Props {
  current: Floor;
  onChange: (floor: Floor) => void;
  isTransitioning: boolean;
}

const floors: Array<{ id: Floor; label: string; icon: string; color: string }> = [
  { id: 'lp', label: 'LP Pool', icon: '🔝', color: 'from-blue-500 to-purple-500' },
  { id: 'home', label: 'Home', icon: '🏠', color: 'from-yellow-500 to-amber-500' },
  { id: 'vault', label: 'Vault', icon: '⚙️', color: 'from-yellow-600 to-amber-700' }
];

export default function FloorIndicator({ current, onChange, isTransitioning }: Props) {
  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50">
      <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl">
        {floors.map((floor, index) => {
          const isActive = current === floor.id;
          const isPast = floors.findIndex(f => f.id === current) > index;
          
          return (
            <div key={floor.id} className="relative">
              <button
                onClick={() => onChange(floor.id)}
                disabled={isTransitioning}
                className={`
                  relative block w-14 h-14 rounded-xl mb-2 last:mb-0 
                  transition-all duration-300 group
                  ${isActive 
                    ? `bg-gradient-to-br ${floor.color} scale-110 shadow-lg` 
                    : 'bg-white/10 hover:bg-white/20'
                  }
                  ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}
                `}
                title={floor.label}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"
                    animate={{
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
                
                <span className={`
                  text-2xl absolute inset-0 flex items-center justify-center
                  ${isActive ? 'scale-110' : ''}
                  transition-transform
                `}>
                  {floor.icon}
                </span>

                {/* Label on hover */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 whitespace-nowrap">
                    <p className="text-sm font-medium text-white">{floor.label}</p>
                  </div>
                </div>
              </button>

              {/* Connection Line */}
              {index < floors.length - 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-2 bg-white/20" />
              )}
            </div>
          );
        })}

        {/* Current Floor Label */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-gray-400 text-center font-medium">
            {floors.find(f => f.id === current)?.label}
          </p>
        </div>
      </div>
    </div>
  );
}

