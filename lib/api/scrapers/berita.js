/**
 * Berita dari feed RSS resmi.
 * Hanya sumber yang benar-benar bisa diakses yang didaftarkan di sini.
 */
const cheerio = require('cheerio')
const { getHTML, clean } = require('../http')

const FEEDS = {
  cnn: 'https://www.cnnindonesia.com/nasional/rss',
  antara: 'https://www.antaranews.com/rss/terkini.xml',
  republika: 'https://www.republika.co.id/rss',
  cnbc: 'https://www.cnbcindonesia.com/rss',
}

/**
 * @param {String} sumber cnn|antara|republika|cnbc
 * @returns {Promise<{status:Boolean, judul:String, tanggal:String, artikel:String, thumb:String, url:String}>}
 */
async function berita(sumber) {
  const key = String(sumber || '').toLowerCase().trim()
  const feed = FEEDS[key]
  if (!feed) {
    throw new Error(`Sumber berita "${sumber}" tidak tersedia. Pilihan: ${Object.keys(FEEDS).join(', ')}`)
  }
  const xml = await getHTML(feed)
  const $ = cheerio.load(xml, { xmlMode: true })
  const item = $('item').first()
  if (!item.length) throw new Error('Feed berita kosong')

  let thumb = item.find('enclosure').attr('url') || ''
  if (!thumb) {
    const media = xml.match(/<media:content[^>]*url="([^"]+)"/i) || xml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
    if (media) thumb = media[1]
  }
  const deskripsi = item.find('description').first().text() || ''

  return {
    status: true,
    judul: clean(item.find('title').first().text()),
    tanggal: clean(item.find('pubDate').first().text()),
    artikel: clean(cheerio.load('<div>' + deskripsi + '</div>').text()),
    thumb,
    url: clean(item.find('link').first().text()),
  }
}

module.exports = { berita, FEEDS }
