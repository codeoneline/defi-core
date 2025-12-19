const fs = require('fs')
const path = require('path')
const axios = require('axios')
const BigNumber = require('bignumber.js')
const { ethers } = require('ethers-v6')

const vaultAbi = require('./abi/abi.vault.json')
const erc20Abi = require('./abi/abi.erc20.json')
const multiCallAbi = require('./abi/abi.multicall2.json')
const tokenManagerAbi = require('./abi/abi.TokenManagerDelegateV2.json')
const adapterAbi = require('./abi/abi.IAdapter.json')
const crossConfigAbi = require('./abi/abi.ConfigurationDelegate.json')
const crossAbi = require('./abi/abi.CrossDelegateV4.json')

// 默认：chain.decimals = 18
const defiChainConfigs = {
  "Ethereum": {
    bip44: 2147483708,
    symbol: 'ETH',
    rpcs: [
      "https://eth.meowrpc.com",
      "https://rpc.mevblocker.io",
      "https://ethereum.publicnode.com",
      "https://gateway.tenderly.co/public/mainnet",
      "https://1rpc.io/eth"
    ],
    adapters: {
      USDT: {
        "aave-v3": '0x846a3C785882015B660977c2d6EB1233c00DAF49',
      }
    },
    // 原始币信息
    origins: {
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: '6',
      }
    },
    multicallAddr: "0xeefba1e63905ef1d7acba5a8513c70307c1ce441",
    crossScAddr: '0xfceaaaeb8d564a9d0e71ef36f027b9d162bc334e',
    tokenManagerAddr: '0xbab93311de250b5b422c705129b3617b3cb6e9e1',
  },
  "Arbitrum": {
    bip44: 1073741826,
    symbol: 'ARETH',
    rpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://1rpc.io/arb",
      "https://arbitrum-one.publicnode.com",
      "https://api.tatum.io/v3/blockchain/node/arb-one-mainnet"
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: '6',
      }
    },
    multicallAddr: "0xb66f96e30d6a0ae64d24e392bb2dbd25155cb3a6",
    crossScAddr: '0xf7ba155556e2cd4dfe3fe26e506a14d2f4b97613',
    tokenManagerAddr: '0xc928c8e48647c8b0ce550c2352087b1cf5c6111e',
  },
  "Wanchain": {
    bip44: 2153201998,
    symbol: 'WAN',
    rpcs: [
      'https://nodes.wandevs.org/wan',
      'https://gwan-ssl.wandevs.org:56891',
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0x11e77E27Af5539872efEd10abaA0b408cfd9fBBD',
        decimals: '6',
      }
    },
    multicallAddr: "0xba5934ab3056fca1fa458d30fbb3810c3eb5145f",
    crossScAddr: '0xe85b0D89CbC670733D6a40A9450D8788bE13da47',
    tokenManagerAddr: '0x9fdf94dff979dbecc2c1a16904bdfb41d305053a',
    crossConfigAddr: '0x6Dc2fC72584BfFa35Cc6D521a22081dD0217f3b6',
  },
  "BSC": {
    bip44: 2147484362,
    symbol: 'BNB',
    rpcs: [
      "https://go.getblock.asia/06ec35ce38ff41469e82cedd6f65ed2e",
      "https://bsc-rpc.publicnode.com",
      "https://bsc.drpc.org",
      "https://bnb.rpc.subquery.network/public",
      "https://1rpc.io/bnb",
      "https://bsc.meowrpc.com",
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: '18',
      }
    },
    multicallAddr: "0x023a33445f11c978f8a99e232e1c526ae3c0ad70",
    crossScAddr: '0xc3711bdbe7e3063bf6c22e7fed42f782ac82baee',
    tokenManagerAddr: '0x39af91cba3aed00e9b356ecc3675c7ef309017dd',
  },
  "Polygon": {
    bip44: 2147484614,
    symbol: 'MATIC',
    rpcs: [
      "https://polygon-rpc.com",
      "https://polygon.drpc.org",
      "https://rpc-mainnet.matic.quiknode.pro",
      "https://polygon.api.onfinality.io/public"
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: '6',
      }
    },
    multicallAddr: "0x1bbc16260d5d052f1493b8f2aeee7888fed1e9ab",
    crossScAddr: '0x2216072a246a84f7b9ce0f1415dd239c9bf201ab',
    tokenManagerAddr: "0xc928c8e48647c8b0ce550c2352087b1cf5c6111e",
  },
  "Optimism": {
    bip44: 2147484262,
    symbol: 'OETH',
    rpcs: [
      "https://optimism.publicnode.com",
      "https://1rpc.io/op",
      "https://optimism.meowrpc.com",
      "https://api.tatum.io/v3/blockchain/node/optimism-mainnet"
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        decimals: '6',
      }
    },
    multicallAddr: "0x2dc0e2aa608532da689e89e237df582b783e552c",
    crossScAddr: '0xc6ae1db6c66d909f7bfeeeb24f9adb8620bf9dbf',
    tokenManagerAddr: "0x1ed3538383bbfdb80343b18f85d6c5a5fb232fb6",
  },
  "Avalanche": {
    bip44: 2147492648,
    symbol: 'AVAX',
    rpcs: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://avax.meowrpc.com",
      "https://1rpc.io/avax/c"
    ],
    adapters: {},
    origins: {
      USDT: {
        address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        decimals: '6',
      }
    },
    multicallAddr: "0xa4726706935901fe7dd0f23cf5d4fb19867dfc88",
    crossScAddr: '0x74e121a34a66d54c33f3291f2cdf26b1cd037c3a',
    tokenManagerAddr: "0xf06d72375d3bf5ab1a8222858e2098b16e5e8355",
  }
};

