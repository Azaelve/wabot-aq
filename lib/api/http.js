/**
 * Helper HTTP bersama untuk route dan scraper API lokal.
 * Satu-satunya tempat yang tahu cara mengambil data dari internet
 * (single responsibility + dependency inversion: modul lain tidak
 * memanggil fetch secara langsung).
 */
const fetch = require('node-fetch')

const USER_AGENT = 'wabot-aq-localapi/1.0 (+https://github.com/Azaelve/wabot-aq)'
const TIMEOUT = 25000

/** Rapikan teks: buang nbsp dan spasi berlebih. */
function clean(str) {
  return String(str == null ? '' : str)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parameter query yang aman dipakai. */
function text(value) {
  return String(value == null ? '' : value).trim()
}

/**
 * Ambil respons HTTP mentah.
 * @param {String} url
 * @param {Object} [options]
 * @returns {Promise<import('node-fetch').Response>}
 */
async function request(url, options = {}) {
  const res = await fetch(url, {
    timeout: TIMEOUT,
    redirect: 'follow',
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${new URL(url).host}`)
  return res
}

/** Ambil HTML/XML sebagai string. */
async function getHTML(url, options) {
  return (await request(url, options)).text()
}

/** Ambil JSON. */
async function getJSON(url, options = {}) {
  const res = await request(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  })
  return res.json()
}

module.exports = {
  USER_AGENT,
  TIMEOUT,
  clean,
  text,
  request,
  getHTML,
  getJSON,
}
