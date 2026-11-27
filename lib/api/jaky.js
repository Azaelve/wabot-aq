/**
 * Klien api.jaky.dev — satu-satunya tempat yang tahu cara memanggil
 * API Jaky. Semua fungsi murni/injectable supaya bisa diuji tanpa jaringan.
 *
 * API key dibaca dari env `Zennith` (fallback `ZENNITH`).
 * Auth via header `x-jaky-key`.
 * Envelope respons: `{ status: Boolean, code, latency, result }` pada sukses,
 *                   `{ status: false, msg }` pada error.
 */
const { getJSON, request: httpRequest } = require('./http')

const BASE_URL = 'https://api.jaky.dev'
const TIMEOUT = 25000

/* ---- Helpers API key ---- */

/**
 * Ambil API key dari env. Tidak pernah log/cetak nilainya.
 * @param {Object} [env] pengganti process.env (untuk tes)
 * @returns {String} key (mungkin kosong)
 */
function apiKey(env) {
  const e = env || process.env
  return String(e.Zennith || e.ZENNITH || '').trim()
}

/**
 * Apakah API key sudah diset?
 * @param {Object} [env]
 * @returns {Boolean}
 */
function isConfigured(env) {
  return apiKey(env).length > 0
}

/* ---- Pembangunan URL ---- */

/**
 * Bangun URL lengkap untuk endpoint Jaky.
 * @param {String} path  mis. `/v1/download/twitter`
 * @param {Object} [params]  query parameters
 * @returns {String}
 */
function buildUrl(path, params) {
  if (!path || typeof path !== 'string') throw new Error('Path wajib diisi')
  const clean = path.startsWith('/') ? path : '/' + path
  const url = new URL(clean, BASE_URL)
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/* ---- Pembongkaran envelope ---- */

/**
 * Bongkar envelope respons Jaky. Lempar error bila `status` false.
 * @param {Object} envelope
 * @returns {*} isi `result`
 */
function unwrap(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Respons Jaky tidak valid')
  }
  if (envelope.status === false || envelope.status === 'false') {
    throw new Error(envelope.msg || envelope.message || 'Jaky API error')
  }
  return envelope.result
}

/* ---- Pencarian URL media di dalam respons ---- */

const MEDIA_URL_RE = /^https?:\/\/\S+$/i
const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|mp4|mp3|m4a|ogg|pdf)(\?|#|$)/i

/**
 * Cari URL media pertama di dalam struktur respons Jaky.
 * Bentuk `result` berbeda-beda antar endpoint, jadi rute legacy yang harus
 * mengirim berkas (bukan JSON) memakai fungsi ini alih-alih menebak nama field.
 * @param {*} value struktur apa pun
 * @param {Number} [depth] batas rekursi internal
 * @returns {String} URL media, atau '' bila tidak ada
 */
function firstMediaUrl(value, depth = 0) {
  if (value == null || depth > 6) return ''
  if (typeof value === 'string') {
    return MEDIA_URL_RE.test(value) && MEDIA_EXT_RE.test(value) ? value : ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMediaUrl(item, depth + 1)
      if (found) return found
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = firstMediaUrl(item, depth + 1)
      if (found) return found
    }
  }
  return ''
}

/* ---- Request ---- */

/**
 * Panggil endpoint Jaky dan kembalikan envelope mentah.
 * @param {String} path mis. `/v1/download/twitter`
 * @param {Object} [params] query parameters
 * @param {Object} [opts]
 * @param {Function} [opts.fetchJSON] pengganti getJSON (untuk tes)
 * @param {Object}   [opts.env] pengganti process.env
 * @returns {Promise<Object>} envelope `{ status, code, result, ... }`
 */
async function request(path, params, { fetchJSON, env } = {}) {
  const key = apiKey(env)
  if (!key) {
    throw new Error(
      'Secret Zennith belum diset. Tambahkan API key api.jaky.dev ' +
      'ke environment variable Zennith (atau ZENNITH).'
    )
  }

  const url = buildUrl(path, params)
  const fetcher = fetchJSON || getJSON

  const envelope = await fetcher(url, {
    timeout: TIMEOUT,
    headers: {
      'x-jaky-key': key,
      Accept: 'application/json',
    },
  })

  return envelope
}

/**
 * Panggil endpoint Jaky dan kembalikan hanya `result`.
 * @param {String} path
 * @param {Object} [params]
 * @param {Object} [opts]
 * @returns {Promise<*>}
 */
async function requestResult(path, params, opts) {
  const envelope = await request(path, params, opts)
  return unwrap(envelope)
}

/**
 * Panggil endpoint Jaky yang mengembalikan berkas biner (bukan envelope
 * JSON), mis. `/v1/tools/qr` yang mengembalikan PNG langsung. `request()`
 * memakai getJSON dan gagal (502) untuk respons seperti ini.
 * @param {String} path mis. `/v1/tools/qr`
 * @param {Object} [params] query parameters
 * @param {Object} [opts]
 * @param {Function} [opts.fetchRaw] pengganti httpRequest (untuk tes)
 * @param {Object}   [opts.env] pengganti process.env
 * @returns {Promise<{buffer: Buffer, contentType: String}>}
 */
async function requestBinary(path, params, { fetchRaw, env } = {}) {
  const key = apiKey(env)
  if (!key) {
    throw new Error(
      'Secret Zennith belum diset. Tambahkan API key api.jaky.dev ' +
      'ke environment variable Zennith (atau ZENNITH).'
    )
  }

  const url = buildUrl(path, params)
  const fetcher = fetchRaw || httpRequest

  const res = await fetcher(url, {
    timeout: TIMEOUT,
    headers: {
      'x-jaky-key': key,
      Accept: 'image/*,*/*',
    },
  })
  const buffer = await res.buffer()
  const contentType = (res.headers && res.headers.get)
    ? (res.headers.get('content-type') || 'application/octet-stream')
    : 'application/octet-stream'
  return { buffer, contentType }
}

module.exports = {
  BASE_URL,
  apiKey,
  isConfigured,
  buildUrl,
  unwrap,
  firstMediaUrl,
  request,
  requestResult,
  requestBinary,
}
