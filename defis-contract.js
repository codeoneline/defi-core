const { ethers } = require('ethers');

// ==================== 合约地址配置 ====================

const CONTRACTS = {
  // Compound V2 (以太坊主网)
  compound: {
    network: 'ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    comptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
    tokens: {
      cETH: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
      cUSDC: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
      cDAI: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      cWBTC: '0xccF4429DB6322D5C611ee964527D42E5d685DD6a',
    }
  },
  
  // Venus (BSC)
  venus: {
    network: 'bsc',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    comptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384',
    tokens: {
      vBNB: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
      vETH: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8',
      vBUSD: '0x95c78222B3D6e262426483D42CfA53685A67Ab9D',
      vUSDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
    }
  },
  
  // Benqi (Avalanche)
  benqi: {
    network: 'avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    comptroller: '0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4',
    tokens: {
      qiAVAX: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
      qiETH: '0x334AD834Cd4481BB02d09615E7c11a00579A7909',
      qiUSDC: '0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F',
      qiWBTC: '0xe194c4c5aC32a3C9ffDb358d9Bfd523a0B6d1568',
    }
  },
  
  // MakerDAO (以太坊主网)
  makerdao: {
    network: 'ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    pot: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7', // DSR 合约
    daiToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  }
};

// ==================== ABI 定义 ====================

// Compound/Venus/Benqi cToken ABI (相似架构)
const CTOKEN_ABI = [
  'function supplyRatePerBlock() external view returns (uint)',
  'function borrowRatePerBlock() external view returns (uint)',
  'function totalSupply() external view returns (uint)',
  'function totalBorrows() external view returns (uint)',
  'function getCash() external view returns (uint)',
  'function exchangeRateStored() external view returns (uint)',
  'function decimals() external view returns (uint8)',
];

// Compound Comptroller ABI
const COMPTROLLER_ABI = [
  'function getAllMarkets() external view returns (address[])',
];

// MakerDAO Pot (DSR) ABI
const POT_ABI = [
  'function dsr() external view returns (uint)',
  'function chi() external view returns (uint)',
  'function Pie() external view returns (uint)',
  'function pie(address) external view returns (uint)',
];

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address) external view returns (uint)',
  'function decimals() external view returns (uint8)',
];

// ==================== 工具函数 ====================

/**
 * 初始化 Provider
 */
function getProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Compound V2: 计算 APY (每区块复利)
 * APY = (((Rate / 1e18 * BlocksPerDay) + 1) ^ DaysPerYear) - 1
 */
function calculateCompoundAPY(ratePerBlock, blocksPerDay = 7200) {
  const rate = Number(ratePerBlock) / 1e18;
  const dailyRate = rate * blocksPerDay;
  const apy = Math.pow(1 + dailyRate, 365) - 1;
  return apy * 100;
}

/**
 * Venus: 计算 APY (BSC 每3秒一个块)
 */
function calculateVenusAPY(ratePerBlock) {
  const blocksPerDay = 28800; // BSC: 3秒/块
  return calculateCompoundAPY(ratePerBlock, blocksPerDay);
}

/**
 * Benqi: 计算 APY (Avalanche 每2秒一个块)
 */
function calculateBenqiAPY(ratePerBlock) {
  const blocksPerDay = 43200; // Avalanche: 2秒/块
  return calculateCompoundAPY(ratePerBlock, blocksPerDay);
}

/**
 * MakerDAO: 计算 DSR APY
 * DSR 是每秒复利，返回值是 RAY (10^27)
 */
function calculateMakerDSR(dsr) {
  const RAY = 1e27;
  const SECONDS_PER_YEAR = 31536000;
  const rate = Number(dsr) / RAY;
  // APY = (1 + rate)^seconds_per_year - 1
  const apy = Math.pow(rate, SECONDS_PER_YEAR) - 1;
  return apy * 100;
}

// ==================== Compound V2 ====================

