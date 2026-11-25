const express = require('express')
const { asyncHandler, callUpstream } = require('../errors')
const { berita } = require('../scrapers')

/**
 * Berita dari feed RSS (cnn, antara, republika, cnbc).
 * path: /news/:sumber
 */
module.exports = {
  name: 'news',
  path: '/news',
  createRouter() {
    const router = express.Router()
    router.get('/:sumber', asyncHandler(async (req, res) => {
      res.json(await callUpstream('Gagal mengambil berita', () => berita(req.params.sumber)))
    }))
    return router
  },
}
