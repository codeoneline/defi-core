const { ethers } = require('ethers-v6');

// Compound V3 (Comet) 在各个链上的部署地址配置
const COMPOUND_DEPLOYMENTS = {
  ethereum: {
    chainId: 1,
    rpcUrl: 'https://ethereum.publicnode.com', // 可替换为你的 RPC
    markets: {
      USDC: {
        comet: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
        baseToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      },
      WETH: {
        comet: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
        baseToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      }
    }
  },
  arbitrum: {
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    markets: {
      USDC: {
        comet: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA',
        baseToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC native
      },
      'USDC.e': {
        comet: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
        baseToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC.e bridged
      }
    }
  },
  base: {
    chainId: 8453,
    rpcUrl: 'https://base.public.blockpi.network/v1/rpc/public',
    markets: {
      USDC: {
        comet: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
        baseToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      },
      WETH: {
        comet: '0x46e6b214b524310239732D51387075E0e70970bf',
        baseToken: '0x4200000000000000000000000000000000000006', // WETH
      },
      'USDbC': {
        comet: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
        baseToken: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
      }
    }
  },
  optimism: {
    chainId: 10,
    rpcUrl: 'https://optimism.publicnode.com',
    markets: {
      USDC: {
        comet: '0x2e44e174f7D53F0212823acC11C01A11d58c5bCB',
        baseToken: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC native
      },
      WETH: {
        comet: '0xE36A30D249f7761327fd973001A32010b521b6Fd',
        baseToken: '0x4200000000000000000000000000000000000006', // WETH
      }
    }
  },
  polygon: {
    chainId: 137,
    rpcUrl: 'https://polygon-mumbai-bor.publicnode.com',
    markets: {
      USDC: {
        comet: '0xF25212E676D1F7F89Cd72fFEe66158f541246445',
        baseToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC native
      },
      'USDC.e': {
        comet: '0xaeB318360f27748Acb200CE616E389A6C9409a07',
        baseToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e bridged
      }
    }
  }
};

