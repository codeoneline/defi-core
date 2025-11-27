const { ethers } = require('ethers-v6');
// const { UiPoolDataProvider, ChainId } = require('@aave/contract-helpers');
const markets = require('@bgd-labs/aave-address-book');

// Aave V3 合约地址（以太坊主网）
const ADDRESSES = {
  ethereum: {
    PoolDataProvider: markets.AaveV3Ethereum.AAVE_PROTOCOL_DATA_PROVIDER,
    Pool: markets.AaveV3Ethereum.POOL,
    UiPoolDataProvider: markets.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
    PoolAddressesProvider: markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
    RewardsController: markets.AaveV3Ethereum.DEFAULT_INCENTIVES_CONTROLLER,

    // PoolDataProvider: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
    // Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    // UiPoolDataProvider: '0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d',
    // PoolAddressesProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',

  },
  // 可以添加其他网络的地址
  polygon: {
    PoolDataProvider: markets.AaveV3Polygon.AAVE_PROTOCOL_DATA_PROVIDER,
    Pool: markets.AaveV3Polygon.POOL,
  }
};

// WETH 地址（Aave 使用 WETH 而不是 ETH）
const TOKEN_ADDRESSES = {
  ethereum: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  }
};

// ABI 定义
const POOL_DATA_PROVIDER_ABI = [
  'function getReserveData(address asset) external view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
  'function getAllReservesTokens() external view returns (tuple(string symbol, address tokenAddress)[])',
  'function getReserveConfigurationData(address asset) external view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)'
];

const UI_POOL_DATA_PROVIDER_ABI = [
  'function getReservesData(address addressesProvider) external view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 liquidityRate, uint128 variableBorrowRate, uint128 stableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalPrincipalStableDebt, uint256 averageStableRate, uint256 stableDebtLastUpdateTimestamp, uint256 totalScaledVariableDebt, uint256 priceInMarketReferenceCurrency, address priceOracle, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 stableRateSlope1, uint256 stableRateSlope2, uint256 baseStableBorrowRate, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, bool isPaused, bool isSiloedBorrowing, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, uint16 eModeLtv, uint16 eModeLiquidationThreshold, uint16 eModeLiquidationBonus, address eModePriceSource, string eModeLabel, bool borrowableInIsolation)[])'
];

// 添加 RewardsController ABI
const REWARDS_CONTROLLER_ABI = [
  'function getRewardsData(address asset, address reward) external view returns (uint256, uint256, uint256, uint256)',
  'function getAllUserRewards(address[] calldata assets, address user) external view returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts)',
  'function getRewardsByAsset(address asset) external view returns (address[] memory)',
  'function getAssetIndex(address asset, address reward) external view returns (uint256, uint256)'
];

/**
 * 初始化 Provider 和 Contracts
 */
const eth_rpc = 'https://eth-sepolia.api.onfinality.io/public'
function initializeProvider(rpcUrl = eth_rpc) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return provider;
}

/**
 * 获取奖励APY
 */
async function getRewardAPY(provider, network, aTokenAddress) {
  const rewardsController = new ethers.Contract(
    ADDRESSES[network].RewardsController,
    REWARDS_CONTROLLER_ABI,
    provider
  );

  try {
    // 获取该资产的奖励代币列表
    const rewardTokens = await rewardsController.getRewardsByAsset(aTokenAddress);
    
    if (rewardTokens.length === 0) {
      return 0; // 没有奖励
    }

    // 这里需要获取每个奖励代币的价格和分发速率来计算APY
    // 实际实现需要调用价格预言机和计算奖励分发率
    
    return 0; // 简化处理
  } catch (error) {
    console.error('获取奖励数据失败:', error.message);
    return 0;
  }
}


/**
 * 将 RAY 单位转换为百分比
 * RAY = 10^27
 */
function rayToPercentage(ray) {
  const RAY = ethers.parseUnits('1', 27);
  return (Number(ray) / Number(RAY)) * 100;
}

/**
 * 将 APR 转换为 APY（按秒复利）
 */
function aprToApy(apr) {
  const SECONDS_PER_YEAR = 31536000;
  // APY = (1 + APR/SECONDS_PER_YEAR)^SECONDS_PER_YEAR - 1
  const apy = Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
  return apy * 100;
}

/**
 * 获取储备资产的详细数据
 */
