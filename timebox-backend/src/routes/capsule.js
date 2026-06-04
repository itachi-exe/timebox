const router = require('express').Router()
const walrus = require('../services/walrus')
const sui    = require('../services/sui')
const config = require('../config')

const BLOB_ID_RE = /^[A-Za-z0-9_-]{20,100}$/

function calcFee(unlockTimestamp) {
  const days = Math.max(1, Math.round((unlockTimestamp - Date.now()) / 86400000))
  return parseFloat(Math.max(0.08, 0.05 + (days / 365) * 0.04).toFixed(2))
}

function epochsForDuration(unlockTimestamp) {
  const days = Math.max(1, Math.ceil((unlockTimestamp - Date.now()) / 86400000))
  return Math.max(config.walrus.defaultEpochs, Math.ceil(days / 30))
}

// GET /api/capsule/fee?unlockDate=YYYY-MM-DD
router.get('/fee', (req, res) => {
  const { unlockDate } = req.query
  if (!unlockDate) return res.status(400).json({ error: 'unlockDate required' })

  const unlockTimestamp = new Date(unlockDate).getTime()
  if (isNaN(unlockTimestamp)) return res.status(400).json({ error: 'Invalid unlockDate' })
  if (unlockTimestamp <= Date.now()) return res.status(400).json({ error: 'unlockDate must be in the future' })

  res.json({ fee: calcFee(unlockTimestamp), currency: 'WAL', epochs: epochsForDuration(unlockTimestamp) })
})

// POST /api/capsule — encrypt and upload to Walrus
router.post('/', async (req, res, next) => {
  try {
    const { message, unlockDate, attachment } = req.body

    if (!message?.trim())      return res.status(400).json({ error: 'message is required' })
    if (!unlockDate)           return res.status(400).json({ error: 'unlockDate is required' })
    if (message.length > 5000) return res.status(400).json({ error: 'message too long (max 5000 chars)' })

    const unlockTimestamp = new Date(unlockDate).getTime()
    if (isNaN(unlockTimestamp))       return res.status(400).json({ error: 'Invalid unlockDate' })
    if (unlockTimestamp <= Date.now()) return res.status(400).json({ error: 'unlockDate must be in the future' })

    const { generateKey, encrypt } = require('../services/encryption')
    const key     = generateKey()
    const payload = JSON.stringify({ message: message.trim(), attachment: attachment || null, created: Date.now() })
    const blob    = encrypt(payload, key)

    const blobId = await walrus.uploadBlob(blob, epochsForDuration(unlockTimestamp))

    res.status(201).json({
      blobId,
      encryptionKey:  key.toString('hex'),
      unlockTimestamp,
      fee:            calcFee(unlockTimestamp),
      currency:       'WAL',
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/capsule/address/:address — list capsules by wallet
router.get('/address/:address', async (req, res, next) => {
  try {
    if (!sui.isValidSuiAddress(req.params.address)) {
      return res.status(400).json({ error: 'Invalid Sui address' })
    }
    const capsules = await sui.getCapsulesByAddress(req.params.address)
    res.json({ capsules })
  } catch (err) {
    next(err)
  }
})

// GET /api/capsule/:blobId/blob — return raw encrypted blob for client-side decryption
// The server NEVER sees the plaintext — decryption always happens in the browser.
router.get('/:blobId/blob', async (req, res, next) => {
  try {
    const { blobId }   = req.params
    const { capsuleId } = req.query

    if (!BLOB_ID_RE.test(blobId)) return res.status(400).json({ error: 'Invalid blobId' })

    // Verify time-lock on-chain if capsuleId provided
    if (capsuleId) {
      const capsule = await sui.getCapsuleById(capsuleId)
      if (!capsule.isUnlocked) {
        return res.status(403).json({
          error:          'Capsule is still time-locked',
          unlocksAt:      capsule.unlockTimestamp,
          unlocksAtHuman: new Date(capsule.unlockTimestamp).toISOString(),
        })
      }
    }

    const encrypted = await walrus.downloadBlob(blobId)
    res.set('Content-Type', 'application/octet-stream')
    res.send(encrypted)
  } catch (err) {
    next(err)
  }
})

module.exports = router
