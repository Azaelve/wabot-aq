const express = require('express')
const { asyncHandler, requireParam, callUpstream } = require('../errors')
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
      const q = requireParam(req.query.q, 'q')
      res.json(await callUpstream('Gagal mengambil resep', () => resep(q)))
    }))
    return router
  },
}
