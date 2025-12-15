const Web3 = require('web3');
const web3 = new Web3()

const vaultAbi = require('./abi/abi.vault.json')
const erc20Abi = require('./abi/abi.erc20.json')
const multiCallAbi = require('./abi/abi.multicall2.json')
const tokenManagerAbi = require('./abi/abi.TokenManagerDelegateV2.json')

const defiChainConfigs = {
  "Ethereum": {
    bip44: 2147483708,
    rpcs: [
      "https://eth.meowrpc.com",
      "https://rpc.mevblocker.io",
      "https://ethereum.publicnode.com",
      "https://gateway.tenderly.co/public/mainnet",
      "https://1rpc.io/eth"
    ],
    adapters: {
      "USDT:aave-v3": '0x846a3C785882015B660977c2d6EB1233c00DAF49',
    },
    origins: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
    multicallAddr: "0xeefba1e63905ef1d7acba5a8513c70307c1ce441",
    tokenManagerAddr: '0xbab93311de250b5b422c705129b3617b3cb6e9e1',
    // oracleAddr
    // crossScAddr
    // tokenManagerAddr
    // transChainID
    // chainID
  },
  "Arbitrum": {
    bip44: 1073741826,
    rpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://1rpc.io/arb",
      "https://arbitrum-one.publicnode.com",
      "https://api.tatum.io/v3/blockchain/node/arb-one-mainnet"
    ],
    adapters: {},
    origins: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
    multicallAddr: "0xb66f96e30d6a0ae64d24e392bb2dbd25155cb3a6",
    tokenManagerAddr: '0xc928c8e48647c8b0ce550c2352087b1cf5c6111e',
  },
  "Wanchain": {
    bip44: 2153201998,
    rpcs: [
      'https://gwan-ssl.wandevs.org:56891',
    ],
    adapters: {},
    origins: {
      USDT: '0x11e77E27Af5539872efEd10abaA0b408cfd9fBBD',
    },
    multicallAddr: "0xba5934ab3056fca1fa458d30fbb3810c3eb5145f",
    tokenManagerAddr: '0x9fdf94dff979dbecc2c1a16904bdfb41d305053a',
  },
  "BSC": {
    bip44: 2147484362,
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
      USDT: '0x55d398326f99059fF775485246999027B3197955',
    },
    multicallAddr: "0x023a33445f11c978f8a99e232e1c526ae3c0ad70",
    tokenManagerAddr: '0x39af91cba3aed00e9b356ecc3675c7ef309017dd',
  },
  "Polygon": {
    bip44: 2147484614,
    rpcs: [
      "https://polygon-rpc.com",
      "https://polygon.drpc.org",
      "https://rpc-mainnet.matic.quiknode.pro",
      "https://polygon.api.onfinality.io/public"
    ],
    adapters: {},
    origins: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
    multicallAddr: "0x1bbc16260d5d052f1493b8f2aeee7888fed1e9ab",
    tokenManagerAddr: "0xc928c8e48647c8b0ce550c2352087b1cf5c6111e",
  },
  "Optimism": {
    bip44: 2147484262,
    rpcs: [
      "https://optimism.publicnode.com",
      "https://1rpc.io/op",
      "https://optimism.meowrpc.com",
      "https://api.tatum.io/v3/blockchain/node/optimism-mainnet"
    ],
    adapters: {},
    origins: {
      USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    },
    multicallAddr: "0x2dc0e2aa608532da689e89e237df582b783e552c",
    tokenManagerAddr: "0x1ed3538383bbfdb80343b18f85d6c5a5fb232fb6",
  },
  "Avalanche": {
    bip44: 2147492648,
    rpcs: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://avax.meowrpc.com",
      "https://1rpc.io/avax/c"
    ],
    adapters: {},
    origins: {
      USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
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

// 常量定义
const BATCH_SIZE = 100; // 每次处理的调用数量

/// 工具函数
function createProvider(rpc_url) {
  if (!rpc_url) {
    console.error('rpc error');
    return null;
  }

  const options = {
    timeout: 5000,
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
    this.rpcIndex = (this.rpcIndex + 1) % this.config.rpcs.length;
    const newProvider = createProvider(this.config.rpcs[this.rpcIndex]);
    if (newProvider) {
      this.provider = newProvider;
      this.web3.setProvider(this.provider);
      this.contracts.clear(); // 清除合约缓存，因为新的provider需要重新连接
    }
  }

  getContract(contractAddress, abi) {
    const key = contractAddress //`${contractAddress}_${JSON.stringify(abi)}`;
    if (!this.contracts.has(key)) {
      const contract = new this.web3.eth.Contract(abi, contractAddress);
      this.contracts.set(key, contract);
    }
    return this.contracts.get(key);
  }

  async callWithRetry(method, ...args) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.config.rpcs.length; attempt++) {
      try {
        return await method(...args);
      } catch (error) {
        lastError = error;
        if (attempt < this.config.rpcs.length - 1) {
          this.switchRpc();
        }
      }
    }
    
    console.error(`All RPC attempts failed:`, lastError);
    return null;
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
async function callContract(chainName, contractAddress, abi, method, params = []) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  
  const methodCall = async () => {
    return await contract.methods[method](...params).call();
  };
  
  return await manager.callWithRetry(methodCall);
}

