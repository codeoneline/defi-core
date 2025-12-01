/**
 * Venus Protocol 多链资产数据获取工具 (包含奖励代币 APY)
 * 支持从多个链上获取 USDC, USDT, WBTC, ETH, WBNB 等资产的完整 APY 和 TVL
 * 完整 APY = 基础利率 APY + 奖励代币 APY (XVS等)
 */

const axios = require('axios');
const { ethers } = require('ethers-v6');

// Venus Protocol 部署的链配置
const CHAINS_CONFIG = {
  bsc: {
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-rpc.publicnode.com',
    chainId: 56,
    comptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384',
    blocksPerDay: 28800, // ~3秒/区块
    nativeToken: 'BNB'
  },
  ethereum: {
    name: 'Ethereum',
    rpcUrl: 'https://ethereum.publicnode.com',
    chainId: 1,
    comptroller: '0x687a01ecF6d3907658f7A7c714749fAC32336D1B',
    blocksPerDay: 7200, // ~12秒/区块
    nativeToken: 'ETH'
  },
  arbitrum: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    comptroller: '0x317c1A5739F39046E20b08ac9BeEa3f10fD43326',
    blocksPerDay: 7200,
    nativeToken: 'ETH'
  },
  optimism: {
    name: 'Optimism',
    rpcUrl: 'https://api.venus.io',
    chainId: 10,
    comptroller: '0x5593FF68bE84C966821eEf5F0a988C285D5B7CeC',
    blocksPerDay: 7200,
    nativeToken: 'ETH'
  },
  base: {
    name: 'Base',
    rpcUrl: 'https://base.public.blockpi.network/v1/rpc/public',
    chainId: 8453,
    comptroller: '0x0C7973F9598AA62f9e03B94E92C967fD5437426C',
    blocksPerDay: 7200,
    nativeToken: 'ETH'
  },
  zksync: {
    name: 'zkSync Era',
    rpcUrl: 'https://mainnet.era.zksync.io',
    chainId: 324,
    comptroller: '0xddE4D098D9995B659724ae6d5E3FB9681Ac941B1',
    blocksPerDay: 7200,
    nativeToken: 'ETH'
  },
  opbnb: {
    name: 'opBNB',
    rpcUrl: 'https://opbnb-mainnet-rpc.bnbchain.org',
    chainId: 204,
    comptroller: '0xD6e3E2A1d8d95caE355D15b3b9f8E5c2511874dd',
    blocksPerDay: 28800,
    nativeToken: 'BNB'
  }
};

// 资产符号映射
const ASSET_SYMBOLS = ['USDC', 'USDT', 'WBTC', 'ETH', 'WETH', 'WBNB', 'BNB'];

// VToken 合约 ABI
const VTOKEN_ABI = [
  'function underlying() view returns (address)',
  'function symbol() view returns (string)',
  'function supplyRatePerBlock() view returns (uint256)',
  'function borrowRatePerBlock() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function exchangeRateStored() view returns (uint256)',
  'function getCash() view returns (uint256)'
];

// Comptroller 合约 ABI
const COMPTROLLER_ABI = [
  'function getAllMarkets() view returns (address[])',
  'function getRewardDistributors() view returns (address[])',
  'function rewardDistributors(uint256) view returns (address)'
];

// RewardsDistributor 合约 ABI
const REWARDS_DISTRIBUTOR_ABI = [
  'function rewardToken() view returns (address)',
  'function rewardTokenSupplySpeeds(address) view returns (uint256)',
  'function rewardTokenBorrowSpeeds(address) view returns (uint256)',
  'function rewardTokenSupplyState(address) view returns (uint224, uint32)',
  'function rewardTokenBorrowState(address) view returns (uint224, uint32)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)'
];

// Chainlink Price Feed ABI
const PRICE_FEED_ABI = [
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'
];

class VenusDataFetcher {
  constructor() {
    this.providers = {};
    this.priceCache = {};
    this.initializeProviders();
  }

  // 初始化各链的 provider
  initializeProviders() {
    for (const [chainKey, config] of Object.entries(CHAINS_CONFIG)) {
      try {
        this.providers[chainKey] = new ethers.JsonRpcProvider(config.rpcUrl);
      } catch (error) {
        console.error(`Failed to initialize provider for ${config.name}:`, error.message);
      }
    }
  }

