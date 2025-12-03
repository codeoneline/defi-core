/**
 * Venus Protocol 多链资产数据获取工具
 * 支持从多个链上获取 USDC, USDT, WBTC, ETH, WBNB 等资产的 APY 和 TVL
 */

const axios = require('axios');
const { ethers } = require('ethers-v6');

// Venus Protocol 部署的链配置
const CHAINS_CONFIG = {
  bsc: {
    name: 'BNB Chain',
    // rpcUrl: 'https://bsc-dataseed1.binance.org',
    rpcUrl: 'https://bsc-rpc.publicnode.com',
    chainId: 56,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0x9F7b01A536aFA00EF10310A162877fd792cD0666',
    pools: {
      core: '0xfD36E2c2a6789Db23113685031d7F16329158384' // core pool, comptroller
    },
    // 新增：奖励分发器合约地址（不同链可能不同）
    rewardDistributor: '0x6592b5DE802159F3E74B2486b091D11a8256ab8A', // BNB Chain 主网
    priceOracle: '0x594810b741d136f1960141C0d8Fb4a91bE78A820', // 价格预言机
    xvsAddress: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63' // XVS 代币地址
  },
  ethereum: {
    name: 'Ethereum',
    // rpcUrl: 'https://eth.llamarpc.com',
    rpcUrl: 'https://ethereum.publicnode.com',
    chainId: 1,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0x61CAff113CCaf05FFc6540302c37adcf077C5179',
    pools: {
      core: '0x687a01ecF6d3907658f7A7c714749fAC32336D1B'
    }
  },
  arbitrum: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0x382238f07Bc4Fe4aA99e561adE8A4164b5f815DA',
    pools: {
      core: '0x317c1A5739F39046E20b08ac9BeEa3f10fD43326'
    }
  },
  optimism: {
    name: 'Optimism',
    // "https://optimism.publicnode.com",
    // "https://1rpc.io/op",
    // "https://optimism.meowrpc.com",
    // "https://api.tatum.io/v3/blockchain/node/optimism-mainnet"
    rpcUrl: 'https://optimism.publicnode.com',
    chainId: 10,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0x147780799840d541C1d7c998F0cbA996d11D62bb',
    pools: {
      core: '0x5593FF68bE84C966821eEf5F0a988C285D5B7CeC'
    }
  },
  base: {
    name: 'Base',
    // "https://mainnet.base.org",
    // "https://base.lava.build",
    rpcUrl: 'https://base.public.blockpi.network/v1/rpc/public',
    chainId: 8453,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0xeef902918DdeCD773D4B422aa1C6e1673EB9136F',
    pools: {
      core: '0x0C7973F9598AA62f9e03B94E92C967fD5437426C'
    }
  },
  zksync: {
    name: 'zkSync Era',
    rpcUrl: 'https://mainnet.era.zksync.io',
    chainId: 324,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0xFD96B926298034aed9bBe0Cca4b651E41eB87Bc4',
    pools: {
      core: '0xddE4D098D9995B659724ae6d5E3FB9681Ac941B1'
    }
  },
  opbnb: {
    name: 'opBNB',
    rpcUrl: 'https://opbnb-mainnet-rpc.bnbchain.org',
    chainId: 204,
    apiUrl: 'https://api.venus.io',
    poolRegistry: '0x345a030Ad22e2317ac52811AC41C1A63cfa13aEe',
    pools: {
      core: '0xD6e3E2A1d8d95caE355D15b3b9f8E5c2511874dd'
    }
  }
};

// 资产符号映射（不同链上可能有不同的代币地址）
const ASSET_SYMBOLS = ['USDC', 'USDT', 'WBTC', 'ETH', 'WETH', 'WBNB'];

// VToken 合约 ABI (简化版，只包含需要的函数)
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
  'function markets(address) view returns (bool, uint256, bool)',
  // 新增：奖励相关
  'function rewardDistributor() view returns (address)',
  'function oracle() view returns (address)',
  // 获取rewardDistributors
  'function getRewardDistributors() view returns (address[])'
];