/// 只允许 1 <--> 1 的 key, value
const value2key = (obj) => {
  let rt = {}
  for (let key in obj) {
    let v = obj[key]
    if (rt[v]) {
      throw new Error(`same value for key = ${key}, value = ${v}, oldKey = ${rt[v]}`)
    }
    rt[v] = key
  }
  return rt
}

const symbol2CoingeckoId =  {
  TBADT: 'mytestbad',
  ETH: 'ethereum',
  // ARETH,OETH
  WAN: 'wanchain',
  BNB: 'binancecoin',
  MATIC: 'polygon-ecosystem-token',
  AVAX: 'avalanche-2',

  USDC: 'usd-coin',
  USDT: 'tether',
  BTC: 'bitcoin',
}

const coingeckoId2Symbol = value2key(symbol2CoingeckoId)

const vaultConfigs = {
  USDT: {
    address: '0x48a697A1F01C009d70BEb238103261e313e009b6'
  }
};

const symbol2Asset = {
  BTC: 'WBTC',
  ETH: 'WETH',
  USDC: 'USDC',
  USDT: 'USDT',
  WAN: 'WAN',
}

// aave-v3
// compound-v3
// compound-v2
// venus-core-pool
// benqi-lending
// wanlend

const bip44ToChainConfig = {
  // "2147483708": "Ethereum", // ETH
  // "1073741826": "Arbitrum", // ARETH
  // "2153201998": "Wanchain", // WAN
  // "2147484362": "BSC",      // BNB
  // "2147484614": "Polygon",  // MATIC
  // "2147484262": "Optimism", // OETH,  alias: OptimisticEthereum
  // "2147492648": "Avalanche",// AVAX
}

// init config
for (let chain in defiChainConfigs) {
  const config = defiChainConfigs[chain]
  const bip44 = config.bip44
  config.chain = chain
  if (config.decimals === undefined) {
    config.decimals = 18
  }
  config.unit = BigNumber(10).pow(config.decimals)
  for (let asset in config.origins) {
    const assetConfig = config.origins[asset]
    if (assetConfig.decimals !== undefined) {
      assetConfig.unit = BigNumber(10).pow(assetConfig.decimals)
    }
  }
  bip44ToChainConfig[bip44] = config
}

// 常量定义
const BATCH_SIZE = 100
const CACHE_TIME = 600000 // 10分钟

function sleep(ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve();
    }, ms);
  })
}

// ethers 提供者创建函数
const createProvider = (rpc_url) => {
  if (!rpc_url) {
    console.error('rpc error');
    return null;
  }

  if (rpc_url.startsWith('http')) {
    return new ethers.JsonRpcProvider(rpc_url, 'mainnet', {
      staticNetwork: true,
    });
  } else if (rpc_url.startsWith('ws')) {
    return new ethers.WebSocketProvider(rpc_url);
  }
  
  console.error(`Unsupported RPC protocol: ${rpc_url}`);
  return null;
}

/// 链管理器
class ChainManager {
  constructor(config) {
    this.config = config;
    this.rpcIndex = 0;
    this.provider = null;
    this.contracts = new Map();
    this.init();
  }

  init() {
    this.provider = createProvider(this.config.rpcs[0]);
    if (!this.provider) {
      throw new Error(`Failed to create provider for chain`);
    }
  }

  switchRpc() {
    const oldIndex = this.rpcIndex;
    this.rpcIndex = (this.rpcIndex + 1) % this.config.rpcs.length;
    
    if (oldIndex === this.rpcIndex) {
      return false;
    }
    
    console.log(`Switching RPC from ${this.config.rpcs[oldIndex]} to ${this.config.rpcs[this.rpcIndex]}`);
    const newProvider = createProvider(this.config.rpcs[this.rpcIndex]);
    if (newProvider) {
      if (this.provider && this.provider.destroy) {
        this.provider.destroy();
      }
      this.provider = newProvider;
      // 更新所有合约的提供者
      const updatedContracts = new Map();
      this.contracts.forEach((contract, key) => {
        updatedContracts.set(key, contract.connect(this.provider));
      });
      this.contracts = updatedContracts;
      return true;
    }
    return false;
  }

  getContract(contractAddress, abi) {
    const key = contractAddress;
    if (!this.contracts.has(key)) {
      const contract = new ethers.Contract(contractAddress, abi, this.provider);
      this.contracts.set(key, contract);
    }
    return this.contracts.get(key);
  }

  async callWithRetry(method, ...args) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.config.rpcs.length * 2; attempt++) {
      try {
        return await method(...args);
      } catch (error) {
        lastError = error;
        if (attempt < this.config.rpcs.length * 2 - 1) {
          this.switchRpc();
          await new Promise(resolve => setTimeout(resolve, 1000 * (Math.floor(attempt / this.config.rpcs.length) + 1)));
        }
      }
    }
    
    throw new Error(`All RPC attempts failed: ${lastError?.message}`);
  }
}

/// 全局管理器
const chainManagers = new Map();

function getChainManager(chainName) {
  if (!chainManagers.has(chainName)) {
    const config = defiChainConfigs[chainName];
    if (!config) {
      throw new Error(`Chain ${chainName} not found in config`);
    }
    chainManagers.set(chainName, new ChainManager(config));
  }
  return chainManagers.get(chainName);
}

