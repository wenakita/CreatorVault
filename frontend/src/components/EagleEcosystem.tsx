import { motion } from 'framer-motion';
import { useState } from 'react';
import EagleHome from './EagleHome';
import EagleLP from './EagleLP';
import FloorIndicator from './FloorIndicator';
import { BrowserProvider } from 'ethers';

export type Floor = 'lp' | 'home' | 'vault';

interface Props {
  provider: BrowserProvider | null;
  account: string;
  onToast: (toast: { message: string; type: 'success' | 'error' | 'info'; txHash?: string }) => void;
  VaultComponent: React.ComponentType<any>;
}

export default function EagleEcosystem({ provider, account, onToast, VaultComponent }: Props) {
  const [currentFloor, setCurrentFloor] = useState<Floor>('home');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Vertical offset for each floor (in viewport height)
  const floorOffsets: Record<Floor, number> = {
    'lp': 0,      // Top floor at 0vh
    'home': 100,  // Main floor at 100vh  
    'vault': 200  // Vault at 200vh (basement)
  };

  const navigateToFloor = (floor: Floor) => {
    setIsTransitioning(true);
    setCurrentFloor(floor);
    
    // Reset scroll position for the destination floor
    setTimeout(() => {
      const floorElement = document.getElementById(`${floor}-floor`);
      if (floorElement) {
        floorElement.scrollTop = 0;
      }
      setIsTransitioning(false);
    }, 400);
  };

  const currentOffset = floorOffsets[currentFloor];

  return (
    <div className="h-[calc(100vh-64px-80px)] overflow-hidden relative">
      {/* Animated Container */}
      <motion.div
        className="absolute w-full"
        animate={{ 
          y: `${-currentOffset}vh` 
        }}
        transition={{ 
          type: "spring",
          stiffness: 60,
          damping: 25,
          mass: 0.8,
          duration: 0.8
        }}
      >
        {/* Continuous Gradient Background - Spans all 3 floors */}
        <div className="absolute inset-0 w-full h-[300vh] bg-gradient-to-b from-yellow-500/15 via-amber-600/8 via-[#0a0a0a] to-[#0a0a0a] pointer-events-none"></div>
        {/* Top Floor - EAGLE/ETH LP */}
        <div className="h-[calc(100vh-64px-80px)] overflow-hidden" id="lp-floor">
          <motion.div
            animate={{
              opacity: isTransitioning && currentFloor !== 'lp' ? 0.5 : 1,
              scale: isTransitioning && currentFloor !== 'lp' ? 0.98 : 1
            }}
            className="h-full"
          >
            <EagleLP 
              onNavigateDown={() => navigateToFloor('home')}
              provider={provider}
            />
          </motion.div>
        </div>

        {/* Main Floor - Home */}
        <div className="h-[calc(100vh-64px-80px)] overflow-hidden" id="home-floor">
          <motion.div
            animate={{
              opacity: isTransitioning && currentFloor !== 'home' ? 0.5 : 1,
              scale: isTransitioning && currentFloor !== 'home' ? 0.98 : 1
            }}
            className="h-full"
          >
            <EagleHome 
              onNavigateUp={() => navigateToFloor('lp')}
              onNavigateDown={() => navigateToFloor('vault')}
              provider={provider}
            />
          </motion.div>
        </div>

        {/* Basement - Vault */}
        <div className="h-[calc(100vh-64px-80px)] overflow-y-auto overflow-x-hidden" id="vault-floor" style={{ WebkitOverflowScrolling: 'touch' }}>
          <motion.div
            animate={{
              opacity: isTransitioning && currentFloor !== 'vault' ? 0.5 : 1,
              scale: isTransitioning && currentFloor !== 'vault' ? 0.98 : 1
            }}
          >
            <VaultComponent 
              provider={provider}
              account={account}
              onToast={onToast}
              onNavigateUp={() => navigateToFloor('home')}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Floor Indicator (Elevator) - Always visible */}
      <FloorIndicator 
        current={currentFloor}
        onChange={navigateToFloor}
        isTransitioning={isTransitioning}
      />
    </div>
  );
}

