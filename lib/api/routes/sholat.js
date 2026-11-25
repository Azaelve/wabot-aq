const express = require('express')
const { getJSON, text } = require('../http')
const { ApiError, asyncHandler } = require('../errors')
const { daerah } = require('../data/regions')

/**
 * Jadwal sholat harian dari Aladhan (gratis, tanpa API key).
 * path: /api/jadwalsholat
 */
module.exports = {
  name: 'sholat',
  path: '/api/jadwalsholat',
  createRouter() {
    const router = express.Router()
    router.get('/', asyncHandler(async (req, res) => {
      const city = text(req.query.daerah || req.query.city || req.query.q)
      if (!city) {
        return res.json({ status: false, message: 'Daerah belum diisi', listdaerah: daerah })
      }

      let json
      try {
        json = await getJSON('https://api.aladhan.com/v1/timingsByCity?method=11&country=Indonesia&city=' + encodeURIComponent(city))
      } catch (e) {
        throw ApiError.upstream('Gagal mengambil jadwal sholat: ' + e.message)
      }
      if (!json.data || !json.data.timings) {
        return res.json({ status: false, message: 'Daerah tidak ditemukan', listdaerah: daerah })
      }

      const t = json.data.timings
      const tanggal = json.data.date ? json.data.date.readable + ' ' + json.data.date.hijri.date : ''
      const string = [
        `┌ *${city}*`,
        `│ ${tanggal}`.trim(),
        `│ Imsak   : ${t.Imsak}`,
        `│ Subuh   : ${t.Fajr}`,
        `│ Terbit  : ${t.Sunrise}`,
        `│ Dzuhur  : ${t.Dhuhr}`,
        `│ Ashar   : ${t.Asr}`,
        `│ Maghrib : ${t.Maghrib}`,
        `│ Isya    : ${t.Isha}`,
        '└────',
      ].join('\n')

      res.json({ status: true, data: { string } })
    }))
    return router
  },
}
