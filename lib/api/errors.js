/**
 * Kesalahan API lokal, pembungkus handler, dan dua helper yang dipakai
 * hampir semua route (validasi parameter & pemanggilan pihak ketiga).
 */

class ApiError extends Error {
  /**
   * @param {Number} status HTTP status
   * @param {String} message pesan untuk pengguna
   */
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  /** Parameter wajib belum diisi. */
  static badRequest(message) {
    return new ApiError(400, message)
  }

  /** Sumber data pihak ketiga gagal. */
  static upstream(message) {
    return new ApiError(502, message)
  }
}

/** Bentuk respons error yang konsisten untuk semua route. */
function jsonError(res, status, message) {
  return res.status(status).json({ status: false, message })
}

/**
 * Bungkus handler async agar penolakan promise diteruskan ke error handler
 * Express 4 (yang tidak menangani promise secara otomatis).
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

/**
 * Ambil parameter wajib; kosong berarti 400.
 * @param {*} value
 * @param {String} name nama parameter untuk pesan error
 * @returns {String}
 */
function requireParam(value, name) {
  const val = String(value == null ? '' : value).trim()
  if (!val) throw ApiError.badRequest(`Parameter ${name} wajib diisi`)
  return val
}

/**
 * Jalankan operasi pihak ketiga; kegagalannya menjadi 502 dengan label route.
 * @param {String} label mis. "Gagal mengambil data KBBI"
 * @param {Function} fn operasi async
 */
async function callUpstream(label, fn) {
  try {
    return await fn()
  } catch (e) {
    throw ApiError.upstream(`${label}: ${e.message}`)
  }
}

module.exports = {
  ApiError,
  jsonError,
  asyncHandler,
  requireParam,
  callUpstream,
}
