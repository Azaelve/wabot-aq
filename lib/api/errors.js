/**
 * Kesalahan API lokal dan pembungkus handler.
 * Route cukup melempar ApiError; satu error handler pusat yang
 * menerjemahkannya menjadi respons HTTP.
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

module.exports = {
  ApiError,
  jsonError,
  asyncHandler,
}
