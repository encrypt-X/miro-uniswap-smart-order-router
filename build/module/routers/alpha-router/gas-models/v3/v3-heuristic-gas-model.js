import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Percent, Price, TradeType } from '@uniswap/sdk-core';
import _ from 'lodash';
import { SwapType, WRAPPED_NATIVE_CURRENCY, } from '../../../..';
import { CurrencyAmount } from '../../../../util/amounts';
import { calculateArbitrumToL1FeeFromCalldata, getL2ToL1GasUsed } from '../../../../util/gas-factory-helpers';
import { log } from '../../../../util/log';
import { buildSwapMethodParameters, buildTrade, } from '../../../../util/methodParameters';
import { getQuoteThroughNativePool, IOnChainGasModelFactory, } from '../gas-model';
import { BASE_SWAP_COST, COST_PER_HOP, COST_PER_INIT_TICK, COST_PER_UNINIT_TICK, SINGLE_HOP_OVERHEAD, TOKEN_OVERHEAD, } from './gas-costs';
/**
 * Computes a gas estimate for a V3 swap using heuristics.
 * Considers number of hops in the route, number of ticks crossed
 * and the typical base cost for a swap.
 *
 * We get the number of ticks crossed in a swap from the QuoterV2
 * contract.
 *
 * We compute gas estimates off-chain because
 *  1/ Calling eth_estimateGas for a swaps requires the caller to have
 *     the full balance token being swapped, and approvals.
 *  2/ Tracking gas used using a wrapper contract is not accurate with Multicall
 *     due to EIP-2929. We would have to make a request for every swap we wanted to estimate.
 *  3/ For V2 we simulate all our swaps off-chain so have no way to track gas used.
 *
 * @export
 * @class V3HeuristicGasModelFactory
 */
