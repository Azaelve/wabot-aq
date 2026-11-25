const express = require('express')
const { asyncHandler, requireParam, callUpstream } = require('../errors')
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
      const q = requireParam(req.query.q, 'q')
      const result = await callUpstream('Gagal mencari kode pos', () => kodepos(q))
      res.json({ status: true, result })
    }))
    return router
  },
}
