/**
 * Pembatas laju (cooldown) dan penyaring spam.
 *
 * Keduanya menyimpan hitungan di memori dan menerima jam yang bisa disuntik
 * (`now`), sehingga perilakunya dapat diuji tanpa menunggu waktu nyata.
 */

/**
 * Cooldown per kunci, mis. `namaPlugin:pengirim`.
 *
 * @param {Object} [options]
 * @param {Function} [options.now] sumber waktu (ms), default `Date.now`
 * @returns {Object} `hit`, `reset`, `clear`, dan properti `size`
 */
function createCooldown({ now = Date.now } = {}) {
  const buckets = new Map()

  /**
   * Catat satu pemakaian.
   * @param {String} key kunci cooldown
   * @param {Object} [options]
   * @param {Number} [options.windowMs] panjang jendela waktu
   * @param {Number} [options.limit] jumlah pemakaian yang diizinkan per jendela
   * @returns {{ allowed: Boolean, count: Number, limit: Number, windowMs: Number, remainingMs: Number }}
   */
  function hit(key, { windowMs = 5000, limit = 1 } = {}) {
    const time = now()
    const span = Math.max(1, Number(windowMs) || 1)
    const max = Math.max(1, Number(limit) || 1)
    let bucket = buckets.get(key)
    if (!bucket || time - bucket.startedAt >= span) {
      bucket = { count: 0, startedAt: time }
      buckets.set(key, bucket)
    }
    bucket.count++
    const allowed = bucket.count <= max
    return {
      allowed,
      count: bucket.count,
      limit: max,
      windowMs: span,
      remainingMs: allowed ? 0 : Math.max(0, span - (time - bucket.startedAt)),
    }
  }

  return {
    hit,
    reset(key) { buckets.delete(key) },
    clear() { buckets.clear() },
    get size() { return buckets.size },
  }
}

/**
 * Penyaring spam: berapa pesan dalam satu jendela waktu.
 * `first` bernilai true hanya pada pemeriksaan yang pertama kali melewati batas,
 * supaya peringatan tidak dikirim berulang-ulang.
 *
 * @param {Object} [options]
 * @param {Number} [options.limit] jumlah pesan yang dianggap wajar per jendela
 * @param {Number} [options.windowMs] panjang jendela waktu
 * @param {Function} [options.now] sumber waktu (ms)
 * @returns {Object} `check`, `reset`, `clear`, dan properti `size`
 */
function createSpamGuard({ limit = 10, windowMs = 10000, now = Date.now } = {}) {
  const counters = new Map()
  const max = Math.max(1, Number(limit) || 1)
  const span = Math.max(1, Number(windowMs) || 1)

  /**
   * @param {String} key biasanya JID pengirim
   * @returns {{ blocked: Boolean, first: Boolean, count: Number, limit: Number, windowMs: Number, remainingMs: Number }}
   */
  function check(key) {
    const time = now()
    let counter = counters.get(key)
    if (!counter || time - counter.startedAt >= span) {
      counter = { count: 0, startedAt: time, warned: false }
      counters.set(key, counter)
    }
    counter.count++
    const blocked = counter.count > max
    let first = false
    if (blocked && !counter.warned) {
      counter.warned = true
      first = true
    }
    return {
      blocked,
      first,
      count: counter.count,
      limit: max,
      windowMs: span,
      remainingMs: blocked ? Math.max(0, span - (time - counter.startedAt)) : 0,
    }
  }

  return {
    check,
    reset(key) { counters.delete(key) },
    clear() { counters.clear() },
    get size() { return counters.size },
  }
}

module.exports = { createCooldown, createSpamGuard }
