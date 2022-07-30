// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.11;

import "./SwapHelperUniswap.sol";
import "./SwapHelperBalancer.sol";

/// @title Contains logic facilitating swapping using Uniswap / Balancer
abstract contract SwapHelper is SwapHelperBalancer, SwapHelperUniswap {

    /**
     * @notice Sets initial values
     * @param _uniswapRouter Uniswap router address
     * @param _WETH WETH token address
     */
    constructor(ISwapRouter02 _uniswapRouter, 
                address _WETH)
    SwapHelperUniswap(_uniswapRouter, _WETH)
    SwapHelperBalancer()
    {}

    /**
     * @notice Approve reward token and swap the `amount` to a strategy underlying asset
     * @param from Token to swap from
     * @param to Token to swap to
     * @param amount Amount of tokens to swap
     * @param swapData Swap details showing the path of the swap
     * @return result Amount of underlying (`to`) tokens recieved
     */
    function _approveAndSwap(
        IERC20 from,
        IERC20 to,
        uint256 amount,
        SwapData calldata swapData
    ) internal virtual returns (uint256) {

        uint actualpathSize = swapData.path.length - ACTION_SIZE;

        if((actualpathSize % ADDR_SIZE == 0)     ||          // Uniswap V2 (Direct, WETH, Normal)
           (actualpathSize == FEE_SIZE)          ||          // Uniswap V3 (Direct)
           (actualpathSize == WETH_V3_PATH_SIZE) ||          // Uniswap V3 (WETH)
         (((actualpathSize - FEE_SIZE) % NEXT_OFFSET) == 0)) // Uniswap V3 (Normal)
        {
            return _approveAndSwapUniswap(from, to, amount, swapData);
        }
        return _approveAndSwapBalancer(from, to, amount, swapData);
    }
}
