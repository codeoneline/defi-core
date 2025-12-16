const fs = require('fs')
const path = require('path')
const axios = require('axios')
const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const web3 = new Web3()

const vaultAbi = require('./abi/abi.vault.json')
const erc20Abi = require('./abi/abi.erc20.json')
const multiCallAbi = require('./abi/abi.multicall2.json')
const tokenManagerAbi = require('./abi/abi.TokenManagerDelegateV2.json')
const adapterAbi = require('./abi/abi.IAdapter.json')

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
    origins: {
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: '6',
      }
    },
    multicallAddr: "0xeefba1e63905ef1d7acba5a8513c70307c1ce441",
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
    tokenManagerAddr: '0x9fdf94dff979dbecc2c1a16904bdfb41d305053a',
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
    tokenManagerAddr: "0xf06d72375d3bf5ab1a8222858e2098b16e5e8355",
  }
};

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
  WAN: 'WAN'
}

const bip44ToChainConfig = {
  // "2147483708": "Ethereum",
  // "1073741826": "Arbitrum", // 
  // "2153201998": "Wanchain",
  // "2147484362": "BSC",
  // "2147484614": "Polygon", // MATIC
  // "2147484262": "Optimism",
  // "2147492648": "Avalanche",
}

for (let chain in defiChainConfigs) {
  const bip44 = defiChainConfigs[chain].bip44
  bip44ToChainConfig[bip44] = defiChainConfigs[chain]
  bip44ToChainConfig[bip44].chain = chain
}

// 常量定义
const BATCH_SIZE = 100

function sleep(ms) {
	return new Promise(function (resolve, reject) {
		setTimeout(function () {
			resolve();
		}, ms);
	})
};

