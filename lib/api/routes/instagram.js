const express = require('express')
const { instagram, parseInstagramUrl } = require('../scrapers/instagram')
const { ApiError, asyncHandler, requireParam, callUpstream } = require('../errors')

/**
 * Downloader Instagram lewat igexport.com.
 * path: /dl/ig — bentuk respons dipertahankan seperti plugin lama:
 * { status, result: { name, username, likes, caption, data: [{ data, type }] } }
 */
module.exports = {
  name: 'instagram',
  path: '/dl/ig',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      try {
        parseInstagramUrl(url)
      } catch (e) {
        throw ApiError.badRequest(e.message)
      }

      const media = await callUpstream('Gagal mengambil media Instagram', () => instagram(url))
      res.json({
        status: true,
        result: {
          name: '',
          username: '',
          likes: '',
          caption: '',
          shortcode: media.shortcode,
          source: media.source,
          data: media.items.map(item => ({
            data: item.url,
            type: item.type,
            thumbnail: item.thumbnail,
            filename: item.filename,
          })),
        },
      })
    }))
    return router
  },
}
