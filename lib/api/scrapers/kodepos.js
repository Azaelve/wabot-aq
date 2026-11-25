/**
 * Pencarian kode pos lewat API gratis carikodepos.id.
 */
const { getJSON, clean } = require('../http')

const ENDPOINT = 'https://carikodepos.id/api/postal-codes'
const LIMIT = 10

/**
 * @param {String} q nama kota/kecamatan/desa
 * @returns {Promise<Array<{province:String, city:String, subdistrict:String, urban:String, postalcode:String}>>}
 */
async function kodepos(q) {
  if (!q) throw new Error('Kota/kecamatan wajib diisi')
  const json = await getJSON(`${ENDPOINT}?limit=${LIMIT}&search=${encodeURIComponent(q)}`)
  const rows = json && json.data && json.data.postalCodes
  if (!Array.isArray(rows) || !rows.length) throw new Error('Kode pos tidak ditemukan')

  const hasil = rows.map(v => ({
    province: v.province ? v.province.name : '',
    city: v.city ? v.city.name : '',
    subdistrict: v.district ? v.district.name : '',
    urban: v.village ? v.village.name : '',
    postalcode: v.code || '',
  }))

  // yang paling relevan dulu: cocok persis, awalan, lalu yang memuat kata kunci
  const key = clean(q).toLowerCase()
  const skor = v => {
    const fields = [v.city, v.subdistrict, v.urban, v.province].map(x => String(x).toLowerCase())
    if (fields.some(x => x === key)) return 0
    if (fields.some(x => x.startsWith(key))) return 1
    if (fields.some(x => x.includes(key))) return 2
    return 3
  }
  return hasil.sort((a, b) => skor(a) - skor(b))
}

module.exports = { kodepos }
