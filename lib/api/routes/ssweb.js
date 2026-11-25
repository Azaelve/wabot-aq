const express = require('express')
const { request, text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')

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
      let url = text(req.query.url)
      if (!url) throw ApiError.badRequest('Parameter url wajib diisi')
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url

      const full = req.query.full && req.query.full !== 'false' && req.query.full !== '0'
      const target = full
        ? `https://image.thum.io/get/width/1080/fullpage/${url}`
        : `https://image.thum.io/get/width/1080/crop/1200/${url}`

      let shot
      try {
        shot = await request(target, { timeout: 45000 })
      } catch (e) {
        throw ApiError.upstream(`Gagal mengambil screenshot (${e.message})`)
      }
      res.set('Content-Type', shot.headers.get('content-type') || 'image/png')
      res.send(await shot.buffer())
    }))
    return router
  },
}
