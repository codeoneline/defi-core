const axios = require('axios');
const fs = require('fs')
const path = require('path')
// https://gateway-arbitrum.network.thegraph.com/api/5a1340b49fa9efe0021452daa260564e/subgraphs/id/Htf6Hh1qgkvxQxqbcv4Jp5AatsaiY5dNLVcySkpCaxQ8

// DeFiLlama API 基础 URL
const BASE_URL = 'https://api.llama.fi';
const YIELDS_URL = 'https://yields.llama.fi';

/**
 * 获取所有协议的 TVL 数据
 */
async function getAllProtocolsTVL() {
  try {
    const response = await axios.get(`${BASE_URL}/protocols`);
    return response.data;
  } catch (error) {
    console.error('获取协议 TVL 失败:', error.message);
    throw error;
  }
}

/**
 * 获取特定协议的详细信息（包括链上 TVL 分布）
 */
async function getProtocolDetails(protocolSlug) {
  try {
    const response = await axios.get(`${BASE_URL}/protocol/${protocolSlug}`);
    return response.data;
  } catch (error) {
    console.error(`获取 ${protocolSlug} 详情失败:`, error.message);
    throw error;
  }
}

/**
 * 获取所有收益池的 APY 数据
 */
async function getAllYieldPools() {
  try {
    const response = await axios.get(`${YIELDS_URL}/pools`);
    return response.data;
  } catch (error) {
    console.error('获取收益池失败:', error.message);
    throw error;
  }
}

/**
 * 筛选包含特定资产的池子
 * @param {Array} pools - 所有池子数据
 * @param {string} symbol - 资产符号，如 'ETH'
 */
function filterPoolsByAsset(pools, symbol) {
  return pools.data.filter(pool => {
    const poolSymbol = pool.symbol?.toUpperCase() || '';
    return poolSymbol.includes(symbol.toUpperCase());
  });
}

/**
 * 格式化输出池子信息
 */
function formatPoolInfo(pool) {
  return {
    协议名称: pool.project,
    池子: pool.symbol,
    链: pool.chain,
    APY: `${pool.apy?.toFixed(2)}%` || 'N/A',
    TVL: `$${(pool.tvlUsd / 1000000).toFixed(2)}M`,
    APY基础: `${pool.apyBase?.toFixed(2)}%` || '0%',
    APY奖励: `${pool.apyReward?.toFixed(2)}%` || '0%',
    池子ID: pool.pool
  };
}

/**
 * 主函数：获取特定资产的 APY 和 TVL
 */
