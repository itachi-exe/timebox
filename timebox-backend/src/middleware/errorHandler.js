const config = require('../config')

function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500
  const isDev  = config.nodeEnv === 'development'

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.message}`)
    if (isDev) console.error(err.stack)
  }

  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    ...(isDev && status >= 500 && { detail: err.message }),
  })
}

module.exports = errorHandler