/// 工具函数
function createProvider(rpc_url) {
  if (!rpc_url) {
    console.error('rpc error');
    return null;
  }

  const options = {
    timeout: 60000,
    clientConfig: {
      maxReceivedFrameSize: 100000000,
      maxReceivedMessageSize: 100000000,
      keepalive: true,
      keepaliveInterval: -1
    },
    reconnect: {
      auto: true,
      delay: 1000,
      maxAttempts: 10,
      onTimeout: false
    }
  };

  if (rpc_url.startsWith('http')) {
    return new Web3.providers.HttpProvider(rpc_url, options);
  } else if (rpc_url.startsWith('ws')) {
    const provider = new Web3.providers.WebsocketProvider(rpc_url, options);
    provider.on('connect', () => console.log(`provider connect ${rpc_url}`));
    provider.on('error', () => {
      console.error(`provider connect error ${rpc_url}`);
      provider.disconnect();
    });
    provider.on('close', () => {
      console.error(`provider connect close ${rpc_url}`);
    });
    return provider;
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
    this.web3 = null;
    this.contracts = new Map();
    this.init();
  }

  init() {
    this.provider = createProvider(this.config.rpcs[0]);
    if (!this.provider) {
      throw new Error(`Failed to create provider for chain`);
    }
    this.web3 = new Web3(this.provider);
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
      if (this.provider && this.provider.disconnect) {
        this.provider.disconnect();
      }
      this.provider = newProvider;
      this.web3.setProvider(this.provider);
      this.contracts.forEach((contract) => {
        contract.setProvider(this.provider);
      });
      return true;
    }
    return false;
  }

  getContract(contractAddress, abi) {
    const key = contractAddress;
    if (!this.contracts.has(key)) {
      const contract = new this.web3.eth.Contract(abi, contractAddress);
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

/// 合约调用函数
async function callContract(chainName, contractAddress, abi, method, params = [], parse) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  
  const methodCall = async () => {
    return await contract.methods[method](...params).call();
  };
  
  const result = await manager.callWithRetry(methodCall);
  return parse ? parse(result) : result;
}

/// 批量调用函数
function addContractCall(calls, chainName, contractAddress, abi, method, params = [], decoder) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  const callData = contract.methods[method](...params).encodeABI();
  
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
      return await multicallContract.methods.aggregate(multicallCalls).call();
    };
    
    const batchResult = await manager.callWithRetry(methodCall);
    
    if (!batchResult) {
      throw new Error(`MultiCall batch ${Math.floor(i / adjustedBatchSize) + 1} returned null result`);
    }

    const decodedResults = batchResult.returnData.map((data, index) => {
      const callIndex = i + index;
      return calls[callIndex]?.decoder ? calls[callIndex].decoder(data) : data;
    });
    
    // 设置blockNumber（只使用第一个成功的batch）
    if (i === 0) {
      results.blockNumber = batchResult.blockNumber;
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
        (data) => web3.eth.abi.decodeParameter('address[]', data)
      );
      assetHandlers.push({ type: 'adapters', asset });
      
      // 获取原币地址
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'asset', [],
        (data) => web3.eth.abi.decodeParameter('address', data)
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
            (data) => web3.eth.abi.decodeParameter('uint8', data)
          );
          handle2s.push((decimals) => {
            if (chainConfig.origins[asset].decimals !== decimals) {
              console.log(`${chainName} ${asset}: Decimals updated from ${chainConfig.origins[asset].decimals} to ${decimals}`);
              chainConfig.origins[asset].decimals = decimals;
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
      (data) => parseInt(data)
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
        (data) => web3.eth.abi.decodeParameter('uint256', data)
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
        (data) => web3.eth.abi.decodeParameters([
          {"name":"fromChainID","type":"uint256"},
          {"name":"fromAccount","type":"bytes"},
          {"name":"toChainID","type":"uint256"},
          {"name":"toAccount","type":"bytes"}
        ], data)
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
        (data) => web3.eth.abi.decodeParameters([
          {"name":"account","type":"bytes"},
          {"name":"name","type":"string"},
          {"name":"symbol","type":"string"},
          {"name":"decimals","type":"uint8"},
          {"name":"chainId","type":"uint256"}
        ], data)
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
  // const now = Date.now()
  // if (now - gPoolsInfo.poolTime > 6000000) {
  //   console.info(`try get pools`)
  //   do {
  //     try {
  //       const res = await axios.get(`https://yields.llama.fi/pools`)
  //       console.info(`try get pools end`)
  //       if (res.status === 200) {
  //         if (res.data.status === 'success') {
  //           gPoolsInfo.pools = res.data.data
  //           gPoolsInfo.poolTime = Date.now()
  //           fs.writeFileSync(gPoolsFilePath, JSON.stringify(gPoolsInfo, null, 2))
  //           break
  //         }
  //       }
  //     } catch (error) {
  //     }
  //     await sleep(10000)
  //   } while (true);
  // }

  const poolsAll = gPoolsInfo.pools
  let pools = poolsAll.filter(pool => {
    const key = `${pool.symbol}:${pool.chain}:${pool.project}`
    // 我们支持的 资产、链、平台
    if (supportProjects[key]) {
      // 只信任低风险
      if (pool.ilRisk === 'no') {
        return true
      }
    }
    return false
  })

  return pools
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

const gFeesFilePath = path.resolve(__dirname, "./config/fees.json");
const gFeesInfo = tryLoadJsonObj(gFeesFilePath, {feesTime: 0, fees: {}, feeTokenPairs: {}})
async function getFees() {
  const now = Date.now()
  if (now - gFeesInfo.feesTime > 6000000) {
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
            if (!fees[key1] || (id > fees[key1].id)) {
              const feeDetail = await reqQuotaAndFee(fromChainSymbol, toChainSymbol, id, tokenSymbol)
              fees[key1] = { ...feeDetail, id}
              feeTokenPairs[id] = tokenPair
            } else {
              feeTokenPairs[id] = tokenPair
              console.warn(`${key1} already exist, old id = ${fees[key1].id}, new id = ${id}`)
            }
            const key2 = `${asset}:${toChain}->${fromChain}`
            if (!fees[key2] || (id > fees[key2].id)) {
              const feeDetail = await reqQuotaAndFee(toChainSymbol, fromChainSymbol, id, tokenSymbol)
              fees[key2] = { ...feeDetail, id}
              feeTokenPairs[id] = tokenPair
            } else {
              feeTokenPairs[id] = tokenPair
              console.warn(`${key2} already exist, old id = ${fees[key2].id}, new id = ${id}`)
            }
          }
        }
      }
    }
    gFeesInfo.feesTime = Date.now()
    gFeesInfo.feeTokenPairs = feeTokenPairs
    gFeesInfo.fees = fees
    fs.writeFileSync(gFeesFilePath, JSON.stringify(gFeesInfo, null, 2))
  }

  return gFeesInfo
}
/// getApyTvl 函数（保留）
async function getApyTvl() {
  const vaults = [];
  const supportProjects = {};

  const chains = Object.keys(defiChainConfigs);
  const assets = Object.keys(vaultConfigs);
  
  // 获取vaults信息
  for (const chainName of chains) {
    console.log(`\n=== Processing ${chainName} for VAULT ===`);
    const calls = [];
    const handleResults = [];
    
    const chainConfig = defiChainConfigs[chainName];
    const chainDecimals = chainConfig.decimals !== undefined ? chainConfig.decimals : 18;
    const chainUnit = BigNumber(10).pow(chainDecimals);

    for (const asset of assets) {
      const vault = {
        chain: chainName,
        asset,
        totalAssets: '0',
        availableBalance: '0',
        yielding: {}
      };

      const tokenUnit = BigNumber(10).pow(chainConfig.origins[asset].decimals || 18);
      const vaultAddress = vaultConfigs[asset].address;
      
      // 获取总持仓
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'totalAssets', [],
        (data) => web3.eth.abi.decodeParameter('uint256', data)
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
          (data) => web3.eth.abi.decodeParameter('uint256', data)
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
          (data) => web3.eth.abi.decodeParameter('uint256', data)
        );
        handleResults.push((balance) => {
          vault.availableBalance = BigNumber(balance || 0).dividedBy(chainUnit).toString();
        });
      } else if (assetOrigin?.address) {
        addContractCall(
          calls, chainName, assetOrigin.address, erc20Abi, 'balanceOf', [vaultAddress],
          (data) => web3.eth.abi.decodeParameter('uint256', data)
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
      
      console.log(`${chainName} vaults:`, JSON.stringify(
        vaults.filter(v => v.chain === chainName),
        null, 2
      ));
      
    } catch (error) {
      console.error(`Failed to get VAULT for ${chainName}:`, error.message);
    }
  }
  console.log('Support projects:', Object.keys(supportProjects));
  console.log('\n=== VAULT collection completed ===');

  // 获取pools
  const pools = await getPools(supportProjects)

  const {fees} = await getFees()

  
  const rt = {
    pools,
    fees,
    vaults
  };
  const gFeesFilePath = path.resolve(__dirname, "./config/apyTvls.json");
  fs.writeFileSync(gFeesFilePath, JSON.stringify(rt, null, 2))
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
        (data) => web3.eth.abi.decodeParameter('address[]', data)
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