const config = require('../config')

function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Walrus request timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

async function uploadBlob(data, epochs) {
  const url = `${config.walrus.publisherUrl}/v1/blobs?epochs=${epochs}`

  const res = await withTimeout(
    fetch(url, {
      method:  'PUT',
      body:    data,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
    config.walrus.timeoutMs
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Walrus upload failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  const blobId =
    result.newlyCreated?.blobObject?.blobId ||
    result.alreadyCertified?.blobId

  if (!blobId) throw new Error('Walrus returned no blobId')
  return blobId
}

async function downloadBlob(blobId) {
  const url = `${config.walrus.aggregatorUrl}/v1/${blobId}`

  const res = await withTimeout(
    fetch(url),
    config.walrus.timeoutMs
  )

  if (!res.ok) throw new Error(`Walrus download failed (${res.status})`)

  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}

module.exports = { uploadBlob, downloadBlob }
