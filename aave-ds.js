const { ethers } = require('ethers-v5');
const axios = require('axios');

// AAVE V3 池子地址（主要链）
const AAVE_V3_POOL_ADDRESSES = {
  ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  avalanche: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  optimism: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  base: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
};

// 代币地址映射
const TOKEN_ADDRESSES = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WAN: null // WAN 在以太坊上可能不存在
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WAN: null
  }
  // 其他链的地址类似配置
};

// AAVE V3 Pool ABI (简化版本)
const AAVE_POOL_ABI = [
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))'
];

// AAVE Oracle ABI
const AAVE_ORACLE_ABI = [
  'function getAssetPrice(address asset) view returns (uint256)'
];

class AaveDataFetcher {
  constructor(chainRpcUrls) {
    this.providers = {};
    this.pools = {};
    
    // 初始化各链的provider和pool合约
    for (const [chain, rpcUrl] of Object.entries(chainRpcUrls)) {
      if (AAVE_V3_POOL_ADDRESSES[chain]) {
        this.providers[chain] = new ethers.providers.JsonRpcProvider(rpcUrl);
        this.pools[chain] = new ethers.Contract(
          AAVE_V3_POOL_ADDRESSES[chain],
          AAVE_POOL_ABI,
          this.providers[chain]
        );
      }
    }
  }

  // 计算 APY
  calculateAPY(liquidityRate, isSupply = true) {
    // AAVE 使用 RAY (10^27) 作为利率单位
    const RAY = 10 ** 27;
    const SECONDS_PER_YEAR = 31536000;
    
    const rate = Number(liquidityRate) / RAY;
    const apy = (Math.pow(1 + rate / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
    
    return apy;
  }

  // 获取储备数据
  async getReserveData(chain, assetAddress) {
    try {
      const pool = this.pools[chain];
      if (!pool) {
        throw new Error(`No pool found for chain: ${chain}`);
      }

      const reserveData = await pool.getReserveData(assetAddress);
      
      return {
        liquidityRate: reserveData.currentLiquidityRate.toString(),
        variableBorrowRate: reserveData.currentVariableBorrowRate.toString(),
        stableBorrowRate: reserveData.currentStableBorrowRate.toString(),
        liquidityIndex: reserveData.liquidityIndex.toString(),
        variableBorrowIndex: reserveData.variableBorrowIndex.toString(),
        aTokenAddress: reserveData.aTokenAddress,
        availableLiquidity: reserveData.availableLiquidity // 需要额外计算
      };
    } catch (error) {
      console.error(`Error fetching reserve data for ${chain}:`, error);
      return null;
    }
  }

  // 获取代币余额（用于计算TVL）
  async getTokenBalance(chain, tokenAddress, walletAddress) {
    try {
      const provider = this.providers[chain];
      const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      return balance.toString();
    } catch (error) {
      console.error(`Error getting token balance:`, error);
      return '0';
    }
  }

  // 获取价格数据
  async getAssetPrice(chain, assetAddress) {
    try {
      // 这里可以使用 Chainlink 或 AAVE Oracle 获取价格
      // 简化版本，实际使用时需要配置正确的 Oracle 地址
      const provider = this.providers[chain];
      // 需要根据具体链配置 Oracle 地址
      return '0';
    } catch (error) {
      console.error(`Error getting asset price:`, error);
      return '0';
    }
  }

  // 获取所有资产的 APY 和 TVL
  async getAllAssetsData() {
    const results = {};
    
    for (const [chain, tokens] of Object.entries(TOKEN_ADDRESSES)) {
      results[chain] = {};
      
      for (const [tokenSymbol, tokenAddress] of Object.entries(tokens)) {
        if (!tokenAddress) continue;
        
        try {
          const reserveData = await this.getReserveData(chain, tokenAddress);
          
          if (reserveData) {
            const supplyAPY = this.calculateAPY(reserveData.liquidityRate, true);
            const borrowAPY = this.calculateAPY(reserveData.variableBorrowRate, false);
            
            results[chain][tokenSymbol] = {
              supplyAPY,
              borrowAPY,
              liquidityRate: reserveData.liquidityRate,
              variableBorrowRate: reserveData.variableBorrowRate,
              aTokenAddress: reserveData.aTokenAddress
            };
          }
        } catch (error) {
          console.error(`Error processing ${tokenSymbol} on ${chain}:`, error);
          results[chain][tokenSymbol] = null;
        }
      }
    }
    
    return results;
  }
}

// 使用示例
async function main() {
  // 配置各链的 RPC URL
  const chainRpcUrls = {
    ethereum: process.env.ETHEREUM_RPC || 'https://eth-sepolia.api.onfinality.io/public',
    polygon: process.env.POLYGON_RPC || 'https://polygon-amoy-bor-rpc.publicnode.com',
    avalanche: process.env.AVALANCHE_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    optimism: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io'
  };

  const fetcher = new AaveDataFetcher(chainRpcUrls);
  
  try {
    const allData = await fetcher.getAllAssetsData();
    console.log('AAVE V3 APY Data:', JSON.stringify(allData, null, 2));
    
    // 保存到文件
    const fs = require('fs');
    fs.writeFileSync('aave-apy-data.json', JSON.stringify(allData, null, 2));
    console.log('Data saved to aave-apy-data.json');
    
  } catch (error) {
    console.error('Error fetching AAVE data:', error);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = AaveDataFetcher;