export class V3HeuristicGasModelFactory extends IOnChainGasModelFactory {
    constructor() {
        super();
    }
    async buildGasModel({ chainId, gasPriceWei, pools, amountToken, quoteToken, l2GasDataProvider, providerConfig, }) {
        const l2GasData = l2GasDataProvider
            ? await l2GasDataProvider.getGasData()
            : undefined;
        const usdPool = pools.usdPool;
        const calculateL1GasFees = async (route) => {
            const swapOptions = {
                type: SwapType.UNIVERSAL_ROUTER,
                recipient: '0x0000000000000000000000000000000000000001',
                deadlineOrPreviousBlockhash: 100,
                slippageTolerance: new Percent(5, 10000),
            };
            let l1Used = BigNumber.from(0);
            let l1FeeInWei = BigNumber.from(0);
            const opStackChains = [
                ChainId.OPTIMISM,
                ChainId.OPTIMISM_GOERLI,
                ChainId.BASE,
                ChainId.BASE_GOERLI,
            ];
            if (opStackChains.includes(chainId)) {
                [l1Used, l1FeeInWei] = this.calculateOptimismToL1SecurityFee(route, swapOptions, l2GasData);
            }
            else if (chainId == ChainId.ARBITRUM_ONE ||
                chainId == ChainId.ARBITRUM_GOERLI) {
                [l1Used, l1FeeInWei] = this.calculateArbitrumToL1SecurityFee(route, swapOptions, l2GasData);
            }
            // wrap fee to native currency
            const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
            const costNativeCurrency = CurrencyAmount.fromRawAmount(nativeCurrency, l1FeeInWei.toString());
            // convert fee into usd
            const nativeTokenPrice = usdPool.token0.address == nativeCurrency.address
                ? usdPool.token0Price
                : usdPool.token1Price;
            const gasCostL1USD = nativeTokenPrice.quote(costNativeCurrency);
            let gasCostL1QuoteToken = costNativeCurrency;
            // if the inputted token is not in the native currency, quote a native/quote token pool to get the gas cost in terms of the quote token
            if (!quoteToken.equals(nativeCurrency)) {
                const nativePool = pools.nativeAndQuoteTokenV3Pool;
                if (!nativePool) {
                    log.info('Could not find a pool to convert the cost into the quote token');
                    gasCostL1QuoteToken = CurrencyAmount.fromRawAmount(quoteToken, 0);
                }
                else {
                    const nativeTokenPrice = nativePool.token0.address == nativeCurrency.address
                        ? nativePool.token0Price
                        : nativePool.token1Price;
                    gasCostL1QuoteToken = nativeTokenPrice.quote(costNativeCurrency);
                }
            }
            // gasUsedL1 is the gas units used calculated from the bytes of the calldata
            // gasCostL1USD and gasCostL1QuoteToken is the cost of gas in each of those tokens
            return {
                gasUsedL1: l1Used,
                gasCostL1USD,
                gasCostL1QuoteToken,
            };
        };
        const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
        let nativeAmountPool = null;
        if (!amountToken.equals(nativeCurrency)) {
            nativeAmountPool = pools.nativeAndAmountTokenV3Pool;
        }
        const usdToken = usdPool.token0.equals(nativeCurrency)
            ? usdPool.token1
            : usdPool.token0;
        const estimateGasCost = (routeWithValidQuote) => {
            var _a;
            const { totalGasCostNativeCurrency, baseGasUse } = this.estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig);
            /** ------ MARK: USD logic  -------- */
            const gasCostInTermsOfUSD = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, usdPool);
            /** ------ MARK: Conditional logic run if gasToken is specified  -------- */
            const nativeAndSpecifiedGasTokenPool = pools.nativeAndSpecifiedGasTokenV3Pool;
            let gasCostInTermsOfGasToken = undefined;
            // we don't want to fetch the gasToken pool if the gasToken is the native currency
            if (nativeAndSpecifiedGasTokenPool) {
                gasCostInTermsOfGasToken = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, nativeAndSpecifiedGasTokenPool);
            }
            // if the gasToken is the native currency, we can just use the totalGasCostNativeCurrency
            else if ((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) === null || _a === void 0 ? void 0 : _a.equals(nativeCurrency)) {
                gasCostInTermsOfGasToken = totalGasCostNativeCurrency;
            }
            /** ------ MARK: return early if quoteToken is wrapped native currency ------- */
            if (quoteToken.equals(nativeCurrency)) {
                return {
                    gasEstimate: baseGasUse,
                    gasCostInToken: totalGasCostNativeCurrency,
                    gasCostInUSD: gasCostInTermsOfUSD,
                    gasCostInGasToken: gasCostInTermsOfGasToken,
                };
            }
            /** ------ MARK: Main gas logic in terms of quote token -------- */
            // Since the quote token is not in the native currency, we convert the gas cost to be in terms of the quote token.
            // We do this by getting the highest liquidity <quoteToken>/<nativeCurrency> pool. eg. <quoteToken>/ETH pool.
            const nativeAndQuoteTokenPool = pools.nativeAndQuoteTokenV3Pool;
            let gasCostInTermsOfQuoteToken = null;
            if (nativeAndQuoteTokenPool) {
                gasCostInTermsOfQuoteToken = getQuoteThroughNativePool(chainId, totalGasCostNativeCurrency, nativeAndQuoteTokenPool);
            }
            // We may have a nativeAmountPool, but not a nativePool
            else {
                log.info(`Unable to find ${nativeCurrency.symbol} pool with the quote token, ${quoteToken.symbol} to produce gas adjusted costs. Using amountToken to calculate gas costs.`);
            }
            /** ------ MARK: (V3 ONLY) Logic for calculating synthetic gas cost in terms of amount token -------- */
            // TODO: evaluate effectiveness and potentially refactor
            // Highest liquidity pool for the non quote token / ETH
            // A pool with the non quote token / ETH should not be required and errors should be handled separately
            if (nativeAmountPool) {
                // get current execution price (amountToken / quoteToken)
                const executionPrice = new Price(routeWithValidQuote.amount.currency, routeWithValidQuote.quote.currency, routeWithValidQuote.amount.quotient, routeWithValidQuote.quote.quotient);
                const inputIsToken0 = nativeAmountPool.token0.address == nativeCurrency.address;
                // ratio of input / native
                const nativeAndAmountTokenPrice = inputIsToken0
                    ? nativeAmountPool.token0Price
                    : nativeAmountPool.token1Price;
                const gasCostInTermsOfAmountToken = nativeAndAmountTokenPrice.quote(totalGasCostNativeCurrency);
                // Convert gasCostInTermsOfAmountToken to quote token using execution price
                const syntheticGasCostInTermsOfQuoteToken = executionPrice.quote(gasCostInTermsOfAmountToken);
                // Note that the syntheticGasCost being lessThan the original quoted value is not always strictly better
                // e.g. the scenario where the amountToken/ETH pool is very illiquid as well and returns an extremely small number
                // however, it is better to have the gasEstimation be almost 0 than almost infinity, as the user will still receive a quote
                if (gasCostInTermsOfQuoteToken === null ||
                    syntheticGasCostInTermsOfQuoteToken.lessThan(gasCostInTermsOfQuoteToken.asFraction)) {
                    log.info({
                        nativeAndAmountTokenPrice: nativeAndAmountTokenPrice.toSignificant(6),
                        gasCostInTermsOfQuoteToken: gasCostInTermsOfQuoteToken
                            ? gasCostInTermsOfQuoteToken.toExact()
                            : 0,
                        gasCostInTermsOfAmountToken: gasCostInTermsOfAmountToken.toExact(),
                        executionPrice: executionPrice.toSignificant(6),
                        syntheticGasCostInTermsOfQuoteToken: syntheticGasCostInTermsOfQuoteToken.toSignificant(6),
                    }, 'New gasCostInTermsOfQuoteToken calculated with synthetic quote token price is less than original');
                    gasCostInTermsOfQuoteToken = syntheticGasCostInTermsOfQuoteToken;
                }
            }
            // If gasCostInTermsOfQuoteToken is null, both attempts to calculate gasCostInTermsOfQuoteToken failed (nativePool and amountNativePool)
            if (gasCostInTermsOfQuoteToken === null) {
                log.info(`Unable to find ${nativeCurrency.symbol} pool with the quote token, ${quoteToken.symbol}, or amount Token, ${amountToken.symbol} to produce gas adjusted costs. Route will not account for gas.`);
                return {
                    gasEstimate: baseGasUse,
                    gasCostInToken: CurrencyAmount.fromRawAmount(quoteToken, 0),
                    gasCostInUSD: CurrencyAmount.fromRawAmount(usdToken, 0),
                };
            }
            return {
                gasEstimate: baseGasUse,
                gasCostInToken: gasCostInTermsOfQuoteToken,
                gasCostInUSD: gasCostInTermsOfUSD,
                gasCostInGasToken: gasCostInTermsOfGasToken,
            };
        };
        return {
            estimateGasCost: estimateGasCost.bind(this),
            calculateL1GasFees,
        };
    }
    estimateGas(routeWithValidQuote, gasPriceWei, chainId, providerConfig) {
        var _a;
        const totalInitializedTicksCrossed = BigNumber.from(Math.max(1, _.sum(routeWithValidQuote.initializedTicksCrossedList)));
        const totalHops = BigNumber.from(routeWithValidQuote.route.pools.length);
        let hopsGasUse = COST_PER_HOP(chainId).mul(totalHops);
        // We have observed that this algorithm tends to underestimate single hop swaps.
        // We add a buffer in the case of a single hop swap.
        if (totalHops.eq(1)) {
            hopsGasUse = hopsGasUse.add(SINGLE_HOP_OVERHEAD(chainId));
        }
        // Some tokens have extremely expensive transferFrom functions, which causes
        // us to underestimate them by a large amount. For known tokens, we apply an
        // adjustment.
        const tokenOverhead = TOKEN_OVERHEAD(chainId, routeWithValidQuote.route);
        const tickGasUse = COST_PER_INIT_TICK(chainId).mul(totalInitializedTicksCrossed);
        const uninitializedTickGasUse = COST_PER_UNINIT_TICK.mul(0);
        // base estimate gas used based on chainId estimates for hops and ticks gas useage
        const baseGasUse = BASE_SWAP_COST(chainId)
            .add(hopsGasUse)
            .add(tokenOverhead)
            .add(tickGasUse)
            .add(uninitializedTickGasUse)
            .add((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.additionalGasOverhead) !== null && _a !== void 0 ? _a : BigNumber.from(0));
        const baseGasCostWei = gasPriceWei.mul(baseGasUse);
        const wrappedCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
        const totalGasCostNativeCurrency = CurrencyAmount.fromRawAmount(wrappedCurrency, baseGasCostWei.toString());
        return {
            totalGasCostNativeCurrency,
            totalInitializedTicksCrossed,
            baseGasUse,
        };
    }
    /**
     * To avoid having a call to optimism's L1 security fee contract for every route and amount combination,
     * we replicate the gas cost accounting here.
     */
    calculateOptimismToL1SecurityFee(routes, swapConfig, gasData) {
        const { l1BaseFee, scalar, decimals, overhead } = gasData;
        const route = routes[0];
        const amountToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.amount.currency
            : route.quote.currency;
        const outputToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.quote.currency
            : route.amount.currency;
        // build trade for swap calldata
        const trade = buildTrade(amountToken, outputToken, route.tradeType, routes);
        const data = buildSwapMethodParameters(trade, swapConfig, ChainId.OPTIMISM).calldata;
        const l1GasUsed = getL2ToL1GasUsed(data, overhead);
        // l1BaseFee is L1 Gas Price on etherscan
        const l1Fee = l1GasUsed.mul(l1BaseFee);
        const unscaled = l1Fee.mul(scalar);
        // scaled = unscaled / (10 ** decimals)
        const scaledConversion = BigNumber.from(10).pow(decimals);
        const scaled = unscaled.div(scaledConversion);
        return [l1GasUsed, scaled];
    }
    calculateArbitrumToL1SecurityFee(routes, swapConfig, gasData) {
        const route = routes[0];
        const amountToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.amount.currency
            : route.quote.currency;
        const outputToken = route.tradeType == TradeType.EXACT_INPUT
            ? route.quote.currency
            : route.amount.currency;
        // build trade for swap calldata
        const trade = buildTrade(amountToken, outputToken, route.tradeType, routes);
        const data = buildSwapMethodParameters(trade, swapConfig, ChainId.ARBITRUM_ONE).calldata;
        return calculateArbitrumToL1FeeFromCalldata(data, gasData);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjMtaGV1cmlzdGljLWdhcy1tb2RlbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3YzL3YzLWhldXJpc3RpYy1nYXMtbW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUV2RSxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFFdkIsT0FBTyxFQUVMLFFBQVEsRUFDUix1QkFBdUIsR0FDeEIsTUFBTSxhQUFhLENBQUM7QUFLckIsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFELE9BQU8sRUFDTCxvQ0FBb0MsRUFDcEMsZ0JBQWdCLEVBQ2pCLE1BQU0sc0NBQXNDLENBQUM7QUFDOUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzNDLE9BQU8sRUFDTCx5QkFBeUIsRUFDekIsVUFBVSxHQUNYLE1BQU0sbUNBQW1DLENBQUM7QUFFM0MsT0FBTyxFQUdMLHlCQUF5QixFQUV6Qix1QkFBdUIsR0FDeEIsTUFBTSxjQUFjLENBQUM7QUFFdEIsT0FBTyxFQUNMLGNBQWMsRUFDZCxZQUFZLEVBQ1osa0JBQWtCLEVBQ2xCLG9CQUFvQixFQUNwQixtQkFBbUIsRUFDbkIsY0FBYyxHQUNmLE1BQU0sYUFBYSxDQUFDO0FBRXJCOzs7Ozs7Ozs7Ozs7Ozs7OztHQWlCRztBQUNILE1BQU0sT0FBTywwQkFBMkIsU0FBUSx1QkFBdUI7SUFDckU7UUFDRSxLQUFLLEVBQUUsQ0FBQztJQUNWLENBQUM7SUFFTSxLQUFLLENBQUMsYUFBYSxDQUFDLEVBQ3pCLE9BQU8sRUFDUCxXQUFXLEVBQ1gsS0FBSyxFQUNM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