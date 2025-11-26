const Web3 = require('web3');
const axios = require('axios');

// AAVE V2 LendingPool contract ABI for fetching TVL and APY
const lendingPoolAbi = [
    {
        "constant": true,
        "inputs": [{ "name": "asset", "type": "address" }],
        "name": "getReserveData",
        "outputs": [
            { "name": "totalLiquidity", "type": "uint256" },
            { "name": "totalBorrowsStable", "type": "uint256" },
            { "name": "totalBorrowsVariable", "type": "uint256" },
            { "name": "liquidityRate", "type": "uint256" }, // APY
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

const chains = {
    ethereum: 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
    polygon: 'https://polygon-rpc.com',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    fantom: 'https://rpcapi.fantom.network',
    harmony: 'https://api.harmony.one'
};

// AAVE contract addresses for different chains (example)
const aaveContractAddresses = {
    ethereum: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Example: Ethereum LendingPool address
    polygon: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Replace with actual address
    avalanche: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Replace with actual address
    arbitrum: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Replace with actual address
    optimism: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Replace with actual address
    fantom: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f', // Replace with actual address
    harmony: '0x3dfd13dd660a87196d2433b8086fa493507e3a5f'  // Replace with actual address
};

async function getAaveData(chain) {
    const web3 = new Web3(new Web3.providers.HttpProvider(chains[chain]));
    const lendingPool = new web3.eth.Contract(lendingPoolAbi, aaveContractAddresses[chain]);
    
    // Token addresses (USDC, USDT, WBTC, ETH, WAN) for example:
    const tokens = {
        USDC: '0xA0b86991c6218b36c1d19D4a2e9eb0ce3606e01f',
        USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        WAN: '0x0b80030fb1b02e6f003ec78bb7e6c4df9b804c4f',
    };
    
    for (const [asset, address] of Object.entries(tokens)) {
        try {
            const data = await lendingPool.methods.getReserveData(address).call();
            const liquidityRate = web3.utils.fromWei(data.liquidityRate, 'ether');
            const totalLiquidity = web3.utils.fromWei(data.totalLiquidity, 'ether');
            
            console.log(`${asset} APY: ${liquidityRate}%`);
            console.log(`${asset} TVL: $${totalLiquidity}`);
        } catch (error) {
            console.error(`Error fetching data for ${asset} on ${chain}:`, error);
        }
    }
}

// Get data from all chains
async function getAllChainsData() {
    for (const chain of Object.keys(chains)) {
        console.log(`Fetching data for ${chain}...`);
        await getAaveData(chain);
    }
}

getAllChainsData();
