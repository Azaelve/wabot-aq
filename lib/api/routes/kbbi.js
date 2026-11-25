const express = require('express')
const { asyncHandler, requireParam, callUpstream } = require('../errors')
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
      const kata = requireParam(req.query.kata || req.query.q, 'kata')
      const message = await callUpstream('Gagal mengambil data KBBI', () => kbbi(kata))
      res.json({ status: true, message })
    }))
    return router
  },
}