let gPrices = {}
let gPricesTime = 0
const getPrices = async() => {
  const now = Date.now()
  if (now - gPricesTime > CACHE_TIME) {
    const ids = Object.keys(coingeckoId2Symbol)
    let pricesNew = null
    do {
      try {
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
        pricesNew = res.data
        const prices = {}
        for(let id in pricesNew) {
          const price = pricesNew[id]
          if (price === null || price.usd === null) {
            console.error(`${symbol} bad price`)
          } else {
            const symbol = coingeckoId2Symbol[id]
            prices[symbol] = BigNumber(price.usd)
          }
        }
        if (prices['ETH']) {
          prices['ARETH'] = prices['ETH']
          prices['OETH'] = prices['ETH']
        }
    
        gPrices = prices
        gPricesTime = Date.now()
        console.log(`get new price ${JSON.stringify(pricesNew)}`)
        break
      } catch (error) {
        console.log(`get price error:${error}`)
        await sleep(10000)
      }
    } while (true);
  }
  
  return gPrices
}

/// 合约调用函数
async function callContract(chainName, contractAddress, abi, method, params = [], parse) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  
  const methodCall = async () => {
    return await contract[method](...params);
  };
  
  const result = await manager.callWithRetry(methodCall);
  return parse ? parse(result) : result;
}

/// 批量调用函数
function addContractCall(calls, chainName, contractAddress, abi, method, params = [], decoder) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  
  // 获取函数选择器
  const iface = new ethers.Interface(abi);
  const functionFragment = iface.getFunction(method);
  const callData = iface.encodeFunctionData(functionFragment, params);
  
  calls.push({
    target: contractAddress,
    callData,
    decoder,
    abi
  });
}

/// 简化的批量调用 - 禁止失败版本
async function multiCallBatch(chainName, calls, batchSize = BATCH_SIZE) {
  if (!calls || calls.length === 0) {
    return { blockNumber: 0, results: [] };
  }

  const manager = getChainManager(chainName);
  const multiCallAddress = defiChainConfigs[chainName]?.multicallAddr;
  if (!multiCallAddress) {
    throw new Error(`MultiCall address not configured for chain ${chainName}`);
  }

  const multicallContract = manager.getContract(multiCallAddress, multiCallAbi);
  const results = [];
  
  // 动态调整batch size
  const adjustedBatchSize = Math.min(batchSize, Math.max(20, Math.floor(10000 / (calls.length || 1))));

  // 分批处理
  for (let i = 0; i < calls.length; i += adjustedBatchSize) {
    const batchCalls = calls.slice(i, i + adjustedBatchSize);
    const multicallCalls = batchCalls.map(c => ({
      target: c.target,
      callData: c.callData
    }));

    const methodCall = async () => {
      return await multicallContract.aggregate.staticCall(multicallCalls);
    };
    
    const batchResult = await manager.callWithRetry(methodCall);
    
    if (!batchResult) {
      throw new Error(`MultiCall batch ${Math.floor(i / adjustedBatchSize) + 1} returned null result`);
    }

    const decodedResults = batchResult[1].map((data, index) => {
      const callIndex = i + index;
      return calls[callIndex]?.decoder ? calls[callIndex].decoder(data) : data;
    });
    
    // 设置blockNumber（只使用第一个成功的batch）
    if (i === 0) {
      results.blockNumber = Number(batchResult[0]);
    }
    
    results.push(...decodedResults);
  }

  return {
    blockNumber: results.blockNumber || 0,
    results: results
  };
}

