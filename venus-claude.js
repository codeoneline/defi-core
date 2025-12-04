const ethers = require('ethers');
const axios = require('axios');

// BNB Chain RPC
const RPC_URL = 'https://bsc-rpc.publicnode.com/';

// Venus Protocol 合约地址 (Core Pool)
const VENUS_CONTRACTS = {
  Comptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384',
  PriceOracle: '0x6592b5DE802159F3E74B2486b091D11a8256ab8A',
  XVS: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63',
  vUSDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
  vUSDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255',
  vETH: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8',
  vBTC: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
};

// VToken ABI
const VTOKEN_ABI = [
  'function supplyRatePerBlock() external view returns (uint256)',
  'function borrowRatePerBlock() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function totalBorrows() external view returns (uint256)',
  'function exchangeRateStored() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function decimals() external view returns (uint8)'
];

// Price Oracle ABI
const ORACLE_ABI = [
  'function getUnderlyingPrice(address) external view returns (uint256)'
];

// 每年的区块数 (BSC ~3秒一个块)
const BLOCKS_PER_YEAR = (365 * 24 * 60 * 60) / 3;

// 使用 Venus API 获取数据(推荐方法)
async function getVenusDataFromAPI() {
  try {
    const response = await axios.get('https://api.venus.io/markets', {
      params: {
        chainId: 56  // BSC 主网
      }
    });
    
    const markets = response.data.result;
    
    // 目标资产的 vToken 地址映射
    const targetAssets = {
      '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8': 'USDC',  // vUSDC
      '0xfD5840Cd36d94D7229439859C0112a4185BC0255': 'USDT',  // vUSDT
      '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8': 'ETH',   // vETH
      '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B': 'BTC'    // vBTC
    };
    
    const results = {};

    console.log(`\n从 API 获取到 ${markets.length} 个市场`);

    for (const market of markets) {
      // const vTokenAddress = market.address?.toLowerCase();
      const vTokenAddress = market.address;
      const displaySymbol = targetAssets[vTokenAddress];
      
      if (displaySymbol) {
        // 将 mantissa 格式的数据转换为可读格式
        const totalSupplyUsd = Number(market.liquidityCents || 0) / 100 + 
                               Number(market.totalBorrowsMantissa || 0) / 
                               Math.pow(10, market.underlyingDecimal || 18) * 
                               Number(market.tokenPriceCents || 0) / 100;
        
        // 计算 TVL (Total Supply in USD)
        const tvlUsd = Number(market.totalSupplyMantissa || 0) / 
                       Math.pow(10, market.underlyingDecimal || 18) * 
                       Number(market.tokenPriceCents || 0) / 100;
        
        const totalBorrowsUsd = Number(market.totalBorrowsMantissa || 0) / 
                                Math.pow(10, market.underlyingDecimal || 18) * 
                                Number(market.tokenPriceCents || 0) / 100;
        
        const liquidityUsd = Number(market.liquidityCents || 0) / 100;
        
        const underlyingPrice = Number(market.tokenPriceCents || 0) / 100;

        // APY 数据
        const supplyApy = Number(market.supplyApy || 0);
        const borrowApy = Number(market.borrowApy || 0);
        const supplyXvsApy = Number(market.supplyXvsApy || 0);
        const borrowXvsApy = Number(market.borrowXvsApy || 0);
        
        const totalSupplyApy = supplyApy + supplyXvsApy;
        const totalBorrowApy = borrowApy + borrowXvsApy;
        
        results[displaySymbol] = {
          symbol: market.underlyingSymbol || displaySymbol,
          supplyAPY: `${supplyApy.toFixed(2)}%`,
          supplyXvsAPY: `${supplyXvsApy.toFixed(2)}%`,
          totalSupplyAPY: `${totalSupplyApy.toFixed(2)}%`,
          borrowAPY: `${borrowApy.toFixed(2)}%`,
          borrowXvsAPY: `${borrowXvsApy.toFixed(2)}%`,
          totalBorrowAPY: `${totalBorrowApy.toFixed(2)}%`,
          tvl: `$${tvlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          tvlRaw: tvlUsd,
          liquidity: `$${liquidityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          totalBorrows: `$${totalBorrowsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          utilizationRate: tvlUsd > 0 ? `${(totalBorrowsUsd / tvlUsd * 100).toFixed(2)}%` : '0.00%',
          underlyingPrice: `$${underlyingPrice.toFixed(2)}`,
          vTokenAddress: market.address,
          supplierCount: market.supplierCount || 0,
          borrowerCount: market.borrowerCount || 0
        };

        console.log(`\n${displaySymbol} (${market.underlyingSymbol || displaySymbol}) 数据:`);
        console.log(`  基础供应 APY: ${supplyApy.toFixed(2)}%`);
        console.log(`  XVS 供应奖励: ${supplyXvsApy.toFixed(2)}%`);
        console.log(`  总供应 APY: ${totalSupplyApy.toFixed(2)}%`);
        console.log(`  基础借贷 APY: ${borrowApy.toFixed(2)}%`);
        console.log(`  XVS 借贷奖励: ${borrowXvsApy.toFixed(2)}%`);
        console.log(`  总借贷 APY: ${totalBorrowApy.toFixed(2)}%`);
        console.log(`  TVL: $${tvlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  流动性: $${liquidityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  总借贷: $${totalBorrowsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`  利用率: ${tvlUsd > 0 ? (totalBorrowsUsd / tvlUsd * 100).toFixed(2) : '0.00'}%`);
        console.log(`  价格: $${underlyingPrice.toFixed(2)}`);
        console.log(`  供应用户数: ${market.supplierCount || 0}`);
        console.log(`  借贷用户数: ${market.borrowerCount || 0}`);
      }
    }

    if (Object.keys(results).length === 0) {
      console.log('\n⚠️  未找到目标资产数据');
      console.log('可用的市场:');
      markets.slice(0, 10).forEach(m => {
        console.log(`  - ${m.underlyingSymbol || 'Unknown'} (${m.address})`);
      });
    }

    return results;
  } catch (error) {
    console.error('API 获取失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    throw error;
  }
}

// 直接从链上读取数据
async function getVenusDataFromChain() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const priceOracle = new ethers.Contract(
    VENUS_CONTRACTS.PriceOracle,
    ORACLE_ABI,
    provider
  );

  const assets = [
    { symbol: 'USDC', vToken: 'vUSDC', underlying: 'USDC' },
    { symbol: 'USDT', vToken: 'vUSDT', underlying: 'USDT' },
    { symbol: 'ETH', vToken: 'vETH', underlying: 'ETH' },
    { symbol: 'BTC', vToken: 'vBTC', underlying: 'BTCB' }
  ];
  
  const results = {};

  for (const asset of assets) {
    try {
      const vTokenAddress = VENUS_CONTRACTS[asset.vToken];
      const underlyingAddress = VENUS_CONTRACTS[asset.underlying];
      
      const vToken = new ethers.Contract(vTokenAddress, VTOKEN_ABI, provider);
      const underlyingToken = new ethers.Contract(underlyingAddress, ERC20_ABI, provider);

      // 获取基础利率
      const supplyRatePerBlock = await vToken.supplyRatePerBlock();
      const borrowRatePerBlock = await vToken.borrowRatePerBlock();

      // 计算基础 APY (复利公式)
      const supplyAPY = (
        (Math.pow(1 + Number(supplyRatePerBlock) / 1e18, BLOCKS_PER_YEAR) - 1) * 100
      );
      
      const borrowAPY = (
        (Math.pow(1 + Number(borrowRatePerBlock) / 1e18, BLOCKS_PER_YEAR) - 1) * 100
      );

      // 获取 TVL 数据
      const totalSupply = await vToken.totalSupply();
      const exchangeRate = await vToken.exchangeRateStored();
      const underlyingDecimals = await underlyingToken.decimals();
      
      // 计算 TVL (vToken 都是 8 位小数)
      const tvlInUnderlying = Number(totalSupply) * Number(exchangeRate) / 
        (Math.pow(10, 18 + 8));
      
      // 获取价格
      const underlyingPrice = await priceOracle.getUnderlyingPrice(vTokenAddress);
      const priceInUSD = Number(underlyingPrice) / Math.pow(10, 36 - underlyingDecimals);
      
      const tvlUSD = tvlInUnderlying * priceInUSD;

      // 获取总借贷
      const totalBorrows = await vToken.totalBorrows();
      const totalBorrowsUSD = Number(totalBorrows) / Math.pow(10, underlyingDecimals) * priceInUSD;

      results[asset.symbol] = {
        supplyAPY: `${supplyAPY.toFixed(2)}%`,
        borrowAPY: `${borrowAPY.toFixed(2)}%`,
        tvl: `$${tvlUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        tvlRaw: tvlUSD,
        totalBorrows: `$${totalBorrowsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        utilizationRate: `${(totalBorrowsUSD / tvlUSD * 100).toFixed(2)}%`,
        underlyingPrice: `$${priceInUSD.toFixed(2)}`,
        vTokenAddress
      };

      console.log(`\n${asset.symbol} 数据:`);
      console.log(`  供应 APY: ${supplyAPY.toFixed(2)}%`);
      console.log(`  借贷 APY: ${borrowAPY.toFixed(2)}%`);
      console.log(`  TVL: $${tvlUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  总借贷: $${totalBorrowsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  利用率: ${(totalBorrowsUSD / tvlUSD * 100).toFixed(2)}%`);
      console.log(`  价格: $${priceInUSD.toFixed(2)}`);
      
    } catch (error) {
      console.error(`获取 ${asset.symbol} 数据失败:`, error.message);
    }
  }

  return results;
}

// 主函数
async function main() {
  console.log('=== 方法 1: 使用 Venus API (推荐) ===');
  try {
    const apiData = await getVenusDataFromAPI();
    console.log('\n📊 完整数据:');
    console.log(JSON.stringify(apiData, null, 2));
  } catch (error) {
    console.error('❌ API 方法失败:', error.message);
  }

  console.log('\n\n=== 方法 2: 直接读取链上合约 ===');
  try {
    const chainData = await getVenusDataFromChain();
    console.log('\n📊 完整数据:');
    console.log(JSON.stringify(chainData, null, 2));
  } catch (error) {
    console.error('❌ 链上读取失败:', error.message);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

// 导出函数供其他模块使用
module.exports = {
  getVenusDataFromChain,
  getVenusDataFromAPI
};