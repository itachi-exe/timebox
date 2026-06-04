const router  = require('express').Router()
const capsule = require('./capsule')

router.use('/capsule', capsule)

module.exports = router