/// 自动重试版本
async function robustMultiCallBatch(chainName, calls, maxRetries = 3) {
  if (!calls || calls.length === 0) {
    return { blockNumber: 0, results: [] };
  }

  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const batchSize = Math.max(20, Math.floor(200 / (attempt + 1)));
      return await multiCallBatch(chainName, calls, batchSize);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }
  
  throw new Error(`MultiCall failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/// 特定业务函数
async function getVault(asset, chainName, method, params = []) {
  const contractAddress = vaultConfigs[asset]?.address;
  if (!contractAddress) {
    throw new Error(`Vault address not found for asset ${asset}`);
  }
  return await callContract(chainName, contractAddress, vaultAbi, method, params);
}

async function getVaultAdapters(asset, chainName) {
  return await getVault(asset, chainName, 'getAllAdapters', []);
}

function findAddressDifferences(addrs, adapters) {
  const adapterAddresses = Object.values(adapters);
  const adapterSet = new Set(adapterAddresses);
  const addrSet = new Set(addrs);
  
  return {
    onlyInAddrs: addrs.filter(addr => !adapterSet.has(addr)),
    onlyInAdapters: adapterAddresses.filter(addr => !addrSet.has(addr)),
    common: addrs.filter(addr => adapterSet.has(addr))
  };
}

/// initVaultAddress 函数（保留）
async function initVaultAddress() {
  const chains = Object.keys(defiChainConfigs);
  const assets = Object.keys(vaultConfigs);

  for (const chainName of chains) {
    console.log(`\n=== Processing ${chainName} ===`);
    const calls = [];
    const assetHandlers = [];
    
    for (const asset of assets) {
      const vaultAddress = vaultConfigs[asset].address;
      
      // 获取所有adapters
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'getAllAdapters', [],
        (data) => {
          const iface = new ethers.Interface(vaultAbi);
          return iface.decodeFunctionResult('getAllAdapters', data)[0];
        }
      );
      assetHandlers.push({ type: 'adapters', asset });
      
      // 获取原币地址
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'asset', [],
        (data) => {
          const iface = new ethers.Interface(vaultAbi);
          return iface.decodeFunctionResult('asset', data)[0];
        }
      );
      assetHandlers.push({ type: 'origin', asset });
    }

    try {
      const result = await robustMultiCallBatch(chainName, calls, 3);
      console.log(`${chainName}: Got ${result.results.length} results, block: ${result.blockNumber}`);
      
      // 处理结果
      const call2s = [];
      const handle2s = [];
      const chainConfig = defiChainConfigs[chainName];
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const adapterResult = result.results[i * 2];
        const originResult = result.results[i * 2 + 1];
        
        // 初始化配置
        chainConfig.origins = chainConfig.origins || {};
        chainConfig.origins[asset] = chainConfig.origins[asset] || {};
        
        // 处理adapter对比
        const adapterConfigs = chainConfig.adapters?.[asset];
        if (adapterConfigs && adapterResult) {
          const { onlyInAddrs, onlyInAdapters } = findAddressDifferences(adapterResult, adapterConfigs);
          if (onlyInAddrs.length > 0 || onlyInAdapters.length > 0) {
            console.warn(`${chainName} ${asset}: Adapter mismatch`);
            console.warn(`  Only in contract: ${JSON.stringify(onlyInAddrs)}`);
            console.warn(`  Only in config: ${JSON.stringify(onlyInAdapters)}`);
          }
        }
        
        // 处理原币地址
        if (originResult) {
          if (chainConfig.origins[asset].address !== originResult) {
            console.log(`${chainName} ${asset}: Origin address updated from ${chainConfig.origins[asset].address} to ${originResult}`);
            chainConfig.origins[asset].address = originResult;
          }
          
          // 获取decimals
          addContractCall(
            call2s, chainName, originResult, erc20Abi, 'decimals', [],
            (data) => {
              const iface = new ethers.Interface(erc20Abi);
              return iface.decodeFunctionResult('decimals', data)[0];
            }
          );
          handle2s.push((decimals) => {
            const assetConfig = chainConfig.origins[asset]
            if (assetConfig.decimals !== decimals) {
              console.log(`${chainName} ${asset}: Decimals updated from ${chainConfig.origins[asset].decimals} to ${decimals}`);
              assetConfig.decimals = decimals;
              assetConfig.unit = BigNumber(10).pow(decimals)
            }
          });
        }
      }
      
      // 获取decimals
      if (call2s.length > 0) {
        const result2 = await robustMultiCallBatch(chainName, call2s, 3);
        console.log(`${chainName}: Got ${result2.results.length} decimals, block: ${result2.blockNumber}`);
        
        result2.results.forEach((decimals, index) => {
          if (handle2s[index] && decimals !== null) {
            handle2s[index](decimals);
          }
        });
      }
      
    } catch (error) {
      console.error(`Failed to init vault address for ${chainName}:`, error.message);
    }
  }
  
  console.log('\n=== Vault address initialization completed ===');
}

/// 文件操作函数
const gTokenPairFilePath = path.resolve(__dirname, "./config/tokenPairs.json");
let gTokenPairsInfo = {total: 0, tokenPairs: {}};

function tryLoadJsonObj(fileFullPath, defaultObj) {
  if (fs.existsSync(fileFullPath)) {
    try {
      const data = fs.readFileSync(fileFullPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${fileFullPath}:`, error);
      return defaultObj;
    }
  }
  return defaultObj;
}

gTokenPairsInfo = tryLoadJsonObj(gTokenPairFilePath, {total: 0, tokenPairs: {}});