async function getReserveData(provider, network, assetAddress) {
  const poolDataProvider = new ethers.Contract(
    ADDRESSES[network].PoolDataProvider,
    POOL_DATA_PROVIDER_ABI,
    provider
  );

  try {
    const reserveData = await poolDataProvider.getReserveData(assetAddress);
    
    // 解构返回值
    const [
      unbacked,
      accruedToTreasuryScaled,
      totalAToken,
      totalStableDebt,
      totalVariableDebt,
      liquidityRate,
      variableBorrowRate,
      stableBorrowRate,
      averageStableBorrowRate,
      liquidityIndex,
      variableBorrowIndex,
      lastUpdateTimestamp
    ] = reserveData;

    // 计算 TVL（总锁仓价值 = aToken 总供应量）
    const tvlInWei = totalAToken;
    const tvlInEth = ethers.formatEther(tvlInWei);

    // 计算 APY
    const depositAPR = rayToPercentage(liquidityRate);
    const depositAPY = aprToApy(depositAPR / 100);
    
    const variableBorrowAPR = rayToPercentage(variableBorrowRate);
    const variableBorrowAPY = aprToApy(variableBorrowAPR / 100);

    const stableBorrowAPR = rayToPercentage(stableBorrowRate);
    const stableBorrowAPY = aprToApy(stableBorrowAPR / 100);

    return {
      tvl: {
        wei: tvlInWei.toString(),
        formatted: tvlInEth,
      },
      totalBorrowed: {
        stable: ethers.formatEther(totalStableDebt),
        variable: ethers.formatEther(totalVariableDebt),
      },
      deposit: {
        apr: depositAPR.toFixed(4),
        apy: depositAPY.toFixed(4),
      },
      borrow: {
        variable: {
          apr: variableBorrowAPR.toFixed(4),
          apy: variableBorrowAPY.toFixed(4),
        },
        stable: {
          apr: stableBorrowAPR.toFixed(4),
          apy: stableBorrowAPY.toFixed(4),
        }
      },
      lastUpdate: new Date(Number(lastUpdateTimestamp) * 1000).toISOString(),
    };
  } catch (error) {
    console.error('获取储备数据失败:', error.message);
    throw error;
  }
}

/**
 * 获取所有储备资产列表
 */
async function getAllReserves(provider, network) {
  const poolDataProvider = new ethers.Contract(
    ADDRESSES[network].PoolDataProvider,
    POOL_DATA_PROVIDER_ABI,
    provider
  );

  try {
    const reserves = await poolDataProvider.getAllReservesTokens();
    return reserves.map(r => ({
      symbol: r.symbol,
      address: r.tokenAddress
    }));
  } catch (error) {
    console.error('获取储备列表失败:', error.message);
    throw error;
  }
}

/**
 * 使用 UiPoolDataProvider 一次性获取所有数据（更高效）
 */
async function getAllReservesDataOptimized(provider, network) {
  const uiPoolDataProvider = new ethers.Contract(
    ADDRESSES[network].UiPoolDataProvider,
    UI_POOL_DATA_PROVIDER_ABI,
    provider
  );

  try {
    const reservesData = await uiPoolDataProvider.getReservesData(
      ADDRESSES[network].PoolAddressesProvider
    );

    return reservesData.map(reserve => {
      const depositAPR = rayToPercentage(reserve.liquidityRate);
      const depositAPY = aprToApy(depositAPR / 100);
      
      const variableBorrowAPR = rayToPercentage(reserve.variableBorrowRate);
      const variableBorrowAPY = aprToApy(variableBorrowAPR / 100);

      const tvl = ethers.formatUnits(reserve.availableLiquidity, reserve.decimals);

      return {
        symbol: reserve.symbol,
        name: reserve.name,
        address: reserve.underlyingAsset,
        tvl: tvl,
        depositAPY: depositAPY.toFixed(4),
        variableBorrowAPY: variableBorrowAPY.toFixed(4),
        isActive: reserve.isActive,
        isFrozen: reserve.isFrozen,
      };
    });
  } catch (error) {
    console.error('获取所有储备数据失败:', error.message);
    throw error;
  }
}

/**
 * 获取特定资产（如 ETH/WETH）的数据
 */
async function getAssetData(assetSymbol = 'WETH', network = 'ethereum') {
  try {
    console.log(`\n正在获取 ${network} 网络上 ${assetSymbol} 的数据...\n`);

    const provider = initializeProvider();
    const assetAddress = TOKEN_ADDRESSES[network][assetSymbol];

    if (!assetAddress) {
      throw new Error(`未找到 ${assetSymbol} 的地址`);
    }

    const data = await getReserveData(provider, network, assetAddress);

    console.log(`📊 ${assetSymbol} 数据概览:`);
    console.log(`\n💰 TVL (总锁仓价值):`);
    console.log(`   ${data.tvl.formatted} ${assetSymbol}`);
    
    console.log(`\n📈 存款收益率:`);
    console.log(`   APR: ${data.deposit.apr}%`);
    console.log(`   APY: ${data.deposit.apy}%`);
    
    console.log(`\n📉 浮动借款利率:`);
    console.log(`   APR: ${data.borrow.variable.apr}%`);
    console.log(`   APY: ${data.borrow.variable.apy}%`);
    
    console.log(`\n📊 稳定借款利率:`);
    console.log(`   APR: ${data.borrow.stable.apr}%`);
    console.log(`   APY: ${data.borrow.stable.apy}%`);
    
    console.log(`\n💸 总借出量:`);
    console.log(`   浮动: ${data.totalBorrowed.variable} ${assetSymbol}`);
    console.log(`   稳定: ${data.totalBorrowed.stable} ${assetSymbol}`);
    
    console.log(`\n🕐 最后更新: ${data.lastUpdate}`);

    return data;
  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  }
}
/**
 * 获取完整的APY数据（分离base和reward）
 */
