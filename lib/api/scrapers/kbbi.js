/**
 * Scraper KBBI Daring (kbbi.web.id).
 */
const cheerio = require('cheerio')
const { getHTML, clean } = require('../http')

/**
 * Arti kata dari KBBI.
 * @param {String} kata
 * @returns {Promise<{word: String, list: String[]}>}
 */
async function kbbi(kata) {
  if (!kata) throw new Error('Kata wajib diisi')
  const html = await getHTML('https://kbbi.web.id/' + encodeURIComponent(kata))
  const $ = cheerio.load(html)
  const judul = clean($('title').text())
  const word = (judul.match(/Arti kata (.+?) [-–]/i) || [])[1] || kata
  const definisi = clean($('#d1').text())
  if (!definisi) throw new Error('Kata tidak ditemukan di KBBI')
  const list = definisi.split(/;\s*/).map(clean).filter(Boolean).slice(0, 20)
  return { word, list }
}

module.exports = { kbbi }