/// getTokenPairs 函数
async function getTokenPairs() {
  const chainName = 'Wanchain'
  const tokenManagerAddr = defiChainConfigs[chainName].tokenManagerAddr
  
  try {
    // 获取总数
    const total = await callContract(
      chainName, tokenManagerAddr, tokenManagerAbi, 'totalTokenPairs', [],
      (data) => Number(data)
    );
    console.log(`totalTokenPairs is ${total}`);
    
    if (total === gTokenPairsInfo.total) {
      return gTokenPairsInfo.tokenPairs;
    }

    const ids = [];
    const tokenPairs = {};

    // 第一步：获取所有ID
    console.log(`Step 1: Getting ${total} token pair IDs...`);
    const idCalls = [];
    
    for (let i = 0; i < total; i++) {
      addContractCall(
        idCalls, chainName, tokenManagerAddr, tokenManagerAbi, 'mapTokenPairIndex', [i],
        (data) => {
          const iface = new ethers.Interface(tokenManagerAbi);
          return Number(iface.decodeFunctionResult('mapTokenPairIndex', data)[0]);
        }
      );
    }

    const idResult = await robustMultiCallBatch(chainName, idCalls, 3);
    console.log(`Got ${idResult.results.length} IDs, blockNumber: ${idResult.blockNumber}`);
    
    // 处理ID结果
    idResult.results.forEach((id, index) => {
      if (id !== null && id !== undefined) {
        ids.push(id);
      } else {
        console.warn(`Failed to get ID for index ${index}`);
      }
    });

    console.log(`Successfully retrieved ${ids.length} token pair IDs`);

    // 第二步：获取详细信息
    console.log(`Step 2: Getting details for ${ids.length} token pairs...`);
    const detailCalls = [];
    const detailHandlers = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      
      tokenPairs[id] = {};

      // Token pair info
      addContractCall(
        detailCalls, chainName, tokenManagerAddr, tokenManagerAbi, 'getTokenPairInfo', [id],
        (data) => {
          const iface = new ethers.Interface(tokenManagerAbi);
          const result = iface.decodeFunctionResult('getTokenPairInfo', data);
          return {
            fromChainID: Number(result[0]),
            fromAccount: result[1],
            toChainID: Number(result[2]),
            toAccount: result[3]
          };
        }
      );
      detailHandlers.push((tokenPairInfo) => {
        const {fromChainID, fromAccount, toChainID, toAccount} = tokenPairInfo;
        tokenPairs[id].fromChainID = fromChainID;
        tokenPairs[id].fromAccount = fromAccount;
        tokenPairs[id].toChainID = toChainID;
        tokenPairs[id].toAccount = toAccount;
      });

      // Ancestor info
      addContractCall(
        detailCalls, chainName, tokenManagerAddr, tokenManagerAbi, 'getAncestorInfo', [id],
        (data) => {
          const iface = new ethers.Interface(tokenManagerAbi);
          const result = iface.decodeFunctionResult('getAncestorInfo', data);
          return {
            account: result[0],
            name: result[1],
            symbol: result[2],
            decimals: Number(result[3]),
            chainId: Number(result[4])
          };
        }
      );
      detailHandlers.push((ancestorInfo) => {
        const {account, name, symbol, decimals, chainId} = ancestorInfo;
        tokenPairs[id].account = account;
        tokenPairs[id].name = name;
        tokenPairs[id].symbol = symbol;
        tokenPairs[id].decimals = decimals;
        tokenPairs[id].chainId = chainId;
      });
    }

    const detailResult = await robustMultiCallBatch(chainName, detailCalls, 3);
    console.log(`Got ${detailResult.results.length} details, blockNumber: ${detailResult.blockNumber}`);
    
    // 处理详细信息
    detailResult.results.forEach((result, index) => {
      if (result !== null && result !== undefined && detailHandlers[index]) {
        try {
          detailHandlers[index](result);
        } catch (error) {
          console.error(`Error processing detail ${index}:`, error);
        }
      } else if (result === null || result === undefined) {
        console.warn(`Missing detail for call ${index}`);
      }
    });

    console.log(`Successfully processed ${Object.keys(tokenPairs).length} token pairs`);
    
    // 保存到文件
    gTokenPairsInfo = {
      total,
      tokenPairs
    };
    fs.writeFileSync(gTokenPairFilePath, JSON.stringify({total, tokenPairs}, null, 2));
    
    return tokenPairs;
    
  } catch (error) {
    console.error(`Error in getTokenPairs: ${error.message}`);
    throw error;
  }
}

const gPoolsFilePath = path.resolve(__dirname, "./config/defiPools.json");
const gPoolsInfo = tryLoadJsonObj(gPoolsFilePath, {poolTime: 0, pools: []})
async function getPools(supportProjects) {
  const now = Date.now()
  if (now - gPoolsInfo.poolTime > CACHE_TIME) {
    console.info(`try get pools`)
    do {
      try {
        const res = await axios.get(`https://yields.llama.fi/pools`)
        console.info(`try get pools end`)
        if (res.status === 200) {
          if (res.data.status === 'success') {
            const poolsAll = res.data.data
            const pools = poolsAll.filter(pool => {
              // format pool
              pool.asset = pool.symbol
              delete pool.symbol

              const key = `${pool.asset}:${pool.chain}:${pool.project}`
              // 我们支持的 资产、链、平台
              if (supportProjects[key]) {
                // 只信任低风险
                if (pool.ilRisk === 'no') {
                  return true
                }
              }
              return false
            })
            gPoolsInfo.poolTime = Date.now()
            gPoolsInfo.pools = pools
            fs.writeFileSync(gPoolsFilePath, JSON.stringify(gPoolsInfo, null, 2))
            break
          }
        }
      } catch (error) {
      }
      await sleep(10000)
    } while (true);
  }

  return gPoolsInfo.pools
}

async function reqQuotaAndFee(fromSymbol, toSymbol, tokenPairID, symbol) {
  do {
    try {
      let urlReal = `https://bridge-api.wanchain.org/api/quotaAndFee?fromChainType=${fromSymbol}&toChainType=${toSymbol}&tokenPairID=${tokenPairID}&symbol=${symbol}`
      // let urlTest = 'https://bridge-api.wanchain.org/api/quotaAndFee?fromChainType=ETH&toChainType=BTC&tokenPairID=14&symbol=BTC'
      let url = urlReal
      const res = await axios.get(url)
      if (res.status === 200) {
        const data = res.data
        if (data.success) {
          return data.data
        } else {
          await sleep(10000)
        }
      } else {
        await sleep(10000)
      }
    } catch (error) {
      await sleep(10000)
    }
  } while (true);
}

