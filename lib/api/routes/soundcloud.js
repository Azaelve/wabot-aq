const express = require('express')
const { search } = require('../scrapers/soundcloud')
const { asyncHandler, requireParam, callUpstream } = require('../errors')

/**
 * Pencarian lagu SoundCloud.
 * path: /api/soundcloud?q=...&limit=5&offset=0
 */
module.exports = {
  name: 'soundcloud',
  path: '/api/soundcloud',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const q = requireParam(req.query.q, 'q')
      const result = await callUpstream('Gagal mencari lagu di SoundCloud', () => search(q, {
        limit: req.query.limit,
        offset: req.query.offset,
      }))
      res.json({ status: true, result })
    }))
    return router
  },
}
