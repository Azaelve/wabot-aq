/**
 * Kumpulan scraper API lokal. Route hanya bergantung pada berkas ini,
 * bukan pada implementasi tiap situs.
 */
const { kbbi } = require('./kbbi')
const { kodepos } = require('./kodepos')
const { resep } = require('./resep')
const { berita } = require('./berita')
const { instagram } = require('./instagram')
const { tiktok } = require('./tiktok')
const soundcloud = require('./soundcloud')

module.exports = { kbbi, kodepos, resep, berita, instagram, tiktok, soundcloud }
