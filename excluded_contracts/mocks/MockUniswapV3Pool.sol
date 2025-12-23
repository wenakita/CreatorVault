// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;
    uint24 public fee = 10000; // 1%
    
    // Mock slot0 data
    uint160 private _sqrtPriceX96 = 79228162514264337593543950336; // 1:1 price
    int24 private _tick = 0;
    
    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }
    
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (
            _sqrtPriceX96,
            _tick,
            0,
            100, // cardinality
            100,
            0,
            true
        );
    }
    
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
        
        for (uint i = 0; i < secondsAgos.length; i++) {
            tickCumulatives[i] = int56(_tick) * int56(int32(secondsAgos[i]));
            secondsPerLiquidityCumulativeX128s[i] = 0;
        }
    }
    
    function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external {
        // Mock function - does nothing
    }
    
    function setSqrtPriceX96(uint160 newPrice) external {
        _sqrtPriceX96 = newPrice;
    }
    
    function setTick(int24 newTick) external {
        _tick = newTick;
    }
}

