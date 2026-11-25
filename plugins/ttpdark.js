const { sticker } = require('../lib/sticker')
const { MessageType } = require('../lib/wa/message-type')

let handler = async (m, { conn, text }) => {
  try {
    let teks = text ? text : m.quoted && m.quoted.text ? m.quoted.text : m.text
    // Rute lokal /ttp (api.jaky.dev). Warna outline khas ttpdark tidak
    // didukung padanan ini, jadi tampilan mengikuti kartu kutipan bawaan.
    let stiker = await sticker(null, global.API('local', '/ttp', { text: teks }), global.packname, global.author)
    if (!stiker) throw false
    conn.sendMessage(m.chat, stiker, MessageType.sticker, {
      quoted: m
    })
  } catch (e) {
    m.reply('Conversion Failed')
    throw false
  }
}
handler.help = ['ttpdark <teks>']
handler.tags = ['sticker']
handler.command = /^(ttpdark)$/i
handler.limit = true
//Made By Anshul
module.exports = handler