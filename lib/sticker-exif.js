/**
 * Metadata EXIF stiker WhatsApp: id paket, nama paket, pembuat, dan emoji.
 *
 * Bagian murni (`buildMeta`, `buildExif`, `parseExif`) tidak menyentuh berkas
 * webp sehingga bisa diuji langsung; `addExif`/`readExif` membungkus
 * node-webpmux untuk menyisipkan dan membaca metadata pada stiker asli.
 */
const crypto = require('crypto')

/** Batas panjang teks yang aman untuk nama paket/pembuat. */
const MAX_TEXT = 128

/** Header TIFF little-endian berisi satu tag 0x5741 ("AW") milik WhatsApp. */
const EXIF_HEADER = Buffer.from([
  0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
])
const LENGTH_OFFSET = 14

/**
 * Bersihkan teks metadata: buang karakter kontrol, rapikan spasi, batasi panjang.
 * @param {String} value
 * @param {Number} [max]
 * @returns {String}
 */
function cleanText(value, max = MAX_TEXT) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Daftar emoji, dengan default 🤖 seperti stiker WhatsApp pada umumnya.
 * @param {String[]} list
 * @returns {String[]}
 */
function normalizeEmojis(list) {
  const emojis = []
  for (const item of list || []) {
    const emoji = cleanText(item, 8)
    if (emoji) emojis.push(emoji)
  }
  return emojis.length ? emojis : ['🤖']
}

/**
 * Bentuk objek metadata yang ditulis ke EXIF.
 * @param {Object} [options]
 * @param {String} [options.packname] nama paket stiker
 * @param {String} [options.author] pembuat
 * @param {String[]} [options.emojis]
 * @param {Object} [options.extra] field tambahan, mis. `{ name }`
 * @returns {Object}
 */
function buildMeta({ packname = '', author = '', emojis = [], extra = {} } = {}) {
  const meta = { ...(extra || {}) }
  meta['sticker-pack-id'] = cleanText(meta['sticker-pack-id'], 64) || crypto.randomBytes(32).toString('hex')
  meta['sticker-pack-name'] = cleanText(packname)
  meta['sticker-pack-publisher'] = cleanText(author)
  meta.emojis = normalizeEmojis(emojis)
  return meta
}

/**
 * Susun buffer EXIF (header 22 byte + JSON) dari objek metadata.
 * @param {Object} meta hasil `buildMeta`
 * @returns {Buffer}
 */
function buildExif(meta = {}) {
  const json = Buffer.from(JSON.stringify(meta), 'utf8')
  const header = Buffer.from(EXIF_HEADER)
  header.writeUIntLE(json.length, LENGTH_OFFSET, 4)
  return Buffer.concat([header, json])
}

/**
 * Baca metadata dari buffer EXIF. Toleran terhadap header apa pun yang
 * mendahului JSON, dan mengembalikan `null` bila tidak ada JSON yang valid.
 * @param {Buffer} buffer
 * @returns {Object|null}
 */
function parseExif(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null
  const start = buffer.indexOf('{')
  if (start < 0) return null
  try {
    const meta = JSON.parse(buffer.slice(start).toString('utf8'))
    return meta && typeof meta === 'object' ? meta : null
  } catch (e) {
    return null
  }
}

/**
 * Sisipkan metadata ke stiker webp.
 * @param {Buffer} webpSticker
 * @param {String} [packname]
 * @param {String} [author]
 * @param {String[]} [categories] emoji
 * @param {Object} [extra]
 * @returns {Promise<Buffer>}
 */
async function addExif(webpSticker, packname = '', author = '', categories = [''], extra = {}) {
  const { Image } = require('node-webpmux')
  const image = new Image()
  await image.load(webpSticker)
  image.exif = buildExif(buildMeta({ packname, author, emojis: categories, extra }))
  return image.save(null)
}

/**
 * Baca metadata dari stiker webp.
 * @param {Buffer} webpSticker
 * @returns {Promise<Object|null>}
 */
async function readExif(webpSticker) {
  const { Image } = require('node-webpmux')
  const image = new Image()
  await image.load(webpSticker)
  return parseExif(image.exif)
}

module.exports = { MAX_TEXT, EXIF_HEADER, cleanText, normalizeEmojis, buildMeta, buildExif, parseExif, addExif, readExif }
