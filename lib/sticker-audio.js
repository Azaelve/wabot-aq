/**
 * Stiker audio: saat pengguna membalas voice note dengan `.sticker`, bot
 * mengirim stiker penanda suara sekaligus audio aslinya.
 *
 * Semua fungsi di sini murni (tanpa I/O) supaya bisa diuji tanpa WhatsApp:
 * pengenalan media audio, penamaan berkas, rencana pengiriman, dan
 * konfigurasi batas (durasi, ukuran).
 *
 * Batas dan opsi terinspirasi dari repo JH-Zapo/Hitori-Zapo (feat/sticker/saudio.js)
 * tapi disesuaikan ke pola repo ini: modul murni, default aman, tanpa I/O.
 */

/* ---- Batas bawaan (dari Hitori-Zapo, disesuaikan) ---- */

/** Batas durasi audio dalam detik. 0 = tanpa batas. */
const DEFAULT_MAX_SECONDS = 10

/** Batas ukuran media dalam byte. 0 = tanpa batas. */
const DEFAULT_MAX_BYTES = 30 * 1024 * 1024 // 30 MiB

/** Mimetype yang dipakai WhatsApp untuk voice note. */
const VOICE_MIME = 'audio/ogg; codecs=opus'

/** Mimetype audio dasar → ekstensi berkas. */
const AUDIO_EXTENSIONS = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/amr': 'amr',
  'audio/webm': 'weba',
}

/**
 * Ambil mimetype tanpa parameter (`; codecs=...`) dalam huruf kecil.
 * @param {String} mimetype
 * @returns {String}
 */
function baseMime(mimetype) {
  return String(mimetype || '').split(';')[0].trim().toLowerCase()
}

/**
 * Apakah media ini audio (termasuk voice note)?
 * @param {Object} [media] objek pesan gaya lama (`m.quoted.msg`)
 * @returns {Boolean}
 */
function isAudioMedia(media = {}) {
  if (!media || typeof media !== 'object') return false
  if (media.mtype === 'audioMessage') return true
  const mime = baseMime(media.mimetype)
  if (mime.startsWith('audio/')) return true
  // Voice note lama kadang hanya membawa flag `ptt` tanpa mimetype.
  return !mime && media.ptt === true
}

/**
 * Ekstensi berkas untuk sebuah mimetype audio.
 * @param {String} mimetype
 * @returns {String} default `ogg`
 */
function audioExtension(mimetype) {
  return AUDIO_EXTENSIONS[baseMime(mimetype)] || 'ogg'
}

/**
 * Ringkasan audio yang siap dikirim ulang.
 * @param {Object} [media] objek pesan gaya lama
 * @returns {{ mimetype: String, ptt: Boolean, seconds: Number, filename: String }}
 */
function describeAudio(media = {}) {
  const ptt = Boolean(media && media.ptt)
  const mimetype = ptt ? VOICE_MIME : (baseMime(media && media.mimetype) || VOICE_MIME)
  const seconds = Number(media && media.seconds) || 0
  return {
    mimetype,
    ptt,
    seconds,
    filename: `${ptt ? 'voice' : 'audio'}.${audioExtension(mimetype)}`,
  }
}

/**
 * Susun urutan kirim: stiker penanda lebih dulu, lalu audio aslinya.
 * @param {Object} params
 * @param {Buffer} params.sticker stiker WEBP
 * @param {Buffer} params.audio audio asli
 * @param {Object} [params.media] objek pesan asal (`ptt`, `mimetype`, `seconds`)
 * @returns {Array<{ kind: 'sticker'|'audio', content: Buffer, options?: Object }>}
 */
function planStickerAudio({ sticker, audio, media } = {}) {
  if (!Buffer.isBuffer(sticker) || sticker.length === 0) throw new Error('planStickerAudio: stiker kosong')
  if (!Buffer.isBuffer(audio) || audio.length === 0) throw new Error('planStickerAudio: audio kosong')
  const info = describeAudio(media)
  return [
    { kind: 'sticker', content: sticker },
    {
      kind: 'audio',
      content: audio,
      options: {
        mimetype: info.mimetype,
        ptt: info.ptt,
        seconds: info.seconds,
        fileName: info.filename,
      },
    },
  ]
}

/* ---- Konfigurasi batas ---- */

/**
 * Bangun objek konfigurasi batas stiker audio dengan default aman.
 * Nilai tidak valid (NaN, negatif, bukan angka) diabaikan → pakai default.
 *
 * @param {Object} [overrides]
 * @param {Number} [overrides.maxSeconds] batas durasi (detik), 0 = tanpa batas
 * @param {Number} [overrides.maxBytes]   batas ukuran (byte), 0 = tanpa batas
 * @returns {{ maxSeconds: Number, maxBytes: Number }}
 */
function createAudioConfig(overrides = {}) {
  return {
    maxSeconds: clampPositive(overrides.maxSeconds, DEFAULT_MAX_SECONDS),
    maxBytes: clampPositive(overrides.maxBytes, DEFAULT_MAX_BYTES),
  }
}

/**
 * @param {*} value
 * @param {Number} fallback
 * @returns {Number} 0 atau lebih
 */
function clampPositive(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

/**
 * Periksa apakah durasi audio melebihi batas.
 * @param {Number} seconds  durasi audio
 * @param {Number} [maxSeconds=DEFAULT_MAX_SECONDS]  batas (0 = tanpa batas)
 * @returns {{ ok: Boolean, message: String }}
 */
function checkDuration(seconds, maxSeconds) {
  const limit = Number.isFinite(maxSeconds) && maxSeconds >= 0 ? maxSeconds : DEFAULT_MAX_SECONDS
  if (limit > 0 && seconds > limit) {
    return { ok: false, message: `Audio terlalu panjang: ${seconds} detik (maks ${limit} detik)` }
  }
  return { ok: true, message: '' }
}

/**
 * Periksa apakah ukuran media melebihi batas.
 * @param {Number} bytes    ukuran dalam byte
 * @param {Number} [maxBytes=DEFAULT_MAX_BYTES]  batas (0 = tanpa batas)
 * @returns {{ ok: Boolean, message: String }}
 */
function checkSize(bytes, maxBytes) {
  const limit = Number.isFinite(maxBytes) && maxBytes >= 0 ? maxBytes : DEFAULT_MAX_BYTES
  if (limit > 0 && bytes > limit) {
    const mb = (limit / 1024 / 1024).toFixed(1)
    return { ok: false, message: `Ukuran media terlalu besar: ${bytes} byte (maks ${mb} MiB)` }
  }
  return { ok: true, message: '' }
}

module.exports = {
  VOICE_MIME,
  AUDIO_EXTENSIONS,
  DEFAULT_MAX_SECONDS,
  DEFAULT_MAX_BYTES,
  isAudioMedia,
  audioExtension,
  describeAudio,
  planStickerAudio,
  createAudioConfig,
  checkDuration,
  checkSize,
}