async function getCompoundData(tokenSymbol = 'cETH') {
  try {
    console.log(`\n=== Compound V2 - ${tokenSymbol} ===`);
    
    const config = CONTRACTS.compound;
    const provider = getProvider(config.rpcUrl);
    const tokenAddress = config.tokens[tokenSymbol];
    
    if (!tokenAddress) {
      throw new Error(`未找到 ${tokenSymbol} 地址`);
    }
    
    const cToken = new ethers.Contract(tokenAddress, CTOKEN_ABI, provider);
    
    // 获取利率
    const supplyRate = await cToken.supplyRatePerBlock();
    const borrowRate = await cToken.borrowRatePerBlock();
    
    // 获取 TVL 相关数据
    const totalSupply = await cToken.totalSupply();
    const totalBorrows = await cToken.totalBorrows();
    const cash = await cToken.getCash();
    const exchangeRate = await cToken.exchangeRateStored();
    
    // 计算 APY
    const supplyAPY = calculateCompoundAPY(supplyRate);
    const borrowAPY = calculateCompoundAPY(borrowRate);
    
    // 计算 TVL (cToken 数量 * 汇率 / 1e18)
    const tvl = (Number(totalSupply) * Number(exchangeRate)) / 1e36;
    const borrowed = Number(totalBorrows) / 1e18;
    const available = Number(cash) / 1e18;
    
    const result = {
      platform: 'Compound V2',
      token: tokenSymbol,
      supplyAPY: supplyAPY.toFixed(4) + '%',
      borrowAPY: borrowAPY.toFixed(4) + '%',
      tvl: tvl.toFixed(2),
      totalBorrowed: borrowed.toFixed(2),
      availableLiquidity: available.toFixed(2),
    };
    
    console.log('存款 APY:', result.supplyAPY);
    console.log('借款 APY:', result.borrowAPY);
    console.log('TVL:', result.tvl);
    console.log('已借出:', result.totalBorrowed);
    console.log('可用流动性:', result.availableLiquidity);
    
    return result;
  } catch (error) {
    console.error(`❌ Compound 数据获取失败:`, error.message);
    throw error;
  }
}

// ==================== Venus Protocol ====================

async function getVenusData(tokenSymbol = 'vBNB') {
  try {
    console.log(`\n=== Venus Protocol - ${tokenSymbol} ===`);
    
    const config = CONTRACTS.venus;
    const provider = getProvider(config.rpcUrl);
    const tokenAddress = config.tokens[tokenSymbol];
    
    if (!tokenAddress) {
      throw new Error(`未找到 ${tokenSymbol} 地址`);
    }
    
    const vToken = new ethers.Contract(tokenAddress, CTOKEN_ABI, provider);
    
    // 获取利率
    const supplyRate = await vToken.supplyRatePerBlock();
    const borrowRate = await vToken.borrowRatePerBlock();
    
    // 获取 TVL 数据
    const totalSupply = await vToken.totalSupply();
    const totalBorrows = await vToken.totalBorrows();
    const cash = await vToken.getCash();
    const exchangeRate = await vToken.exchangeRateStored();
    
    // 计算 APY
    const supplyAPY = calculateVenusAPY(supplyRate);
    const borrowAPY = calculateVenusAPY(borrowRate);
    
    // 计算 TVL
    const tvl = (Number(totalSupply) * Number(exchangeRate)) / 1e36;
    const borrowed = Number(totalBorrows) / 1e18;
    const available = Number(cash) / 1e18;
    
    const result = {
      platform: 'Venus',
      token: tokenSymbol,
      supplyAPY: supplyAPY.toFixed(4) + '%',
      borrowAPY: borrowAPY.toFixed(4) + '%',
      tvl: tvl.toFixed(2),
      totalBorrowed: borrowed.toFixed(2),
      availableLiquidity: available.toFixed(2),
    };
    
    console.log('存款 APY:', result.supplyAPY);
    console.log('借款 APY:', result.borrowAPY);
    console.log('TVL:', result.tvl);
    console.log('已借出:', result.totalBorrowed);
    console.log('可用流动性:', result.availableLiquidity);
    
    return result;
  } catch (error) {
    console.error(`❌ Venus 数据获取失败:`, error.message);
    throw error;
  }
}

// ==================== Benqi Protocol ====================

