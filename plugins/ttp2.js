const { sticker } = require('../lib/sticker')
const { MessageType } = require('../lib/wa/message-type')

let handler = async (m, { conn, text }) => {
  try {
    let teks = text ? text : m.quoted && m.quoted.text ? m.quoted.text : m.text
    // Rute lokal /ttp meneruskan ke api.jaky.dev; salism3api sudah mati.
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
handler.help = ['ttp2 <teks>']
handler.tags = ['sticker']
handler.command = /^(ttp2)$/i
handler.limit = true
//MadeByAnshul
module.exports = handler