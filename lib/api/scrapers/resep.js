/**
 * Scraper resep masakan (resepkoki.id): cari, lalu ambil resep pertama.
 */
const cheerio = require('cheerio')
const { getHTML, clean } = require('../http')

const SEARCH = 'https://resepkoki.id/?s='

/**
 * Ambil tautan resep pertama dari halaman pencarian.
 * @param {CheerioStatic} $
 * @returns {String}
 */
function firstRecipeLink($) {
  let link = ''
  $('a[href*="resepkoki.id/resep/"]').each((i, el) => {
    if (link) return
    const href = $(el).attr('href') || ''
    if (/\/resep\/[^/?#]+\/?$/.test(href)) link = href.split('?')[0]
  })
  return link
}

/**
 * @param {String} q nama masakan
 * @returns {Promise<{title:String,thumb:String,url:String,tingkat:String,duration:String,banyak:String,bahan:String,cara:String}>}
 */
async function resep(q) {
  if (!q) throw new Error('Nama masakan wajib diisi')
  const hasilPencarian = await getHTML(SEARCH + encodeURIComponent(q))
  const link = firstRecipeLink(cheerio.load(hasilPencarian))
  if (!link) throw new Error('Resep tidak ditemukan')

  const $$ = cheerio.load(await getHTML(link))
  const bahan = $$('.ingredients-table tr')
    .map((i, el) => {
      const nama = clean($$(el).find('.ingredient-name').text())
      const jumlah = clean($$(el).find('.ingredient-amount').text())
      if (nama) return jumlah ? `${nama} - ${jumlah}` : nama
      return clean($$(el).find('td').last().text())
    })
    .get()
    .filter(Boolean)
    .join('\n')
  const cara = $$('.recipe-steps-table .single-step-description')
    .map((i, el) => clean($$(el).text()))
    .get()
    .filter(Boolean)
    .map((step, i) => `${i + 1}. ${step}`)
    .join('\n')

  return {
    title: clean($$('h1').first().text()),
    thumb: $$('meta[property="og:image"]').attr('content') || '',
    url: link,
    tingkat: '',
    // resepkoki.id tidak menyediakan durasi masak; field tetap ada sesuai kontrak plugin
    duration: '',
    banyak: clean($$('.ingredient-serves input').attr('value') || ''),
    bahan,
    cara,
  }
}

module.exports = { resep }
