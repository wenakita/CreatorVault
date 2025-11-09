/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Line } from '@react-three/drei'
import * as THREE from 'three'
import { MAINSYMBOLS } from '../../utils/setting';
// import utils from '../../utils/setting';
// import { fetchLiquidityConcentration } from '../../utils/graphQueries';
// import {
//   DEFAULT_CAMERA_POSITION as CAMERA_POSITION,
//   calculateAxisValues as computeAxisValues,
//   calculateLiquidityHeight as computeLiquidityHeight,
//   calculateTickFromSlider as computeTickFromSlider
// } from '../../utils/visualizationUtils';

// Constants
const MAX_TICK = 887272;
const MIN_TICK = -887272;

// Helper functions
const formatTickPrice = (tick: number): string => {
  try {
    const price = Math.pow(1.0001, tick);
    return price.toFixed(4);
  } catch (error) {
    console.error('Error formatting tick price:', error);
    return '0.00';
  }
};

const calculateTokenRatios = (currentTick: number, lowerTick: number, upperTick: number): { depositedToken: number, hermes: number } => {
  try {
    // Ensure ticks are within safe bounds
    const safeLowerTick = Math.max(MIN_TICK, Math.min(MAX_TICK, lowerTick));
    const safeUpperTick = Math.max(MIN_TICK, Math.min(MAX_TICK, upperTick));
    const safeCurrentTick = Math.max(MIN_TICK, Math.min(MAX_TICK, currentTick));

    if (safeCurrentTick <= safeLowerTick) {
      return { depositedToken: 100, hermes: 0 };
    } else if (safeCurrentTick >= safeUpperTick) {
      return { depositedToken: 0, hermes: 100 };
    }

    const position = (safeCurrentTick - safeLowerTick) / (safeUpperTick - safeLowerTick);
    const hermes = Math.round(position * 100);
    const depositedToken = 100 - hermes;
    return { depositedToken, hermes };
  } catch (error) {
    console.error('Error calculating token ratios:', error);
    return { depositedToken: 100, hermes: 0 };
  }
};

const calculateLiquidityRange = (lowerTick: number, upperTick: number): number => {
  try {
    // Convert ticks to prices
    const lowerPrice = Math.pow(1.0001, lowerTick);
    const upperPrice = Math.pow(1.0001, upperTick);
    
    // Calculate price range as percentage
    const priceRange = ((upperPrice - lowerPrice) / lowerPrice) * 100;
    
    // Return the range percentage, with a minimum of 0.01%
    return Math.max(0.01, Math.min(999.99, priceRange));
  } catch (error) {
    console.error("Error calculating liquidity range:", error);
    return 0;
  }
};