async function getReserveDataWithRewards(provider, network, assetAddress) {
  // 获取基础数据
  const baseData = await getReserveData(provider, network, assetAddress);
  
  // 获取aToken地址（用于查询奖励）
  const poolDataProvider = new ethers.Contract(
    ADDRESSES[network].PoolDataProvider,
    [
      'function getReserveTokensAddresses(address asset) external view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)'
    ],
    provider
  );
  
  const { aTokenAddress } = await poolDataProvider.getReserveTokensAddresses(assetAddress);
  
  // 获取奖励APY
  const rewardAPY = await getRewardAPY(provider, network, aTokenAddress);
  
  return {
    ...baseData,
    deposit: {
      ...baseData.deposit,
      apyBase: baseData.deposit.apy, // 基础APY就是原来计算的APY
      apyReward: rewardAPY,           // 奖励APY
      apyTotal: (parseFloat(baseData.deposit.apy) + rewardAPY).toFixed(4)
    }
  };
}
/**
 * 获取多个资产的数据对比
 */
async function compareAssets(assets = ['WETH', 'USDC', 'DAI'], network = 'ethereum') {
  console.log(`\n比较 ${network} 网络上的资产...\n`);

  const provider = initializeProvider();
  const results = [];

  for (const asset of assets) {
    try {
      const address = TOKEN_ADDRESSES[network][asset];
      if (!address) continue;

      const data = await getReserveData(provider, network, address);
      results.push({
        symbol: asset,
        tvl: data.tvl.formatted,
        depositAPY: data.deposit.apy,
        borrowAPY: data.borrow.variable.apy,
      });
    } catch (error) {
      console.error(`获取 ${asset} 数据失败:`, error.message);
    }
  }

  console.log('资产对比表:');
  console.table(results);

  return results;
}
async function getAllAssetsOverview(network = 'ethereum') {
  console.log(`\n获取 ${network} 网络上所有资产概览...\n`);

  const provider = initializeProvider();
  
  // 第一步：获取所有资产列表
  const reserves = await getAllReserves(provider, network);
  console.log(`找到 ${reserves.length} 个资产\n`);

  const results = [];

  // 第二步：逐个获取详细数据
  for (const reserve of reserves) {
    try {
      const data = await getReserveData(provider, network, reserve.address);
      
      results.push({
        symbol: reserve.symbol,
        address: reserve.address,
        tvl: parseFloat(data.tvl.formatted).toFixed(2),
        depositAPY: data.deposit.apy,
        borrowAPY: data.borrow.variable.apy,
      });
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`获取 ${reserve.symbol} 数据失败:`, error.message);
    }
  }

  // 按 TVL 排序并显示前15个
  const topAssets = results
    .sort((a, b) => parseFloat(b.tvl) - parseFloat(a.tvl))
    .slice(0, 15);

  console.log('前 15 个资产（按 TVL 排序）:');
  console.table(topAssets.map(asset => ({
    资产: asset.symbol,
    TVL: asset.tvl,
    '存款APY': `${asset.depositAPY}%`,
    '借款APY': `${asset.borrowAPY}%`,
  })));

  return topAssets;
}
/**
 * 获取所有资产概览（优化版）
 */
async function getAllAssetsOverviewOld(network = 'ethereum') {
  console.log(`\n获取 ${network} 网络上所有资产概览...\n`);

  const provider = initializeProvider();
  const allData = await getAllReservesDataOptimized(provider, network);

  // 过滤活跃资产并按 TVL 排序
  const activeAssets = allData
    .filter(asset => asset.isActive && !asset.isFrozen)
    .sort((a, b) => parseFloat(b.tvl) - parseFloat(a.tvl))
    .slice(0, 15); // 显示前 15 个

  console.log('前 15 个资产（按 TVL 排序）:');
  console.table(activeAssets.map(asset => ({
    资产: asset.symbol,
    TVL: parseFloat(asset.tvl).toFixed(2),
    '存款APY': `${asset.depositAPY}%`,
    '借款APY': `${asset.variableBorrowAPY}%`,
  })));

  return activeAssets;
}

// 主函数示例
async function main() {
  try {
    // USDC,USDT,WBTC,WETH,WAN
    // 示例 1: 获取 ETH (WETH) 的数据
    // await getAssetData('WETH', 'ethereum');
    // await getAssetData('USDC', 'ethereum');

    // 示例 2: 比较多个资产
    // await compareAssets(['WETH', 'USDC', 'DAI'], 'ethereum');

    // 示例 3: 获取所有资产概览
    await getAllAssetsOverviewOld('ethereum');

  } catch (error) {
    console.error('执行失败:', error);
  }
}

// 运行
main();

// 导出函数
// module.exports = {
//   getReserveData,
//   getAssetData,
//   compareAssets,
//   getAllReservesDataOptimized,
//   getAllAssetsOverview,
//   getAllReserves,
// };