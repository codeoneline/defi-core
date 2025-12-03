// AAVE 多链 APY 和 TVL 数据获取工具
// 安装依赖: npm install ethers @bgd-labs/aave-address-book @aave/contract-helpers

const { ethers } = require('ethers');
const { UiPoolDataProvider, ChainId } = require('@aave/contract-helpers');
const markets = require('@bgd-labs/aave-address-book');
const { formatReserves } = require('@aave/math-utils');

// 配置支持的链和RPC端点
const CHAINS_CONFIG = {
  ethereum: {
    chainId: ChainId.mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
    market: markets.AaveV3Ethereum,
    name: 'Ethereum'
  },
  polygon: {
    chainId: ChainId.polygon,
    rpcUrl: 'https://polygon.llamarpc.com',
    market: markets.AaveV3Polygon,
    name: 'Polygon'
  },
  avalanche: {
    chainId: ChainId.avalanche,
    rpcUrl: 'https://avalanche.public-rpc.com',
    market: markets.AaveV3Avalanche,
    name: 'Avalanche'
  },
  arbitrum: {
    chainId: ChainId.arbitrum_one,
    rpcUrl: 'https://arbitrum.llamarpc.com',
    market: markets.AaveV3Arbitrum,
    name: 'Arbitrum'
  },
  optimism: {
    chainId: ChainId.optimism,
    rpcUrl: 'https://optimism.llamarpc.com',
    market: markets.AaveV3Optimism,
    name: 'Optimism'
  },
  base: {
    chainId: ChainId.base,
    rpcUrl: 'https://base.llamarpc.com',
    market: markets.AaveV3Base,
    name: 'Base'
  },
  gnosis: {
    chainId: ChainId.gnosis,
    rpcUrl: 'https://rpc.gnosischain.com',
    market: markets.AaveV3Gnosis,
    name: 'Gnosis'
  },
  bnb: {
    chainId: ChainId.bnb,
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    market: markets.AaveV3BNB,
    name: 'BNB Chain'
  },
  scroll: {
    chainId: ChainId.scroll,
    rpcUrl: 'https://rpc.scroll.io',
    market: markets.AaveV3Scroll,
    name: 'Scroll'
  }
};

// 目标资产的常见地址映射（不同链可能不同）'WAN'
const ASSET_SYMBOLS = ['USDC', 'USDT', 'WBTC', 'WETH'];

/**
 * 从单个链获取储备数据
 */
async function fetchChainReserves(chainKey, chainConfig) {
  try {
    console.log(`\n正在获取 ${chainConfig.name} 的数据...`);
    
    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);
    
    // 创建 UiPoolDataProvider 实例
    const poolDataProviderContract = new UiPoolDataProvider({
      uiPoolDataProviderAddress: chainConfig.market.UI_POOL_DATA_PROVIDER,
      provider,
      chainId: chainConfig.chainId,
    });

    // 获取储备数据
    const reserves = await poolDataProviderContract.getReservesHumanized({
      lendingPoolAddressProvider: chainConfig.market.POOL_ADDRESSES_PROVIDER,
    });

    // 获取基础货币数据用于价格转换
    const reservesArray = reserves.reservesData;
    const baseCurrencyData = reserves.baseCurrencyData;

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // 使用 formatReserves 格式化数据
    const formattedReserves = formatReserves({
      reserves: reservesArray,
      currentTimestamp,
      marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
      marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    });

    return {
      chain: chainConfig.name,
      reserves: formattedReserves,
      success: true
    };

  } catch (error) {
    console.error(`获取 ${chainConfig.name} 数据失败:`, error.message);
    return {
      chain: chainConfig.name,
      reserves: [],
      success: false,
      error: error.message
    };
  }
}

/**
 * 过滤和格式化目标资产数据
 */
function filterTargetAssets(chainData) {
  const results = [];

  for (const chainResult of chainData) {
    if (!chainResult.success) {
      continue;
    }

    const chainAssets = [];

    for (const reserve of chainResult.reserves) {
      // 检查是否是目标资产
      const symbol = reserve.symbol.toUpperCase();
      const isTargetAsset = ASSET_SYMBOLS.some(target => 
        symbol === target || 
        symbol.includes(target) ||
        (target === 'ETH' && symbol === 'WETH')
      );

      if (isTargetAsset) {
        chainAssets.push({
          symbol: reserve.symbol,
          name: reserve.name,
          address: reserve.underlyingAsset,
          // APY 数据
          supplyAPY: (parseFloat(reserve.supplyAPY) * 100).toFixed(2) + '%',
          variableBorrowAPY: (parseFloat(reserve.variableBorrowAPY) * 100).toFixed(2) + '%',
          stableBorrowAPY: reserve.stableBorrowAPYAvailable ? 
            (parseFloat(reserve.stableBorrowAPY) * 100).toFixed(2) + '%' : 'N/A',
          // TVL 数据
          totalLiquidity: reserve.totalLiquidity,
          totalLiquidityUSD: parseFloat(reserve.totalLiquidityUSD).toFixed(2),
          availableLiquidity: reserve.availableLiquidity,
          availableLiquidityUSD: parseFloat(reserve.availableLiquidityUSD).toFixed(2),
          totalDebt: reserve.totalDebt,
          totalDebtUSD: parseFloat(reserve.totalDebtUSD).toFixed(2),
          // 其他有用信息
          utilizationRate: (parseFloat(reserve.utilizationRate) * 100).toFixed(2) + '%',
          ltv: reserve.baseLTVasCollateral,
          liquidationThreshold: reserve.reserveLiquidationThreshold,
          liquidationBonus: reserve.reserveLiquidationBonus,
          priceInUSD: parseFloat(reserve.priceInUSD).toFixed(2),
        });
      }
    }

    if (chainAssets.length > 0) {
      results.push({
        chain: chainResult.chain,
        assets: chainAssets
      });
    }
  }

  return results;
}