/// 批量调用函数
function prepareContractCall(chainName, contractAddress, abi, method, params = [], decoder) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  const callData = contract.methods[method](...params).encodeABI();
  
  return {
    target: contractAddress,
    callData,
    decoder,
    abi
  };
}
function addContractCall(calls, chainName, contractAddress, abi, method, params = [], decoder) {
  const manager = getChainManager(chainName);
  const contract = manager.getContract(contractAddress, abi);
  const callData = contract.methods[method](...params).encodeABI();
  
  const call =  {
    target: contractAddress,
    callData,
    decoder,
    abi
  };

  calls.push(call)
}

async function multiCallBatch(chainName, calls, batchSize = BATCH_SIZE, allowFailure = false) {
  if (!calls || calls.length === 0) {
    return allowFailure ? [] : { blockNumber: 0, results: [] };
  }

  const manager = getChainManager(chainName);
  const multiCallAddress = defiChainConfigs[chainName]?.multicallAddr;
  if (!multiCallAddress) {
    throw new Error(`MultiCall address not configured for chain ${chainName}`);
  }

  const multicallContract = manager.getContract(multiCallAddress, multiCallAbi);
  const results = [];

  // 分批处理
  for (let i = 0; i < calls.length; i += batchSize) {
    const batchCalls = calls.slice(i, i + batchSize);
    const multicallCalls = batchCalls.map(c => ({
      target: c.target,
      callData: c.callData
    }));

    try {
      let batchResult;
      
      if (allowFailure) {
        // 我们的multicall居然不支持
        const methodCall = async () => {
          return await multicallContract.methods.tryAggregate(false, multicallCalls).call();
        };
        batchResult = await manager.callWithRetry(methodCall);
        
        if (batchResult) {
          results.push(...batchResult.map((result, index) => {
            const callIndex = i + index;
            if (result.success && calls[callIndex]?.decoder) {
              return calls[callIndex].decoder(result.returnData);
            }
            return result.success ? result.returnData : null;
          }));
        }
      } else {
        const methodCall = async () => {
          return await multicallContract.methods.aggregate(multicallCalls).call();
        };
        batchResult = await manager.callWithRetry(methodCall);
        
        if (batchResult) {
          const decodedResults = batchResult.returnData.map((data, index) => {
            const callIndex = i + index;
            return calls[callIndex]?.decoder ? calls[callIndex].decoder(data) : data;
          });
          
          // 如果是最后一批或者是第一批（设置blockNumber）
          if (i === 0) {
            results.push({
              blockNumber: batchResult.blockNumber,
              results: decodedResults
            });
          } else {
            // 合并结果
            results[0].results.push(...decodedResults);
          }
        }
      }
    } catch (error) {
      console.error(`MultiCall batch ${i/batchSize + 1} failed:`, error);
      // 对于失败的情况，填充null值
      const nullResults = Array(batchCalls.length).fill(null);
      if (allowFailure) {
        results.push(...nullResults);
      } else {
        if (i === 0) {
          results.push({
            blockNumber: 0,
            results: nullResults
          });
        } else {
          results[0].results.push(...nullResults);
        }
      }
    }
  }

  return allowFailure ? results : results[0];
}

