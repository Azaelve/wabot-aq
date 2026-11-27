/**
 * Rute API lokal yang diteruskan ke api.jaky.dev.
 *
 * Dua jenis rute:
 * 1. **Alias legacy** — menggantikan API mati (twitter, fb, spotify, dll.)
 *    dengan normalisasi bentuk respons agar plugin lama tetap jalan.
 * 2. **Passthrough** — endpoint baru yang langsung meneruskan envelope Jaky
 *    (ai, tools, canvas, islami, lyrics, stalker, anime, download, search).
 *    Pengecualian: `/tools/qr` mengembalikan PNG langsung, jadi memakai
 *    `jaky.requestBinary` (lihat handler-nya), bukan passthrough JSON.
 *
 * Jika secret `Zennith` belum diset, semua rute Jaky membalas 503.
 * Path yang bukan rute Jaky diteruskan ke fallback server (503 'belum punya penyedia pengganti').
 *
 * path: '/' — rute ini dipasang di root oleh registry, jadi path di
 * router == path asli yang diterima Express setelah route-route lain
 * yang lebih spesifik (tiktok, ig, soundcloud, dsb.) sudah dicoba.
 * Karena server.js memasang route berurutan dari registry, dan jaky
 * didaftarkan paling akhir, route ini hanya menangkap path yang belum
 * ditangani oleh route lokal yang sudah ada.
 */
const express = require('express')
const jaky = require('../jaky')
const { ApiError, asyncHandler, requireParam, callUpstream } = require('../errors')

/* ---- Rute yang ditangani router ini ---- */

const JAKY_STATIC_PATHS = new Set([
  '/dl/twitter', '/dl/fb', '/api/spotify', '/dl/spotify',
  '/sticker/stickerly', '/sticker/stickerly/download',
  '/quotemaker', '/ephoto', '/textpro',
  '/ttp', '/ttp2', '/ttpdark', '/attp', '/attp2',
  '/api/pinimg', '/dl/igstalk',
  '/ai/removebg', '/ai/upscale', '/ai/text2image',
  '/tools/qr', '/tools/shorturl',
  '/canvas/brat', '/canvas/quote',
  '/internet/cuaca', '/internet/news', '/internet/gempa',
  '/videomaker', '/asupan', '/sticker/stickerline', '/sticker/emojitopng',
  '/tahta', '/magernulis', '/dl/smule', '/dl/igs', '/dl/ighighlight',
  '/search/grupwa', '/search/freefire', '/api/ppcouple', '/api/unsplash',
  '/api/telegram-sticker', '/api/primbonjodoh', '/api/kuis/tebakgambar',
  '/trendingtwitter', '/canvas/gay', '/canvas/horny', '/canvas/its-so-stupid',
  '/canvas/lolice', '/canvas/simpcard', '/canvas/triggered',
  '/canvas/youtube-comment',
])

const JAKY_PREFIXES = [
  '/ephoto', '/textpro', '/videomaker', '/asupan', '/randomimage', '/jaky',
  '/alight-motion', '/anime', '/ai', '/canvas', '/cfsolver', '/deepfakemaker',
  '/download', '/ephoto360', '/gomerchant', '/internet', '/islami', '/lyrics',
  '/maker', '/search', '/shopeepay', '/smm', '/solve', '/stalker', '/tools',
  '/user', '/vivago', '/wink',
]

const JAKY_DL = new Set(['threads', 'youtube', 'play', 'pinterest', 'capcut',
  'mediafire', 'mega', 'krakenfiles', 'bstation', 'gdrive'])
const JAKY_SEARCH = new Set(['youtube', 'kbbi', 'spotify', 'soundcloud',
  'tiktok', 'pinterest', 'bstation', 'capcut'])

/**
 * Apakah path ini salah satu rute yang ditangani router Jaky?
 * Path yang bukan rute Jaky harus diteruskan ke fallback server
 * (lib/api/server.js), bukan dijawab 503 soal secret.
 * @param {String} path
 * @returns {Boolean}
 */
function isJakyPath(path) {
  if (JAKY_STATIC_PATHS.has(path)) return true
  for (const p of JAKY_PREFIXES) {
    if (path === p || path.startsWith(p + '/')) return true
  }
  const dl = path.match(/^\/dl\/([^/]+)$/)
  if (dl && JAKY_DL.has(dl[1])) return true
  const search = path.match(/^\/search\/([^/]+)$/)
  if (search && JAKY_SEARCH.has(search[1])) return true
  return false
}

