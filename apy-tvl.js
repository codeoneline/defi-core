
const BASE_URL = 'https://api.llama.fi';
const YIELDS_URL = 'https://yields.llama.fi';

const symbols = {
  'USDC':{},
  'USDT':{},
  'WETH':{},
  'WBTC':{},
}
// wan
// sushiswap - WAN-USDT, 0.07
const projects = {
  'aave-v3': {

  },
  // morpho-v0-aavev2
  'compound-v3': {

  },
  'compound-v2': {

  },
  'venus-core-pool': {

  },
  'benqi-lending': {

  }
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

function filterPoolsByAsset(pools, symbol) {
  return pools.data.filter(pool => {
    const poolSymbol = pool.symbol?.toUpperCase() || '';
    return poolSymbol.includes(symbol.toUpperCase());
  });
}

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
        // tvlUsd > 50w
        return (p .tvlUsd > 500000) && keywords.some(keyword => p.project.includes(keyword))
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

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
async function main() {
  try {
    // 示例 1: 获取 ETH 的 APY 和 TVL
    await getAssetAPYAndTVL('USDC');
  } catch (error) {
    console.error('执行失败:', error);
  }
}

main()