import { ChainId, } from '@uniswap/sdk-core';
import { CUSD_CELO, CUSD_CELO_ALFAJORES, DAI_ARBITRUM, DAI_AVAX, DAI_BNB, DAI_GOERLI, DAI_MAINNET, DAI_OPTIMISM, DAI_OPTIMISM_GOERLI, DAI_POLYGON_MUMBAI, DAI_SEPOLIA, USDC_ARBITRUM, USDC_ARBITRUM_GOERLI, USDC_AVAX, USDC_BASE, USDC_BNB, USDC_ETHEREUM_GNOSIS, USDC_GOERLI, USDC_MAINNET, USDC_MOONBEAM, USDC_OPTIMISM, USDC_OPTIMISM_GOERLI, USDC_POLYGON, USDC_SEPOLIA, USDC_ZKATANA, USDC_SEIDEV, USDT_ARBITRUM, USDT_BNB, USDT_GOERLI, USDT_MAINNET, USDT_OPTIMISM, USDT_OPTIMISM_GOERLI, WBTC_GOERLI } from '../../../providers/token-provider';
import { WRAPPED_NATIVE_CURRENCY } from '../../../util';
// When adding new usd gas tokens, ensure the tokens are ordered
// from tokens with highest decimals to lowest decimals. For example,
// DAI_AVAX has 18 decimals and comes before USDC_AVAX which has 6 decimals.
export const usdGasTokensByChain = {
    [ChainId.MAINNET]: [DAI_MAINNET, USDC_MAINNET, USDT_MAINNET],
    [ChainId.ARBITRUM_ONE]: [DAI_ARBITRUM, USDC_ARBITRUM, USDT_ARBITRUM],
    [ChainId.OPTIMISM]: [DAI_OPTIMISM, USDC_OPTIMISM, USDT_OPTIMISM],
    [ChainId.OPTIMISM_GOERLI]: [
        DAI_OPTIMISM_GOERLI,
        USDC_OPTIMISM_GOERLI,
        USDT_OPTIMISM_GOERLI,
    ],
    [ChainId.ARBITRUM_GOERLI]: [USDC_ARBITRUM_GOERLI],
    [ChainId.GOERLI]: [DAI_GOERLI, USDC_GOERLI, USDT_GOERLI, WBTC_GOERLI],
    [ChainId.SEPOLIA]: [USDC_SEPOLIA, DAI_SEPOLIA],
    [ChainId.POLYGON]: [USDC_POLYGON],
    [ChainId.POLYGON_MUMBAI]: [DAI_POLYGON_MUMBAI],
    [ChainId.CELO]: [CUSD_CELO],
    [ChainId.CELO_ALFAJORES]: [CUSD_CELO_ALFAJORES],
    [ChainId.GNOSIS]: [USDC_ETHEREUM_GNOSIS],
    [ChainId.MOONBEAM]: [USDC_MOONBEAM],
    [ChainId.BNB]: [USDT_BNB, USDC_BNB, DAI_BNB],
    [ChainId.AVALANCHE]: [DAI_AVAX, USDC_AVAX],
    [ChainId.BASE]: [USDC_BASE],
    [ChainId.ZKATANA]: [USDC_ZKATANA],
    [ChainId.SEIDEV]: [USDC_SEIDEV],
};
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IV2GasModelFactory
 */
export class IV2GasModelFactory {
}
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IOnChainGasModelFactory
 */
export class IOnChainGasModelFactory {
}
// Determines if native currency is token0
// Gets the native price of the pool, dependent on 0 or 1
// quotes across the pool
export const getQuoteThroughNativePool = (chainId, nativeTokenAmount, nativeTokenPool) => {
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
    const isToken0 = nativeTokenPool.token0.equals(nativeCurrency);
    // returns mid price in terms of the native currency (the ratio of token/nativeToken)
    const nativeTokenPrice = isToken0
        ? nativeTokenPool.token0Price
        : nativeTokenPool.token1Price;
    // return gas cost in terms of the non native currency
    return nativeTokenPrice.quote(nativeTokenAmount);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFDTCxPQUFPLEdBR1IsTUFBTSxtQkFBbUIsQ0FBQztBQUszQixPQUFPLEVBQ0wsU0FBUyxFQUNULG1CQUFtQixFQUNuQixZQUFZLEVBQ1osUUFBUSxFQUNSLE9BQU8sRUFDUCxVQUFVLEVBQ1YsV0FBVyxFQUNYLFlBQVksRUFDWixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLFdBQVcsRUFDWCxhQUFhLEVBQ2Isb0JBQW9CLEVBQ3BCLFNBQVMsRUFDVCxTQUFTLEVBQ1QsUUFBUSxFQUNSLG9CQUFvQixFQUNwQixXQUFXLEVBQ1gsWUFBWSxFQUNaLGFBQWEsRUFDYixhQUFhLEVBQ2Isb0JBQW9CLEVBQ3BCLFlBQVksRUFDWixZQUFZLEVBQ1osWUFBWSxFQUNaLFdBQVcsRUFDWCxhQUFhLEVBQ2IsUUFBUSxFQUNSLFdBQVcsRUFDWCxZQUFZLEVBQ1osYUFBYSxFQUNiLG9CQUFvQixFQUNwQixXQUFXLEVBQ1osTUFBTSxtQ0FBbUMsQ0FBQztBQU8zQyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFTeEQsZ0VBQWdFO0FBQ2hFLHFFQUFxRTtBQUNyRSw0RUFBNEU7QUFDNUUsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQXVDO0lBQ3JFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUM7SUFDNUQsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWEsQ0FBQztJQUNwRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsYUFBYSxDQUFDO0lBQ2hFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ3pCLG1CQUFtQjtRQUNuQixvQkFBb0I7UUFDcEIsb0JBQW9CO0tBQ3JCO0lBQ0QsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztJQUNqRCxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztJQUNyRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUM7SUFDOUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUM7SUFDakMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztJQUM5QyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQztJQUMzQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDO0lBQy9DLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUM7SUFDeEMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUM7SUFDbkMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQztJQUM1QyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUM7SUFDMUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUM7SUFDM0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUM7SUFDakMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUM7Q0FDaEMsQ0FBQztBQXVFRjs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxPQUFnQixrQkFBa0I7Q0FRdkM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxPQUFnQix1QkFBdUI7Q0FhNUM7QUFFRCwwQ0FBMEM7QUFDMUMseURBQXlEO0FBQ3pELHlCQUF5QjtBQUN6QixNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxDQUN2QyxPQUFnQixFQUNoQixpQkFBMkMsRUFDM0MsZUFBNEIsRUFDWixFQUFFO0lBQ2xCLE1BQU0sY0FBYyxHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBRSxDQUFDO0lBQ3pELE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQy9ELHFGQUFxRjtJQUNyRixNQUFNLGdCQUFnQixHQUFHLFFBQVE7UUFDL0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxXQUFXO1FBQzdCLENBQUMsQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDO0lBQ2hDLHNEQUFzRDtJQUN0RCxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBbUIsQ0FBQztBQUNyRSxDQUFDLENBQUMifQ==