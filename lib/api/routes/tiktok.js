const express = require('express')
const { tiktok, parseTikTokUrl } = require('../scrapers/tiktok')
const { ApiError, asyncHandler, requireParam, callUpstream } = require('../errors')

/**
 * Downloader TikTok lewat tikwm (utama) dan tikloapp (cadangan, termasuk
 * foto/live photo). path: /dl/tiktok
 */
module.exports = {
  name: 'tiktok',
  path: '/dl/tiktok',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      try {
        parseTikTokUrl(url)
      } catch (e) {
        throw ApiError.badRequest(e.message)
      }

      const media = await callUpstream('Gagal mengambil video TikTok', () => tiktok(url))
      res.json({
        status: true,
        result: {
          name: media.author || '',
          caption: media.title || '',
          link_dl1: media.video || media.images[0] || '',
          cover: media.cover || '',
          duration: media.duration || 0,
          type: media.type,
          images: media.images,
          live: media.live,
        },
      })
    }))
    return router
  },
}
