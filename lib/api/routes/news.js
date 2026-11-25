const express = require('express')
const { ApiError, asyncHandler } = require('../errors')
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
      let data
      try {
        data = await berita(req.params.sumber)
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil berita: ' + e.message)
      }
      res.json(data)
    }))
    return router
  },
}
