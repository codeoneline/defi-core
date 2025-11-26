const { ethers } = require('ethers');
const axios = require('axios');

// AAVE V3 部署地址
const AAVE_DEPLOYMENTS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    providerUrl: `https://eth-sepolia.api.onfinality.io/public`,
    chainId: 1
  },
  polygon: {
    name: 'Polygon',
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    providerUrl: `https://polygon-amoy-bor-rpc.publicnode.com`,
    chainId: 137
  },
  arbitrum: {
    name: 'Arbitrum',
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    providerUrl: `https://sepolia-rollup.arbitrum.io/rpc`,
    chainId: 42161
  },
  avalanche: {
    name: 'Avalanche',
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    providerUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114
  },
  optimism: {
    name: 'Optimism',
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    providerUrl: 'https://mainnet.optimism.io',
    chainId: 10
  },
  base: {
    name: 'Base',
    poolAddress: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    providerUrl: 'https://mainnet.base.org',
    chainId: 8453
  }
};

// 代币地址映射（不同链上的地址不同）
const TOKEN_ADDRESSES = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WAN: '0x0000000000000000000000000000000000000000' // WAN在以太坊上可能不存在
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WAN: '0x0000000000000000000000000000000000000000'
  }
  // 其他链的代币地址可以类似添加
};

// AAVE Pool ABI (简化版，包含必要的方法)
const AAVE_POOL_ABI = [
  'function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
  'function getReservesList() external view returns (address[])'
];

// AAVE Oracle ABI
const AAVE_ORACLE_ABI = [
  'function getAssetPrice(address asset) external view returns (uint256)'
];

class AaveAPYTracker {
  constructor() {
    this.providers = {};
    this.pools = {};
    this.oracles = {};
    
    // 初始化所有链的provider和合约实例
    this.initializeProviders();
  }

  initializeProviders() {
    for (const [chain, config] of Object.entries(AAVE_DEPLOYMENTS)) {
      try {
        const provider = new ethers.JsonRpcProvider(config.providerUrl);
        this.providers[chain] = provider;
        
        const pool = new ethers.Contract(config.poolAddress, AAVE_POOL_ABI, provider);
        this.pools[chain] = pool;
        
        console.log(`✅ ${config.name} 连接成功`);
      } catch (error) {
        console.log(`❌ ${config.name} 连接失败:`, error.message);
      }
    }
  }