// Comet ABI - 只包含我们需要的函数
const COMET_ABI = [
  'function getSupplyRate(uint utilization) public view returns (uint64)',
  'function getBorrowRate(uint utilization) public view returns (uint64)',
  'function getUtilization() public view returns (uint)',
  'function totalSupply() external view returns (uint256)',
  'function totalBorrow() external view returns (uint256)',
  'function baseToken() external view returns (address)',
  'function baseScale() external view returns (uint)',
  'function baseIndexScale() external view returns (uint64)',
  'function numAssets() external view returns (uint8)',
  'function getAssetInfo(uint8 i) external view returns (tuple(uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap))',
  'function balanceOf(address account) external view returns (uint256)',
  'function borrowBalanceOf(address account) external view returns (uint256)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// 工具函数:将利率从每秒转换为年化百分比
function convertRateToAPY(ratePerSecond) {
  const SECONDS_PER_YEAR = 31536000;
  // ratePerSecond 是以 1e18 为单位的
  const rate = parseFloat(ethers.formatUnits(ratePerSecond, 18));
  const apy = (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;
  return apy;
}

// 获取单个市场的数据
async function getMarketData(provider, marketConfig, marketName, chainName) {
  try {
    const comet = new ethers.Contract(marketConfig.comet, COMET_ABI, provider);
    const baseToken = new ethers.Contract(marketConfig.baseToken, ERC20_ABI, provider);

    // 获取基础信息
    const [totalSupply, totalBorrow, utilization, baseScale, symbol, decimals] = await Promise.all([
      comet.totalSupply(),
      comet.totalBorrow(),
      comet.getUtilization(),
      comet.baseScale(),
      baseToken.symbol(),
      baseToken.decimals()
    ]);

    // 计算 APY
    const supplyRate = await comet.getSupplyRate(utilization);
    const borrowRate = await comet.getBorrowRate(utilization);
    
    const supplyAPY = convertRateToAPY(supplyRate);
    const borrowAPY = convertRateToAPY(borrowRate);

    // 计算 TVL (totalSupply - totalBorrow)
    const tvlRaw = totalSupply - totalBorrow;
    const tvl = parseFloat(ethers.formatUnits(tvlRaw, decimals));

    // 格式化总供应和总借贷
    const totalSupplyFormatted = parseFloat(ethers.formatUnits(totalSupply, decimals));
    const totalBorrowFormatted = parseFloat(ethers.formatUnits(totalBorrow, decimals));

    return {
      chain: chainName,
      market: marketName,
      comet: marketConfig.comet,
      baseToken: symbol,
      supplyAPY: supplyAPY.toFixed(2) + '%',
      borrowAPY: borrowAPY.toFixed(2) + '%',
      tvl: `$${tvl.toFixed(2)}`,
      totalSupply: `$${totalSupplyFormatted.toFixed(2)}`,
      totalBorrow: `$${totalBorrowFormatted.toFixed(2)}`,
      utilization: (parseFloat(ethers.formatUnits(utilization, 18)) * 100).toFixed(2) + '%'
    };
  } catch (error) {
    console.error(`Error fetching data for ${chainName} - ${marketName}:`, error.message);
    return null;
  }
}

// 获取所有支持的抵押品资产
async function getCollateralAssets(provider, cometAddress) {
  try {
    const comet = new ethers.Contract(cometAddress, COMET_ABI, provider);
    const numAssets = await comet.numAssets();
    
    const collateralAssets = [];
    for (let i = 0; i < numAssets; i++) {
      const assetInfo = await comet.getAssetInfo(i);
      const token = new ethers.Contract(assetInfo.asset, ERC20_ABI, provider);
      const symbol = await token.symbol();
      collateralAssets.push({
        symbol,
        address: assetInfo.asset,
        borrowCollateralFactor: (parseFloat(assetInfo.borrowCollateralFactor) / 1e18 * 100).toFixed(2) + '%',
        liquidateCollateralFactor: (parseFloat(assetInfo.liquidateCollateralFactor) / 1e18 * 100).toFixed(2) + '%',
        supplyCap: ethers.formatUnits(assetInfo.supplyCap, await token.decimals())
      });
    }
    
    return collateralAssets;
  } catch (error) {
    console.error(`Error fetching collateral assets:`, error.message);
    return [];
  }
}

// 主函数
async function main() {
  console.log('='.repeat(80));
  console.log('Compound V3 (Comet) 多链数据获取');
  console.log('='.repeat(80));
  console.log();

  const allResults = [];

  // 遍历所有链
  for (const [chainName, chainConfig] of Object.entries(COMPOUND_DEPLOYMENTS)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`链: ${chainName.toUpperCase()} (Chain ID: ${chainConfig.chainId})`);
    console.log(`RPC: ${chainConfig.rpcUrl}`);
    console.log('='.repeat(80));

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

    // 遍历该链上的所有市场
    for (const [marketName, marketConfig] of Object.entries(chainConfig.markets)) {
      console.log(`\n处理市场: ${marketName}`);
      
      const marketData = await getMarketData(provider, marketConfig, marketName, chainName);
      
      if (marketData) {
        allResults.push(marketData);
        
        console.log(`  Comet 地址: ${marketData.comet}`);
        console.log(`  基础资产: ${marketData.baseToken}`);
        console.log(`  供应 APY: ${marketData.supplyAPY}`);
        console.log(`  借贷 APY: ${marketData.borrowAPY}`);
        console.log(`  TVL: ${marketData.tvl}`);
        console.log(`  总供应: ${marketData.totalSupply}`);
        console.log(`  总借贷: ${marketData.totalBorrow}`);
        console.log(`  利用率: ${marketData.utilization}`);

        // 获取并显示抵押品资产
        console.log(`\n  支持的抵押品资产:`);
        const collateralAssets = await getCollateralAssets(provider, marketConfig.comet);
        collateralAssets.forEach(asset => {
          console.log(`    - ${asset.symbol}`);
          console.log(`      地址: ${asset.address}`);
          console.log(`      借贷抵押率: ${asset.borrowCollateralFactor}`);
          console.log(`      清算抵押率: ${asset.liquidateCollateralFactor}`);
        });
      }
    }
  }

  // 汇总表格
  console.log('\n\n' + '='.repeat(80));
  console.log('汇总数据');
  console.log('='.repeat(80));
  console.log();
  console.table(allResults);

  // 筛选特定资产的数据 (USDC, USDT, WBTC, ETH/WETH)
  console.log('\n' + '='.repeat(80));
  console.log('目标资产筛选 (USDC, USDT, WBTC, ETH/WETH)');
  console.log('='.repeat(80));
  
  const targetAssets = allResults.filter(result => 
    ['USDC', 'USDT', 'WBTC', 'WETH', 'ETH', 'USDbC', 'USDC.e'].includes(result.baseToken)
  );
  
  console.table(targetAssets);

  console.log('\n注意:');
  console.log('1. WAN (Wanchain) 不是 Compound V3 支持的资产');
  console.log('2. USDT 目前不是 Compound V3 的基础借贷资产');
  console.log('3. 以上数据仅包含可以直接借贷的基础资产 (base assets)');
  console.log('4. WBTC, LINK, UNI, COMP 等通常作为抵押品资产,不能直接借出');
  console.log('5. TVL 计算方式: 总供应 - 总借贷');
}

// 运行主函数
main()
  .then(() => {
    console.log('\n数据获取完成!');
    process.exit(0);
  })
  .catch(error => {
    console.error('发生错误:', error);
    process.exit(1);
  });


/**
================================================================================
目标资产筛选 (USDC, USDT, WBTC, ETH/WETH)
================================================================================
┌─────────┬────────────┬──────────┬──────────────────────────────────────────────┬───────────┬───────────┬───────────┬────────────────┬─────────────────┬─────────────────┬─────────────┐
│ (index) │   chain    │  market  │                    comet                     │ baseToken │ supplyAPY │ borrowAPY │      tvl       │   totalSupply   │   totalBorrow   │ utilization │
├─────────┼────────────┼──────────┼──────────────────────────────────────────────┼───────────┼───────────┼───────────┼────────────────┼─────────────────┼─────────────────┼─────────────┤
│    0    │ 'ethereum' │  'USDC'  │ '0xc3d688B66703497DAA19211EEdff47f25384cdc3' │  'USDC'   │  '3.18%'  │  '4.00%'  │ '$53352774.57' │ '$412650588.87' │ '$359297814.29' │  '87.07%'   │
│    1    │ 'ethereum' │  'WETH'  │ '0xA17581A9E3356d9A858b789D68B4d866e593aE94' │  'WETH'   │  '1.89%'  │  '2.37%'  │   '$9922.00'   │   '$73435.27'   │   '$63513.27'   │  '86.49%'   │
│    2    │ 'arbitrum' │  'USDC'  │ '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA' │  'USDC'   │  '3.18%'  │  '4.26%'  │  '$122900.81'  │  '$622018.64'   │  '$499117.83'   │  '80.24%'   │
│    3    │ 'arbitrum' │ 'USDC.e' │ '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' │  'USDC'   │  '2.86%'  │  '3.75%'  │ '$5591116.11'  │ '$25910954.29'  │ '$20319838.18'  │  '78.42%'   │
│    4    │   'base'   │  'USDC'  │ '0xb125E6687d4313864e53df431d5425969c15Eb2F' │  'USDC'   │  '4.25%'  │  '5.16%'  │ '$1406349.12'  │ '$14479848.57'  │ '$13073499.45'  │  '90.29%'   │
│    5    │   'base'   │  'WETH'  │ '0x46e6b214b524310239732D51387075E0e70970bf' │  'WETH'   │  '1.73%'  │  '2.26%'  │   '$498.88'    │   '$2423.41'    │   '$1924.53'    │  '79.41%'   │
│    6    │   'base'   │ 'USDbC'  │ '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' │  'USDbC'  │  '0.85%'  │  '6.71%'  │  '$47570.11'   │   '$82602.20'   │   '$35032.09'   │  '42.41%'   │
│    7    │ 'optimism' │  'USDC'  │ '0x2e44e174f7D53F0212823acC11C01A11d58c5bCB' │  'USDC'   │  '3.26%'  │  '4.06%'  │  '$440329.99'  │  '$4086806.00'  │  '$3646476.00'  │  '89.23%'   │
│    8    │ 'optimism' │  'WETH'  │ '0xE36A30D249f7761327fd973001A32010b521b6Fd' │  'WETH'   │  '1.66%'  │  '2.20%'  │   '$468.09'    │   '$1962.59'    │   '$1494.50'    │  '76.15%'   │
└─────────┴────────────┴──────────┴──────────────────────────────────────────────┴───────────┴───────────┴───────────┴────────────────┴─────────────────┴─────────────────┴─────────────┘
 */