module.exports = {
  name: 'jaky',
  path: '/',
  isJakyPath,
  createRouter() {
    const router = express.Router()

    /* ================================================================
     *  MIDDLEWARE: periksa API key sekali untuk semua rute di bawah
     * ================================================================ */
    router.use((req, res, next) => {
      if (!jaky.isConfigured() && isJakyPath(req.path)) {
        return res.status(503).type('text/plain').send(
          'Secret Zennith belum diset. Tambahkan API key api.jaky.dev ' +
          'ke environment variable Zennith (atau ZENNITH).'
        )
      }
      next()
    })

    /* ================================================================
     *  ALIAS LEGACY — normalisasi bentuk respons untuk plugin lama
     * ================================================================ */

    // --- Download Twitter ---
    router.get('/dl/twitter', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      const data = await callUpstream('Gagal mengunduh Twitter',
        () => jaky.requestResult('/v1/download/twitter', { url }))
      res.json({ status: true, result: data })
    }))

    // --- Download Facebook ---
    router.get('/dl/fb', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      const data = await callUpstream('Gagal mengunduh Facebook',
        () => jaky.requestResult('/v1/download/facebook', { url }))
      res.json({ status: true, result: data })
    }))

    // --- Cari Spotify ---
    router.get('/api/spotify', asyncHandler(async (req, res) => {
      const query = requireParam(req.query.query || req.query.q, 'query')
      const data = await callUpstream('Gagal mencari Spotify',
        () => jaky.requestResult('/v1/search/spotify', { query }))
      // Plugin mengharapkan { data: [...] }
      res.json({ status: true, data: Array.isArray(data) ? data : [data] })
    }))

    // --- Download Spotify ---
    router.get('/dl/spotify', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      const data = await callUpstream('Gagal mengunduh Spotify',
        () => jaky.requestResult('/v1/download/spotify', { url }))
      res.json({ status: true, result: data })
    }))

    // --- Cari Stickerly ---
    router.get('/sticker/stickerly', asyncHandler(async (req, res) => {
      const query = requireParam(req.query.query || req.query.q, 'query')
      const data = await callUpstream('Gagal mencari stiker',
        () => jaky.requestResult('/v1/search/stickerly', { query }))
      // Plugin mengharapkan { result: { stickerlist: [...] } }
      const list = Array.isArray(data) ? data : (data && data.stickerlist) || []
      res.json({ status: true, result: { stickerlist: list } })
    }))

    // --- Download Stickerly ---
    router.get('/sticker/stickerly/download', asyncHandler(async (req, res) => {
      const url = requireParam(req.query.url, 'url')
      const data = await callUpstream('Gagal mengunduh stiker',
        () => jaky.requestResult('/v1/download/stickerly', { url }))
      res.json({ status: true, result: data })
    }))

    // --- Quotemaker (kirim berkasnya, bukan JSON) ---
    // Plugin lama mengirim `wm`; canvas/quote memakai nama `author`.
    router.get('/quotemaker', mediaRedirectHandler('/v1/canvas/quote', 'text',
      req => (req.query.wm ? { author: req.query.wm } : {}), ['text']))

    // --- Ephoto360: daftar efek ---
    router.get('/ephoto', asyncHandler(async (req, res) => {
      const data = await callUpstream('Gagal mengambil daftar efek',
        () => jaky.requestResult('/v1/ephoto360', { action: 'list' }))
      res.json({ status: true, effects: Array.isArray(data) ? data : [] })
    }))

    // --- Ephoto360: buat efek (plugin memakai URL ini sebagai gambar) ---
    router.get('/ephoto/:effect', mediaRedirectHandler('/v1/ephoto360/text-effects', 'text',
      req => ({ style: req.params.effect })))

    // --- TextPro: daftar efek (sama dengan ephoto) ---
    router.get('/textpro', asyncHandler(async (req, res) => {
      const data = await callUpstream('Gagal mengambil daftar efek',
        () => jaky.requestResult('/v1/ephoto360', { action: 'list' }))
      res.json({ status: true, effects: Array.isArray(data) ? data : [] })
    }))

    // --- TextPro: buat efek (dilayani ephoto360, kirim berkasnya) ---
    router.get('/textpro/:effect', mediaRedirectHandler('/v1/ephoto360/text-effects', 'text',
      req => ({ style: req.params.effect })))

    // --- TTP (text to picture) ---
    // Padanan terdekat di api.jaky.dev: kartu kutipan (canvas/quote).
    const ttpHandler = mediaRedirectHandler('/v1/canvas/quote', 'text')
    router.get('/ttp', ttpHandler)
    router.get('/ttp2', ttpHandler)
    router.get('/ttpdark', ttpHandler)

    // --- ATTP (animated text to picture) ---
    // api.jaky.dev tidak punya endpoint attp; /v1/canvas/brat dengan
    // animation=true menghasilkan GIF teks yang diketik satu per satu.
    const attpHandler = mediaRedirectHandler('/v1/canvas/brat', 'text', { animation: 'true' })
    router.get('/attp', attpHandler)
    router.get('/attp2', attpHandler)

    // --- Pinterest (pencarian gambar) ---
    router.get('/api/pinimg', asyncHandler(async (req, res) => {
      const query = requireParam(req.query.query || req.query.q, 'query')
      const data = await callUpstream('Gagal mencari Pinterest',
        () => jaky.requestResult('/v1/search/pinterest', { query }))
      res.json({ status: true, data: Array.isArray(data) ? data : [] })
    }))

    // --- IG Stalk ---
    router.get('/dl/igstalk', asyncHandler(async (req, res) => {
      const username = requireParam(req.query.username || req.query.user, 'username')
      const data = await callUpstream('Gagal mengambil profil Instagram',
        () => jaky.requestResult('/v1/stalker/instagram', { username }))
      res.json({ status: true, result: { user: data } })
    }))

    /* ================================================================
     *  ENDPOINT BARU — passthrough dengan envelope Jaky
     * ================================================================ */

    // --- AI ---
    router.get('/ai/removebg', passthroughHandler('/v1/ai/removebg', 'url'))
    router.get('/ai/upscale', passthroughHandler('/v1/ai/upscale', 'url'))
    router.get('/ai/text2image', passthroughHandler('/v1/ai/text2image', 'prompt'))

    // --- Tools ---
    // /v1/tools/qr mengembalikan PNG langsung (bukan envelope JSON),
    // jadi passthroughHandler (getJSON) gagal 502 untuknya. Pakai
    // requestBinary dan teruskan gambarnya apa adanya.
    router.get('/tools/qr', asyncHandler(async (req, res) => {
      const text = requireParam(req.query.text || req.query.teks, 'text')
      const { buffer, contentType } = await callUpstream('Gagal memanggil /v1/tools/qr',
        () => jaky.requestBinary('/v1/tools/qr', { text }))
      res.type(contentType).send(buffer)
    }))
    router.get('/tools/shorturl', passthroughHandler('/v1/tools/shorturl', 'url'))

    // --- Canvas ---
    router.get('/canvas/brat', passthroughHandler('/v1/canvas/brat', 'text'))
    router.get('/canvas/quote', passthroughHandler('/v1/canvas/quote', 'text'))

    // --- Internet ---
    // Nama parameter Jaky: city, bukan kota.
    router.get('/internet/cuaca', asyncHandler(async (req, res) => {
      const city = requireParam(req.query.city || req.query.kota, 'city')
      const envelope = await callUpstream('Gagal mengambil cuaca',
        () => jaky.request('/v1/internet/cuaca', { city }))
      res.json(envelope)
    }))
    router.get('/internet/news', passthroughHandler('/v1/internet/news'))
    router.get('/internet/gempa', passthroughHandler('/v1/internet/gempa'))

    /* ================================================================
     *  PATH PLUGIN YANG TIDAK PUNYA PADANAN DI JAKY
     *  Katalog api.jaky.dev (196 endpoint, 22 kategori) sudah diperiksa:
     *  tidak ada videomaker, attp/ttp animasi, tts, textpro, asupan,
     *  stickerline, atau kuis. Jawab 503 dengan pesan jelas, bukan
     *  meneruskan ke endpoint yang tidak ada.
     * ================================================================ */
    const tanpaPadanan = [
      '/videomaker', '/videomaker/*',
      '/asupan', '/asupan/*',
      '/sticker/stickerline', '/sticker/emojitopng',
      '/tahta', '/magernulis',
      '/dl/smule', '/dl/igs', '/dl/ighighlight',
      '/search/grupwa', '/search/freefire',
      '/api/ppcouple', '/api/unsplash', '/api/telegram-sticker',
      '/api/primbonjodoh', '/api/kuis/tebakgambar',
      '/randomimage/*', '/trendingtwitter',
      '/canvas/gay', '/canvas/horny', '/canvas/its-so-stupid',
      '/canvas/lolice', '/canvas/simpcard', '/canvas/triggered',
      '/canvas/youtube-comment',
    ]
    for (const pattern of tanpaPadanan) {
      router.get(pattern, (req, res) => {
        res.status(503).json({
          status: false,
          message: `${req.path} belum ada padanannya di api.jaky.dev. ` +
            'Cek /v1/maker/*, /v1/canvas/*, atau /v1/download/* untuk alternatif, ' +
            'atau tambahkan scraper sendiri di lib/api/scrapers.',
        })
      })
    }

    /* ================================================================
     *  PASSTHROUGH KATALOG
     *  Prefix = slug kategori di api.jaky.dev, sehingga endpoint baru
     *  bisa dipakai tanpa mengubah berkas ini.
     * ================================================================ */
    const catalogPrefixes = [
      'alight-motion', 'anime', 'ai', 'canvas', 'cfsolver', 'deepfakemaker',
      'download', 'ephoto360', 'gomerchant', 'internet', 'islami', 'lyrics',
      'maker', 'search', 'shopeepay', 'smm', 'solve', 'stalker', 'tools',
      'user', 'vivago', 'wink',
    ]
    for (const prefix of catalogPrefixes) {
      router.get(`/${prefix}`, passthroughWildcard(`/v1/${prefix}`))
      router.get(`/${prefix}/*`, passthroughWildcard(`/v1/${prefix}`))
    }

    // --- Alias /dl/* → /v1/download/* (path plugin lebih pendek) ---
    const dlEndpoints = [
      'threads', 'youtube', 'play', 'pinterest', 'capcut',
      'mediafire', 'mega', 'krakenfiles', 'bstation', 'gdrive',
    ]
    for (const ep of dlEndpoints) {
      router.get(`/dl/${ep}`, passthroughHandler(`/v1/download/${ep}`, 'url'))
    }

    // --- Alias /search/* → /v1/search/* ---
    const searchEndpoints = [
      'youtube', 'kbbi', 'spotify', 'soundcloud',
      'tiktok', 'pinterest', 'bstation', 'capcut',
    ]
    for (const ep of searchEndpoints) {
      router.get(`/search/${ep}`, passthroughHandler(`/v1/search/${ep}`, 'query'))
    }

    // --- Passthrough umum: /jaky/* → /v1/* ---
    router.get('/jaky/*', asyncHandler(async (req, res) => {
      const subPath = req.params[0]
      if (!subPath) throw ApiError.badRequest('Path endpoint wajib diisi')
      const envelope = await callUpstream('Gagal memanggil Jaky',
        () => jaky.request(`/v1/${subPath}`, req.query))
      res.json(envelope)
    }))

    return router
  },
}

