/**
 * Pembuatan socket Baileys 7 + permintaan kode pairing.
 * Semua parameter bisa disuntik (socket factory, auth) agar dapat diuji
 * tanpa jaringan.
 */
const baileys = require('baileys')
const { loadAuth } = require('./auth')
const { normalizePhone } = require('./normalize')

const DEFAULT_AUTH_DIR = require('path').join(__dirname, '..', '..', 'wa-auth')

/**
 * @param {Object} options
 * @param {String} [options.authDir]
 * @param {String} [options.phone] nomor untuk pairing code (mis. 6285...)
 * @param {Function} [options.onPairingCode] dipanggil saat kode didapat
 * @param {Object} [options.logger]
 * @param {Function} [options.makeSocket] injeksi untuk pengujian
 */
/**
 * Baileys 7 membutuhkan logger bergaya pino (punya `.child`).
 * Terima console biasa dengan membungkusnya.
 */
function resolveLogger(logger, level = 'warn') {
  if (logger && typeof logger.child === 'function') return logger
  try {
    return require('pino')({ level })
  } catch (e) {
    const noop = () => { }
    const fallback = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, level }
    fallback.child = () => fallback
    return fallback
  }
}

async function createClient(options = {}) {
  const logger = resolveLogger(options.logger || console, options.logLevel || 'warn')
  const authDir = options.authDir || DEFAULT_AUTH_DIR
  const phone = options.phone ? normalizePhone(options.phone) : ''
  const makeSocket = options.makeSocket || baileys.makeWASocket

  const { state, saveCreds } = options.auth
    ? { state: options.auth.state, saveCreds: options.auth.saveCreds }
    : await loadAuth(authDir)

  const version = options.version || (
    await baileys.fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
  ).version

  const sock = makeSocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: baileys.Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  if (sock.ev && saveCreds) sock.ev.on('creds.update', saveCreds)

  let pairingCode = null
  let requested = false

  /** Minta kode pairing sekali; aman dipanggil berulang. */
  async function requestPairingCode() {
    if (!phone || requested) return pairingCode
    if (sock.authState && sock.authState.creds && sock.authState.creds.registered) return null
    requested = true
    try {
      pairingCode = await sock.requestPairingCode(phone)
      if (options.onPairingCode) options.onPairingCode(pairingCode, phone)
      logger.info && logger.info(`[wa] kode pairing untuk ${phone}: ${pairingCode}`)
      return pairingCode
    } catch (e) {
      requested = false
      logger.error && logger.error('[wa] gagal meminta kode pairing:', e.message)
      return null
    }
  }

  return { sock, phone, authDir, requestPairingCode, getPairingCode: () => pairingCode }
}

module.exports = { createClient, resolveLogger, DEFAULT_AUTH_DIR }