// Reward Distributor ABI
const REWARD_DISTRIBUTOR_ABI = [
  // 获取特定市场的奖励分发速度
  'function rewardTokenSpeeds(address market) view returns (uint256)',
  'function rewardTokenSupplySpeeds(address market) view returns (uint256)',
  'function rewardTokenBorrowSpeeds(address market) view returns (uint256)',
  // 获取奖励代币信息
  'function rewardToken() view returns (address)',
  // 获取奖励数据
  'function rewardAccrued(address account) view returns (uint256)'
];

// 价格预言机 ABI
const ORACLE_ABI = [
  'function getUnderlyingPrice(address vToken) view returns (uint256)',
  'function price(address asset) view returns (uint256)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
];

class VenusDataFetcher {
  constructor() {
    this.providers = {};
    this.prices = {}; // 缓存价格数据
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

  // 获取价格数据
  async fetchPrices(chainKey) {
    const config = CHAINS_CONFIG[chainKey];
    const provider = this.providers[chainKey];
    
    if (!provider || !config.priceOracle) {
      return {};
    }

    try {
      const oracle = new ethers.Contract(
        config.priceOracle,
        ORACLE_ABI,
        provider
      );

      // 获取 XVS 价格
      const xvsPrice = await oracle.price(config.xvsAddress);
      
      this.prices[chainKey] = {
        XVS: parseFloat(ethers.formatUnits(xvsPrice, 18)) // 假设 18 位小数
      };
      
      return this.prices[chainKey];
    } catch (error) {
      console.warn(`Failed to fetch prices for ${chainKey}:`, error.message);
      return {};
    }
  }

  // 计算奖励 APY
  calculateRewardAPY(
    rewardSpeed,      // 每秒奖励数量（XVS）
    rewardPrice,      // XVS 价格（USD）
    totalSupplyUSD,   // 总供应量（USD）
    blocksPerYear     // 每年区块数
  ) {
    if (!rewardSpeed || !rewardPrice || !totalSupplyUSD || totalSupplyUSD === 0) {
      return 0;
    }

    // 将奖励速度转换为每年奖励数量
    const secondsPerYear = 365 * 24 * 60 * 60;
    const rewardsPerYear = Number(rewardSpeed) * secondsPerYear;
    
    // 计算每年奖励的 USD 价值
    const rewardsValuePerYear = rewardsPerYear * rewardPrice;
    
    // 计算 APY（奖励价值 / 总供应量）
    const rewardAPY = (rewardsValuePerYear / totalSupplyUSD) * 100;
    
    return rewardAPY;
  }

  // 获取市场奖励数据
  async fetchRewardData(chainKey, vTokenAddress, underlyingPriceUSD) {
    const config = CHAINS_CONFIG[chainKey];
    const provider = this.providers[chainKey];
    
    if (!config.rewardDistributor || !provider) {
      return {
        supplyRewardSpeed: 0,
        borrowRewardSpeed: 0,
        rewardAPY: 0,
        totalRewardAPY: 0
      };
    }

    try {
      // 获取奖励分发器合约
      const rewardDistributor = new ethers.Contract(
        config.rewardDistributor,
        REWARD_DISTRIBUTOR_ABI,
        provider
      );

      // 获取奖励速度
      const [supplyRewardSpeed, borrowRewardSpeed] = await Promise.all([
        rewardDistributor.rewardTokenSupplySpeeds(vTokenAddress),
        rewardDistributor.rewardTokenBorrowSpeeds(vTokenAddress)
      ]);

      // 获取 XVS 价格
      const prices = await this.fetchPrices(chainKey);
      const xvsPrice = prices.XVS || 0;

      // 计算奖励 APY
      const rewardSupplyAPY = this.calculateRewardAPY(
        supplyRewardSpeed,
        xvsPrice,
        underlyingPriceUSD,
        chainKey === 'bsc' ? 10512000 : 31536000 // BSC: 3s/block, ETH: 12s/block
      );

      return {
        supplyRewardSpeed: Number(supplyRewardSpeed),
        borrowRewardSpeed: Number(borrowRewardSpeed),
        rewardAPY: rewardSupplyAPY
      };
    } catch (error) {
      console.warn(`Failed to fetch reward data for ${vTokenAddress}:`, error.message);
      return {
        supplyRewardSpeed: 0,
        borrowRewardSpeed: 0,
        rewardAPY: 0
      };
    }
  }

  // 从 Venus API 获取市场数据
  async fetchFromAPI(chainKey) {
    try {
      const config = CHAINS_CONFIG[chainKey];
      const response = await axios.get(`${config.apiUrl}/api/governance/venus`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.warn(`API fetch failed for ${chainKey}:`, error.message);
      return null;
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
        config.pools.core,
        COMPTROLLER_ABI,
        provider
      );

      // 获取所有市场
      const markets = await comptroller.getAllMarkets();
      console.log(`Found ${markets.length} markets on ${config.name}`);

      // 获取价格预言机
      let oracle;
      try {
        const oracleAddress = await comptroller.oracle();
        oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
      } catch (error) {
        console.warn(`Failed to get oracle for ${config.name}:`, error.message);
        oracle = null;
      }

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
          const [supplyRate, borrowRate, totalSupply, totalBorrows, exchangeRate, cash, underlyingAddress] = 
            await Promise.all([
              vToken.supplyRatePerBlock(),
              vToken.borrowRatePerBlock(),
              vToken.totalSupply(),
              vToken.totalBorrows(),
              vToken.exchangeRateStored(),
              vToken.getCash(),
              vToken.underlying().catch(() => '0x0000000000000000000000000000000000000000')
            ]);

          // 获取底层资产信息
          let underlyingSymbol = symbol.replace('v', '').replace('_Core', '');
          let underlyingDecimals = 18;

          if (underlyingAddress !== '0x0000000000000000000000000000000000000000') {
            try {
              const underlyingToken = new ethers.Contract(
                underlyingAddress,
                ERC20_ABI,
                provider
              );
              underlyingSymbol = await underlyingToken.symbol();
              underlyingDecimals = Number(await underlyingToken.decimals());
            } catch (e) {
              console.warn(`Failed to get underlying token for ${symbol}:`, e.message);
            }
          } else {
            // Native token (BNB/ETH)
            if (symbol.includes('BNB')) {
              underlyingSymbol = 'WBNB';
            } else if (symbol.includes('ETH')) {
              underlyingSymbol = 'ETH';
            }
          }

          // 计算 APY (区块数根据链而定)
          const blocksPerDay = chainKey === 'bsc' ? 28800 : 
                              chainKey === 'ethereum' ? 7200 : 7200;
          const daysPerYear = 365;

          // 将利率从每区块转换为年化
          const supplyRatePerDay = Number(supplyRate) * blocksPerDay / 1e18;
          const borrowRatePerDay = Number(borrowRate) * blocksPerDay / 1e18;
          
          const supplyAPY = ((1 + supplyRatePerDay) ** daysPerYear - 1) * 100;
          const borrowAPY = ((1 + borrowRatePerDay) ** daysPerYear - 1) * 100;

          // 计算 TVL (供应量 = 现金 + 借出)
          const totalSupplyUnderlying = Number(totalSupply) * Number(exchangeRate) / 1e18 / (10 ** underlyingDecimals);
          const totalBorrowsUnderlying = Number(totalBorrows) / (10 ** underlyingDecimals);
          const cashUnderlying = Number(cash) / (10 ** underlyingDecimals);
          
          // 获取市场价格（用于计算奖励 APY）
          let underlyingPriceUSD = 1; // 默认稳定币价格
          if (oracle) {
            try {
              const price = await oracle.getUnderlyingPrice(marketAddress);
              underlyingPriceUSD = parseFloat(ethers.formatUnits(price, 18));
            } catch (error) {
              console.warn(`Failed to get price for ${underlyingSymbol}:`, error.message);
              // 默认价格（简化处理）
              if (['USDC', 'USDT'].includes(underlyingSymbol)) underlyingPriceUSD = 1;
              else if (underlyingSymbol.includes('ETH')) underlyingPriceUSD = 3500; // 示例价格
              else if (underlyingSymbol.includes('BTC')) underlyingPriceUSD = 60000; // 示例价格
              else if (underlyingSymbol.includes('BNB')) underlyingPriceUSD = 600; // 示例价格
            }
          }

          const totalSupplyUSD = totalSupplyUnderlying * underlyingPriceUSD;

          // 获取奖励数据
          const rewardData = await this.fetchRewardData(
            chainKey,
            marketAddress,
            totalSupplyUSD
          );

          // 计算总 APY（基础 + 奖励）
          const totalSupplyAPY = supplyAPY + rewardData.rewardAPY;
          
          results.push({
            chain: config.name,
            market: marketAddress,
            vTokenSymbol: symbol,
            underlyingSymbol,

            underlyingPriceUSD: underlyingPriceUSD.toFixed(2),
            // APY 数据
            baseSupplyAPY: supplyAPY.toFixed(2),
            rewardSupplyAPY: rewardData.rewardAPY.toFixed(2),
            totalSupplyAPY: totalSupplyAPY.toFixed(2),
            borrowAPY: borrowAPY.toFixed(2),
            // TVL 数据
            totalSupply: totalSupplyUnderlying.toFixed(2),
            totalBorrows: totalBorrowsUnderlying.toFixed(2),
            liquidity: cashUnderlying.toFixed(2),
            totalSupplyUSD: totalSupplyUSD.toFixed(2),
            utilizationRate: totalSupplyUnderlying > 0 
              ? ((totalBorrowsUnderlying / totalSupplyUnderlying) * 100).toFixed(2) 
              : '0.00',
            // 奖励数据详情
            rewardDetails: {
              supplySpeed: rewardData.supplyRewardSpeed,
              borrowSpeed: rewardData.borrowRewardSpeed
            }
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
    console.log('开始从所有链获取数据...\n');
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

      // 添加延迟以避免 RPC 限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allResults;
  }

  // 格式化输出结果
  formatResults(results) {
    console.log('\n='.repeat(80));
    console.log('Venus Protocol 多链资产数据汇总');
    console.log('='.repeat(80));

    for (const [chainKey, chainData] of Object.entries(results)) {
      console.log(`\n📊 ${chainData.chainName}`);
      console.log('-'.repeat(80));

      if (chainData.error) {
        console.log(`❌ 错误: ${chainData.error}`);
        continue;
      }

      if (!chainData.data || chainData.data.length === 0) {
        console.log('⚠️  未找到目标资产');
        continue;
      }

      for (const asset of chainData.data) {
        console.log(`\n🪙 ${asset.underlyingSymbol} (${asset.vTokenSymbol})`);
        console.log(`   合约地址: ${asset.market}`);
        console.log(`   价格: $${asset.underlyingPriceUSD}`);
        console.log(`   📈 APY 详情:`);
        console.log(`     基础供应 APY: ${asset.baseSupplyAPY}%`);
        console.log(`     奖励供应 APY: ${asset.rewardSupplyAPY}%`);
        console.log(`     🎯 总供应 APY: ${asset.totalSupplyAPY}%`);
        console.log(`     借款 APY: ${asset.borrowAPY}%`);
        console.log(`   💰 TVL 详情:`);
        console.log(`     总供应量: ${asset.totalSupply} ${asset.underlyingSymbol} ($${asset.totalSupplyUSD})`);
        console.log(`     总借款量: ${asset.totalBorrows} ${asset.underlyingSymbol}`);
        console.log(`     可用流动性: ${asset.liquidity} ${asset.underlyingSymbol}`);
        console.log(`     利用率: ${asset.utilizationRate}%`);
        if (asset.rewardDetails.supplySpeed > 0) {
          console.log(`   🎁 奖励速度: ${asset.rewardDetails.supplySpeed} XVS/秒`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
  }

  // 导出为 JSON
  exportToJSON(results, filename = 'venus_data.json') {
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n✓ 数据已导出到 ${filename}`);
  }
}
// API 方式获取奖励 APY（备用方案）
async function fetchRewardAPYFromAPI() {
  try {
    // Venus API 可能提供奖励数据
    const response = await axios.get('https://api.venus.io/api/market', {
      timeout: 10000
    });
    
    // 解析 API 返回的奖励数据
    // 注意：API 结构可能变化，需要根据实际返回调整
    return response.data;
  } catch (error) {
    console.warn('API fetch failed for reward data:', error.message);
    return null;
  }
}

// 主函数
async function main() {
  const fetcher = new VenusDataFetcher();
  
  try {
    // 获取所有链的数据
    const results = await fetcher.fetchAllChains();
    
    // 格式化输出
    fetcher.formatResults(results);
    
    // 导出 JSON
    fetcher.exportToJSON(results);
    
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
Venus Protocol 多链资产数据汇总
================================================================================

📊 BNB Chain
--------------------------------------------------------------------------------

🪙 USDC (vUSDC)
   合约地址: 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8
   供应 APY: 0.75%
   借款 APY: 1.31%
   总供应量: 82701956.42 USDC
   总借款量: 52944254.21 USDC
   可用流动性: 29757790.45 USDC
   利用率: 64.02%

🪙 USDT (vUSDT)
   合约地址: 0xfD5840Cd36d94D7229439859C0112a4185BC0255
   供应 APY: 0.84%
   借款 APY: 1.43%
   总供应量: 266264118.11 USDT
   总借款量: 173381582.01 USDT
   可用流动性: 92882696.70 USDT
   利用率: 65.12%

🪙 ETH (vETH)
   合约地址: 0xf508fCD89b8bd15579dc79A6827cB4686A3592c8
   供应 APY: 0.28%
   借款 APY: 0.51%
   总供应量: 23974.22 ETH
   总借款量: 16363.61 ETH
   可用流动性: 7610.64 ETH
   利用率: 68.26%

🪙 BETH (vBETH)
   合约地址: 0x972207A639CC1B374B893cc33Fa251b55CEB7c07
   供应 APY: 0.00%
   借款 APY: 0.22%
   总供应量: 101.67 BETH
   总借款量: 6.01 BETH
   可用流动性: 95.66 BETH
   利用率: 5.91%

🪙 wBETH (vWBETH)
   合约地址: 0x6CFdEc747f37DAf3b87a35a1D9c8AD3063A1A8A0
   供应 APY: 0.00%
   借款 APY: 0.02%
   总供应量: 14663.52 wBETH
   总借款量: 107.91 wBETH
   可用流动性: 14555.61 wBETH
   利用率: 0.74%

🪙 WBNB (vWBNB)
   合约地址: 0x6bCa74586218dB34cdB402295796b79663d816e9
   供应 APY: 0.39%
   借款 APY: 0.85%
   总供应量: 102249.79 WBNB
   总借款量: 55103.07 WBNB
   可用流动性: 47146.77 WBNB
   利用率: 53.89%

📊 Ethereum
--------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core)
   合约地址: 0x8716554364f20BCA783cb2BAA744d39361fd1D8d
   供应 APY: 0.00%
   借款 APY: 0.02%
   总供应量: 10.79 WBTC
   总借款量: 0.03 WBTC
   可用流动性: 10.76 WBTC
   利用率: 0.23%

🪙 WETH (vWETH_Core)
   合约地址: 0x7c8ff7d2A1372433726f879BD945fFb250B94c65
   供应 APY: 0.53%
   借款 APY: 1.41%
   总供应量: 393.69 WETH
   总借款量: 184.36 WETH
   可用流动性: 209.34 WETH
   利用率: 46.83%

🪙 USDC (vUSDC_Core)
   合约地址: 0x17C07e0c232f2f80DfDbd7a95b942D893A4C5ACb
   供应 APY: 3.98%
   借款 APY: 6.80%
   总供应量: 756891.55 USDC
   总借款量: 498280.49 USDC
   可用流动性: 258611.06 USDC
   利用率: 65.83%

🪙 USDT (vUSDT_Core)
   合约地址: 0x8C3e3821259B82fFb32B2450A95d2dcbf161C24E
   供应 APY: 4.00%
   借款 APY: 6.83%
   总供应量: 2630320.97 USDT
   总借款量: 1737240.07 USDT
   可用流动性: 893097.75 USDT
   利用率: 66.05%

🪙 yvWETH-1 (vyvWETH-1_Core)
   合约地址: 0xba3916302cBA4aBcB51a01e706fC6051AaF272A0
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 0.00 yvWETH-1
   总借款量: 0.00 yvWETH-1
   可用流动性: 0.00 yvWETH-1
   利用率: 0.00%

🪙 weETHs (vweETHs_Core)
   合约地址: 0xc42E4bfb996ED35235bda505430cBE404Eb49F77
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 97.08 weETHs
   总借款量: 0.00 weETHs
   可用流动性: 97.08 weETHs
   利用率: 0.00%

📊 Arbitrum One
--------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core)
   合约地址: 0xaDa57840B372D4c28623E87FC175dE8490792811
   供应 APY: 0.01%
   借款 APY: 0.14%
   总供应量: 8.95 WBTC
   总借款量: 1.00 WBTC
   可用流动性: 7.96 WBTC
   利用率: 11.14%

🪙 WETH (vWETH_Core)
   合约地址: 0x68a34332983f4Bf866768DD6D6E638b02eF5e1f0
   供应 APY: 0.05%
   借款 APY: 0.12%
   总供应量: 156.35 WETH
   总借款量: 77.24 WETH
   可用流动性: 79.11 WETH
   利用率: 49.40%

🪙 USDC (vUSDC_Core)
   合约地址: 0x7D8609f8da70fF9027E9bc5229Af4F6727662707
   供应 APY: 0.26%
   借款 APY: 0.49%
   总供应量: 522957.97 USDC
   总借款量: 307788.88 USDC
   可用流动性: 215170.06 USDC
   利用率: 58.86%

🪙 USD₮0 (vUSDT_Core)
   合约地址: 0xB9F9117d4200dC296F9AcD1e8bE1937df834a2fD
   供应 APY: 0.21%
   借款 APY: 0.44%
   总供应量: 855925.41 USD₮0
   总借款量: 453398.13 USD₮0
   可用流动性: 402532.14 USD₮0
   利用率: 52.97%

🪙 GM (vgmWETH-USDC_Core)
   合约地址: 0x9bb8cEc9C0d46F53b4f2173BB2A0221F66c353cC
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 164129.04 GM
   总借款量: 0.00 GM
   可用流动性: 164129.04 GM
   利用率: 0.00%

🪙 GM (vgmBTC-USDC_Core)
   合约地址: 0x4f3a73f318C5EA67A86eaaCE24309F29f89900dF
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 357227.00 GM
   总借款量: 0.00 GM
   可用流动性: 357227.00 GM
   利用率: 0.00%

📊 Optimism
--------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core)
   合约地址: 0x9EfdCfC2373f81D3DF24647B1c46e15268884c46
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 0.09 WBTC
   总借款量: 0.00 WBTC
   可用流动性: 0.09 WBTC
   利用率: 0.01%

🪙 WETH (vWETH_Core)
   合约地址: 0x66d5AE25731Ce99D46770745385e662C8e0B4025
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 7.95 WETH
   总借款量: 0.04 WETH
   可用流动性: 7.91 WETH
   利用率: 0.56%

🪙 USDT (vUSDT_Core)
   合约地址: 0x37ac9731B0B02df54975cd0c7240e0977a051721
   供应 APY: 0.05%
   借款 APY: 0.18%
   总供应量: 6045.62 USDT
   总借款量: 1871.05 USDT
   可用流动性: 4174.57 USDT
   利用率: 30.95%

🪙 USDC (vUSDC_Core)
   合约地址: 0x1C9406ee95B7af55F005996947b19F91B6D55b15
   供应 APY: 0.10%
   借款 APY: 0.25%
   总供应量: 5683.63 USDC
   总借款量: 2492.16 USDC
   可用流动性: 3191.48 USDC
   利用率: 43.85%

📊 Base
--------------------------------------------------------------------------------

🪙 WETH (vWETH_Core)
   合约地址: 0xEB8A79bD44cF4500943bf94a2b4434c95C008599
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 5.86 WETH
   总借款量: 0.06 WETH
   可用流动性: 5.80 WETH
   利用率: 1.09%

🪙 USDC (vUSDC_Core)
   合约地址: 0x3cb752d175740043Ec463673094e06ACDa2F9a2e
   供应 APY: 0.27%
   借款 APY: 0.50%
   总供应量: 11405.77 USDC
   总借款量: 6817.09 USDC
   可用流动性: 4588.76 USDC
   利用率: 59.77%

🪙 wsuperOETHb (vwsuperOETHb_Core)
   合约地址: 0x75201D81B3B0b9D17b179118837Be37f64fc4930
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 0.04 wsuperOETHb
   总借款量: 0.00 wsuperOETHb
   可用流动性: 0.04 wsuperOETHb
   利用率: 0.00%

🪙 wstETH (vwstETH_Core)
   合约地址: 0x133d3BCD77158D125B75A17Cb517fFD4B4BE64C5
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 2.87 wstETH
   总借款量: 0.00 wstETH
   可用流动性: 2.87 wstETH
   利用率: 0.06%

📊 zkSync Era
--------------------------------------------------------------------------------

🪙 WBTC (vWBTC_Core)
   合约地址: 0xAF8fD83cFCbe963211FAaf1847F0F217F80B4719
   供应 APY: 0.00%
   借款 APY: 0.05%
   总供应量: 2.46 WBTC
   总借款量: 0.16 WBTC
   可用流动性: 2.29 WBTC
   利用率: 6.65%

🪙 WETH (vWETH_Core)
   合约地址: 0x1Fa916C27c7C2c4602124A14C77Dbb40a5FF1BE8
   供应 APY: 0.50%
   借款 APY: 0.72%
   总供应量: 192.39 WETH
   总借款量: 166.39 WETH
   可用流动性: 26.00 WETH
   利用率: 86.48%

🪙 USDC.e (vUSDC.e_Core)
   合约地址: 0x1aF23bD57c62A99C59aD48236553D0Dd11e49D2D
   供应 APY: 0.39%
   借款 APY: 0.60%
   总供应量: 291794.34 USDC.e
   总借款量: 209469.74 USDC.e
   可用流动性: 82321.01 USDC.e
   利用率: 71.79%

🪙 USDT (vUSDT_Core)
   合约地址: 0x69cDA960E3b20DFD480866fFfd377Ebe40bd0A46
   供应 APY: 0.45%
   借款 APY: 0.65%
   总供应量: 212447.33 USDT
   总借款量: 164086.85 USDT
   可用流动性: 48362.50 USDT
   利用率: 77.24%

🪙 USDC (vUSDC_Core)
   合约地址: 0x84064c058F2EFea4AB648bB6Bd7e40f83fFDe39a
   供应 APY: 0.35%
   借款 APY: 0.57%
   总供应量: 46712.21 USDC
   总借款量: 32023.98 USDC
   可用流动性: 14688.34 USDC
   利用率: 68.56%

🪙 wstETH (vwstETH_Core)
   合约地址: 0x03CAd66259f7F34EE075f8B62D133563D249eDa4
   供应 APY: 0.00%
   借款 APY: 0.01%
   总供应量: 2.51 wstETH
   总借款量: 0.03 wstETH
   可用流动性: 2.48 wstETH
   利用率: 1.03%

🪙 zkETH (vzkETH_Core)
   合约地址: 0xCEb7Da150d16aCE58F090754feF2775C23C8b631
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 0.04 zkETH
   总借款量: 0.00 zkETH
   可用流动性: 0.04 zkETH
   利用率: 0.00%

📊 opBNB
--------------------------------------------------------------------------------

🪙 ETH (vETH_Core)
   合约地址: 0x509e81eF638D489936FA85BC58F52Df01190d26C
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 0.68 ETH
   总借款量: 0.01 ETH
   可用流动性: 0.67 ETH
   利用率: 2.13%

🪙 USDT (vUSDT_Core)
   合约地址: 0xb7a01Ba126830692238521a1aA7E7A7509410b8e
   供应 APY: 0.04%
   借款 APY: 0.13%
   总供应量: 2835.81 USDT
   总借款量: 900.43 USDT
   可用流动性: 1935.38 USDT
   利用率: 31.75%

🪙 WBNB (vWBNB_Core)
   合约地址: 0x53d11cB8A0e5320Cd7229C3acc80d1A0707F2672
   供应 APY: 0.00%
   借款 APY: 0.00%
   总供应量: 5.85 WBNB
   总借款量: 0.00 WBNB
   可用流动性: 5.84 WBNB
   利用率: 0.04%

================================================================================
 */