const formatFeeDetail = (feeDetail, fromConfig, tokenSymbol) => {
  const asset = symbol2Asset[tokenSymbol]
  const tokenUnit = fromConfig.origins[asset].unit
  const netPrice = gPrices[fromConfig.symbol]
  const assetPrice = gPrices[tokenSymbol]
  feeDetail.networkFee.value = BigNumber(feeDetail.networkFee.value).dividedBy(fromConfig.unit).toString(10)
  // feeDetail.networkFee.value 已经单位化了
  feeDetail.networkFee.assetValue = BigNumber(feeDetail.networkFee.value).dividedBy(assetPrice).multipliedBy(netPrice).toString(10)
  const operationFee = feeDetail.operationFee
  if (operationFee.minFeeLimit !== undefined) operationFee.minFeeLimit = BigNumber(operationFee.minFeeLimit).dividedBy(tokenUnit).toString(10)
  if (operationFee.maxFeeLimit !== undefined) operationFee.maxFeeLimit = BigNumber(operationFee.maxFeeLimit).dividedBy(tokenUnit).toString(10)
  if (!operationFee.isPercent) operationFee.value = BigNumber(operationFee.value).dividedBy(tokenUnit).toString(10)
  feeDetail.minQuota = BigNumber(feeDetail.minQuota).dividedBy(tokenUnit).toString(10)
  feeDetail.maxQuota = BigNumber(feeDetail.maxQuota).dividedBy(tokenUnit).toString(10)

  feeDetail.asset = feeDetail.symbol
  delete feeDetail.symbol

  feeDetail.nativeCoinFee = feeDetail.networkFee
  delete feeDetail.networkFee

  feeDetail.tokenFee = feeDetail.operationFee
  delete feeDetail.operationFee
}

const gFeesFilePath = path.resolve(__dirname, "./config/fees.json");
const gFeesInfo = tryLoadJsonObj(gFeesFilePath, {feesTime: 0, bridgeFees: {}, feeTokenPairs: {}})
async function getFees() {
  await getPrices()
  const now = Date.now()
  if (now - gFeesInfo.feesTime > CACHE_TIME) {
    const fees = {}
    const feeTokenPairs = {}
    const tokenPairs = await getTokenPairs()
    for(let id in tokenPairs) {
      const tokenPair = tokenPairs[id]
      // 是我们关注的资产
      const tokenSymbol = tokenPair.symbol
      const asset = symbol2Asset[tokenSymbol]
      if (asset) {
        // 我们有vault
        if (vaultConfigs[asset]) {
          // 是我们关注的chain
          const fromConfig =  bip44ToChainConfig[tokenPair.fromChainID]
          const toConfig = bip44ToChainConfig[tokenPair.toChainID]
          if (fromConfig && toConfig) {
            const fromChainSymbol = fromConfig.symbol
            const toChainSymbol = toConfig.symbol
            let fromChain = fromConfig.chain
            let toChain = toConfig.chain
            const key1 = `${asset}:${fromChain}->${toChain}`
            if (!fees[key1] || (id > fees[key1].tokenPairId)) {
              const feeDetail = await reqQuotaAndFee(fromChainSymbol, toChainSymbol, id, tokenSymbol)
              // TODO:没有价格怎么办。
              /// networkFee收为coin的绝对值，用from链的coin的decimals, operationFee收的是asset的百分比，有最值，用from链的asset的decimals
              formatFeeDetail(feeDetail, fromConfig, tokenSymbol)
              fees[key1] = { ...feeDetail, tokenPairId: id}
              feeTokenPairs[id] = tokenPair
            } else {
              feeTokenPairs[id] = tokenPair
              console.warn(`${key1} already exist, old id = ${fees[key1].tokenPairId}, new id = ${id}`)
            }
            const key2 = `${asset}:${toChain}->${fromChain}`
            if (!fees[key2] || (id > fees[key2].tokenPairId)) {
              const feeDetail = await reqQuotaAndFee(toChainSymbol, fromChainSymbol, id, tokenSymbol)
              // TODO:没有价格怎么办。
              /// networkFee收为coin的绝对值，用from链的coin的decimals, operationFee收的是asset的百分比，有最值，用from链的asset的decimals
              formatFeeDetail(feeDetail, toConfig, tokenSymbol)
              fees[key2] = { ...feeDetail, tokenPairId: id}
              feeTokenPairs[id] = tokenPair
            } else {
              feeTokenPairs[id] = tokenPair
              console.warn(`${key2} already exist, old id = ${fees[key2].tokenPairId}, new id = ${id}`)
            }
          }
        }
      }
    }
    gFeesInfo.feesTime = Date.now()
    gFeesInfo.feeTokenPairs = feeTokenPairs
    gFeesInfo.bridgeFees = fees
    fs.writeFileSync(gFeesFilePath, JSON.stringify(gFeesInfo, null, 2))
  }

  return gFeesInfo
}