async function getAssetAPYAndTVL(assetSymbol = 'ETH') {
  try {
    console.log(`\n正在获取 ${assetSymbol} 相关的 DeFi 数据...\n`);

    // 1. 获取所有收益池
    const allPools = await getAllYieldPools();
    console.log(`✓ 已获取 ${allPools.data.length} 个收益池数据`);

    // 2. 筛选包含目标资产的池子
    const assetPools = filterPoolsByAsset(allPools, assetSymbol);
    console.log(`✓ 找到 ${assetPools.length} 个包含 ${assetSymbol} 的池子\n`);

    // 3. 按 APY 排序, 或按tvlUsd排序
    const keywords = ['aave', 'compound', 'venus', 'benqi'];
    // const keywords = ['venus'];
    const sortedPools = assetPools
      .filter(p => {
        return keywords.some(keyword => p.project.includes(keyword))
      })
      // .sort((a, b) => b.apy - a.apy);
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
      // sortedPools[]
      // {
      //   chain: "BSC",
      //   project: "venus-core-pool",
      //   symbol: "USDC",
      //   tvlUsd: 29573429,
      //   apyBase: 3.04712,
      //   apyReward: 0,
      //   apy: 3.04712,
      //   rewardTokens: [
      //     "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
      //   ],
      //   pool: "89eba1e5-1b1b-47b6-958b-38138a04c244",
      //   apyPct1D: 0.03349,
      //   apyPct7D: 0.16256,
      //   apyPct30D: -6.57234,
      //   stablecoin: true,
      //   ilRisk: "no",
      //   exposure: "single",
      //   predictions: {
      //     predictedClass: "Stable/Up",
      //     predictedProbability: 80,
      //     binnedConfidence: 3,
      //   },
      //   poolMeta: null,
      //   mu: 5.33656,
      //   sigma: 0.19019,
      //   count: 1244,
      //   outlier: false,
      //   underlyingTokens: [
      //     "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      //   ],
      //   il7d: null,
      //   apyBase7d: null,
      //   apyMean30d: 3.63862,
      //   volumeUsd1d: null,
      //   volumeUsd7d: null,
      //   apyBaseInception: null,
      // }

    let defiPoolPath = path.resolve(__dirname, "./defi-pool.json")
    fs.writeFileSync(defiPoolPath, JSON.stringify(sortedPools, null, 2))

    // 4. 显示前 10 个最高 APY 的池子
    console.log(`📊 ${assetSymbol} 收益率排行榜（前10）:\n`);
    // sortedPools.slice(0, 10).forEach((pool, index) => {
    sortedPools.forEach((pool, index) => {
      const info = formatPoolInfo(pool);
      console.log(`${index + 1}. ${info.协议名称} - ${info.池子}`);
      console.log(`   链: ${info.链}`);
      console.log(`   APY: ${info.APY} (基础: ${info.APY基础} + 奖励: ${info.APY奖励})`);
      console.log(`   TVL: ${info.TVL}`);
      console.log('');
    });

    // 5. 计算统计数据
    const totalTVL = assetPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0);
    const avgAPY = sortedPools.reduce((sum, pool) => sum + pool.apy, 0) / sortedPools.length;

    console.log(`\n📈 ${assetSymbol} 统计摘要:`);
    console.log(`   总 TVL: $${(totalTVL / 1000000).toFixed(2)}M`);
    console.log(`   平均 APY: ${avgAPY.toFixed(2)}%`);
    console.log(`   最高 APY: ${sortedPools[0]?.apy.toFixed(2)}%`);
    console.log(`   池子数量: ${assetPools.length}`);

    return {
      pools: sortedPools.map(formatPoolInfo),
      stats: {
        totalTVL,
        avgAPY,
        maxAPY: sortedPools[0]?.apy,
        poolCount: assetPools.length
      }
    };

  } catch (error) {
    console.error('❌ 获取数据失败:', error.message);
    throw error;
  }
}

/**
 * 获取特定协议在不同链上的 TVL 分布
 */
async function getProtocolTVLByChain(protocolName) {
  try {
    const protocols = await getAllProtocolsTVL();
    const protocol = protocols.find(p => 
      p.name.toLowerCase() === protocolName.toLowerCase() ||
      p.slug.toLowerCase() === protocolName.toLowerCase()
    );

    if (!protocol) {
      console.log(`未找到协议: ${protocolName}`);
      return null;
    }

    const details = await getProtocolDetails(protocol.slug);
    
    console.log(`\n📊 ${protocol.name} TVL 分布:\n`);
    console.log(`总 TVL: $${(protocol.tvl / 1000000).toFixed(2)}M`);
    console.log(`\n各链 TVL:`);
    
    if (details.chainTvls) {
      Object.entries(details.chainTvls).forEach(([chain, tvl]) => {
        if (typeof tvl === 'number') {
          console.log(`  ${chain}: $${(tvl / 1000000).toFixed(2)}M`);
        }
      });
    }

    return details;
  } catch (error) {
    console.error('获取协议 TVL 分布失败:', error.message);
    throw error;
  }
}

// 使用示例
async function main() {
  try {
    // 示例 1: 获取 ETH 的 APY 和 TVL
    await getAssetAPYAndTVL('BTC');

    // 示例 2: 获取 USDC 的数据
    // await getAssetAPYAndTVL('USDC');

    // 示例 3: 获取特定协议的 TVL 分布
    // await getProtocolTVLByChain('Aave');

  } catch (error) {
    console.error('执行失败:', error);
  }
}

// 运行主函数
main();

// 导出函数供其他模块使用
module.exports = {
  getAllProtocolsTVL,
  getProtocolDetails,
  getAllYieldPools,
  filterPoolsByAsset,
  getAssetAPYAndTVL,
  getProtocolTVLByChain
};