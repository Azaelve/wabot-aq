/**
 * Normalisasi pesan Baileys 7 menjadi bentuk `m` yang dipakai handler/plugin,
 * plus helper murni yang bisa diuji tanpa koneksi WhatsApp.
 */
const { contentKey, isMediaType } = require('./content')
const { MessageType } = require('./message-type')
const { preferPn } = require('./jid')

/** Bungkus pesan (ephemeral/viewOnce/document-with-caption) ke isi sebenarnya. */
function unwrapMessage(message) {
  let current = message
  for (let i = 0; i < 5 && current; i++) {
    const key = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage', 'editedMessage']
      .find(k => current[k])
    if (!key) break
    const inner = current[key]
    current = inner && inner.message ? inner.message : inner
  }
  return current
}

/** Ambil teks dari berbagai bentuk pesan. */
function extractText(message) {
  const msg = unwrapMessage(message) || {}
  const type = contentKey(msg)
  const body = msg[type] || {}
  switch (type) {
    case MessageType.text:
      return typeof body === 'string' ? body : String(body.text || '')
    case MessageType.extendedText:
      return String(body.text || '')
    case MessageType.image:
    case MessageType.video:
    case MessageType.document:
      return String(body.caption || '')
    case MessageType.buttons:
      return String(body.contentText || body.text || '')
    case MessageType.list:
      return String(body.title || body.description || '')
    case MessageType.reaction:
      return String(body.text || '')
    default:
      return ''
  }
}

/**
 * Nomor telepon untuk pairing: hanya digit, tanpa '+'/spasi.
 * @param {String} input
 * @returns {String}
 */
function normalizePhone(input) {
  const digits = String(input == null ? '' : input).replace(/[^0-9]/g, '')
  if (!digits) throw new Error('Nomor WhatsApp wajib diisi')
  if (digits.length < 8 || digits.length > 15) throw new Error('Nomor WhatsApp tidak valid: ' + input)
  return digits
}

/**
 * Pesan mentah Baileys 7 -> objek `m` gaya lama.
 * @param {Object} raw { key, message, pushName, messageTimestamp }
 * @returns {Object}
 */
function toLegacyMessage(raw) {
  const key = raw.key || {}
  const message = unwrapMessage(raw.message)
  const mtype = contentKey(message)
  const chat = key.remoteJid || ''
  const isGroup = chat.endsWith('@g.us')
  // `chat` dibiarkan apa adanya agar balasan tetap lewat rute yang sama, tetapi
  // `sender` dinormalkan ke nomor telepon: kunci database, daftar peserta, dan
  // sapaan menu semuanya memakai nomor telepon, bukan LID.
  const sender = isGroup
    ? preferPn(key.participant || raw.participant || chat, key.participantAlt)
    : preferPn(chat, key.remoteJidAlt)
  return {
    key,
    message,
    mtype,
    msg: message ? message[mtype] || {} : {},
    chat,
    sender,
    isGroup,
    fromMe: !!key.fromMe,
    pushName: raw.pushName || '',
    messageTimestamp: raw.messageTimestamp || Math.floor(Date.now() / 1000),
    isMedia: isMediaType(mtype),
    text: extractText(message),
  }
}

/**
 * Lengkapi `m` dengan helper yang dipakai plugin (reply, download, quoted, ...).
 * @param {Object} conn client kompatibel (lihat lib/wa/legacy.js)
 * @param {Object} m hasil toLegacyMessage
 */
function smsg(conn, m) {
  m.reply = (text, chatId = m.chat, options = {}) =>
    conn.sendMessage(chatId, text, MessageType.text, { quoted: m, ...options })
  m.mentionedJid = (m.msg && m.msg.contextInfo && m.msg.contextInfo.mentionedJid) || []
  m.isBaileys = !!(m.key && m.key.id && m.key.id.startsWith('BAE5')) || m.mtype === MessageType.protocol

  const context = (m.msg && m.msg.contextInfo) || {}
  if (context.quotedMessage) {
    const quotedMessage = unwrapMessage(context.quotedMessage)
    const quotedType = contentKey(quotedMessage)
    m.quoted = {
      message: quotedMessage,
      mtype: quotedType,
      msg: quotedMessage ? quotedMessage[quotedType] || {} : {},
      sender: context.participant || m.chat,
      text: extractText(quotedMessage),
      download: () => conn.downloadMedia(quotedMessage),
    }
    if (m.quoted.msg && m.quoted.msg.mimetype) m.quoted.mimetype = m.quoted.msg.mimetype
  }

  m.download = () => conn.downloadMedia(m.message)
  m.chatUpdate = conn.chats.get(m.chat) || (conn.chats.set(m.chat, { metadata: undefined }), conn.chats.get(m.chat))
  return m
}

module.exports = {
  unwrapMessage,
  extractText,
  normalizePhone,
  toLegacyMessage,
  smsg,
}
