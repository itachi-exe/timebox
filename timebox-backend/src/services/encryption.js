const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const KEY_LEN   = 32
const IV_LEN    = 16
const TAG_LEN   = 16

function generateKey() {
  return crypto.randomBytes(KEY_LEN)
}

function encrypt(plaintext, key) {
  const iv      = crypto.randomBytes(IV_LEN)
  const cipher  = crypto.createCipheriv(ALGORITHM, key, iv)
  const payload = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag     = cipher.getAuthTag()
  // Layout: [iv (16)] [tag (16)] [ciphertext]
  return Buffer.concat([iv, tag, payload])
}

function decrypt(ciphertext, key) {
  const iv       = ciphertext.slice(0, IV_LEN)
  const tag      = ciphertext.slice(IV_LEN, IV_LEN + TAG_LEN)
  const data     = ciphertext.slice(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

module.exports = { generateKey, encrypt, decrypt }
