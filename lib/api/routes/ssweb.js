const express = require('express')
const { request } = require('../http')
const { asyncHandler, requireParam, callUpstream } = require('../errors')

/**
 * Screenshot halaman web lewat thum.io (tanpa API key).
 * path: /api/ssweb
 */
module.exports = {
  name: 'ssweb',
  path: '/api/ssweb',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      let url = requireParam(req.query.url, 'url')
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url

      const full = req.query.full && req.query.full !== 'false' && req.query.full !== '0'
      const target = full
        ? `https://image.thum.io/get/width/1080/fullpage/${url}`
        : `https://image.thum.io/get/width/1080/crop/1200/${url}`

      const shot = await callUpstream('Gagal mengambil screenshot', () =>
        request(target, { timeout: 45000 }))

      res.set('Content-Type', shot.headers.get('content-type') || 'image/png')
      res.send(await shot.buffer())
    }))
    return router
  },
}
