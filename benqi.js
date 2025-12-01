const { ethers } = require('ethers-v6');
const axios = require('axios');

// BENQI 合约配置 - 主要部署在 Avalanche C-Chain
const BENQI_CONTRACTS = {
  avalanche: {
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    comptroller: '0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4',
    markets: {
      USDC: {
        qiToken: '0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F',
        underlying: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
      },
      USDT: {
        qiToken: '0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C',
        underlying: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'
      },
      'WBTC.e': {
        qiToken: '0xe194c4c5aC32a3C9ffDb358D9Bfd523a0B6d1568',
        underlying: '0x50b7545627a5162F82A992c33b87aDc75187B218'
      },
      'WETH.e': {
        qiToken: '0x334AD834Cd4481BB02d09615E7c11a00579A7909',
        underlying: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'
      },
      AVAX: {
        qiToken: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1C',
        underlying: 'native'
      }
    }
  }
};

// QiToken ABI (只需要关键函数)
const QI_TOKEN_ABI = [
  'function exchangeRateCurrent() returns (uint256)',
  'function getCash() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function totalReserves() view returns (uint256)',
  'function supplyRatePerTimestamp() view returns (uint256)',
  'function borrowRatePerTimestamp() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)'
];

class BenqiDataFetcher {
  constructor() {
    this.providers = {};
    this.setupProviders();
  }

  setupProviders() {
    for (const [chain, config] of Object.entries(BENQI_CONTRACTS)) {
      this.providers[chain] = new ethers.JsonRpcProvider(config.rpcUrl);
    }
  }

