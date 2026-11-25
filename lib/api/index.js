/**
 * API lokal pengganti layanan yang sudah mati.
 *
 * Menyajikan bentuk respons yang sama dengan API lama (xteam/zahir/zeks/
 * LeysCoder/nrtm) supaya plugin tidak perlu diubah. Struktur:
 *
 *   lib/api/http.js        helper fetch bersama
 *   lib/api/errors.js      ApiError + asyncHandler
 *   lib/api/data/          data statis (bank soal, daftar daerah)
 *   lib/api/scrapers/      pengambil data dari situs pihak ketiga
 *   lib/api/routes/        satu modul per kelompok endpoint
 *   lib/api/server.js      perakitan app Express
 */
const { createApp } = require('./server')

const DEFAULT_PORT = 3001

let server

/**
 * Jalankan server API lokal sekali saja (idempoten).
 * @param {Number} [port]
 * @returns {import('http').Server}
 */
function start(port = +(process.env.LOCAL_API_PORT || (global.localAPIPort || DEFAULT_PORT))) {
  if (server) return server
  const app = createApp()
  server = app.listen(port, '127.0.0.1', () => {
    console.log(`[localapi] berjalan di http://127.0.0.1:${port}`)
  })
  server.on('error', e => {
    server = null
    console.error(`[localapi] gagal listen di port ${port}:`, e.message)
  })
  return server
}

module.exports = { start, createApp }
