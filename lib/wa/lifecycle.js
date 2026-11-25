/**
 * Helper siklus hidup koneksi WhatsApp: melepas listener dan menghitung jeda
 * reconnect. Dipisah dari `main.js` agar dapat diuji tanpa membuka koneksi.
 */

/**
 * Lepaskan listener dari sebuah emitter, mengabaikan entri yang belum terpasang.
 * Node melempar `ERR_INVALID_ARG_TYPE` bila listener bernilai `undefined`; itu
 * yang membuat reconnect gagal setelah socket baru dibuat (belum punya handler).
 *
 * @param {import('events').EventEmitter} emitter
 * @param {Array<[String, Function|undefined]>} entries pasangan [event, listener]
 * @returns {Number} jumlah listener yang benar-benar dilepas
 */
function detachListeners(emitter, entries = []) {
  if (!emitter || typeof emitter.off !== 'function') return 0
  let removed = 0
  for (const [event, listener] of entries) {
    if (typeof listener !== 'function') continue
    emitter.off(event, listener)
    removed++
  }
  return removed
}

/**
 * Jeda reconnect eksponensial: 5 dtk, 10 dtk, 20 dtk, ... maksimum 60 dtk.
 *
 * @param {Number} attempt percobaan ke-0, 1, 2, ...
 * @param {Object} [options]
 * @param {Number} [options.base] jeda percobaan pertama (ms)
 * @param {Number} [options.max] batas atas jeda (ms)
 * @returns {Number} milidetik
 */
function reconnectDelay(attempt = 0, { base = 5000, max = 60000 } = {}) {
  const step = Math.max(0, Math.floor(Number(attempt) || 0))
  return Math.min(max, base * Math.pow(2, step))
}

module.exports = { detachListeners, reconnectDelay }