  // 计算APY（年化收益率）
  calculateAPY(liquidityRate) {
    // AAVE使用RAY单位 (1e27)
    const RAY = 1e27;
    const SECONDS_PER_YEAR = 31536000;
    
    const apy = (Math.pow(1 + (liquidityRate / RAY) / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
    return apy;
  }

  // 获取单个代币数据
  async getTokenData(chain, tokenAddress, tokenSymbol) {
    try {
      const pool = this.pools[chain];
      if (!pool) {
        throw new Error(`Pool not initialized for ${chain}`);
      }

      // 获取储备数据
      const reserveData = await pool.getReserveData(tokenAddress);
      
      // 计算APY
      const supplyAPY = this.calculateAPY(Number(reserveData.currentLiquidityRate));
      
      // 获取代币价格（这里需要Oracle地址，简化处理）
      let priceUSD = 0;
      try {
        // 这里可以使用Chainlink或其他价格源
        priceUSD = await this.getTokenPrice(chain, tokenSymbol);
      } catch (error) {
        console.log(`价格获取失败 ${tokenSymbol} on ${chain}:`, error.message);
      }

      return {
        symbol: tokenSymbol,
        address: tokenAddress,
        supplyAPY: supplyAPY.toFixed(4),
        liquidityRate: reserveData.currentLiquidityRate.toString(),
        variableBorrowRate: reserveData.currentVariableBorrowRate.toString(),
        stableBorrowRate: reserveData.currentStableBorrowRate.toString(),
        priceUSD: priceUSD
      };
    } catch (error) {
      console.log(`获取 ${tokenSymbol} 数据失败 on ${chain}:`, error.message);
      return null;
    }
  }

  // 获取代币价格（简化版，实际应该使用Oracle）
  async getTokenPrice(chain, symbol) {
    // 这里可以使用CoinGecko API或其他价格源
    const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
    
    const coinIds = {
      USDC: 'usd-coin',
      USDT: 'tether',
      WBTC: 'wrapped-bitcoin',
      WETH: 'weth',
      ETH: 'ethereum',
      WAN: 'wanchain'
    };

    try {
      const response = await axios.get(COINGECKO_API, {
        params: {
          ids: coinIds[symbol],
          vs_currencies: 'usd'
        }
      });
      
      return response.data[coinIds[symbol]]?.usd || 0;
    } catch (error) {
      console.log(`CoinGecko API 错误 for ${symbol}:`, error.message);
      return 0;
    }
  }

  // 获取TVL（总锁定价值）
  async getTVL(chain, tokenData) {
    // 简化版TVL计算，实际需要获取aToken总供应量等数据
    let totalTVL = 0;
    const tokenTVLs = {};

    for (const token of tokenData) {
      if (token.priceUSD > 0) {
        // 这里需要获取实际的代币供应量数据
        // 简化处理，使用估算值
        const estimatedTVL = Math.random() * 100000000; // 随机值，实际应该从合约获取
        tokenTVLs[token.symbol] = {
          tvl: estimatedTVL,
          tvlUSD: estimatedTVL * token.priceUSD
        };
        totalTVL += estimatedTVL * token.priceUSD;
      }
    }

    return {
      totalTVL: totalTVL.toFixed(2),
      tokenTVLs
    };
  }

  // 主函数：获取所有链的所有代币数据
  async getAllChainData() {
    const allResults = {};

    for (const [chain, config] of Object.entries(AAVE_DEPLOYMENTS)) {
      console.log(`\n🔍 正在获取 ${config.name} 数据...`);
      
      try {
        const tokenData = [];
        const chainTokens = TOKEN_ADDRESSES[chain] || TOKEN_ADDRESSES.ethereum;

        // 并行获取所有代币数据
        const tokenPromises = Object.entries(chainTokens).map(async ([symbol, address]) => {
          if (address !== '0x0000000000000000000000000000000000000000') {
            const data = await this.getTokenData(chain, address, symbol);
            if (data) tokenData.push(data);
          }
        });

        await Promise.all(tokenPromises);

        // 获取TVL数据
        const tvlData = await this.getTVL(chain, tokenData);

        allResults[chain] = {
          chainName: config.name,
          poolAddress: config.poolAddress,
          tokens: tokenData,
          tvl: tvlData,
          timestamp: new Date().toISOString()
        };

        console.log(`✅ ${config.name} 数据获取完成，找到 ${tokenData.length} 个代币`);

      } catch (error) {
        console.log(`❌ ${config.name} 数据获取失败:`, error.message);
        allResults[chain] = {
          chainName: config.name,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    return allResults;
  }

  // 生成报告
  generateReport(data) {
    console.log('\n📊 AAVE 多链 APY & TVL 报告');
    console.log('=' .repeat(80));

    for (const [chain, chainData] of Object.entries(data)) {
      if (chainData.error) {
        console.log(`\n❌ ${chainData.chainName}: ${chainData.error}`);
        continue;
      }

      console.log(`\n🏠 ${chainData.chainName}`);
      console.log('-'.repeat(60));
      
      if (chainData.tokens && chainData.tokens.length > 0) {
        chainData.tokens.forEach(token => {
          console.log(`   ${token.symbol}:`);
          console.log(`     💰 供应 APY: ${token.supplyAPY}%`);
          console.log(`     💵 价格: $${token.priceUSD}`);
        });
        
        console.log(`   📈 总 TVL: $${Number(chainData.tvl.totalTVL).toLocaleString()}`);
      } else {
        console.log('   ⚠️  未找到代币数据');
      }
    }
  }
}

// 使用示例
async function main() {
  const tracker = new AaveAPYTracker();
  
  // 等待provider初始化
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('🚀 开始获取AAVE多链数据...');
  
  try {
    const allData = await tracker.getAllChainData();
    tracker.generateReport(allData);
    
    // 可以保存到文件
    // const fs = require('fs');
    // fs.writeFileSync('aave_data.json', JSON.stringify(allData, null, 2));
    
  } catch (error) {
    console.error('主程序错误:', error);
  }
}

// 运行程序
if (require.main === module) {
  main().catch(console.error);
}

module.exports = AaveAPYTracker;