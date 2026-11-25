/**
 * Stiker audio: saat pengguna membalas voice note dengan `.sticker`, bot
 * mengirim stiker penanda suara sekaligus audio aslinya.
 *
 * Semua fungsi di sini murni (tanpa I/O) supaya bisa diuji tanpa WhatsApp:
 * pengenalan media audio, penamaan berkas, dan rencana pengiriman.
 */

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

module.exports = {
  VOICE_MIME,
  AUDIO_EXTENSIONS,
  isAudioMedia,
  audioExtension,
  describeAudio,
  planStickerAudio,
}
