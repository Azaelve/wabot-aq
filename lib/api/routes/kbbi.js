const express = require('express')
const { text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')
const { kbbi } = require('../scrapers')

/**
 * Arti kata KBBI (scraper kbbi.web.id).
 * path: /kbbi
 */
module.exports = {
  name: 'kbbi',
  path: '/kbbi',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const kata = text(req.query.kata || req.query.q)
      if (!kata) throw ApiError.badRequest('Parameter kata wajib diisi')

      let message
      try {
        message = await kbbi(kata)
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil data KBBI: ' + e.message)
      }
      res.json({ status: true, message })
    }))
    return router
  },
}
