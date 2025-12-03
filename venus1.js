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
    nativeToken: 'BNB',
    resilientOracle: '0x6592b5DE802159F3E74B2486b091D11a8256ab8A',
    // https://gateway-bsc.network.thegraph.com/api/5a1340b49fa9efe0021452daa260564e/subgraphs/id/H2a3D64RV4NNxyJqx9jVFQRBpQRzD6zNZjLDotgdCrTC
  },
  ethereum: {
    name: 'Ethereum',
    rpcUrl: 'https://ethereum.publicnode.com',
    chainId: 1,
    comptroller: '0x687a01ecF6d3907658f7A7c714749fAC32336D1B',
    blocksPerDay: 7200, // ~12秒/区块
    nativeToken: 'ETH',
    resilientOracle: '0xd2ce3fb018805ef92b8C5976cb31F84b4E295F94',
    // https://gateway-ethereum.network.thegraph.com/api/5a1340b49fa9efe0021452daa260564e/subgraphs/id/Htf6Hh1qgkvxQxqbcv4Jp5AatsaiY5dNLVcySkpCaxQ8
  },
  arbitrum: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    comptroller: '0x317c1A5739F39046E20b08ac9BeEa3f10fD43326',
    blocksPerDay: 7200,
    nativeToken: 'ETH',
    resilientOracle: '0xd55A98150e0F9f5e3F6280FC25617A5C93d96007',
  },
  optimism: {
    name: 'Optimism',
    rpcUrl: 'https://optimism.publicnode.com',
    chainId: 10,
    comptroller: '0x5593FF68bE84C966821eEf5F0a988C285D5B7CeC',
    blocksPerDay: 7200,
    nativeToken: 'ETH',
    resilientOracle: '0x21FC48569bd3a6623281f55FC1F8B48B9386907b',
  },
  base: {
    name: 'Base',
    rpcUrl: 'https://base.public.blockpi.network/v1/rpc/public',
    chainId: 8453,
    comptroller: '0x0C7973F9598AA62f9e03B94E92C967fD5437426C',
    blocksPerDay: 7200,
    nativeToken: 'ETH',
    resilientOracle: '0xcBBf58bD5bAdE357b634419B70b215D5E9d6FbeD',
  },
  zksync: {
    name: 'zkSync Era',
    rpcUrl: 'https://mainnet.era.zksync.io',
    chainId: 324,
    comptroller: '0xddE4D098D9995B659724ae6d5E3FB9681Ac941B1',
    blocksPerDay: 7200,
    nativeToken: 'ETH',
    resilientOracle: '0x748853B3bE26c46b4562Fd314dfb82708F395bDf',
  },
  opbnb: {
    name: 'opBNB',
    rpcUrl: 'https://opbnb-mainnet-rpc.bnbchain.org',
    chainId: 204,
    comptroller: '0xD6e3E2A1d8d95caE355D15b3b9f8E5c2511874dd',
    blocksPerDay: 28800,
    nativeToken: 'BNB',
    resilientOracle: '0x8f3618c4F0183e14A218782c116fb2438571dAC9',
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

// Resilient Oracle ABI (简化版，包含核心功能)
const RESILIENT_ORACLE_ABI = [
  'function getPrice(address asset) view returns (uint256)',
  'function getUnderlyingPrice(address vToken) view returns (uint256)'
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
    // 缓存价格，避免重复请求
    if (this.priceCache[symbol]) {
      return this.priceCache[symbol];
    }

    const symbolMap = {
      'WBTC': 'wrapped-bitcoin',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'WETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'WBNB': 'binancecoin',
      'XVS': 'venus'
    };

    const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { timeout: 5000 }
      );
      
      const price = response.data[coinId]?.usd || 0;
      this.priceCache[symbol] = price;
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}:`, error.message);
      return 0;
    }
  }

  async getTokenPriceFromOracle(chainKey, assetAddress, isVToken = false) {
    const config = CHAINS_CONFIG[chainKey];
    const provider = this.providers[chainKey];
    
    // 检查该链是否配置了预言机
    if (!config.resilientOracle) {
      console.warn(`No oracle configured for ${config.name}, falling back to API`);
      return 0;
    }
    
    try {
      const oracle = new ethers.Contract(
        config.resilientOracle,
        RESILIENT_ORACLE_ABI,
        provider
      );
      
      let priceRaw;
      if (isVToken) {
        // 如果是vToken，获取其底层资产价格
        priceRaw = await oracle.getUnderlyingPrice(assetAddress);
      } else {
        // 如果是普通代币地址，直接获取价格
        priceRaw = await oracle.getPrice(assetAddress);
      }
      
      // 预言机返回的价格通常是以USD为单位的，且精度为18位（1e18）
      // 例如，如果ETH价格为 $3500，则返回 3500 * 10^18
      const price = Number(priceRaw) / 1e18;
      return price;
      
    } catch (error) {
      console.error(`Failed to fetch price from oracle on ${config.name} for ${assetAddress}:`, error.message);
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
          // const underlyingPrice = await this.getTokenPrice(underlyingSymbol);
          // 替换后（使用预言机）：
          let underlyingPrice = 0;
          try {
            // 首先尝试获取vToken的底层资产价格（推荐方式）
            underlyingPrice = await this.getTokenPriceFromOracle(chainKey, marketAddress, true);
          } catch (oracleError) {
            console.warn(`Failed to get price via vToken for ${symbol}, trying underlying address:`, oracleError.message);
            // 如果失败，尝试获取底层代币地址的价格
            try {
              const underlyingAddress = await vToken.underlying();
              underlyingPrice = await this.getTokenPriceFromOracle(chainKey, underlyingAddress, false);
            } catch (underlyingError) {
              console.error(`Both oracle methods failed for ${symbol}, falling back to API`);
              // 作为备选方案，可以退回使用原来的API
              underlyingPrice = await this.getTokenPrice(underlyingSymbol);
            }
          }

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
          data: chainDataHtf6Hh1qgkvxQxqbcv4Jp5AatsaiY5dNLVcySkpCaxQ8
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


/**
====================================================================================================
Venus Protocol 多链资产数据汇总 (含奖励代币 APY)
====================================================================================================

📊 BNB Chain
----------------------------------------------------------------------------------------------------

🪙 USDC (vUSDC) - 价格: $1.00
   合约地址: 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8
   
   📈 供应 APY 详情:
      基础利率 APY: 0.75%
      💰 总供应 APY: 0.75%
   
   📉 借款 APY 详情:
      基础利率 APY: 1.31%
      💰 净借款 APY: 1.31%
   
   📊 TVL 数据:
      总供应量: 82573775.81 USDC
      TVL (USD): $82558912.53
      总借款量: 52949073.21 USDC
      可用流动性: 29624812.68 USDC
      利用率: 64.12%

🪙 USDT (vUSDT) - 价格: $1.00
   合约地址: 0xfD5840Cd36d94D7229439859C0112a4185BC0255
   
   📈 供应 APY 详情:
      基础利率 APY: 0.73%
      💰 总供应 APY: 0.73%
   
   📉 借款 APY 详情:
      基础利率 APY: 1.34%
      💰 净借款 APY: 1.34%
   
   📊 TVL 数据:
      总供应量: 260806663.41 USDT
      TVL (USD): $260795237.47
      总借款量: 158768110.51 USDT
      可用流动性: 102038787.86 USDT
      利用率: 60.88%

🪙 BNB (vBNB) - 价格: $828.12
   合约地址: 0xA07c5b74C9B40447a954e1466938b865b6BBea36
   
   📈 供应 APY 详情:
      基础利率 APY: 0.25%
      💰 总供应 APY: 0.25%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.53%
      💰 净借款 APY: 0.53%
   
   📊 TVL 数据:
      总供应量: 470289.26 BNB
      TVL (USD): $389458103.32
      总借款量: 317656.06 BNB
      可用流动性: 152654.51 BNB
      利用率: 67.54%

🪙 ETH (vETH) - 价格: $2804.84
   合约地址: 0xf508fCD89b8bd15579dc79A6827cB4686A3592c8
   
   📈 供应 APY 详情:
      基础利率 APY: 0.29%
      💰 总供应 APY: 0.29%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.53%
      💰 净借款 APY: 0.53%
   
   📊 TVL 数据:
      总供应量: 23328.85 ETH
      TVL (USD): $65433686.61
      总借款量: 16336.33 ETH
      可用流动性: 6992.56 ETH
      利用率: 70.03%

🪙 BETH (vBETH) - 价格: $2785.43
   合约地址: 0x972207A639CC1B374B893cc33Fa251b55CEB7c07
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.22%
      💰 净借款 APY: 0.22%
   
   📊 TVL 数据:
      总供应量: 101.67 BETH
      TVL (USD): $283189.29
      总借款量: 6.01 BETH
      可用流动性: 95.66 BETH
      利用率: 5.91%

🪙 wBETH (vWBETH) - 价格: $3043.42
   合约地址: 0x6CFdEc747f37DAf3b87a35a1D9c8AD3063A1A8A0
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.02%
      💰 净借款 APY: 0.02%
   
   📊 TVL 数据:
      总供应量: 14664.32 wBETH
      TVL (USD): $44629670.33
      总借款量: 107.91 wBETH
      可用流动性: 14556.41 wBETH
      利用率: 0.74%

🪙 asBNB (vasBNB) - 价格: $878.88
   合约地址: 0xCC1dB43a06d97f736C7B045AedD03C6707c09BDF
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 170910.28 asBNB
      TVL (USD): $150209563.89
      总借款量: 0.00 asBNB
      可用流动性: 170910.28 asBNB
      利用率: 0.00%

🪙 WBNB (vWBNB) - 价格: $828.12
   合约地址: 0x6bCa74586218dB34cdB402295796b79663d816e9
   
   📈 供应 APY 详情:
      基础利率 APY: 0.34%
      💰 总供应 APY: 0.34%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.79%
      💰 净借款 APY: 0.79%
   
   📊 TVL 数据:
      总供应量: 96705.66 WBNB
      TVL (USD): $80084338.75
      总借款量: 48614.41 WBNB
      可用流动性: 48091.36 WBNB
      利用率: 50.27%

🪙 slisBNB (vslisBNB) - 价格: $855.87
   合约地址: 0x89c910Eb8c90df818b4649b508Ba22130Dc73Adc
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 11.47 slisBNB
      TVL (USD): $9813.64
      总借款量: 0.00 slisBNB
      可用流动性: 11.47 slisBNB
      利用率: 0.00%

📊 Ethereum
----------------------------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core) - 价格: $866406100000000.13
   合约地址: 0x8716554364f20BCA783cb2BAA744d39361fd1D8d
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      XVS 奖励 APY: 0.00% (XVS价格: $4.5300)
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.02%
      XVS 奖励抵扣: -0.00%
      💰 净借款 APY: 0.02%
   
   📊 TVL 数据:
      总供应量: 10.79 WBTC
      TVL (USD): $9346264675156402.00
      总借款量: 0.03 WBTC
      可用流动性: 10.76 WBTC
      利用率: 0.23%

🪙 WETH (vWETH_Core) - 价格: $2795.99
   合约地址: 0x7c8ff7d2A1372433726f879BD945fFb250B94c65
   
   📈 供应 APY 详情:
      基础利率 APY: 0.48%
      XVS 奖励 APY: 2.14% (XVS价格: $4.5300)
      💰 总供应 APY: 2.62%
   
   📉 借款 APY 详情:
      基础利率 APY: 1.35%
      XVS 奖励抵扣: -7.22%
      💰 净借款 APY: -5.87%
   
   📊 TVL 数据:
      总供应量: 413.70 WETH
      TVL (USD): $1156701.85
      总借款量: 184.37 WETH
      可用流动性: 229.33 WETH
      利用率: 44.57%

🪙 USDC (vUSDC_Core) - 价格: $999810180000.00
   合约地址: 0x17C07e0c232f2f80DfDbd7a95b942D893A4C5ACb
   
   📈 供应 APY 详情:
      基础利率 APY: 3.98%
      XVS 奖励 APY: 0.00% (XVS价格: $4.5300)
      💰 总供应 APY: 3.98%
   
   📉 借款 APY 详情:
      基础利率 APY: 6.81%
      XVS 奖励抵扣: -0.00%
      💰 净借款 APY: 6.81%
   
   📊 TVL 数据:
      总供应量: 756919.28 USDC
      TVL (USD): $756775603056990336.00
      总借款量: 498367.63 USDC
      可用流动性: 258560.36 USDC
      利用率: 65.84%

🪙 USDT (vUSDT_Core) - 价格: $999925500000.00
   合约地址: 0x8C3e3821259B82fFb32B2450A95d2dcbf161C24E
   
   📈 供应 APY 详情:
      基础利率 APY: 3.90%
      XVS 奖励 APY: 0.00% (XVS价格: $4.5300)
      💰 总供应 APY: 3.90%
   
   📉 借款 APY 详情:
      基础利率 APY: 6.74%
      XVS 奖励抵扣: -0.00%
      💰 净借款 APY: 6.74%
   
   📊 TVL 数据:
      总供应量: 2630441.17 USDT
      TVL (USD): $2630245206614501376.00
      总借款量: 1715497.50 USDT
      可用流动性: 914943.68 USDT
      利用率: 65.22%

🪙 yvWETH-1 (vyvWETH-1_Core) - 价格: $2904.34
   合约地址: 0xba3916302cBA4aBcB51a01e706fC6051AaF272A0
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 0.00 yvWETH-1
      TVL (USD): $0.00
      总借款量: 0.00 yvWETH-1
      可用流动性: 0.00 yvWETH-1
      利用率: 0.00%

🪙 weETHs (vweETHs_Core) - 价格: $2910.78
   合约地址: 0xc42E4bfb996ED35235bda505430cBE404Eb49F77
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 97.08 weETHs
      TVL (USD): $282589.31
      总借款量: 0.00 weETHs
      可用流动性: 97.08 weETHs
      利用率: 0.00%

📊 Arbitrum One
----------------------------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core) - 价格: $868191840345500.00
   合约地址: 0xaDa57840B372D4c28623E87FC175dE8490792811
   
   📈 供应 APY 详情:
      基础利率 APY: 0.01%
      💰 总供应 APY: 0.01%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.14%
      💰 净借款 APY: 0.14%
   
   📊 TVL 数据:
      总供应量: 8.97 WBTC
      TVL (USD): $7784038213531864.00
      总借款量: 1.00 WBTC
      可用流动性: 7.97 WBTC
      利用率: 11.12%

🪙 WETH (vWETH_Core) - 价格: $2804.04
   合约地址: 0x68a34332983f4Bf866768DD6D6E638b02eF5e1f0
   
   📈 供应 APY 详情:
      基础利率 APY: 0.05%
      💰 总供应 APY: 0.05%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.12%
      💰 净借款 APY: 0.12%
   
   📊 TVL 数据:
      总供应量: 156.19 WETH
      TVL (USD): $437965.84
      总借款量: 76.76 WETH
      可用流动性: 79.43 WETH
      利用率: 49.14%

🪙 USDC (vUSDC_Core) - 价格: $999851030000.00
   合约地址: 0x7D8609f8da70fF9027E9bc5229Af4F6727662707
   
   📈 供应 APY 详情:
      基础利率 APY: 0.26%
      💰 总供应 APY: 0.26%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.49%
      💰 净借款 APY: 0.49%
   
   📊 TVL 数据:
      总供应量: 522982.51 USDC
      TVL (USD): $522904605290890048.00
      总借款量: 307711.18 USDC
      可用流动性: 215275.05 USDC
      利用率: 58.84%

🪙 USD₮0 (vUSDT_Core) - 价格: $999884360000.00
   合约地址: 0xB9F9117d4200dC296F9AcD1e8bE1937df834a2fD
   
   📈 供应 APY 详情:
      基础利率 APY: 0.21%
      💰 总供应 APY: 0.21%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.44%
      💰 净借款 APY: 0.44%
   
   📊 TVL 数据:
      总供应量: 853989.70 USD₮0
      TVL (USD): $853890944515105408.00
      总借款量: 447172.40 USD₮0
      可用流动性: 406821.36 USD₮0
      利用率: 52.36%

🪙 GM (vgmWETH-USDC_Core) - 价格: $1.84
   合约地址: 0x9bb8cEc9C0d46F53b4f2173BB2A0221F66c353cC
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 157826.22 GM
      TVL (USD): $289642.26
      总借款量: 0.00 GM
      可用流动性: 157826.22 GM
      利用率: 0.00%

🪙 GM (vgmBTC-USDC_Core) - 价格: $2.39
   合约地址: 0x4f3a73f318C5EA67A86eaaCE24309F29f89900dF
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 357227.00 GM
      TVL (USD): $854585.31
      总借款量: 0.00 GM
      可用流动性: 357227.00 GM
      利用率: 0.00%

📊 Optimism
----------------------------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core) - 价格: $868594900000000.00
   合约地址: 0x9EfdCfC2373f81D3DF24647B1c46e15268884c46
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 0.09 WBTC
      TVL (USD): $74537941500611.00
      总借款量: 0.00 WBTC
      可用流动性: 0.09 WBTC
      利用率: 0.01%

🪙 WETH (vWETH_Core) - 价格: $2805.89
   合约地址: 0x66d5AE25731Ce99D46770745385e662C8e0B4025
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 8.20 WETH
      TVL (USD): $23006.95
      总借款量: 0.04 WETH
      可用流动性: 8.15 WETH
      利用率: 0.55%

🪙 USDT (vUSDT_Core) - 价格: $1000070000000.00
   合约地址: 0x37ac9731B0B02df54975cd0c7240e0977a051721
   
   📈 供应 APY 详情:
      基础利率 APY: 0.05%
      💰 总供应 APY: 0.05%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.18%
      💰 净借款 APY: 0.18%
   
   📊 TVL 数据:
      总供应量: 6045.62 USDT
      TVL (USD): $6046040736228010.00
      总借款量: 1871.05 USDT
      可用流动性: 4174.57 USDT
      利用率: 30.95%

🪙 USDC (vUSDC_Core) - 价格: $999861590000.00
   合约地址: 0x1C9406ee95B7af55F005996947b19F91B6D55b15
   
   📈 供应 APY 详情:
      基础利率 APY: 0.10%
      💰 总供应 APY: 0.10%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.25%
      💰 净借款 APY: 0.25%
   
   📊 TVL 数据:
      总供应量: 5686.78 USDC
      TVL (USD): $5685994122609955.00
      总借款量: 2521.32 USDC
      可用流动性: 3165.48 USDC
      利用率: 44.34%

📊 Base
----------------------------------------------------------------------------------------------------

🪙 WETH (vWETH_Core) - 价格: $2805.26
   合约地址: 0xEB8A79bD44cF4500943bf94a2b4434c95C008599
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 5.87 WETH
      TVL (USD): $16456.72
      总借款量: 0.06 WETH
      可用流动性: 5.80 WETH
      利用率: 1.09%

🪙 USDC (vUSDC_Core) - 价格: $999860000000.00
   合约地址: 0x3cb752d175740043Ec463673094e06ACDa2F9a2e
   
   📈 供应 APY 详情:
      基础利率 APY: 0.27%
      💰 总供应 APY: 0.27%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.50%
      💰 净借款 APY: 0.50%
   
   📊 TVL 数据:
      总供应量: 11406.34 USDC
      TVL (USD): $11404743909288418.00
      总借款量: 6831.72 USDC
      可用流动性: 4574.62 USDC
      利用率: 59.89%

🪙 wsuperOETHb (vwsuperOETHb_Core) - 价格: $3044.43
   合约地址: 0x75201D81B3B0b9D17b179118837Be37f64fc4930
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 0.04 wsuperOETHb
      TVL (USD): $127.09
      总借款量: 0.00 wsuperOETHb
      可用流动性: 0.04 wsuperOETHb
      利用率: 0.00%

🪙 wstETH (vwstETH_Core) - 价格: $3424.38
   合约地址: 0x133d3BCD77158D125B75A17Cb517fFD4B4BE64C5
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 2.87 wstETH
      TVL (USD): $9843.86
      总借款量: 0.00 wstETH
      可用流动性: 2.87 wstETH
      利用率: 0.06%

📊 zkSync Era
----------------------------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core) - 价格: $0.00
   合约地址: 0xAF8fD83cFCbe963211FAaf1847F0F217F80B4719
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.05%
      💰 净借款 APY: 0.05%
   
   📊 TVL 数据:
      总供应量: 2.46 WBTC
      TVL (USD): $0.00
      总借款量: 0.16 WBTC
      可用流动性: 2.29 WBTC
      利用率: 6.65%

🪙 WETH (vWETH_Core) - 价格: $0.00
   合约地址: 0x1Fa916C27c7C2c4602124A14C77Dbb40a5FF1BE8
   
   📈 供应 APY 详情:
      基础利率 APY: 0.50%
      💰 总供应 APY: 0.50%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.72%
      💰 净借款 APY: 0.72%
   
   📊 TVL 数据:
      总供应量: 192.26 WETH
      TVL (USD): $0.00
      总借款量: 166.42 WETH
      可用流动性: 25.85 WETH
      利用率: 86.56%

🪙 USDC.e (vUSDC.e_Core) - 价格: $0.00
   合约地址: 0x1aF23bD57c62A99C59aD48236553D0Dd11e49D2D
   
   📈 供应 APY 详情:
      基础利率 APY: 0.38%
      💰 总供应 APY: 0.38%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.60%
      💰 净借款 APY: 0.60%
   
   📊 TVL 数据:
      总供应量: 291922.06 USDC.e
      TVL (USD): $0.00
      总借款量: 208487.40 USDC.e
      可用流动性: 83429.83 USDC.e
      利用率: 71.42%

🪙 USDT (vUSDT_Core) - 价格: $0.00
   合约地址: 0x69cDA960E3b20DFD480866fFfd377Ebe40bd0A46
   
   📈 供应 APY 详情:
      基础利率 APY: 0.44%
      💰 总供应 APY: 0.44%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.64%
      💰 净借款 APY: 0.64%
   
   📊 TVL 数据:
      总供应量: 212609.02 USDT
      TVL (USD): $0.00
      总借款量: 163363.87 USDT
      可用流动性: 49246.96 USDT
      利用率: 76.84%

🪙 USDC (vUSDC_Core) - 价格: $0.00
   合约地址: 0x84064c058F2EFea4AB648bB6Bd7e40f83fFDe39a
   
   📈 供应 APY 详情:
      基础利率 APY: 0.34%
      💰 总供应 APY: 0.34%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.56%
      💰 净借款 APY: 0.56%
   
   📊 TVL 数据:
      总供应量: 46870.14 USDC
      TVL (USD): $0.00
      总借款量: 31387.23 USDC
      可用流动性: 15482.92 USDC
      利用率: 66.97%

🪙 wstETH (vwstETH_Core) - 价格: $0.00
   合约地址: 0x03CAd66259f7F34EE075f8B62D133563D249eDa4
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.01%
      💰 净借款 APY: 0.01%
   
   📊 TVL 数据:
      总供应量: 2.51 wstETH
      TVL (USD): $0.00
      总借款量: 0.03 wstETH
      可用流动性: 2.48 wstETH
      利用率: 1.03%

🪙 zkETH (vzkETH_Core) - 价格: $0.00
   合约地址: 0xCEb7Da150d16aCE58F090754feF2775C23C8b631
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 0.04 zkETH
      TVL (USD): $0.00
      总借款量: 0.00 zkETH
      可用流动性: 0.04 zkETH
      利用率: 0.00%

📊 opBNB
----------------------------------------------------------------------------------------------------

🪙 ETH (vETH_Core) - 价格: $2805.88
   合约地址: 0x509e81eF638D489936FA85BC58F52Df01190d26C
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.01%
      💰 净借款 APY: 0.01%
   
   📊 TVL 数据:
      总供应量: 0.68 ETH
      TVL (USD): $1916.11
      总借款量: 0.01 ETH
      可用流动性: 0.67 ETH
      利用率: 2.13%

🪙 USDT (vUSDT_Core) - 价格: $1.00
   合约地址: 0xb7a01Ba126830692238521a1aA7E7A7509410b8e
   
   📈 供应 APY 详情:
      基础利率 APY: 0.15%
      💰 总供应 APY: 0.15%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.53%
      💰 净借款 APY: 0.53%
   
   📊 TVL 数据:
      总供应量: 2835.81 USDT
      TVL (USD): $2836.11
      总借款量: 900.43 USDT
      可用流动性: 1935.38 USDT
      利用率: 31.75%

🪙 WBNB (vWBNB_Core) - 价格: $828.37
   合约地址: 0x53d11cB8A0e5320Cd7229C3acc80d1A0707F2672
   
   📈 供应 APY 详情:
      基础利率 APY: 0.00%
      💰 总供应 APY: 0.00%
   
   📉 借款 APY 详情:
      基础利率 APY: 0.00%
      💰 净借款 APY: 0.00%
   
   📊 TVL 数据:
      总供应量: 5.85 WBNB
      TVL (USD): $4842.21
      总借款量: 0.00 WBNB
      可用流动性: 5.84 WBNB
      利用率: 0.04%

====================================================================================================
注：总 APY = 基础利率 APY + 奖励代币 APY
   借款净成本 = 基础借款利率 - 奖励代币抵扣
====================================================================================================

✓ 数据已导出到 venus_data_with_rewards.json
✓ CSV 报告已导出到 venus_data_with_rewards.csv
 */