async function getBenqiData(tokenSymbol = 'qiAVAX') {
  try {
    console.log(`\n=== Benqi Protocol - ${tokenSymbol} ===`);
    
    const config = CONTRACTS.benqi;
    const provider = getProvider(config.rpcUrl);
    const tokenAddress = config.tokens[tokenSymbol];
    
    if (!tokenAddress) {
      throw new Error(`未找到 ${tokenSymbol} 地址`);
    }
    
    const qiToken = new ethers.Contract(tokenAddress, CTOKEN_ABI, provider);
    
    // 获取利率
    const supplyRate = await qiToken.supplyRatePerBlock();
    const borrowRate = await qiToken.borrowRatePerBlock();
    
    // 获取 TVL 数据
    const totalSupply = await qiToken.totalSupply();
    const totalBorrows = await qiToken.totalBorrows();
    const cash = await qiToken.getCash();
    const exchangeRate = await qiToken.exchangeRateStored();
    
    // 计算 APY
    const supplyAPY = calculateBenqiAPY(supplyRate);
    const borrowAPY = calculateBenqiAPY(borrowRate);
    
    // 计算 TVL
    const tvl = (Number(totalSupply) * Number(exchangeRate)) / 1e36;
    const borrowed = Number(totalBorrows) / 1e18;
    const available = Number(cash) / 1e18;
    
    const result = {
      platform: 'Benqi',
      token: tokenSymbol,
      supplyAPY: supplyAPY.toFixed(4) + '%',
      borrowAPY: borrowAPY.toFixed(4) + '%',
      tvl: tvl.toFixed(2),
      totalBorrowed: borrowed.toFixed(2),
      availableLiquidity: available.toFixed(2),
    };
    
    console.log('存款 APY:', result.supplyAPY);
    console.log('借款 APY:', result.borrowAPY);
    console.log('TVL:', result.tvl);
    console.log('已借出:', result.totalBorrowed);
    console.log('可用流动性:', result.availableLiquidity);
    
    return result;
  } catch (error) {
    console.error(`❌ Benqi 数据获取失败:`, error.message);
    throw error;
  }
}

// ==================== MakerDAO DSR ====================

async function getMakerDAOData() {
  try {
    console.log(`\n=== MakerDAO - DAI Savings Rate ===`);
    
    const config = CONTRACTS.makerdao;
    const provider = getProvider(config.rpcUrl);
    
    const pot = new ethers.Contract(config.pot, POT_ABI, provider);
    const dai = new ethers.Contract(config.daiToken, ERC20_ABI, provider);
    
    // 获取 DSR 利率
    const dsr = await pot.dsr();
    
    // 获取 TVL (锁定在 DSR 合约中的 DAI 总量)
    const totalDaiInDSR = await dai.balanceOf(config.pot);
    
    // 获取 chi (利率累积器)
    const chi = await pot.chi();
    
    // 获取总 pie (标准化余额)
    const totalPie = await pot.Pie();
    
    // 计算 APY
    const apy = calculateMakerDSR(dsr);
    
    const tvl = Number(totalDaiInDSR) / 1e18;
    
    const result = {
      platform: 'MakerDAO',
      product: 'DAI Savings Rate',
      apy: apy.toFixed(4) + '%',
      tvl: tvl.toFixed(2) + ' DAI',
      chi: (Number(chi) / 1e27).toFixed(6),
      totalPie: (Number(totalPie) / 1e18).toFixed(2),
    };
    
    console.log('DSR APY:', result.apy);
    console.log('锁定的 DAI:', result.tvl);
    console.log('利率累积器 (chi):', result.chi);
    console.log('总标准化余额 (Pie):', result.totalPie);
    
    return result;
  } catch (error) {
    console.error(`❌ MakerDAO 数据获取失败:`, error.message);
    throw error;
  }
}

// ==================== 获取所有平台数据 ====================

async function getAllPlatformsData() {
  console.log('\n🔍 开始获取所有 DeFi 平台数据...\n');
  
  const results = {
    compound: null,
    venus: null,
    benqi: null,
    makerdao: null,
  };
  
  try {
    // Compound V2
    results.compound = await getCompoundData('cETH');
  } catch (error) {
    console.error('Compound 获取失败');
  }
  
  // try {
  //   // Venus
  //   results.venus = await getVenusData('vBNB');
  // } catch (error) {
  //   console.error('Venus 获取失败');
  // }
  
  try {
    // Benqi
    results.benqi = await getBenqiData('qiAVAX');
  } catch (error) {
    console.error('Benqi 获取失败');
  }
  
  try {
    // MakerDAO
    results.makerdao = await getMakerDAOData();
  } catch (error) {
    console.error('MakerDAO 获取失败');
  }
  
  console.log('\n\n📊 ===== 汇总对比 =====\n');
  console.table([
    results.compound,
    results.venus,
    results.benqi,
  ].filter(Boolean));
  
  if (results.makerdao) {
    console.log('\nMakerDAO DSR:');
    console.table([results.makerdao]);
  }
  
  return results;
}

// ==================== 主函数 ====================

async function main() {
  try {
    // 示例 1: 获取所有平台数据
    await getAllPlatformsData();
    
    // 示例 2: 单独获取某个平台
    // await getCompoundData('cUSDC');
    // await getVenusData('vETH');
    // await getBenqiData('qiUSDC'); // eth, avax
    // await getMakerDAOData();
    
  } catch (error) {
    console.error('执行失败:', error);
  }
}

// 运行
main();

// 导出函数
module.exports = {
  getCompoundData,
  getVenusData,
  getBenqiData,
  getMakerDAOData,
  getAllPlatformsData,
};