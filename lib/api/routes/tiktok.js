const express = require('express')
const { getJSON, text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')

/**
 * Downloader TikTok lewat tikwm (tanpa API key).
 * path: /dl/tiktok
 */
module.exports = {
  name: 'tiktok',
  path: '/dl/tiktok',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const url = text(req.query.url)
      if (!url) throw ApiError.badRequest('Parameter url wajib diisi')

      let json
      try {
        json = await getJSON('https://www.tikwm.com/api/?url=' + encodeURIComponent(url))
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil video TikTok: ' + e.message)
      }
      if (json.code !== 0 || !json.data) {
        return res.json({ status: false, message: json.msg || 'Gagal mengambil video' })
      }

      const data = json.data
      const author = data.author ? data.author.nickname || data.author.unique_id : ''
      const video = data.hdplay || data.play || data.wmplay || ''
      res.json({
        status: true,
        result: {
          name: author || '',
          caption: data.title || '',
          link_dl1: /^https?:\/\//i.test(video) ? video : 'https://www.tikwm.com' + video,
        },
      })
    }))
    return router
  },
}
