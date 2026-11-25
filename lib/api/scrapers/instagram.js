/**
 * Scraper Instagram lewat igexport.com (tanpa API key).
 * Hanya mengambil data; bentuk respons HTTP diatur oleh route.
 */
const { getJSON } = require('../http')

const BASE = 'https://igexport.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' }

const IG_URL = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i

/**
 * Validasi URL Instagram dan ubah ke bentuk kanonik.
 * @param {String} value
 * @returns {{url: String, shortcode: String, kind: String}}
 */
function parseInstagramUrl(value) {
  const match = IG_URL.exec(String(value == null ? '' : value).trim())
  if (!match) throw new Error('URL Instagram tidak valid (contoh: https://www.instagram.com/p/xxxx/)')
  const kind = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase()
  const shortcode = match[2]
  return { url: `https://www.instagram.com/${kind}/${shortcode}/`, shortcode, kind }
}

/** Satu item mentah igexport -> bentuk seragam. */
function normalizeItem(item, index, shortcode) {
  if (!item || !item.url) return null
  const type = item.type === 'video' ? 'video' : 'image'
  const ext = type === 'video' ? 'mp4' : 'jpg'
  return {
    type,
    url: item.url,
    thumbnail: item.thumbnailUrl || null,
    filename: item.filename || `instagram-${shortcode}-${index + 1}.${ext}`,
  }
}

/**
 * Ambil media sebuah postingan/reel Instagram.
 * @param {String} url
 * @returns {Promise<{shortcode: String, source: String, items: Array}>}
 */
async function instagram(url) {
  const target = parseInstagramUrl(url)

  const photo = await getJSON(`${BASE}/api/ig-photo/?url=${encodeURIComponent(target.url)}`, { headers: HEADERS })
  if (photo.ok && photo.media && Array.isArray(photo.media.items) && photo.media.items.length) {
    const items = photo.media.items
      .map((item, i) => normalizeItem(item, i, photo.media.shortcode || target.shortcode))
      .filter(Boolean)
    if (items.length) {
      return { shortcode: photo.media.shortcode || target.shortcode, source: 'ig-photo', items }
    }
  }

  const reels = await getJSON(`${BASE}/api/ig-reels/?url=${encodeURIComponent(target.url)}`, { headers: HEADERS })
  if (reels.ok && reels.media && reels.media.videoUrl) {
    return {
      shortcode: target.shortcode,
      source: 'ig-reels',
      items: [normalizeItem({
        type: 'video',
        url: reels.media.videoUrl,
        thumbnailUrl: reels.media.thumbnailUrl,
        filename: reels.media.filename,
      }, 0, target.shortcode)].filter(Boolean),
    }
  }

  throw new Error('Media tidak ditemukan (URL salah atau postingan privat)')
}

module.exports = { instagram, parseInstagramUrl, normalizeItem }
