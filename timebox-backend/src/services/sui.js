const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client')
const config = require('../config')

// Use Tatum RPC URL if API key provided, otherwise fall back to public fullnode
const rpcUrl = config.tatum.apiKey
  ? config.tatum.suiRpc
  : getFullnodeUrl(config.sui.network)

const client = new SuiClient({ url: rpcUrl })

// Validate Sui address format (0x + 64 hex chars)
function isValidSuiAddress(addr) {
  return /^0x[0-9a-fA-F]{64}$/.test(addr)
}

async function getCapsulesByAddress(address) {
  if (!config.sui.contractAddress) return []
  if (!isValidSuiAddress(address))  throw new Error('Invalid Sui address')

  const { data } = await client.getOwnedObjects({
    owner:   address,
    filter:  { StructType: `${config.sui.contractAddress}::timebox::Capsule` },
    options: { showContent: true },
  })

  return data.map((obj) => {
    const fields = obj.data?.content?.fields || {}
    const unlockTs = parseInt(fields.unlock_timestamp_ms || fields.unlock_timestamp || '0')
    return {
      id:              obj.data?.objectId,
      blobId:          fields.blob_id,
      unlockTimestamp: unlockTs,
      isUnlocked:      Date.now() >= unlockTs,
      createdAt:       parseInt(fields.created_at_ms || '0'),
    }
  })
}

async function getCapsuleById(capsuleId) {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(capsuleId)) throw new Error('Invalid capsule ID')

  const obj = await client.getObject({
    id:      capsuleId,
    options: { showContent: true },
  })

  if (!obj.data) throw new Error('Capsule not found')

  const fields   = obj.data.content?.fields || {}
  const unlockTs = parseInt(fields.unlock_timestamp_ms || fields.unlock_timestamp || '0')

  return {
    id:              obj.data.objectId,
    blobId:          fields.blob_id,
    unlockTimestamp: unlockTs,
    isUnlocked:      Date.now() >= unlockTs,
    createdAt:       parseInt(fields.created_at_ms || '0'),
  }
}

module.exports = { client, getCapsulesByAddress, getCapsuleById, isValidSuiAddress }
