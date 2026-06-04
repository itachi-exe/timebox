require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const helmet       = require('helmet')
const rateLimit    = require('express-rate-limit')
const config       = require('./config')
const routes       = require('./routes')
const errorHandler = require('./middleware/errorHandler')

const app = express()

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin:      config.frontendUrl,
  methods:     ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}))

// Rate limiting — 60 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, slow down.' },
}))

// Stricter limit on write endpoints
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message: { error: 'Too many capsule requests, slow down.' },
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), network: config.sui.network })
})

app.use('/api', routes)
app.use('/api/capsule', writeLimiter)

app.use(errorHandler)

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }))

const server = app.listen(config.port, () => {
  console.log(`TimeBox API  →  http://localhost:${config.port}`)
  console.log(`Sui network  →  ${config.sui.network}`)
  console.log(`Walrus       →  ${config.walrus.publisherUrl}`)
})

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully`)
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

module.exports = app
