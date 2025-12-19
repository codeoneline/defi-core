const wanlend_contracts = {
  Unitroller: '0x21c72522005ccf570f40acaa04b448918aecc2ad',
  wWAN: '0xe8548014f731194764af27c8edc9bbaa7d2f4c46',
  wFNX: '0xe2cb1756bd27fca11569513de67e203e929c591e',
  wwanBTC: '0xe167e65754fbbfe506e7227cd5e815ecd6170f8a',
  wwanETH: '0x2411acd51122a43277d1bd8b63c478b815ae9ede',
  wwanUSDT: '0xff39b35474c83f2552b0463d664dd12da5d083cf',
  wwanUSDC: '0x1c6ad34e176f230f430a6e61b5088415482207e4',
}

const wanlend_contracts_2 = {
  WAND: '0x230f0c01b8e2c027459781e6a56da7e1876efdbe',
  "Unitroller/Comptroller": '0xd6980c52c20fb106e54cc6c8ae04c089c3f6b9d6',
  InterestModel: '0x0f16c4c597bf79dc25d40dba58d1b284077b572b',
  w2WAN: '0x48c42529c4c8e3d10060e04240e9ec6cd0eb1218',
  w2wanBTC: '0x040007866aa406908c70f7da53425cae191a9a46',
  w2wanETH: '0x915059e4917d6c2f76b6cc37868cc4d61bc0c7a5',
  w2wanUSDT: '0x86d6aa06b2649a68b59cd76e0195dbd26c5c6c48',
  w2wanUSDC: '0x53c8882b2ce3fe05b871392faacf32ec051dffec',
  w2wanXRP: '0xacc0475893b5e0596479c5a45c9477d418be6da6',
  w2WASP: '0x75c47f668077269cce5ab74b7b7becdafe8ac88f',
  w2PHX: '0x3c2edaa754cbc179cec5659483f336c8af303749',
  w2ZOO: '0x08b296fff000899a91010e765a0903fc049cb479',
}

const { ethers } = require('ethers-v6');
const axios = require('axios');

// Wanchain RPC 和 Comptroller 地址（V2）
const RPC_URL = 'https://gwan-ssl.wandevs.org:56891';
const COMPTROLLER_ADDRESS = '0xd6980c52c20fb106e54cc6c8ae04c089c3f6b9d6';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Minimal ABI
const comptrollerAbi = ['function getAllMarkets() external view returns (address[])'];
const cTokenAbi = [
  'function underlying() external view returns (address)',
  'function symbol() external view returns (string)',
  'function supplyRatePerBlock() external view returns (uint256)',
  'function borrowRatePerBlock() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function exchangeRateStored() external view returns (uint256)',
  'function totalBorrows() external view returns (uint256)'
];
const erc20Abi = [
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)'
];

// 计算参数
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
const AVERAGE_BLOCK_TIME = 5.23; // 当前 Wanchain 平均出块时间（秒）
const blocksPerYear = SECONDS_PER_YEAR / AVERAGE_BLOCK_TIME;

// 计算 APY（复利）
function calculateAPY(ratePerBlock) {
  if (ratePerBlock === BigInt(0)) return 0;
  const rate = Number(ratePerBlock) / 1e18;
  return ((Math.pow(1 + rate, blocksPerYear) - 1) * 100).toFixed(4);
}

// 获取 BTC/ETH 价格（Coingecko）
async function getCryptoPrices() {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,wanchain,usd-coin,tether&vs_currencies=usd');
    return {
      btc: res.data.bitcoin.usd,
      eth: res.data.ethereum.usd,
      wan: res.data.wanchain.usd,
      usdt: res.data["usd-coin"].usd,
      usdc: res.data.tether.usd,
    };
  } catch (e) {
    console.error('获取价格失败，使用备用值');
    return { btc: 60000, eth: 3000, wan: 1}; // 失败时兜底（可删除）
  }
}

async function main() {
  const prices = await getCryptoPrices();
  const comptroller = new ethers.Contract(COMPTROLLER_ADDRESS, comptrollerAbi, provider);
  const allMarkets = await comptroller.getAllMarkets();

  const targetSymbols = ['USDT', 'USDC', 'BTC', 'ETH', 'WAN']; // 目标资产
  const results = {};

  for (const cTokenAddr of allMarkets) {
    // console.log(`cTokenAddr = ${cTokenAddr}`)
    const cToken = new ethers.Contract(cTokenAddr, cTokenAbi, provider);
    
    let underlyingSymbol = '';
    let underlyingDecimals = 18;
    let assetName = '';
    let price = 1;

      if (cTokenAddr === '0x48c42529c4c8e3d10060E04240E9EC6cD0eB1218') {
        assetName = 'WAN';
        price = prices.wan;
      } else {
        const underlyingAddr = await cToken.underlying();
        // console.log(`underlyingAddr = ${underlyingAddr}`)
        const underlying = new ethers.Contract(underlyingAddr, erc20Abi, provider);
        underlyingSymbol = await underlying.symbol();
        // console.log(`underlyingSymbol = ${underlyingSymbol}`)
        underlyingDecimals = await underlying.decimals();

        // 映射资产名称和价格
        if (underlyingSymbol === 'wanUSDT') {
          assetName = 'USDT';
          price = prices.usdt;
        } else if (underlyingSymbol === 'wanUSDC') {
          assetName = 'USDC';
          price = prices.usdc;
        } else if (underlyingSymbol === 'wanBTC') {
          assetName = 'BTC';
          price = prices.btc;
        } else if (underlyingSymbol === 'wanETH') {
          assetName = 'ETH';
          price = prices.eth;
        } else if (underlyingSymbol === 'WAN') {
          assetName = 'WAN';
          price = prices.wan;
        }
      }

      if (targetSymbols.includes(assetName)) {
        // Rates
        const supplyRate = await cToken.supplyRatePerBlock();
        const borrowRate = await cToken.borrowRatePerBlock();
        const supplyAPY = calculateAPY(supplyRate);
        const borrowAPY = calculateAPY(borrowRate);

        // TVL（总供给价值 USD）
        const totalSupply = await cToken.totalSupply();
        const exchangeRate = await cToken.exchangeRateStored();
        const totalUnderlyingMantissa = totalSupply * exchangeRate / ethers.parseUnits('1', 18);
        const totalUnderlying = parseFloat(ethers.formatUnits(totalUnderlyingMantissa, underlyingDecimals));
        const tvl = (totalUnderlying * price).toFixed(2);

        results[assetName] = {
          supplyAPY: `${supplyAPY}%`,
          borrowAPY: `${borrowAPY}%`,
          tvlUSD: `$${tvl}`
        };
      }
  }

  // 输出结果
  console.log('WanLend V2 指定资产数据：');
  for (const asset of targetSymbols) {
    if (results[asset]) {
      console.log(`${asset}: Supply APY = ${results[asset].supplyAPY}, Borrow APY = ${results[asset].borrowAPY}, TVL = ${results[asset].tvlUSD}`);
    } else {
      console.log(`${asset}: 未找到对应市场`);
    }
  }
}

main().catch(console.error);