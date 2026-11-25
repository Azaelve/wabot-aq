/**
 * Adaptor gaya lama (mirip Baileys 3.x) di atas socket Baileys 7.
 *
 * Plugin cukup memakai `conn.sendMessage`, `conn.sendFile`, `conn.reply`, dsb.
 * Semua penerjemahan ke API baru ada di satu tempat ini (SRP + DIP: plugin
 * bergantung pada antarmuka ini, bukan pada Baileys).
 */
const { EventEmitter } = require('events')
const fs = require('fs')
const path = require('path')
const FileType = require('file-type')
const { downloadMediaMessage } = require('baileys')
const { buildContent, contentKey } = require('./content')
const { MessageType } = require('./message-type')
const { ChatStore } = require('./chats')

const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/opus', pdf: 'application/pdf',
  zip: 'application/zip', txt: 'text/plain',
}

/**
 * Ambil isi berkas dari Buffer, URL, atau path lokal.
 * @param {Buffer|String} file
 * @returns {Promise<Buffer>}
 */
async function readSource(file) {
  if (Buffer.isBuffer(file)) return file
  if (typeof file !== 'string') throw new TypeError('Sumber berkas harus Buffer, URL, atau path')
  if (/^https?:\/\//i.test(file)) {
    const fetch = require('node-fetch')
    const res = await fetch(file)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.buffer()
  }
  return fs.promises.readFile(file)
}

/**
 * Tentukan tipe pesan dari nama berkas / isi berkas.
 * @param {Buffer} buffer
 * @param {String} [filename]
 * @returns {String} nilai MessageType
 */
async function detectType(buffer, filename = '') {
  const ext = path.extname(filename).slice(1).toLowerCase()
  if (ext === 'webp') return MessageType.sticker
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return MessageType.image
  if (['mp4', 'mkv', 'mov', 'webm'].includes(ext)) return MessageType.video
  if (['mp3', 'ogg', 'opus', 'm4a', 'wav'].includes(ext)) return MessageType.audio
  try {
    const info = await FileType.fromBuffer(buffer)
    if (info && info.mime) {
      if (info.mime.startsWith('image/')) return info.mime === 'image/webp' ? MessageType.sticker : MessageType.image
      if (info.mime.startsWith('video/')) return MessageType.video
      if (info.mime.startsWith('audio/')) return MessageType.audio
    }
  } catch (e) { /* deteksi opsional */ }
  return MessageType.document
}

/** Tebak mimetype dari nama berkas. */
function mimeOf(filename = '', fallback = 'application/octet-stream') {
  const ext = path.extname(filename).slice(1).toLowerCase()
  return EXT_MIME[ext] || fallback
}

class LegacyClient extends EventEmitter {
  /**
   * @param {Object} sock socket Baileys 7
   * @param {Object} [options]
   */
  constructor(sock, options = {}) {
    super()
    this.sock = sock
    this.logger = options.logger || console
    // ChatStore meniru ChatManager 3.x (`all()`, `presences`) yang dipakai plugin.
    this.chats = new ChatStore()
    this.blocklist = []
    this.prefix = null
    this.user = { jid: '', name: '', phone: {} }
  }

  /** Kirim pesan dengan tanda tangan lama: (jid, content, type, options). */
  async sendMessage(jid, content, type, options = {}) {
    const payload = buildContent(type, content, options)
    const opts = {}
    if (options.quoted) opts.quoted = options.quoted
    if (options.mentions) opts.mentions = options.mentions
    if (options.detectLinks === false) opts.detectLinks = false
    return this.sock.sendMessage(jid, payload, opts)
  }

  /** Balas pesan pada chat yang sama. */
  async reply(jid, text, quoted, options = {}) {
    return this.sendMessage(jid, text, MessageType.text, { quoted, ...options })
  }

  /**
   * Kirim berkas gaya lama: (jid, file, filename, caption, quoted, options).
   * @param {String} jid
   * @param {Buffer|String} file Buffer, URL, atau path
   * @param {String} [filename]
   * @param {String} [caption]
   * @param {Object} [quoted]
   * @param {Object} [options]
   */
  async sendFile(jid, file, filename = '', caption = '', quoted = null, ...rest) {
    // Pemanggil lama kadang menyisipkan `false` lalu objek opsi.
    const options = Object.assign({}, ...rest.filter(v => v && typeof v === 'object'))
    const buffer = await readSource(file)
    const type = options.type || await detectType(buffer, filename)
    const mimetype = options.mimetype || mimeOf(filename, type === MessageType.image ? 'image/jpeg' : 'application/octet-stream')
    return this.sendMessage(jid, buffer, type, { filename, caption, mimetype, quoted, ...options })
  }