async function getTokenPairsFees() {
  const {feeTokenPairs} = tryLoadJsonObj(gFeesFilePath, {feesTime: 0, fees: {}, feeTokenPairs: {}})

  const serviceFeeToFetch = {}
  const networkFeeToFetch = {}

  const serviceFeeDecoder = (data) => {
    const iface = new ethers.Interface(crossConfigAbi);
    const result = iface.decodeFunctionResult('getCrossChainAgentFee', data);
    return {
      numerator: result[0].toString(),
      denominator: result[1].toString(),
      fixedFee: result[2].toString(),
      minFeeLimit: result[3].toString(),
      maxFeeLimit: result[4].toString()
    };
  }

  const addServiceFeeToFetch = (key, id) => {
    const [symbol, fromChainID, toChainID] = key.split('/')
    if (!serviceFeeToFetch[key] || serviceFeeToFetch[key].id < id) {
      if (serviceFeeToFetch[key]) {
        console.warn(`same serviceFeeToFetch, key = ${key}, old id = ${serviceFeeToFetch[key].id}, new id = ${id}`)
      } 
      serviceFeeToFetch[key] = {
        params: [symbol, fromChainID, toChainID],
        id,
        decoder: serviceFeeDecoder,
      }
    }
  }

  const addAllServiceFeeToFetch = (id, symbol, fromChainID, toChainID) => {
    // 1.symbol/fromchainid/tochainid
    // 2.symbol/fromchainid/0
    // 3.symbol/0/tochainid
    // 4.""/fromchainid/tochainid
    // 5.""/fromchainid/0
    // 6.""/0/tochainid
    addServiceFeeToFetch(`${symbol}/${fromChainID}/${toChainID}`, id)
    addServiceFeeToFetch(`${symbol}/${fromChainID}/0`, id)
    addServiceFeeToFetch(`${symbol}/0/${toChainID}`, id)
    addServiceFeeToFetch(`/${fromChainID}/${toChainID}`, id)
    addServiceFeeToFetch(`/${fromChainID}/0`, id)
    addServiceFeeToFetch(`/0/${toChainID}`, id)
  }

  const networkFeeDecoder = (data) => {
    const iface = new ethers.Interface(crossAbi);
    return iface.decodeFunctionResult('getFee', data)[0].toString();
  }

  const addNetworkFeeToFetch = (key, id) => {
    let [id_, fromChainID, toChainID] = key.split('/')
    if (!networkFeeToFetch[key] || networkFeeToFetch[key].id < id) {
      if (networkFeeToFetch[key]) {
        console.warn(`same networkFeeToFetch, key = ${key}, old id = ${networkFeeToFetch[key].id}, new id = ${id}`)
      }
      const chainConfig = bip44ToChainConfig[fromChainID]
      if (id_ === '') {
        networkFeeToFetch[key] = {
          params: [[parseInt(fromChainID), parseInt(toChainID)]],
          method: 'getFee',
          id,
          chainConfig,
          decoder: networkFeeDecoder,
        }
      } else {
        networkFeeToFetch[key] = {
          params: [id],
          method: 'getTokenPairFee',
          id,
          chainConfig,
          decoder: (data) => {
            const iface = new ethers.Interface(crossAbi);
            return iface.decodeFunctionResult('getTokenPairFee', data)[0].toString();
          }
        }
      }
    }
  }

  const addAllNetworkFeeToFetch = (id, symbol, fromChainID, toChainID) => {
    // 1. cross.mapTokenPairContractFee[id]
    // 2. cross.mapContractFee[fromchainid][tochainid]  // current = from
    // 2. cross.mapContractFee[fromchainid][0]          // current = from
    // 2. cross.mapContractFee[tochainid][fromchainid]  // current = to
    // 2. cross.mapContractFee[tochainid][0]  // current = to
    addNetworkFeeToFetch(`${id}/${fromChainID}/${toChainID}`, id)
    addNetworkFeeToFetch(`/${fromChainID}/${toChainID}`, id)
    addNetworkFeeToFetch(`/${fromChainID}/0`, id)
    addNetworkFeeToFetch(`/${toChainID}/${fromChainID}`, id)
    addNetworkFeeToFetch(`/${toChainID}/0`, id)
  }
  
  for(let id in feeTokenPairs) {
    const tokenPair = feeTokenPairs[id]
    const {symbol, fromChainID, toChainID} = tokenPair
    // 正向 service fee
    addAllServiceFeeToFetch(id, symbol, fromChainID, toChainID)
    // 反向 service fee
    addAllServiceFeeToFetch(id, symbol, toChainID, fromChainID)
    // 正反向 network fee
    addAllNetworkFeeToFetch(id, symbol, fromChainID, toChainID)
  }

  let chain = 'Wanchain'
  let crossConfigAddr = defiChainConfigs[chain].crossConfigAddr

  let calls = []
  let handleResults = []
  const servicefeeRaw = {}
  const networkfeeRaw = {}
  
  for(let key in serviceFeeToFetch) {
    const {id, params, decoder} = serviceFeeToFetch[key]
    addContractCall(calls, chain, crossConfigAddr, crossConfigAbi, 'getCrossChainAgentFee', params, decoder)
    handleResults.push((fee) => {
      if (fee.numerator !== 0) {
        servicefeeRaw[key] = fee
      }
    })
  }

  let result = await robustMultiCallBatch(chain, calls, 3)
  if (result && result.results) {
    let results = result.results
    for (let i = 0; i < results.length; i++) {
      if (handleResults[i]) {
        handleResults[i](results[i]);
      }
    }
  }

  calls = {}
  handleResults = {}
  for(let key in networkFeeToFetch) {
    const {id, params, decoder, method, chainConfig} = networkFeeToFetch[key]
    const {chain, crossScAddr } = chainConfig
    if (!calls[chain]) {
      calls[chain] = []
      handleResults[chain] = []
    }
    addContractCall(calls[chain], chain, crossScAddr, crossAbi, method, params, decoder)
    handleResults[chain].push((contractFee) => {
      if (contractFee !== 0) {
        networkfeeRaw[key] = contractFee
      }
    })
  }

  for (let chain in calls) {
    result = await robustMultiCallBatch(chain, calls[chain], 3)
    if (result && result.results) {
      let results = result.results
      for (let i = 0; i < results.length; i++) {
        if (handleResults[chain][i]) {
          handleResults[chain][i](results[i]);
        }
      }
    }
  }
  
  const gFeesRawFilePath = path.resolve(__dirname, "./config/feesRaw.json");
  fs.writeFileSync(gFeesRawFilePath, JSON.stringify({servicefeeRaw, networkfeeRaw}, null, 2))
}

