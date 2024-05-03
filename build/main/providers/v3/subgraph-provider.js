"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.V3SubgraphProvider = exports.printV2SubgraphPool = exports.printV3SubgraphPool = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const async_retry_1 = __importDefault(require("async-retry"));
const await_timeout_1 = __importDefault(require("await-timeout"));
const graphql_request_1 = require("graphql-request");
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../../util");
const printV3SubgraphPool = (s) => `${s.token0.id}/${s.token1.id}/${s.feeTier}`;
exports.printV3SubgraphPool = printV3SubgraphPool;
const printV2SubgraphPool = (s) => `${s.token0.id}/${s.token1.id}`;
exports.printV2SubgraphPool = printV2SubgraphPool;
const SUBGRAPH_URL_BY_CHAIN = {
    [sdk_core_1.ChainId.MAINNET]: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    [sdk_core_1.ChainId.OPTIMISM]: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
    [sdk_core_1.ChainId.ARBITRUM_ONE]: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
    [sdk_core_1.ChainId.POLYGON]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
    [sdk_core_1.ChainId.CELO]: 'https://api.thegraph.com/subgraphs/name/jesse-sawa/uniswap-celo',
    [sdk_core_1.ChainId.GOERLI]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-gorli',
    [sdk_core_1.ChainId.BNB]: 'https://api.thegraph.com/subgraphs/name/ilyamk/uniswap-v3---bnb-chain',
    [sdk_core_1.ChainId.AVALANCHE]: 'https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-avax',
    [sdk_core_1.ChainId.BASE]: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest',
    [sdk_core_1.ChainId.ZKATANA]: 'http://34.143.199.195:8000/subgraphs/name/gradient/uniswap-v3-test12',
    [sdk_core_1.ChainId.SEIDEV]: 'https://api.dev.miro.finance/subgraph-seidev/graphql',
};
const PAGE_SIZE = 1000; // 1k is max possible query size from subgraph.
class V3SubgraphProvider {
    constructor(chainId, retries = 2, timeout = 30000, rollback = true) {
        this.chainId = chainId;
        this.retries = retries;
        this.timeout = timeout;
        this.rollback = rollback;
        const subgraphUrl = SUBGRAPH_URL_BY_CHAIN[this.chainId];
        if (!subgraphUrl) {
            throw new Error(`No subgraph url for chain id: ${this.chainId}`);
        }
        this.client = new graphql_request_1.GraphQLClient(subgraphUrl);
    }
    async getPools(_tokenIn, _tokenOut, providerConfig) {
        let blockNumber = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? await providerConfig.blockNumber
            : undefined;
        const query = (0, graphql_request_1.gql) `
      query getPools($pageSize: Int!, $id: String) {
        pools(
          first: $pageSize
          ${blockNumber ? `block: { number: ${blockNumber} }` : ``}
          where: { id_gt: $id }
          subgraphError: allow
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          feeTier
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
        }
      }
    `;
        let pools = [];
        util_1.log.info(`Getting V3 pools from the subgraph with page size ${PAGE_SIZE}${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? ` as of block ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}`
            : ''}.`);
        await (0, async_retry_1.default)(async () => {
            const timeout = new await_timeout_1.default();
            const getPools = async () => {
                let lastId = '';
                let pools = [];
                let poolsPage = [];
                do {
                    const poolsResult = await this.client.request(query, {
                        pageSize: PAGE_SIZE,
                        id: lastId,
                    });
                    poolsPage = poolsResult.pools;
                    pools = pools.concat(poolsPage);
                    lastId = pools[pools.length - 1].id;
                } while (poolsPage.length > 0);
                return pools;
            };
            /* eslint-disable no-useless-catch */
            try {
                const getPoolsPromise = getPools();
                const timerPromise = timeout.set(this.timeout).then(() => {
                    throw new Error(`Timed out getting pools from subgraph: ${this.timeout}`);
                });
                pools = await Promise.race([getPoolsPromise, timerPromise]);
                return;
            }
            catch (err) {
                throw err;
            }
            finally {
                timeout.clear();
            }
            /* eslint-enable no-useless-catch */
        }, {
            retries: this.retries,
            onRetry: (err, retry) => {
                if (this.rollback &&
                    blockNumber &&
                    lodash_1.default.includes(err.message, 'indexed up to')) {
                    blockNumber = blockNumber - 10;
                    util_1.log.info(`Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`);
                }
                pools = [];
                util_1.log.info({ err }, `Failed to get pools from subgraph. Retry attempt: ${retry}`);
            },
        });
        const poolsSanitized = pools
            .filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > 0.01)
            .map((pool) => {
            const { totalValueLockedETH, totalValueLockedUSD } = pool, rest = __rest(pool, ["totalValueLockedETH", "totalValueLockedUSD"]);
            return Object.assign(Object.assign({}, rest), { id: pool.id.toLowerCase(), token0: {
                    id: pool.token0.id.toLowerCase(),
                }, token1: {
                    id: pool.token1.id.toLowerCase(),
                }, tvlETH: parseFloat(totalValueLockedETH), tvlUSD: parseFloat(totalValueLockedUSD) });
        });
        util_1.log.info(`Got ${pools.length} V3 pools from the subgraph. ${poolsSanitized.length} after filtering`);
        return poolsSanitized;
    }
}
exports.V3SubgraphProvider = V3SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQW1EO0FBQ25ELDhEQUFnQztBQUNoQyxrRUFBb0M7QUFDcEMscURBQXFEO0FBQ3JELG9EQUF1QjtBQUV2QixxQ0FBaUM7QUFrQzFCLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUFpQixFQUFFLEVBQUUsQ0FDdkQsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7QUFEbEMsUUFBQSxtQkFBbUIsdUJBQ2U7QUFFeEMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQWlCLEVBQUUsRUFBRSxDQUN2RCxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUM7QUFEckIsUUFBQSxtQkFBbUIsdUJBQ0U7QUFFbEMsTUFBTSxxQkFBcUIsR0FBc0M7SUFDL0QsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUNmLDREQUE0RDtJQUM5RCxDQUFDLGtCQUFPLENBQUMsUUFBUSxDQUFDLEVBQ2hCLDJFQUEyRTtJQUM3RSxDQUFDLGtCQUFPLENBQUMsWUFBWSxDQUFDLEVBQ3BCLG9FQUFvRTtJQUN0RSxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQ2Ysc0VBQXNFO0lBQ3hFLENBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsRUFDWixpRUFBaUU7SUFDbkUsQ0FBQyxrQkFBTyxDQUFDLE1BQU0sQ0FBQyxFQUNkLG9FQUFvRTtJQUN0RSxDQUFDLGtCQUFPLENBQUMsR0FBRyxDQUFDLEVBQ1gsdUVBQXVFO0lBQ3pFLENBQUMsa0JBQU8sQ0FBQyxTQUFTLENBQUMsRUFDakIsb0VBQW9FO0lBQ3RFLENBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsRUFDWiw0RUFBNEU7SUFDOUUsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUNmLHNFQUFzRTtJQUN4RSxDQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDLEVBQ2Qsc0RBQXNEO0NBQ3pELENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsQ0FBQywrQ0FBK0M7QUFnQnZFLE1BQWEsa0JBQWtCO0lBRzdCLFlBQ1UsT0FBZ0IsRUFDaEIsVUFBVSxDQUFDLEVBQ1gsVUFBVSxLQUFLLEVBQ2YsV0FBVyxJQUFJO1FBSGYsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQixZQUFPLEdBQVAsT0FBTyxDQUFJO1FBQ1gsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUNmLGFBQVEsR0FBUixRQUFRLENBQU87UUFFdkIsTUFBTSxXQUFXLEdBQUcscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbEU7UUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksK0JBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FDbkIsUUFBZ0IsRUFDaEIsU0FBaUIsRUFDakIsY0FBK0I7UUFFL0IsSUFBSSxXQUFXLEdBQUcsQ0FBQSxjQUFjLGFBQWQsY0FBYyx1QkFBZCxjQUFjLENBQUUsV0FBVztZQUMzQyxDQUFDLENBQUMsTUFBTSxjQUFjLENBQUMsV0FBVztZQUNsQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRWQsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBRyxFQUFBOzs7O1lBSVQsV0FBVyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FtQjdELENBQUM7UUFFRixJQUFJLEtBQUssR0FBd0IsRUFBRSxDQUFDO1FBRXBDLFVBQUcsQ0FBQyxJQUFJLENBQ04scURBQXFELFNBQVMsR0FBRyxDQUFBLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxXQUFXO1lBQzFGLENBQUMsQ0FBQyxnQkFBZ0IsY0FBYyxhQUFkLGNBQWMsdUJBQWQsY0FBYyxDQUFFLFdBQVcsRUFBRTtZQUMvQyxDQUFDLENBQUMsRUFDSixHQUFHLENBQ0osQ0FBQztRQUVGLE1BQU0sSUFBQSxxQkFBSyxFQUNULEtBQUssSUFBSSxFQUFFO1lBQ1QsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBTyxFQUFFLENBQUM7WUFFOUIsTUFBTSxRQUFRLEdBQUcsS0FBSyxJQUFrQyxFQUFFO2dCQUN4RCxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7Z0JBQ2hCLElBQUksS0FBSyxHQUF3QixFQUFFLENBQUM7Z0JBQ3BDLElBQUksU0FBUyxHQUF3QixFQUFFLENBQUM7Z0JBRXhDLEdBQUc7b0JBQ0QsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FFMUMsS0FBSyxFQUFFO3dCQUNSLFFBQVEsRUFBRSxTQUFTO3dCQUNuQixFQUFFLEVBQUUsTUFBTTtxQkFDWCxDQUFDLENBQUM7b0JBRUgsU0FBUyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7b0JBRTlCLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUVoQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFFLENBQUMsRUFBRSxDQUFDO2lCQUN0QyxRQUFRLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUUvQixPQUFPLEtBQUssQ0FBQztZQUNmLENBQUMsQ0FBQztZQUVGLHFDQUFxQztZQUNyQyxJQUFJO2dCQUNGLE1BQU0sZUFBZSxHQUFHLFFBQVEsRUFBRSxDQUFDO2dCQUNuQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO29CQUN2RCxNQUFNLElBQUksS0FBSyxDQUNiLDBDQUEwQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQ3pELENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUM1RCxPQUFPO2FBQ1I7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixNQUFNLEdBQUcsQ0FBQzthQUNYO29CQUFTO2dCQUNSLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQzthQUNqQjtZQUNELG9DQUFvQztRQUN0QyxDQUFDLEVBQ0Q7WUFDRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUN0QixJQUNFLElBQUksQ0FBQyxRQUFRO29CQUNiLFdBQVc7b0JBQ1gsZ0JBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsRUFDeEM7b0JBQ0EsV0FBVyxHQUFHLFdBQVcsR0FBRyxFQUFFLENBQUM7b0JBQy9CLFVBQUcsQ0FBQyxJQUFJLENBQ04sa0VBQWtFLFdBQVcsRUFBRSxDQUNoRixDQUFDO2lCQUNIO2dCQUNELEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ1gsVUFBRyxDQUFDLElBQUksQ0FDTixFQUFFLEdBQUcsRUFBRSxFQUNQLHFEQUFxRCxLQUFLLEVBQUUsQ0FDN0QsQ0FBQztZQUNKLENBQUM7U0FDRixDQUNGLENBQUM7UUFFRixNQUFNLGNBQWMsR0FBRyxLQUFLO2FBQ3pCLE1BQU0sQ0FDTCxDQUFDLElBQUksRUFBRSxFQUFFLENBQ1AsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO1lBQzVCLFVBQVUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQzlDO2FBQ0EsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDWixNQUFNLEVBQUUsbUJBQW1CLEVBQUUsbUJBQW1CLEtBQWMsSUFBSSxFQUFiLElBQUksVUFBSyxJQUFJLEVBQTVELDhDQUFxRCxDQUFPLENBQUM7WUFFbkUsdUNBQ0ssSUFBSSxLQUNQLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUN6QixNQUFNLEVBQUU7b0JBQ04sRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRTtpQkFDakMsRUFDRCxNQUFNLEVBQUU7b0JBQ04sRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRTtpQkFDakMsRUFDRCxNQUFNLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLEVBQ3ZDLE1BQU0sRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFDdkM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVMLFVBQUcsQ0FBQyxJQUFJLENBQ04sT0FBTyxLQUFLLENBQUMsTUFBTSxnQ0FBZ0MsY0FBYyxDQUFDLE1BQU0sa0JBQWtCLENBQzNGLENBQUM7UUFFRixPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDO0NBQ0Y7QUExSkQsZ0RBMEpDIn0=