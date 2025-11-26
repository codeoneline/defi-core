链抽象最新任务分工：
- 前端：molin
- 智能合约：molin
// https://lolieatapple.notion.site/Wan-Bridge-HTTP-API-EN-1222c274857b80109a21dd414b17baed#1b69300214744c1792479e80298439f2
// https://bridge-api.wanchain.org/api/quotaAndFee?fromChainType=[fromChainType]&toChainType=[toChainType]&tokenPairID=[tokenPairID]&symbol=[symbol]
// example: https://bridge-api.wanchain.org/api/quotaAndFee?fromChainType=ETH&toChainType=BTC&tokenPairID=14&symbol=BTC
// response: {
//               "success": true,
//               "data": {
//                 "symbol": "BTC",
//                 "minQuota": "0",
//                 "maxQuota": "5061694752",
//                 "networkFee": {
//                   "value": "0",
//                   "isPercent": false
//                 },
//                 "operationFee": {
//                   "value": "0.006",
//                   "isPercent": true,
//                   "minFeeLimit": "35000",
//                   "maxFeeLimit": "50000000"
//                 }
//               }
//             }
- 后端：Defi数据抓取，Vault持仓和余额抓取，跨链手续费抓取，AI输入提示词组织； jishiwu
- 后端：AI系统提示词设计，调用Deepseek API，获取返回的思维链和JSON输出，按照JSON输出调用合约； zhanglihua
- 后端：用户钱包资产信息获取API；zhanglihua

另外根据lini的最新消息，初期上线就要支持USDC, USDT, WBTC, ETH, WAN 这5种资产。可以考虑一下如何实现才能方便扩展。
平台：'aave', 'compound', 'venus','benqi','makerdao'