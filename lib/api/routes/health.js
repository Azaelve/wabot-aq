const express = require('express')

/**
 * Status API lokal.
 * path: /health
 */
module.exports = {
  name: 'health',
  path: '/health',
  createRouter() {
    const router = express.Router()
    router.get('/', (req, res) => res.json({ status: true, uptime: process.uptime() }))
    return router
  },
}
