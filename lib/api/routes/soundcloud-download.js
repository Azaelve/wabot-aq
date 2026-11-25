const express = require('express')
const { download } = require('../scrapers/soundcloud')
const { asyncHandler, requireParam, callUpstream } = require('../errors')

/**
 * Unduh audio SoundCloud (segmen HLS digabung) dan kirim sebagai berkas.
 * path: /dl/soundcloud?url=<permalink atau id>
 */
module.exports = {
  name: 'soundcloud-download',
  path: '/dl/soundcloud',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      const audio = await callUpstream('Gagal mengunduh audio SoundCloud', () => download(url))
      res.setHeader('Content-Type', audio.mime)
      res.setHeader('Content-Disposition', `attachment; filename="${audio.filename}"`)
      res.setHeader('X-SoundCloud-Segments', String(audio.segments))
      res.send(audio.buffer)
    }))
    return router
  },
}
