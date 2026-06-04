require('dotenv').config()

function required(key) {
  const val = process.env[key]
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${key}`)
  }
  return val || ''
}

module.exports = {
  port:        parseInt(process.env.PORT) || 4000,
  nodeEnv:     process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3333',

  tatum: {
    apiKey: process.env.TATUM_API_KEY || '',
    suiRpc: process.env.TATUM_SUI_RPC || 'https://fullnode.testnet.sui.io',
  },

  sui: {
    network:         process.env.SUI_NETWORK || 'testnet',
    contractAddress: process.env.CONTRACT_ADDRESS || '',
  },

  walrus: {
    publisherUrl:  process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space',
    aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space',
    defaultEpochs: parseInt(process.env.WALRUS_EPOCHS_DEFAULT) || 5,
    timeoutMs:     parseInt(process.env.WALRUS_TIMEOUT_MS) || 30000,
  },
}
