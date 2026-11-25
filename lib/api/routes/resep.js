const express = require('express')
const { text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')
const { resep } = require('../scrapers')

/**
 * Resep masakan (scraper resepkoki.id).
 * path: /api/resep-masak
 */
module.exports = {
  name: 'resep',
  path: '/api/resep-masak',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const q = text(req.query.q)
      if (!q) throw ApiError.badRequest('Parameter q wajib diisi')

      let data
      try {
        data = await resep(q)
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil resep: ' + e.message)
      }
      res.json(data)
    }))
    return router
  },
}
