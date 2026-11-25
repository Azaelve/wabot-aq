/**
 * Scraper SoundCloud: pencarian lagu, resolusi URL stream (HLS), dan
 * penggabungan segmen menjadi satu berkas audio.
 * Client ID publik dideteksi dari halaman SoundCloud; ada nilai cadangan.
 */
const { request } = require('../http')

const BASE = 'https://api-v2.soundcloud.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CLIENT_ID_TTL = 60 * 60 * 1000

let cached = { id: '', at: 0 }

/** Cari client_id publik di bundel JS SoundCloud (hasil di-cache 1 jam). */
async function discoverClientId() {
  if (cached.id && Date.now() - cached.at < CLIENT_ID_TTL) return cached.id
  try {
    const html = await (await request('https://soundcloud.com/', { headers: { 'User-Agent': USER_AGENT } })).text()
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1])
    for (const url of scripts.slice(0, 12)) {
      try {
        const body = await (await request(url, { headers: { 'User-Agent': USER_AGENT } })).text()
        const match = body.match(/client_id[^a-zA-Z0-9]{1,12}([a-zA-Z0-9]{20,40})/)
        if (match) {
          cached = { id: match[1], at: Date.now() }
          return match[1]
        }
      } catch (e) { /* lanjut ke bundel berikutnya */ }
    }
  } catch (e) { /* jaringan gagal, lempar pesan di bawah */ }
  throw new Error('Gagal mendapatkan client_id SoundCloud (halaman SoundCloud berubah)')
}

/** GET ke api-v2 dengan retry singkat saat kena 429. */
async function apiFetch(url, retries = 3) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 429/5xx dilempar oleh request(); semuanya layak dicoba ulang.
      return await request(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    } catch (e) {
      lastError = e
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw new Error('SoundCloud tidak merespons: ' + lastError.message)
}

/** Ubah durasi milidetik ke "m:ss". */
function formatDuration(ms) {
  const total = Math.round((Number(ms) || 0) / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Nama berkas aman dari judul lagu. */
function safeName(value) {
  return String(value || 'track').replace(/[^0-9A-Za-z._@-]+/g, '_').replace(/^_+|_+$/g, '') || 'track'
}

/**
 * Urai playlist HLS (fMP4) menjadi init segment + daftar segmen absolut.
 * @param {String} text isi playlist
 * @param {String} [baseUrl] untuk meresolusi URL relatif
 */
function parsePlaylist(text, baseUrl = '') {
  let init = null
  const segments = []
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXT-X-MAP:')) {
      const match = line.match(/URI="([^"]+)"/)
      if (match) init = new URL(match[1], baseUrl || undefined).toString()
    } else if (!line.startsWith('#')) {
      segments.push(new URL(line, baseUrl || undefined).toString())
    }
  }
  return { init, segments }
}

/** Ambil satu track dari SoundCloud berdasarkan URL permalink atau id. */
async function resolveTrack(value) {
  const clientId = await discoverClientId()
  const raw = String(value || '').trim()
  if (!raw) throw new Error('URL atau ID lagu SoundCloud wajib diisi')
  const endpoint = /^\d+$/.test(raw)
    ? `${BASE}/tracks/${raw}?client_id=${clientId}`
    : `${BASE}/resolve?url=${encodeURIComponent(raw)}&client_id=${clientId}`
  const res = await apiFetch(endpoint)
  return res.json()
}

/** Ambil URL stream yang bisa diputar untuk sebuah track. */
async function trackStreams(track) {
  const clientId = await discoverClientId()
  const transcodings = (track && track.media && track.media.transcodings) || []
  const streams = []
  for (const tc of transcodings) {
    try {
      const res = await apiFetch(`${tc.url}?client_id=${clientId}`)
      const json = await res.json()
      if (json && json.url) {
        streams.push({
          preset: tc.preset || '',
          quality: tc.quality || '',
          protocol: (tc.format && tc.format.protocol) || '',
          mime_type: (tc.format && tc.format.mime_type) || '',
          url: json.url,
        })
      }
    } catch (e) { /* transcoding ini dilewati */ }
  }
  return streams
}

/** Bentuk seragam satu track untuk response API. */
async function normalizeTrack(track, { withStreams = true } = {}) {
  return {
    id: track.id,
    title: track.title || '',
    user: (track.user && (track.user.username || track.user.permalink)) || '',
    permalink: track.permalink_url || '',
    duration: track.duration || 0,
    duration_label: formatDuration(track.duration),
    genre: track.genre || '',
    artwork: track.artwork_url || '',
    play_count: track.playback_count || 0,
    streams: withStreams ? await trackStreams(track) : [],
  }
}

/**
 * Cari lagu di SoundCloud.
 * @param {String} query
 * @param {{limit?: Number, offset?: Number, withStreams?: Boolean}} [options]
 */
async function search(query, options = {}) {
  const q = String(query == null ? '' : query).trim()
  if (!q) throw new Error('Kata kunci pencarian wajib diisi')
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 20))
  const offset = Math.max(0, Number(options.offset) || 0)
  const clientId = await discoverClientId()
  const res = await apiFetch(`${BASE}/search/tracks?q=${encodeURIComponent(q)}&client_id=${clientId}&limit=${limit}&offset=${offset}`)
  const json = await res.json()
  const collection = (json.collection || []).filter(t => t && t.kind === 'track')
  const tracks = []
  for (const track of collection) {
    tracks.push(await normalizeTrack(track, { withStreams: options.withStreams !== false }))
  }
  return { total: json.total_results || 0, count: tracks.length, tracks }
}

/**
 * Unduh audio track SoundCloud (gabungan segmen HLS) sebagai Buffer.
 * @param {String} value permalink atau id track
 * @returns {Promise<{buffer: Buffer, title: String, mime: String, segments: Number}>}
 */
async function download(value) {
  const track = await resolveTrack(value)
  const streams = await trackStreams(track)
  const stream = streams.find(s => s.mime_type.includes('mp4')) || streams[0]
  if (!stream) throw new Error('Stream audio tidak tersedia untuk lagu ini')

  const playlist = await (await request(stream.url, { headers: { 'User-Agent': USER_AGENT } })).text()
  const { init, segments } = parsePlaylist(playlist, stream.url)
  if (!segments.length) throw new Error('Playlist audio kosong')

  const chunks = []
  if (init) {
    chunks.push(Buffer.from(await (await request(init, { headers: { 'User-Agent': USER_AGENT } })).arrayBuffer()))
  }
  for (const segment of segments) {
    chunks.push(Buffer.from(await (await request(segment, { headers: { 'User-Agent': USER_AGENT } })).arrayBuffer()))
  }

  return {
    buffer: Buffer.concat(chunks),
    title: track.title || 'soundcloud',
    filename: `${safeName(track.title)}.m4a`,
    mime: stream.mime_type || 'audio/mp4',
    segments: segments.length,
  }
}

module.exports = { search, download, resolveTrack, trackStreams, discoverClientId, parsePlaylist, formatDuration, safeName }