  /**
   * Kompatibilitas pesan berbutton gaya lama: dikirim sebagai teks biasa.
   * @param {String} jid
   * @param {String} text
   * @param {String} footer
   * @param {String} buttonLabel
   * @param {String} buttonCommand
   * @param {Object} [quoted]
   */
  async sendButton(jid, text, footer, buttonLabel, buttonCommand, quoted) {
    const label = buttonLabel ? `\n\n[ ${buttonLabel} ] ${buttonCommand}` : ''
    return this.sendMessage(jid, String(text || '') + label, MessageType.text, { quoted })
  }

  /** Kompatibilitas dua tombol gaya lama (dikirim sebagai teks). */
  async send2Button(jid, text, footer, label1, cmd1, label2, cmd2, quoted) {
    const extra = [label1 && `\n[ ${label1} ] ${cmd1}`, label2 && `[ ${label2} ] ${cmd2}`].filter(Boolean).join('\n')
    return this.sendMessage(jid, String(text || '') + extra, MessageType.text, { quoted })
  }

  /** Kompatibilitas daftar gaya lama (dikirim sebagai teks). */
  async sendList(jid, title, text, footer, list, quoted) {
    const items = (list || []).map(v => `• ${v.title || v.rowId || ''}`).join('\n')
    return this.sendMessage(jid, [title, text, items].filter(Boolean).join('\n'), MessageType.text, { quoted })
  }

  /** Kirim node mentah (dipakai onCall lama); diabaikan dengan aman. */
  async sendJSON() {
    return null
  }

  /** Tag pesan acak, pengganti helper Baileys 3.x. */
  generateMessageTag() {
    return require('crypto').randomBytes(8).toString('hex').toUpperCase()
  }

  /** URL foto profil (dipakai fitur welcome). */
  async getProfilePicture(jid) {
    return this.sock.profilePictureUrl(jid, 'image')
  }

  /** Teruskan pesan apa adanya. */
  async copyNForward(jid, message, options = {}) {
    return this.sendMessage(jid, message, MessageType.text, options)
  }

  /** Metadata grup (di-cache agar handler tidak memanggil berulang). */
  async groupMetadata(jid) {
    const cached = this.chats.get(jid)
    if (cached && cached.metadata) return cached.metadata
    const metadata = await this.sock.groupMetadata(jid)
    this.chats.set(jid, { ...(cached || {}), metadata })
    return metadata
  }

  /** Ganti foto profil (diri sendiri atau grup). */
  async updateProfilePicture(jid, file) {
    const buffer = await readSource(file)
    return this.sock.updateProfilePicture(jid, buffer)
  }

  /** Tandai chat sudah dibaca. */
  async chatRead(jid) {
    try {
      await this.sock.readMessages([{ remoteJid: jid, id: '1', fromMe: false }])
    } catch (e) {
      this.logger.warn && this.logger.warn('[wa] chatRead gagal: ' + e.message)
    }
  }

  /** Kirim ulang pesan yang sudah dibentuk. */
  async relayWAMessage(message, options = {}) {
    const jid = message.key && message.key.remoteJid
    return this.sock.relayMessage(jid, message.message, { messageId: message.key && message.key.id, ...options })
  }

  /**
   * Unduh media dari sebuah pesan (dipakai plugin lewat m.download()).
   * @param {Object} message objek pesan (bukan wrapper)
   * @returns {Promise<Buffer>}
   */
  async downloadMedia(message) {
    const key = message.key || {}
    const type = contentKey(message.message || message)
    const raw = {
      key,
      message: message.message || message,
    }
    if (!raw.key.remoteJid && message.chat) raw.key = { remoteJid: message.chat, id: message.key && message.key.id, fromMe: false }
    return downloadMediaMessage(raw, 'buffer', {}, {
      logger: this.logger,
      reuploadRequest: this.sock.updateMediaMessage,
    })
  }

  /** Kompatibilitas handler lama: memastikan media bisa diunduh. */
  async updateMediaMessage(m) {
    if (!m || !m.message) return m
    try {
      await this.downloadMedia(m)
    } catch (e) {
      this.logger.warn && this.logger.warn('[wa] updateMediaMessage: ' + e.message)
    }
    return m
  }

  /** Nama tampilan sederhana untuk sebuah JID. */
  getName(jid) {
    const num = String(jid || '').split('@')[0]
    return '+' + num
  }
}

module.exports = { LegacyClient, detectType, mimeOf, readSource }