  // 获取代币价格（通过 CoinGecko API）
  async getTokenPrice(symbol) {
    const symbolMap = {
      'WBTC': 'wrapped-bitcoin',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'WETH': 'ethereum',
      'wBETH': 'eigenpie-wbeth',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'WBNB': 'binancecoin',
      'XVS': 'venus',
      'CRV': 'aave-v3-crv',
      'BETH': 'venus-beth',
      'asBNB': 'astherus-staked-bnb',
      'slisBNB': 'synclub-staked-bnb',
      "yvWETH-1": 'weth-yvault"'
    };
    const id = symbolMap[symbol]
    // 缓存价格，避免重复请求
    if (this.priceCache[id]) {
      return this.priceCache[id].usd;
    }

    const coinIds = Object.values(symbolMap).join(',')

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`,
        { timeout: 5000 }
      );
      
      this.priceCache = response.data;
      return this.priceCache[id].usd;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}:`, error.message);
      return 0;
    }
  }

  // 获取奖励分配器信息
  async getRewardDistributors(chainKey, comptrollerAddress) {
    const provider = this.providers[chainKey];
    const comptroller = new ethers.Contract(comptrollerAddress, COMPTROLLER_ABI, provider);
    
    try {
      // 尝试获取 rewards distributors
      const distributors = await comptroller.getRewardDistributors();
      return distributors || [];
    } catch (error) {
      // 某些链可能还没有部署 rewards distributor
      console.log(`No reward distributors found on ${CHAINS_CONFIG[chainKey].name}`);
      return [];
    }
  }

  // 计算奖励代币的 APY
  async calculateRewardAPY(chainKey, vTokenAddress, distributorAddress, totalSupply, totalBorrows, underlyingPrice) {
    const provider = this.providers[chainKey];
    const config = CHAINS_CONFIG[chainKey];
    
    try {
      const distributor = new ethers.Contract(
        distributorAddress,
        REWARDS_DISTRIBUTOR_ABI,
        provider
      );

      // 获取奖励代币地址
      const rewardTokenAddress = await distributor.rewardToken();
      const rewardToken = new ethers.Contract(rewardTokenAddress, ERC20_ABI, provider);
      
      const [rewardSymbol, rewardDecimals] = await Promise.all([
        rewardToken.symbol(),
        rewardToken.decimals()
      ]);

      // 获取供应和借款速度（每区块的奖励代币数量）
      const [supplySpeed, borrowSpeed] = await Promise.all([
        distributor.rewardTokenSupplySpeeds(vTokenAddress),
        distributor.rewardTokenBorrowSpeeds(vTokenAddress)
      ]);

      // 获取奖励代币价格
      const rewardPrice = await this.getTokenPrice(rewardSymbol);

      // 计算年化奖励
      const daysPerYear = 365;
      const blocksPerYear = config.blocksPerDay * daysPerYear;

      // 供应端奖励 APY
      let supplyRewardAPY = 0;
      if (totalSupply > 0 && Number(supplySpeed) > 0) {
        const rewardPerYear = Number(supplySpeed) * blocksPerYear / (10 ** Number(rewardDecimals));
        const rewardValuePerYear = rewardPerYear * rewardPrice;
        const totalSupplyValue = totalSupply * underlyingPrice;
        supplyRewardAPY = totalSupplyValue > 0 ? (rewardValuePerYear / totalSupplyValue) * 100 : 0;
      }

      // 借款端奖励 APY
      let borrowRewardAPY = 0;
      if (totalBorrows > 0 && Number(borrowSpeed) > 0) {
        const rewardPerYear = Number(borrowSpeed) * blocksPerYear / (10 ** Number(rewardDecimals));
        const rewardValuePerYear = rewardPerYear * rewardPrice;
        const totalBorrowsValue = totalBorrows * underlyingPrice;
        borrowRewardAPY = totalBorrowsValue > 0 ? (rewardValuePerYear / totalBorrowsValue) * 100 : 0;
      }

      return {
        rewardToken: rewardSymbol,
        supplyRewardAPY,
        borrowRewardAPY,
        rewardPrice
      };

    } catch (error) {
      console.warn(`Failed to calculate reward APY for ${vTokenAddress}:`, error.message);
      return {
        rewardToken: 'N/A',
        supplyRewardAPY: 0,
        borrowRewardAPY: 0,
        rewardPrice: 0
      };
    }
  }

  // 从链上直接读取数据
  async fetchFromChain(chainKey) {
    const config = CHAINS_CONFIG[chainKey];
    const provider = this.providers[chainKey];
    
    if (!provider) {
      throw new Error(`Provider not available for ${config.name}`);
    }

    const results = [];
    
    try {
      // 获取 Comptroller 合约
      const comptroller = new ethers.Contract(
        config.comptroller,
        COMPTROLLER_ABI,
        provider
      );

      // 获取所有市场
      const markets = await comptroller.getAllMarkets();
      console.log(`Found ${markets.length} markets on ${config.name}`);

      // 获取奖励分配器
      const rewardDistributors = await this.getRewardDistributors(chainKey, config.comptroller);
      console.log(`Found ${rewardDistributors.length} reward distributors on ${config.name}`);

      // 遍历每个市场
      for (const marketAddress of markets) {
        try {
          const vToken = new ethers.Contract(marketAddress, VTOKEN_ABI, provider);
          
          // 获取 vToken 信息
          const symbol = await vToken.symbol();
          
          // 检查是否是我们关注的资产
          const isTargetAsset = ASSET_SYMBOLS.some(asset => 
            symbol.toLowerCase().includes(asset.toLowerCase())
          );

          if (!isTargetAsset) {
            continue;
          }

          // 获取利率数据
          const [supplyRate, borrowRate, totalSupply, totalBorrows, exchangeRate, cash] = 
            await Promise.all([
              vToken.supplyRatePerBlock(),
              vToken.borrowRatePerBlock(),
              vToken.totalSupply(),
              vToken.totalBorrows(),
              vToken.exchangeRateStored(),
              vToken.getCash()
            ]);

          // 获取底层资产信息
          let underlyingSymbol = symbol.replace('v', '').replace('_Core', '').replace('_LiquidStakedETH', '');
          let underlyingDecimals = 18;
          
          try {
            const underlyingAddress = await vToken.underlying();
            const underlyingToken = new ethers.Contract(
              underlyingAddress,
              ERC20_ABI,
              provider
            );
            underlyingSymbol = await underlyingToken.symbol();
            underlyingDecimals = Number(await underlyingToken.decimals());
          } catch (e) {
            // Native token (BNB/ETH) 没有 underlying() 函数
            underlyingSymbol = config.nativeToken;
          }

          // 计算基础 APY
          const blocksPerDay = config.blocksPerDay;
          const daysPerYear = 365;

          // 将利率从每区块转换为年化
          const supplyRatePerDay = Number(supplyRate) * blocksPerDay / 1e18;
          const borrowRatePerDay = Number(borrowRate) * blocksPerDay / 1e18;
          
          const baseSupplyAPY = ((1 + supplyRatePerDay) ** daysPerYear - 1) * 100;
          const baseBorrowAPY = ((1 + borrowRatePerDay) ** daysPerYear - 1) * 100;

          // 计算供应量和借款量
          const totalSupplyUnderlying = Number(totalSupply) * Number(exchangeRate) / 1e18 / (10 ** underlyingDecimals);
          const totalBorrowsUnderlying = Number(totalBorrows) / (10 ** underlyingDecimals);
          const cashUnderlying = Number(cash) / (10 ** underlyingDecimals);

          // 获取底层资产价格
          const underlyingPrice = await this.getTokenPrice(underlyingSymbol);

          // 计算奖励 APY
          const rewardAPYs = [];
          for (const distributorAddress of rewardDistributors) {
            const rewardAPY = await this.calculateRewardAPY(
              chainKey,
              marketAddress,
              distributorAddress,
              totalSupplyUnderlying,
              totalBorrowsUnderlying,
              underlyingPrice
            );
            
            if (rewardAPY.supplyRewardAPY > 0 || rewardAPY.borrowRewardAPY > 0) {
              rewardAPYs.push(rewardAPY);
            }
          }

          // 计算总 APY
          const totalSupplyRewardAPY = rewardAPYs.reduce((sum, r) => sum + r.supplyRewardAPY, 0);
          const totalBorrowRewardAPY = rewardAPYs.reduce((sum, r) => sum + r.borrowRewardAPY, 0);

          const totalSupplyAPY = baseSupplyAPY + totalSupplyRewardAPY;
          const totalBorrowAPY = baseBorrowAPY - totalBorrowRewardAPY; // 借款奖励减少实际成本

          // 计算 TVL (USD)
          const tvlUSD = totalSupplyUnderlying * underlyingPrice;

          results.push({
            chain: config.name,
            market: marketAddress,
            vTokenSymbol: symbol,
            underlyingSymbol,
            underlyingPrice: underlyingPrice.toFixed(2),
            // 基础 APY
            baseSupplyAPY: baseSupplyAPY.toFixed(2),
            baseBorrowAPY: baseBorrowAPY.toFixed(2),
            // 奖励 APY
            rewardAPYs: rewardAPYs.map(r => ({
              token: r.rewardToken,
              supplyAPY: r.supplyRewardAPY.toFixed(2),
              borrowAPY: r.borrowRewardAPY.toFixed(2),
              price: r.rewardPrice.toFixed(4)
            })),
            totalSupplyRewardAPY: totalSupplyRewardAPY.toFixed(2),
            totalBorrowRewardAPY: totalBorrowRewardAPY.toFixed(2),
            // 总 APY
            totalSupplyAPY: totalSupplyAPY.toFixed(2),
            totalBorrowAPY: totalBorrowAPY.toFixed(2),
            // TVL 数据
            totalSupply: totalSupplyUnderlying.toFixed(2),
            totalBorrows: totalBorrowsUnderlying.toFixed(2),
            liquidity: cashUnderlying.toFixed(2),
            tvlUSD: tvlUSD.toFixed(2),
            utilizationRate: totalSupplyUnderlying > 0 
              ? ((totalBorrowsUnderlying / totalSupplyUnderlying) * 100).toFixed(2) 
              : '0.00'
          });

        } catch (error) {
          console.error(`Error processing market ${marketAddress}:`, error.message);
        }
      }

    } catch (error) {
      console.error(`Error fetching data from ${config.name}:`, error.message);
      throw error;
    }

    return results;
  }

  // 获取所有链的数据
  async fetchAllChains() {
    console.log('开始从所有链获取数据（包含奖励代币 APY）...\n');
    const allResults = {};

    for (const [chainKey, config] of Object.entries(CHAINS_CONFIG)) {
      console.log(`正在获取 ${config.name} 的数据...`);
      
      try {
        const chainData = await this.fetchFromChain(chainKey);
        allResults[chainKey] = {
          chainName: config.name,
          data: chainData
        };
        console.log(`✓ ${config.name}: 找到 ${chainData.length} 个目标资产\n`);
      } catch (error) {
        console.error(`✗ ${config.name}: ${error.message}\n`);
        allResults[chainKey] = {
          chainName: config.name,
          error: error.message
        };
      }

      // 添加延迟以避免 RPC 和 API 限制
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return allResults;
  }

  // 格式化输出结果
  formatResults(results) {
    console.log('\n' + '='.repeat(100));
    console.log('Venus Protocol 多链资产数据汇总 (含奖励代币 APY)');
    console.log('='.repeat(100));

    for (const [chainKey, chainData] of Object.entries(results)) {
      console.log(`\n📊 ${chainData.chainName}`);
      console.log('-'.repeat(100));

      if (chainData.error) {
        console.log(`❌ 错误: ${chainData.error}`);
        continue;
      }

      if (!chainData.data || chainData.data.length === 0) {
        console.log('⚠️  未找到目标资产');
        continue;
      }

      for (const asset of chainData.data) {
        console.log(`\n🪙 ${asset.underlyingSymbol} (${asset.vTokenSymbol}) - 价格: $${asset.underlyingPrice}`);
        console.log(`   合约地址: ${asset.market}`);
        console.log(`   
   📈 供应 APY 详情:`);
        console.log(`      基础利率 APY: ${asset.baseSupplyAPY}%`);
        if (asset.rewardAPYs.length > 0) {
          asset.rewardAPYs.forEach(reward => {
            console.log(`      ${reward.token} 奖励 APY: ${reward.supplyAPY}% (${reward.token}价格: $${reward.price})`);
          });
        }
        console.log(`      💰 总供应 APY: ${asset.totalSupplyAPY}%`);
        
        console.log(`   
   📉 借款 APY 详情:`);
        console.log(`      基础利率 APY: ${asset.baseBorrowAPY}%`);
        if (asset.rewardAPYs.length > 0) {
          asset.rewardAPYs.forEach(reward => {
            console.log(`      ${reward.token} 奖励抵扣: -${reward.borrowAPY}%`);
          });
        }
        console.log(`      💰 净借款 APY: ${asset.totalBorrowAPY}%`);
        
        console.log(`   
   📊 TVL 数据:`);
        console.log(`      总供应量: ${asset.totalSupply} ${asset.underlyingSymbol}`);
        console.log(`      TVL (USD): $${asset.tvlUSD}`);
        console.log(`      总借款量: ${asset.totalBorrows} ${asset.underlyingSymbol}`);
        console.log(`      可用流动性: ${asset.liquidity} ${asset.underlyingSymbol}`);
        console.log(`      利用率: ${asset.utilizationRate}%`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('注：总 APY = 基础利率 APY + 奖励代币 APY');
    console.log('   借款净成本 = 基础借款利率 - 奖励代币抵扣');
    console.log('='.repeat(100));
  }

  // 导出为 JSON
  exportToJSON(results, filename = 'venus_data_with_rewards.json') {
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n✓ 数据已导出到 ${filename}`);
  }

  // 生成 CSV 报告
  exportToCSV(results, filename = 'venus_data_with_rewards.csv') {
    const fs = require('fs');
    const rows = [];
    
    // CSV 表头
    rows.push([
      'Chain',
      'Asset',
      'vToken',
      'Contract',
      'Price (USD)',
      'Base Supply APY (%)',
      'Reward Supply APY (%)',
      'Total Supply APY (%)',
      'Base Borrow APY (%)',
      'Reward Borrow APY (%)',
      'Total Borrow APY (%)',
      'Total Supply',
      'TVL (USD)',
      'Total Borrows',
      'Liquidity',
      'Utilization (%)',
      'Reward Tokens'
    ].join(','));

    // 数据行
    for (const [chainKey, chainData] of Object.entries(results)) {
      if (chainData.error || !chainData.data) continue;

      for (const asset of chainData.data) {
        const rewardTokens = asset.rewardAPYs.map(r => r.token).join(';') || 'None';
        
        rows.push([
          asset.chain,
          asset.underlyingSymbol,
          asset.vTokenSymbol,
          asset.market,
          asset.underlyingPrice,
          asset.baseSupplyAPY,
          asset.totalSupplyRewardAPY,
          asset.totalSupplyAPY,
          asset.baseBorrowAPY,
          asset.totalBorrowRewardAPY,
          asset.totalBorrowAPY,
          asset.totalSupply,
          asset.tvlUSD,
          asset.totalBorrows,
          asset.liquidity,
          asset.utilizationRate,
          rewardTokens
        ].join(','));
      }
    }

    fs.writeFileSync(filename, rows.join('\n'));
    console.log(`✓ CSV 报告已导出到 ${filename}`);
  }
}

// 主函数
async function main() {
  const fetcher = new VenusDataFetcher();
  
  try {
    console.log('Venus Protocol 完整数据获取工具');
    console.log('功能：获取基础利率 APY + 奖励代币 APY (如 XVS)');
    console.log('支持链：BNB Chain, Ethereum, Arbitrum, Optimism, Base, zkSync, opBNB\n');
    
    // 获取所有链的数据
    const results = await fetcher.fetchAllChains();
    
    // 格式化输出
    fetcher.formatResults(results);
    
    // 导出 JSON
    fetcher.exportToJSON(results);
    
    // 导出 CSV
    fetcher.exportToCSV(results);
    
    console.log('\n✅ 数据获取完成！');
    
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { VenusDataFetcher, CHAINS_CONFIG };