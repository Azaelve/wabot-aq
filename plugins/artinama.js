let got = require('got')
let cheerio = require('cheerio')

let handler = async (m, { text }) => {
  if (!text) throw 'Namanya siapa?'
  let nama = text
  let body = await got('http://www.primbon.com/arti_nama.php?nama1=' + encodeURIComponent(nama) + '&proses=+Submit%21+').text()
  let $ = cheerio.load(body)
  let y = $.html().split('arti:')[1]
  if (!y) throw 'Arti nama tidak ditemukan'
  let t = y.split('method="get">')[1] || ''
  let f = y.replace(t, " ")
  let x = f.replace(/<br\s*[\/]?>/gi, "\n")
  let h = x.replace(/<[^>]*>?/gm, '')
  m.reply(
    `
      Arti dari nama ${nama} adalah
-----------------------------------
         Nama ${nama} ${h}
         
-----------------------------------
`)
}
handler.help = ['artinama'].map(v => v + ' <nama>')
handler.tags = ['kerang']
handler.command = ['artinama']

module.exports = handler
