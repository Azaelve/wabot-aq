const express = require('express')
const { text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')
const { kodepos } = require('../scrapers')

/**
 * Pencarian kode pos (API carikodepos.id, tanpa API key).
 * path: /kodepos
 */
module.exports = {
  name: 'kodepos',
  path: '/kodepos',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const q = text(req.query.q)
      if (!q) throw ApiError.badRequest('Parameter q wajib diisi')

      let result
      try {
        result = await kodepos(q)
      } catch (e) {
        throw ApiError.upstream('Gagal mencari kode pos: ' + e.message)
      }
      res.json({ status: true, result })
    }))
    return router
  },
}