/// 批量准备调用的工具函数
function prepareMultipleCalls(chainName, baseConfigs) {
  const calls = [];
  
  baseConfigs.forEach(config => {
    const {
      contractAddress,
      abi,
      method,
      params = [],
      decoder
    } = config;
    
    const call = prepareContractCall(chainName, contractAddress, abi, method, params, decoder);
    calls.push(call);
  });
  
  return calls;
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
// 如果需要更简洁的版本，这里是一个只返回数组的简单版本：
function findAddressDifferences(addrs, adapters) {
  const adapterAddresses = Object.values(adapters);
  const adapterSet = new Set(adapterAddresses);
  const addrSet = new Set(addrs);
  
  return {
    // addrs中有但adapters中没有
    onlyInAddrs: addrs.filter(addr => !adapterSet.has(addr)),
    // adapters中有但addrs中没有  
    onlyInAdapters: adapterAddresses.filter(addr => !addrSet.has(addr)),
    // 两者都有的
    common: addrs.filter(addr => adapterSet.has(addr))
  };
}

async function initVaultAddress() {
  const chains = Object.keys(defiChainConfigs);
  const assets = Object.keys(vaultConfigs)

  for (const chainName of chains) {
    // chainName: Ethereum, Wanchain, ...
    const calls = []
    for (const asset of assets) {
      // asset: USDT, USDC, WBTC, WETH, WAN
      const vaultAddress = vaultConfigs[asset].address
      // 获取所有adapters
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'getAllAdapters', [],
        (data) => web3.eth.abi.decodeParameter('address[]', data)
      )
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'asset', [],
        (data) => web3.eth.abi.decodeParameter('address', data)
      )
    }
    const result = await multiCallBatch(chainName, calls, 5, false);
    console.log(`${chainName}, blockNumber: ${result?.blockNumber}, results count: ${result?.results?.length}, ${JSON.stringify(result, null, 2)}`);
    // 把结果分配
    const chainConfig = defiChainConfigs[chainName]
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]
      const results = result.results
      const adapterAddrs = results[0]
      const originAddress = results[1]
      // 提醒adapter是否相同
      const adapterConfigs = chainConfig.adapters
      const {onlyInAddrs, onlyInAdapters} = findAddressDifferences(adapterAddrs, adapterConfigs)
      if (onlyInAddrs.length !== 0 || onlyInAdapters.length !== 0) {
        console.warn(`${chainName}, adapter address not same, onlyInContracts ${JSON.stringify(onlyInAddrs)}, onlyInConfig is ${onlyInAdapters}`)
      }
      if (chainConfig.origins[asset] !== originAddress) {
        console.log(`${chainName}, ${asset} address not same, old ${chainConfig.origins[asset]} !== new ${originAddress}`)
        chainConfig.origins[asset] = originAddress
      }
    }
  }
}

async function getApyTvl() {
  // 获取vault，根据vault筛选我们需要的tokenPair和pool

  const vaults = []

  const chains = Object.keys(defiChainConfigs);
  const assets = Object.keys(vaultConfigs)

  for (const chainName of chains) {
    const calls = []
    // 获取adapters
    for (const asset of assets) {
      const vaultAddress = vaultConfigs[asset].address
      const assetAddress = vaultConfigs[asset].assetAddress
      // 获取所有adapters
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'getAllAdapters', [],
        (data) => web3.eth.abi.decodeParameter('address[]', data)
      )
      // 获取持仓
      addContractCall(
        calls, chainName, vaultAddress, vaultAbi, 'totalAssets', [],
        (data) => web3.eth.abi.decodeParameter('uint256', data)
      )
      // 获取余额或地址
      if (!assetAddress) {
        addContractCall(
          calls, chainName, vaultAddress, vaultAbi, 'asset', [],
          (data) => web3.eth.abi.decodeParameter('uint256', data)
        )
      }
    }
  }
}


/// 测试函数
async function testMultiCall(chainName) {
  const calls = [];
  const contractAddress = vaultConfigs.USDT.address;
  
  // 示例1：单个调用
  const call1 = prepareContractCall(
    chainName, 
    contractAddress, 
    vaultAbi, 
    'getAllAdapters', 
    [], 
    (data) => web3.eth.abi.decodeParameter('address[]', data)
  );
  calls.push(call1);
  
  // 示例2：模拟多个调用（可以扩展到1000个）
  const multipleCalls = [];
  for (let i = 0; i < 10; i++) { // 示例：10个调用
    const call = prepareContractCall(
      chainName,
      contractAddress,
      vaultAbi,
      'getAllAdapters',
      [],
      (data) => web3.eth.abi.decodeParameter('address[]', data)
    );
    multipleCalls.push(call);
  }
  
  // 测试批量调用（allowFailure = false）
  const result = await multiCallBatch(chainName, calls, 5, false);
  console.log(`${chainName}, blockNumber: ${result?.blockNumber}, results count: ${result?.results?.length}`);
  
  // 测试大批量调用（分批次）
  if (multipleCalls.length > 0) {
    const batchResult = await multiCallBatch(chainName, multipleCalls, 5, false); // 每5个一批
    console.log(`${chainName}, Batch - blockNumber: ${batchResult?.blockNumber}, total results: ${batchResult?.results?.length}`);
  }
  
  // 测试allowFailure模式, 我们的不支持
  // const failureResult = await multiCallBatch(chainName, calls, 3, true);
  // console.log(`${chainName}, AllowFailure results:`, failureResult);
}
async function testAllChain() {
  const chains = Object.keys(defiChainConfigs);
  
  for (const chainName of chains) {
    try {
      console.log(`\n=== Testing ${chainName} ===`);
      await testMultiCall(chainName);
      
      // 也可以测试原始函数
      // const adapters = await getVaultAdapters('USDT', chainName);
      // console.log(`${chainName} adapters: ${JSON.stringify(adapters, null, 2)}`);
    } catch (error) {
      console.error(`Error on chain ${chainName}:`, error.message);
    }
  }
  
  console.log('\n=== All tests completed ===');
}

/// 主函数
const main = async () => {
  await initVaultAddress()
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', err => {
  log.error(`uncaughtException: ${err.data}, ${err.message}`, err)
});

main().catch(console.error);
