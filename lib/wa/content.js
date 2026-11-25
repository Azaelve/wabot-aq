/**
 * Penerjemah `MessageType` lama menjadi konten Baileys 7.
 * Fungsi murni (tanpa I/O) supaya mudah diuji.
 */
const { MessageType } = require('./message-type')

const TEXT_TYPES = new Set([MessageType.text, 'conversation', 'text', 'extendedTextMessage'])

/**
 * Ubah (content, type, options) gaya lama menjadi objek `sendMessage` Baileys 7.
 * @param {String} type nilai MessageType (mis. MessageType.image)
 * @param {*} content string | Buffer | { url }
 * @param {Object} [options]
 * @returns {Object}
 */
function buildContent(type, content, options = {}) {
  const opts = { ...options }
  delete opts.quoted
  delete opts.mentions
  delete opts.detectLinks

  if (!type || TEXT_TYPES.has(type)) {
    if (typeof content === 'string') return { text: content }
    if (content && typeof content === 'object') return { text: String(content.text || '') }
    return { text: String(content == null ? '' : content) }
  }

  const common = {}
  if (opts.caption) common.caption = opts.caption
  if (opts.mimetype) common.mimetype = opts.mimetype
  if (opts.ptt) common.ptt = true
  if (opts.seconds) common.seconds = opts.seconds
  if (opts.fileName || opts.filename) common.fileName = opts.fileName || opts.filename
  if (opts.jpegThumbnail) common.jpegThumbnail = opts.jpegThumbnail
  if (opts.viewOnce) common.viewOnce = true
  if (opts.gifPlayback) common.gifPlayback = true

  switch (type) {
    case MessageType.image:
      return { image: content, ...common, mimetype: opts.mimetype || 'image/jpeg' }
    case MessageType.video:
      return { video: content, ...common, mimetype: opts.mimetype || 'video/mp4' }
    case MessageType.audio:
      return { audio: content, ...common, mimetype: opts.mimetype || 'audio/mp4' }
    case MessageType.sticker:
      return { sticker: content }
    case MessageType.document:
      return {
        document: content,
        ...common,
        mimetype: opts.mimetype || 'application/octet-stream',
        fileName: opts.fileName || opts.filename || 'file',
      }
    case MessageType.contact:
      return { contacts: toContacts(content, opts) }
    case MessageType.location:
      return { location: content }
    case MessageType.reaction:
      return { react: content }
    case MessageType.buttons:
    case MessageType.list:
    case MessageType.template:
    case MessageType.poll:
      // Baileys 7 menerima objek konten apa adanya untuk pesan interaktif.
      if (content && typeof content === 'object') return content
      return { text: String(content == null ? '' : content) }
    default:
      if (content && typeof content === 'object' && !Buffer.isBuffer(content)) return content
      return { text: String(content == null ? '' : content) }
  }
}

/**
 * Normalisasi vcard tunggal/array menjadi bentuk kontak Baileys 7.
 * @param {String|Object|Array} content
 * @param {Object} opts
 */
function toContacts(content, opts = {}) {
  const list = Array.isArray(content) ? content : [content]
  const contacts = list.map((v, i) => ({
    vcard: typeof v === 'string' ? v : String(v && v.vcard ? v.vcard : ''),
    displayName: (v && v.displayName) || opts.name || `Kontak ${i + 1}`,
  }))
  return {
    displayName: opts.name || (contacts[0] && contacts[0].displayName) || 'Kontak',
    contacts,
  }
}

/** Tipe konten dari sebuah pesan mentah (field pertama). */
function contentKey(message) {
  return message ? Object.keys(message)[0] || '' : ''
}

/** Apakah tipe konten termasuk media (bisa diunduh). */
function isMediaType(type) {
  return [
    MessageType.image,
    MessageType.video,
    MessageType.audio,
    MessageType.sticker,
    MessageType.document,
  ].includes(type)
}

module.exports = { buildContent, contentKey, isMediaType, TEXT_TYPES }