const getVaults = async(supportProjects) => {
  const vaults = [];
  const chains = Object.keys(defiChainConfigs);
  const assets = Object.keys(vaultConfigs);
  
  console.log('\n=== Processing for VAULT ===');
  // 获取vaults信息
  for (const chainName of chains) {
    console.log(`\n=== Processing ${chainName} for VAULT ===`);
    const calls = [];
    const handleResults = [];
    
    const chainConfig = defiChainConfigs[chainName];
    const chainDecimals = chainConfig.decimals
    const chainUnit = BigNumber(10).pow(chainDecimals);

    for (const asset of assets) {
      const vault = {
        chain: chainName,
        asset,
        totalAssets: '0',
        availableBalance: '0',
        yielding: {}
      };

      const tokenDecimals = chainConfig.origins[asset].decimals
      const tokenUnit = BigNumber(10).pow(tokenDecimals);
      const vaultAddress = vaultConfigs[asset].address;
      
      // 获取总持仓
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'totalAssets', [],
        (data) => {
          const iface = new ethers.Interface(vaultAbi);
          return iface.decodeFunctionResult('totalAssets', data)[0].toString();
        }
      );
      handleResults.push((totalAssets) => {
        vault.totalAssets = BigNumber(totalAssets || 0).dividedBy(tokenUnit).toString();
      });
      
      // 获取每个adapter的持仓
      const adapterAddrs = chainConfig.adapters?.[asset] || {};
      for(const project in adapterAddrs) {
        const adapterAddr = adapterAddrs[project];
        supportProjects[`${asset}:${chainName}:${project}`] = { adapterAddr };
        
        addContractCall(
          calls, chainName, adapterAddr, adapterAbi, 'totalAssets', [],
          (data) => {
            const iface = new ethers.Interface(adapterAbi);
            return iface.decodeFunctionResult('totalAssets', data)[0].toString();
          }
        );
        handleResults.push((totalAssets) => {
          vault.yielding[project] = BigNumber(totalAssets || 0).dividedBy(tokenUnit).toString();
        });
      }
      
      // 获取原币的余额
      const assetOrigin = chainConfig.origins?.[asset];
      if (assetOrigin?.address === '0x0000000000000000000000000000000000000000') {
        const multicallAddr = chainConfig.multicallAddr;
        addContractCall(
          calls, chainName, multicallAddr, multiCallAbi, 'getEthBalance', [vaultAddress],
          (data) => {
            const iface = new ethers.Interface(multiCallAbi);
            return iface.decodeFunctionResult('getEthBalance', data)[0].toString();
          }
        );
        handleResults.push((balance) => {
          vault.availableBalance = BigNumber(balance || 0).dividedBy(chainUnit).toString();
        });
      } else if (assetOrigin?.address) {
        addContractCall(
          calls, chainName, assetOrigin.address, erc20Abi, 'balanceOf', [vaultAddress],
          (data) => {
            const iface = new ethers.Interface(erc20Abi);
            return iface.decodeFunctionResult('balanceOf', data)[0].toString();
          }
        );
        handleResults.push((balance) => {
          vault.availableBalance = BigNumber(balance || 0).dividedBy(tokenUnit).toString();
        });
      }
      
      vaults.push(vault);
    }

    try {
      const result = await robustMultiCallBatch(chainName, calls, 3);
      console.log(`${chainName}: Got ${result.results.length} results, block: ${result.blockNumber}`);
      
      if (result && result.results) {
        for (let i = 0; i < result.results.length; i++) {
          if (handleResults[i]) {
            handleResults[i](result.results[i]);
          }
        }
      }
      
      // console.log(`${chainName} vaults:`, JSON.stringify(
      //   vaults.filter(v => v.chain === chainName),
      //   null, 2
      // ));
      
    } catch (error) {
      console.error(`Failed to get VAULT for ${chainName}:`, error.message);
    }
  }
  console.log('\n=== VAULT collection completed ===');

  return vaults
}


async function getApyTvl() {
  const supportProjects = {};
  const vaults = await getVaults(supportProjects)

  console.log('Support projects:', Object.keys(supportProjects));

  // 获取pools
  const pools = await getPools(supportProjects)
  const {bridgeFees} = await getFees()

  const rt = {
    pools,
    bridgeFees,
    vaults
  };
  return rt
}

/// 测试函数
async function testAllChain() {
  const chains = Object.keys(defiChainConfigs);
  
  for (const chainName of chains) {
    try {
      console.log(`\n=== Testing ${chainName} ===`);
      const calls = [];
      const contractAddress = vaultConfigs.USDT.address;
      
      addContractCall(
        calls, chainName, contractAddress, vaultAbi, 'getAllAdapters', [],
        (data) => {
          const iface = new ethers.Interface(vaultAbi);
          return iface.decodeFunctionResult('getAllAdapters', data)[0];
        }
      );
      
      const result = await robustMultiCallBatch(chainName, calls, 2);
      console.log(`${chainName}: blockNumber: ${result.blockNumber}, results count: ${result.results.length}`);
      
    } catch (error) {
      console.error(`Error on chain ${chainName}:`, error.message);
    }
  }
  
  console.log('\n=== All tests completed ===');
}

/// 主函数
const main = async () => {
  try {
    console.log('Starting defi-core service...');
    
    // 测试所有链连接
    // await testAllChain();
    
    // 初始化vault地址
    // await initVaultAddress();
    
    // 获取token pairs
    // await getTokenPairs();
    
    // 获取APY/TVL数据
    await getApyTvl();

    // await getPrices()

    // await getTokenPairsFees()
    
    console.log('\n=== All tasks completed successfully ===');
  } catch (error) {
    console.error('Main function failed:', error);
    process.exit(1);
  }
};

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(`uncaughtException: ${err.message}`, err);
  process.exit(1);
});

main().catch(console.error);