/**
 * 主函数：获取所有链上的数据
 */
async function fetchAllChainsData() {
  console.log('开始获取 AAVE V3 在所有支持链上的数据...\n');
  console.log('目标资产:', ASSET_SYMBOLS.join(', '));
  console.log('支持的链:', Object.values(CHAINS_CONFIG).map(c => c.name).join(', '));

  // 并发获取所有链的数据
  const promises = Object.entries(CHAINS_CONFIG).map(([key, config]) =>
    fetchChainReserves(key, config)
  );

  const allChainData = await Promise.all(promises);

  // 过滤目标资产
  const filteredData = filterTargetAssets(allChainData);

  return filteredData;
}

/**
 * 打印结果
 */
function printResults(data) {
  console.log('\n' + '='.repeat(80));
  console.log('AAVE V3 多链数据汇总');
  console.log('='.repeat(80));

  for (const chainData of data) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`链: ${chainData.chain}`);
    console.log(`${'─'.repeat(80)}`);

    for (const asset of chainData.assets) {
      console.log(`\n  资产: ${asset.symbol} (${asset.name})`);
      console.log(`  合约地址: ${asset.address}`);
      console.log(`  
  APY 数据:`);
      console.log(`    存款 APY: ${asset.supplyAPY}`);
      console.log(`    浮动借款 APY: ${asset.variableBorrowAPY}`);
      console.log(`    稳定借款 APY: ${asset.stableBorrowAPY}`);
      console.log(`  
  TVL 数据:`);
      console.log(`    总流动性: ${asset.totalLiquidity} ($${asset.totalLiquidityUSD})`);
      console.log(`    可用流动性: ${asset.availableLiquidity} ($${asset.availableLiquidityUSD})`);
      console.log(`    总债务: ${asset.totalDebt} ($${asset.totalDebtUSD})`);
      console.log(`  
  其他信息:`);
      console.log(`    使用率: ${asset.utilizationRate}`);
      console.log(`    价格: $${asset.priceInUSD}`);
      console.log(`    LTV: ${asset.ltv}%`);
      console.log(`    清算阈值: ${asset.liquidationThreshold}%`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * 导出为 JSON
 */
function exportToJSON(data, filename = 'aave_data.json') {
  const fs = require('fs');
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`\n数据已导出到 ${filename}`);
}

/**
 * 获取特定链和特定资产的数据
 */
async function getSpecificAssetData(chainKey, assetSymbol) {
  const chainConfig = CHAINS_CONFIG[chainKey];
  if (!chainConfig) {
    throw new Error(`不支持的链: ${chainKey}`);
  }

  const chainData = await fetchChainReserves(chainKey, chainConfig);
  
  if (!chainData.success) {
    throw new Error(`获取 ${chainConfig.name} 数据失败: ${chainData.error}`);
  }

  const asset = chainData.reserves.find(r => 
    r.symbol.toUpperCase() === assetSymbol.toUpperCase() ||
    r.symbol.toUpperCase().includes(assetSymbol.toUpperCase())
  );

  if (!asset) {
    throw new Error(`在 ${chainConfig.name} 上未找到资产 ${assetSymbol}`);
  }

  return {
    chain: chainConfig.name,
    symbol: asset.symbol,
    supplyAPY: (parseFloat(asset.supplyAPY) * 100).toFixed(2) + '%',
    borrowAPY: (parseFloat(asset.variableBorrowAPY) * 100).toFixed(2) + '%',
    tvl: parseFloat(asset.totalLiquidityUSD).toFixed(2),
    address: asset.underlyingAsset
  };
}

// 导出主要函数
module.exports = {
  fetchAllChainsData,
  getSpecificAssetData,
  printResults,
  exportToJSON,
  CHAINS_CONFIG,
  ASSET_SYMBOLS
};

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    try {
      const data = await fetchAllChainsData();
      printResults(data);
      exportToJSON(data);
    } catch (error) {
      console.error('执行失败:', error);
      process.exit(1);
    }
  })();
}