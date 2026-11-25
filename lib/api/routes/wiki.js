const express = require('express')
const { getJSON } = require('../http')
const { ApiError, asyncHandler, requireParam, callUpstream } = require('../errors')

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
      const q = requireParam(req.query.q || req.query.kata, 'q')
      const title = encodeURIComponent(q.replace(/\s+/g, '_'))
      const json = await callUpstream('Gagal mengambil data Wikipedia', () =>
        getJSON(`https://id.wikipedia.org/api/rest_v1/page/summary/${title}`))
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