const formatCurrency = (
  initialUsdValue: number,
  maxValue: number,
  rangeProgress: number
): string => {
  const currentValue = initialUsdValue + (maxValue - initialUsdValue) * rangeProgress;

  // Determine the formatted value with suffixes
  let formattedValue: string;

  if (currentValue >= 1_000_000) {
    formattedValue = (currentValue / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + 'M'; // Millions
  } else if (currentValue >= 1_000) {
    formattedValue = (currentValue / 1_000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + 'K'; // Thousands
  } else {
    formattedValue = currentValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return formattedValue;
}

const calculatePositionValue = (
  initialAmount: string,
  currentTick: number,
  lowerTick: number,
  upperTick: number,
  initialUsdValue: number
): string => {
  console.log("Calculating position value...", {
    initialAmount,
    currentTick,
    lowerTick,
    upperTick,
    initialUsdValue,
  });
  try {
    if (!initialAmount || initialUsdValue <= 0) return '$0.00';

    // Ensure ticks are within safe bounds
    const safeLowerTick = Math.max(MIN_TICK, Math.min(MAX_TICK, lowerTick));
    const safeUpperTick = Math.max(MIN_TICK, Math.min(MAX_TICK, upperTick));
    const safeCurrentTick = Math.max(MIN_TICK, Math.min(MAX_TICK, currentTick));

    // Calculate position in range (0 to 1)
    const rangeProgress = Math.max(0, Math.min(1, 
      (safeCurrentTick - safeLowerTick) / (safeUpperTick - safeLowerTick)
    ));

    // Calculate value based on position in range
    const maxValue = initialUsdValue * 1.5; // 50% potential increase
    console.log("Currency:");
    const currency = formatCurrency(initialUsdValue, maxValue, rangeProgress);
    return currency;
  } catch (error) {
    console.error('Error calculating position value:', error);
    return '$0.00';
  }
};

const calculateHeight = (amount: string): number => {
  try {
    if (!amount || amount === "0") {
      return 0.5; // Minimum height for zero liquidity
    }

    // Convert amount to number
    const amountNum = parseFloat(amount);
    
    // Scale the height based on the amount
    // Using log scale to handle large ranges of values
    const baseHeight = Math.log10(amountNum + 1) * 5;
    
    // Ensure minimum and maximum heights
    const minHeight = 0.5;
    const maxHeight = 50;
    
    return Math.max(minHeight, Math.min(maxHeight, baseHeight));
  } catch (error) {
    console.error('Error calculating height:', error);
    return 0.5; // Default minimum height
  }
};

// Add interface for main props
interface MainProps {
  currentTick: number;
  lowerTick: number;
  upperTick: number;
  amount: string;
  calculatedAPR: string;
  initialUsdValue: number;
  selectedToken?: {
    name: string;
    symbol: string;
    logoURI?: string;
    address?: string;
    decimals?: number;
  } | null;
  chainId: number;
  v2PairAddress?: string;
}

// Add component interfaces
interface LiquidityPositionProps {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string | THREE.Color;
  index: number;
  currentPricePosition: number;
}

interface AxisIndicatorsProps {
  size: number;
}

// Add component implementations
const GridFloor = React.memo(() => {
  return (
    <group>
      {/* Main grid on the floor */}
      <gridHelper 
        args={[120, 30, 0x303030, 0x505050]} 
        position={[60, 0, 30]}  // Center grid
        rotation={[0, 0, 0]}
      />
      {/* Additional grid for better visibility */}
      <gridHelper 
        args={[120, 15, 0x404040, 0x606060]} 
        position={[60, 0, 30]}  // Center grid
        rotation={[0, 0, 0]}
      />
    </group>
  );
});

const AxisIndicators = React.memo<AxisIndicatorsProps>(({ size }) => {
  const axisColor = new THREE.Color(0x808080);
  
  return (
    <group>
      {/* X axis (Price) */}
      <Line
        points={[[0, 0, 0], [120, 0, 0]]}
        color={axisColor}
        lineWidth={1.5}
      />

      {/* Y axis (Liquidity) */}
      <Line
        points={[[0, 0, 0], [0, size * 0.8, 0]]}
        color={axisColor}
        lineWidth={1.5}
      />

      {/* Z axis */}
      <Line
        points={[[0, 0, 0], [0, 0, 60]]}
        color={axisColor}
        lineWidth={1.5}
      />

      {/* Axis labels */}
      <Text 
        position={[110, -1, 0]}
        color="white" 
        fontSize={1.8}
        anchorX="right" 
        anchorY="top"
        rotation={[0, -Math.PI, 0]}
      >
        Price
      </Text>

      <Text
        position={[-2, size * 0.7, 0]}
        color="white"
        fontSize={1.8}
        anchorY="middle"
        anchorX="right"
        rotation={[0, -Math.PI, -Math.PI / 2]}
      >
        Liquidity
      </Text>
    </group>
  );
});

const LiquidityPosition = React.memo<LiquidityPositionProps>(
  ({ width, height, currentPricePosition }) => {
    // Ensure valid dimensions
    const safeWidth = Math.max(0.001, width);
    const safeHeight = Math.max(0.001, height);
    const fixedDepth = 20; // Fixed depth for both tokens
    
    // Calculate widths based on current price position
    const safePricePosition = Math.max(0, Math.min(1, currentPricePosition));
    const leftWidth = Math.max(0.001, safeWidth * (1 - safePricePosition));
    const rightWidth = Math.max(0.001, safeWidth * safePricePosition);
    
    return (
      <group>
        {/* Left side - Deposited Token */}
        {leftWidth > 0.001 && (
          <group position={[leftWidth/2, safeHeight/2, 0]}>
            <mesh>
              <boxGeometry args={[leftWidth, safeHeight, fixedDepth]} />
              <meshStandardMaterial 
                color="#60A5FA" 
                transparent 
                opacity={0.4}
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(leftWidth, safeHeight, fixedDepth)]} />
              <lineBasicMaterial color="#60A5FA" linewidth={3} />
            </lineSegments>
          </group>
        )}

        {/* Right side - EAGLE */}
        {rightWidth > 0.001 && (
          <group position={[leftWidth + rightWidth/2, safeHeight/2, 0]}>
            <mesh>
              <boxGeometry args={[rightWidth, safeHeight, fixedDepth]} />
              <meshStandardMaterial 
                color="#FFD700" 
                transparent 
                opacity={0.4}
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(rightWidth, safeHeight, fixedDepth)]} />
              <lineBasicMaterial color="#FFD700" linewidth={3} />
            </lineSegments>
          </group>
        )}
      </group>
    );
  }
);

