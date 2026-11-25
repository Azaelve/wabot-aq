/**
 * Composition root API lokal: merakit route dari registry, fallback 503,
 * dan satu error handler pusat.
 */
const express = require('express')
const routes = require('./routes')
const { ApiError, jsonError } = require('./errors')

/**
 * Bangun aplikasi Express tanpa membuka port (mudah diuji).
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express()
  app.disable('x-powered-by')

  for (const route of routes) {
    app.use(route.path, route.createRouter())
  }

  // Endpoint yang belum punya penyedia pengganti.
  app.use((req, res) => {
    res.status(503).type('text/plain').send(
      `Fitur ini belum punya penyedia pengganti (${req.method} ${req.path}). ` +
      'Tambahkan modulnya di lib/api/routes lalu daftarkan di lib/api/routes/index.js.'
    )
  })

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err instanceof ApiError) return jsonError(res, err.status, err.message)
    console.error('[localapi]', err)
    jsonError(res, 500, 'Kesalahan pada API lokal')
  })

  return app
}

module.exports = { createApp }