/* ---- Helper pembuat handler passthrough ---- */

/**
 * Handler legacy: panggil Jaky lalu alihkan (302) ke URL media hasilnya.
 * Plugin lama memakai endpoint ini sebagai "URL gambar" untuk sendFile/sticker,
 * jadi yang harus diterima adalah berkasnya, bukan envelope JSON.
 * @param {String} jakyPath path di api.jaky.dev
 * @param {String} [requiredParam] nama parameter wajib dari query
 * @param {Object|Function} [extra] parameter tambahan tetap, atau fungsi dari req
 * @param {String[]} [keep] bila diisi, hanya parameter ini yang diteruskan
 */
function mediaRedirectHandler(jakyPath, requiredParam, extra, keep) {
  return asyncHandler(async (req, res) => {
    const passthrough = keep
      ? Object.fromEntries(Object.entries(req.query).filter(([k]) => keep.includes(k)))
      : { ...req.query }
    const params = passthrough
    if (requiredParam && !params[requiredParam]) {
      const aliases = { query: 'q', q: 'query', url: 'link', text: 'teks' }
      const alt = aliases[requiredParam]
      if (alt && req.query[alt]) params[requiredParam] = req.query[alt]
      else requireParam(null, requiredParam)
    }
    if (extra) Object.assign(params, typeof extra === 'function' ? extra(req) : extra)

    const envelope = await callUpstream(`Gagal memanggil ${jakyPath}`,
      () => jaky.request(jakyPath, params))
    const url = jaky.firstMediaUrl(envelope)
    if (!url) {
      throw ApiError.upstream(`Tidak menemukan URL media pada respons ${jakyPath}`)
    }
    res.redirect(302, url)
  })
}

