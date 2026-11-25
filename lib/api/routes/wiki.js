const express = require('express')
const { getJSON, text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')

/**
 * Ringkasan artikel Wikipedia bahasa Indonesia.
 * path: /api/wiki
 */
module.exports = {
  name: 'wiki',
  path: '/api/wiki',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const q = text(req.query.q || req.query.kata)
      if (!q) throw ApiError.badRequest('Parameter q wajib diisi')

      let json
      try {
        const title = encodeURIComponent(q.replace(/\s+/g, '_'))
        json = await getJSON(`https://id.wikipedia.org/api/rest_v1/page/summary/${title}`)
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil data Wikipedia: ' + e.message)
      }
      if (!json.extract) throw new ApiError(404, 'Artikel tidak ditemukan')

      res.json({
        status: true,
        result: {
          status: true,
          result: json.extract,
          url: json.content_urls && json.content_urls.desktop ? json.content_urls.desktop.page : '',
        },
      })
    }))
    return router
  },
}