  // 计算 APY 从每秒利率
  calculateAPY(ratePerTimestamp) {
    // Avalanche 使用每秒时间戳
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    const rate = parseFloat(ethers.formatUnits(ratePerTimestamp, 18));
    const apy = (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;
    return apy;
  }

  // 获取单个市场数据
  async getMarketData(chain, asset, config) {
    try {
      const provider = this.providers[chain];
      const qiToken = new ethers.Contract(config.qiToken, QI_TOKEN_ABI, provider);

      console.log(`正在获取 ${chain} 上的 ${asset} 数据...`);

      // 获取市场数据
      const [
        cash,
        totalBorrows,
        totalReserves,
        supplyRate,
        borrowRate,
        totalSupply,
        decimals
      ] = await Promise.all([
        qiToken.getCash(),
        qiToken.totalBorrows(),
        qiToken.totalReserves(),
        qiToken.supplyRatePerTimestamp(),
        qiToken.borrowRatePerTimestamp(),
        qiToken.totalSupply(),
        qiToken.decimals()
      ]);

      // 计算 TVL (Total Value Locked)
      // TVL = 总供应量 - 总借款
      const tvl = cash + totalBorrows - totalReserves;
      const tvlFormatted = parseFloat(ethers.formatUnits(tvl, decimals));

      // 计算 APY
      const supplyAPY = this.calculateAPY(supplyRate);
      const borrowAPY = this.calculateAPY(borrowRate);

      // 获取 USD 价格 (可选 - 需要价格预言机)
      let tvlUSD = 0;
      try {
        const price = await this.getAssetPrice(asset);
        tvlUSD = tvlFormatted * price;
      } catch (error) {
        console.log(`无法获取 ${asset} 的价格`);
      }

      return {
        chain,
        asset,
        qiTokenAddress: config.qiToken,
        supplyAPY: supplyAPY.toFixed(2) + '%',
        borrowAPY: borrowAPY.toFixed(2) + '%',
        tvl: tvlFormatted.toFixed(2),
        tvlUSD: tvlUSD > 0 ? `$${tvlUSD.toFixed(2)}` : 'N/A',
        totalSupply: parseFloat(ethers.formatUnits(totalSupply, decimals)).toFixed(2),
        totalBorrows: parseFloat(ethers.formatUnits(totalBorrows, decimals)).toFixed(2),
        cash: parseFloat(ethers.formatUnits(cash, decimals)).toFixed(2)
      };
    } catch (error) {
      console.error(`获取 ${chain} 上的 ${asset} 数据失败:`, error.message);
      return null;
    }
  }

  // 获取资产价格 (使用 CoinGecko API 或其他价格源)
  async getAssetPrice(asset) {
    const priceMap = {
      'USDC': 1,
      'USDT': 1,
      'WBTC.e': 95000, // 示例价格
      'WETH.e': 3500,  // 示例价格
      'AVAX': 45       // 示例价格
    };

    // 实际应用中应该调用价格API
    // 例如: const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    
    return priceMap[asset] || 0;
  }

  // 从 DefiLlama API 获取 TVL 数据
  async getTVLFromDefiLlama() {
    try {
      const response = await axios.get('https://api.llama.fi/protocol/benqi');
      return response.data;
    } catch (error) {
      console.error('从 DefiLlama 获取数据失败:', error.message);
      return null;
    }
  }

  // 获取所有资产数据
  async getAllMarketsData(assets = ['USDC', 'USDT', 'WBTC.e', 'WETH.e']) {
    const results = [];

    for (const [chain, config] of Object.entries(BENQI_CONTRACTS)) {
      for (const asset of assets) {
        if (config.markets[asset]) {
          const data = await this.getMarketData(chain, asset, config.markets[asset]);
          if (data) {
            results.push(data);
          }
          // 添加延迟避免 RPC 限流
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    return results;
  }

  // 格式化输出
  formatResults(results) {
    console.log('\n' + '='.repeat(100));
    console.log('BENQI 市场数据汇总');
    console.log('='.repeat(100));
    console.log(
      'Chain'.padEnd(15) +
      'Asset'.padEnd(12) +
      'Supply APY'.padEnd(15) +
      'Borrow APY'.padEnd(15) +
      'TVL'.padEnd(20) +
      'TVL (USD)'.padEnd(15)
    );
    console.log('-'.repeat(100));

    results.forEach(data => {
      console.log(
        data.chain.padEnd(15) +
        data.asset.padEnd(12) +
        data.supplyAPY.padEnd(15) +
        data.borrowAPY.padEnd(15) +
        data.tvl.padEnd(20) +
        data.tvlUSD.padEnd(15)
      );
    });

    console.log('='.repeat(100));
    console.log('\n详细数据:');
    console.log(JSON.stringify(results, null, 2));
  }
}

// 主函数
async function main() {
  console.log('开始获取 BENQI 市场数据...\n');

  const fetcher = new BenqiDataFetcher();

  // 指定要查询的资产
  const assets = ['USDC', 'USDT', 'WBTC.e', 'WETH.e'];
  
  // 如果需要包含 AVAX，添加到数组中
  // assets.push('AVAX');

  // 获取链上数据
  const results = await fetcher.getAllMarketsData(assets);

  // 格式化输出
  fetcher.formatResults(results);

  // 可选: 从 DefiLlama 获取额外数据
  console.log('\n从 DefiLlama 获取协议总览数据...');
  const defiLlamaData = await fetcher.getTVLFromDefiLlama();
  if (defiLlamaData) {
    console.log('\nBENQI 协议总 TVL:', defiLlamaData.tvl?.[0]?.totalLiquidityUSD || 'N/A');
  }
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BenqiDataFetcher, BENQI_CONTRACTS };


/**
 * 
node ./benqi.js
开始获取 BENQI 市场数据...

正在获取 avalanche 上的 USDC 数据...
正在获取 avalanche 上的 USDT 数据...
正在获取 avalanche 上的 WBTC.e 数据...
获取 avalanche 上的 WBTC.e 数据失败: bad address checksum (argument="address", value="0xe194c4c5aC32a3C9ffDb358D9Bfd523a0B6d1568", code=INVALID_ARGUMENT, version=6.15.0)
正在获取 avalanche 上的 WETH.e 数据...

====================================================================================================
BENQI 市场数据汇总
====================================================================================================
Chain          Asset       Supply APY     Borrow APY     TVL                 TVL (USD)      
----------------------------------------------------------------------------------------------------
avalanche      USDC        4.72%          9.44%          2048.37             $2048.37       
avalanche      USDT        82.76%         111.08%        2709.02             $2709.02       
avalanche      WETH.e      0.48%          2.40%          11868796635028.08   $41540788222598280.00
====================================================================================================

详细数据:
[
  {
    "chain": "avalanche",
    "asset": "USDC",
    "qiTokenAddress": "0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F",
    "supplyAPY": "4.72%",
    "borrowAPY": "9.44%",
    "tvl": "2048.37",
    "tvlUSD": "$2048.37",
    "totalSupply": "7530704.73",
    "totalBorrows": "1232.42",
    "cash": "5268.71"
  },
  {
    "chain": "avalanche",
    "asset": "USDT",
    "qiTokenAddress": "0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C",
    "supplyAPY": "82.76%",
    "borrowAPY": "111.08%",
    "tvl": "2709.02",
    "tvlUSD": "$2709.02",
    "totalSupply": "7122040.53",
    "totalBorrows": "2733.45",
    "cash": "6368.19"
  },
  {
    "chain": "avalanche",
    "asset": "WETH.e",
    "qiTokenAddress": "0x334AD834Cd4481BB02d09615E7c11a00579A7909",
    "supplyAPY": "0.48%",
    "borrowAPY": "2.40%",
    "tvl": "11868796635028.08",
    "tvlUSD": "$41540788222598280.00",
    "totalSupply": "56469.66",
    "totalBorrows": "3218794877982.58",
    "cash": "9555380486707.94"
  }
]

从 DefiLlama 获取协议总览数据...
从 DefiLlama 获取数据失败: Request failed with status code 502
 */