/**
 * Buat handler passthrough sederhana: 1 parameter wajib → forward ke Jaky.
 * @param {String} jakyPath  path di api.jaky.dev
 * @param {String} [requiredParam]  nama parameter wajib (dari query)
 */
function passthroughHandler(jakyPath, requiredParam) {
  return asyncHandler(async (req, res) => {
    const params = { ...req.query }
    if (requiredParam && !params[requiredParam]) {
      // Coba alias umum: q → query, query → q
      const aliases = { query: 'q', q: 'query', url: 'link', text: 'teks' }
      const alt = aliases[requiredParam]
      if (alt && req.query[alt]) params[requiredParam] = req.query[alt]
      else requireParam(null, requiredParam) // lempar 400
    }
    const envelope = await callUpstream(`Gagal memanggil ${jakyPath}`,
      () => jaky.request(jakyPath, params))
    res.json(envelope)
  })
}

/**
 * Buat handler wildcard: /group/* → /v1/group/*
 * @param {String} basePath  prefix di Jaky, mis. `/v1/islami`
 */
function passthroughWildcard(basePath) {
  return asyncHandler(async (req, res) => {
    const sub = req.params[0] || ''
    const fullPath = sub ? `${basePath}/${sub}` : basePath
    const envelope = await callUpstream(`Gagal memanggil ${fullPath}`,
      () => jaky.request(fullPath, req.query))
    res.json(envelope)
  })
}
