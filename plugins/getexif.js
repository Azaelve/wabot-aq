let util = require('util')
let { readExif } = require('../lib/sticker-exif')

let handler = async (m) => {
  if (!m.quoted) return m.reply('Tag stikernya!')
  if (!/sticker/.test(m.quoted.mtype || '')) return m.reply('Yang dikutip bukan stiker.')
  let meta
  try {
    meta = await readExif(await m.quoted.download())
  } catch (e) {
    return m.reply('Gagal membaca stiker: ' + e.message)
  }
  if (!meta) return m.reply('Stiker ini tidak punya metadata EXIF.')
  m.reply(util.format(meta))
}

handler.help = ['getexif']
handler.tags = ['sticker']
handler.command = ['getexif']

module.exports = handler
