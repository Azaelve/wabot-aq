/**
 * Scraper TikTok: tikwm sebagai sumber utama, tikloapp sebagai cadangan
 * (termasuk untuk postingan foto/live photo).
 */
const { getJSON, request } = require('../http')

const TIKWM = 'https://www.tikwm.com/api/?url='
const TIKLO = 'https://tikloapp.com/api/download/'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TT_URL = /^https?:\/\/(?:www\.|m\.|vt\.|vm\.)?tiktok\.com\//i

/**
 * Validasi URL TikTok.
 * @param {String} value
 * @returns {String} URL yang sudah dirapikan
 */
function parseTikTokUrl(value) {
  const url = String(value == null ? '' : value).trim()
  if (!TT_URL.test(url)) throw new Error('URL TikTok tidak valid (contoh: https://www.tiktok.com/@user/video/123)')
  return url
}

/** Bentuk hasil seragam untuk video. */
function videoResult({ id = '', title = '', author = '', duration = 0, cover = '', video = '' }) {
  return { type: 'video', id, title, author, duration, cover, video, images: [], live: [] }
}

/** Bentuk hasil seragam untuk postingan foto/live photo. */
function photoResult({ id = '', title = '', author = '', images = [], live = [] }) {
  return { type: 'photos', id, title, author, duration: 0, cover: images[0] || '', video: '', images, live }
}

/** Ubah respons tikloapp menjadi hasil seragam. */
function normalizeTikloapp(json) {
  if (!json || !json.ok) return null
  if (json.type === 'video' && json.links) {
    const video = json.links.nowm || json.links.hd || json.links.mp3 || ''
    if (!video) return null
    return videoResult({
      id: json.id,
      title: json.title,
      author: json.author,
      duration: json.duration,
      cover: json.cover,
      video,
    })
  }
  const images = Array.isArray(json.images) ? json.images.filter(Boolean) : []
  if (images.length) {
    return photoResult({
      id: json.id,
      title: json.title || '',
      author: json.author || '',
      images,
      live: Array.isArray(json.live) ? json.live.filter(Boolean) : [],
    })
  }
  return null
}

/** Sumber utama: tikwm (tanpa API key). */
async function viaTikwm(url) {
  const json = await getJSON(TIKWM + encodeURIComponent(url))
  if (!json || json.code !== 0 || !json.data) return null
  const data = json.data
  const video = data.hdplay || data.play || data.wmplay || ''
  if (!video) return null
  return videoResult({
    id: data.id,
    title: data.title || '',
    author: data.author ? data.author.nickname || data.author.unique_id : '',
    duration: data.duration || 0,
    cover: data.cover || '',
    video: /^https?:\/\//i.test(video) ? video : 'https://www.tikwm.com' + video,
  })
}

/** Cadangan: tikloapp (mendukung foto/live photo). */
async function viaTikloapp(url) {
  const res = await request(TIKLO, {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      Origin: 'https://tikloapp.com',
      Referer: 'https://tikloapp.com/id/tiktok-live-photo-downloader/',
      Accept: 'application/json',
    },
  })
  return normalizeTikloapp(await res.json())
}

/**
 * Ambil media TikTok (video, foto, atau live photo).
 * @param {String} url
 * @returns {Promise<Object>} hasil seragam
 */
async function tiktok(url) {
  const target = parseTikTokUrl(url)

  const primary = await viaTikwm(target).catch(() => null)
  if (primary) return primary

  const fallback = await viaTikloapp(target).catch(e => {
    throw new Error(`Gagal mengambil media TikTok: ${e.message}`)
  })
  if (fallback) return fallback

  throw new Error('Media TikTok tidak ditemukan (URL salah atau postingan privat)')
}

module.exports = { tiktok, parseTikTokUrl, normalizeTikloapp, videoResult, photoResult }
