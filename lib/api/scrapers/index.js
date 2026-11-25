/**
 * Kumpulan scraper API lokal.
 * Interface publik lama (`lib/scrapers.js`) tetap sama.
 */
const { kbbi } = require('./kbbi')
const { kodepos } = require('./kodepos')
const { resep } = require('./resep')
const { berita, FEEDS } = require('./berita')

module.exports = { kbbi, kodepos, resep, berita, FEEDS }