// Add display names
GridFloor.displayName = 'GridFloor';
AxisIndicators.displayName = 'AxisIndicators';
LiquidityPosition.displayName = 'LiquidityPosition';

// Add this after the imports
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[500px] w-full flex items-center justify-center bg-[#111111] rounded-lg">
          <div className="text-center">
            <p className="text-red-400 mb-2">Failed to load visualization</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export the main visualization component
export default function InteractiveLiquidityVisualization(props: MainProps) {
  const { currentTick, lowerTick, upperTick, amount, calculatedAPR, initialUsdValue, selectedToken } = props;
  const [mounted, setMounted] = useState(false);
  const [simulatedTick, setSimulatedTick] = useState(lowerTick);
  const [tokenRatios, setTokenRatios] = useState({ depositedToken: 100, hermes: 0 });

  // Memoize expensive calculations
  const liquidityHeight = useMemo(() => calculateHeight(amount), [amount]);
  
  const positionValue = useMemo(() => {
    if (!amount || !initialUsdValue || lowerTick === undefined || upperTick === undefined) {
      return '$0.00';
    }
    return calculatePositionValue(
      amount,
      simulatedTick,
      lowerTick,
      upperTick,
      initialUsdValue
    );
  }, [amount, simulatedTick, lowerTick, upperTick, initialUsdValue]);

  const liquidityRange = useMemo(() => {
    if (lowerTick === undefined || upperTick === undefined) {
      return 0;
    }
    return calculateLiquidityRange(lowerTick, upperTick);
  }, [lowerTick, upperTick]);

  const currentPricePosition = useMemo(() => {
    if (!upperTick || !lowerTick || upperTick === lowerTick) {
      return 0;
    }
    const progress = ((simulatedTick - lowerTick) / (upperTick - lowerTick));
    return isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
  }, [simulatedTick, lowerTick, upperTick]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (selectedToken && lowerTick !== undefined && upperTick !== undefined) {
      const ratios = calculateTokenRatios(simulatedTick, lowerTick, upperTick);
      setTokenRatios(ratios);
    }
  }, [simulatedTick, lowerTick, upperTick, selectedToken]);

  useEffect(() => {
    if (mounted && currentTick !== undefined) {
      setSimulatedTick(currentTick);
    }
  }, [currentTick, mounted]);

  const sliderValue = useMemo(() => {
    if (!upperTick || !lowerTick || upperTick === lowerTick) {
      return 0;
    }
    const progress = ((simulatedTick - lowerTick) / (upperTick - lowerTick)) * 100;
    return isNaN(progress) ? 0 : Math.max(0, Math.min(100, progress));
  }, [simulatedTick, lowerTick, upperTick]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && lowerTick !== undefined && upperTick !== undefined) {
      const newTick = lowerTick + ((upperTick - lowerTick) * value) / 100;
      setSimulatedTick(Math.round(newTick));
    }
  };

  if (!mounted) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-[#111111] rounded-lg">
        <div className="text-center">
          <p className="text-blue-400 mb-2">Loading visualization...</p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 bg-[#1B1B1B] rounded-lg p-6">
      {/* Position Info Display */}
      <div className="flex  justify-between items-stretch p-4 bg-[#1F1F1F] rounded-lg">
        <div className="text-center flex-1 px-2 sm:px-[0px]">
          <div className="text-xs sm:text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            LIQUIDITY DETAILS
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-2xl sm:text-lg font-medium text-gray-200 truncate">
              {liquidityRange.toFixed(0)}%
              <span className="text-sm sm:text-xs text-gray-400 ml-1">Range</span>
            </div>
            {/* <div className="text-2xl sm:text-lg sm:p-2 font-medium text-gray-200 truncate">
              {Math.abs(upperTick - lowerTick).toLocaleString()}
              <span className="text-sm sm:text-xs text-gray-400 ml-1">Ticks</span>
            </div> */}
          </div>
        </div>
        <div className="h-20 w-[1px] bg-gray-800 mx-2 sm:mx-1"></div>
        <div className="text-center flex-1 px-2">
          <div className="text-xs sm:text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            POSITION VALUE
          </div>
          <div className="text-3xl sm:text-lg font-medium text-gray-200 truncate mt-3">
            {positionValue}
          </div>
        </div>
        <div className="h-20 w-[1px] bg-gray-800 mx-2 sm:mx-1"></div>
        <div className="text-center flex-1 px-2 sm:px-[0px]">
          <div className="text-xs sm:text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            ESTIMATED APR
          </div>
          <div className="flex items-baseline justify-center mt-3">
            <span className="text-3xl sm:text-lg font-bold text-green-400 leading-none">
              {calculatedAPR}
            </span>  
            {selectedToken && <span className="text-xl sm:text-xs font-bold text-green-400 leading-none ml-1">%</span>}
          </div>
        </div>
      </div>

      {/* Token Ratio Display */}
      <div className="flex justify-center items-center gap-4 p-4 sm:p-1 bg-[#1F1F1F] rounded-lg relative">
        <div className="text-xs text-gray-500 uppercase tracking-wider absolute -top-2 left-1/2 -translate-x-1/2 bg-[#1B1B1B] px-2">
          TOKEN RATIO
        </div>
        <div className="flex-1 text-center pt-4 sm:pt-0">
          <div className="text-5xl sm:text-2xl font-bold text-blue-400 leading-tight">
            {simulatedTick === lowerTick ? "100" : tokenRatios.depositedToken}%
          </div>
          <div className="text-sm text-blue-400 uppercase tracking-wider mt-2">
            {selectedToken ? selectedToken.name : 'DEPOSITED TOKEN'}
          </div>
        </div>
        <div className="h-24 w-px bg-gray-800"></div>
        <div className="flex-1 text-center pt-4 sm:pt-0">
          <div className={`text-5xl sm:text-2xl font-bold ${props.chainId?"text-yellow-400":"text-purple-500"} leading-tight`}>
            {simulatedTick === lowerTick ? "0" : tokenRatios.hermes}%
          </div>
          <div className={`text-sm ${props.chainId?"text-yellow-400":"text-purple-500"} uppercase tracking-wider mt-2`}>
            {MAINSYMBOLS[props.chainId]}
          </div>
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="aspect-[1] w-full relative bg-[#111111] rounded-lg overflow-hidden">
        <ErrorBoundary>
          <Canvas
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [-100, 69, -100], fov: 30 }}
            shadows
          >
            <ambientLight intensity={0.7} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <directionalLight position={[-5, 5, -5]} intensity={0.7} />
            <hemisphereLight intensity={0.4} />
            
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              rotateSpeed={0.5}
              minDistance={10}
              maxDistance={400}
              target={[40, 30, 0]}
              enableRotate={true}
              enableZoom={true}
              enablePan={true}
            />
            
            <GridFloor />
            <AxisIndicators size={60} />
            
            {/* Position liquidity pool at origin */}
            <group>
              <LiquidityPosition
                position={[0, 0, 0]}
                width={60}
                height={liquidityHeight}
                depth={60}
                color="#3B82F6"
                index={0}
                currentPricePosition={currentPricePosition}
              />
            </group>
          </Canvas>
        </ErrorBoundary>
      </div>

      {/* Price Simulation Slider */}
      <div className="mt-4 relative h-8">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          className={`w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#FFE804]
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          ${props.chainId === 0 ? '[&::-webkit-slider-thumb]:bg-purple-500' : '[&::-webkit-slider-thumb]:bg-yellow-400'}
          ${props.chainId === 0 ? '[&::-moz-range-thumb]:bg-purple-500' : '[&::-moz-range-thumb]:bg-yellow-400'}
          [&::-webkit-slider-thumb]:transition-all
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#FFE804]
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:transition-all
          [&::-moz-range-thumb]:hover:scale-110`}
        />
        <div className="absolute inset-x-0 top-6 text-white text-center text-sm">
          Simulated Price: {formatTickPrice(simulatedTick)} {MAINSYMBOLS[props.chainId]} per {selectedToken?.symbol || 'token'}
        </div>
      </div>
    </div>
  );
}

