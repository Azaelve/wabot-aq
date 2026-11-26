const { sticker } = require('../../lib/sticker')
const { MessageType } = require('../../lib/wa/message-type')

let handler = async (m, { conn, text }) => {
  try {
    let teks = text ? text : m.quoted && m.quoted.text ? m.quoted.text : m.text
    // Rute lokal /attp → /v1/canvas/brat?animation=true (GIF teks animasi).
    let stiker = await sticker(null, global.API('local', '/attp', { text: teks }), global.packname, global.author)
    if (!stiker) throw false
    conn.sendMessage(m.chat, stiker, MessageType.sticker, {
      quoted: m
    })
  } catch (e) {
    m.reply('Conversion Failed')
    throw false
  }
}
handler.help = ['attp2 <teks>']
handler.tags = ['sticker']
handler.command = /^(attp2)$/i
handler.limit = true
//Made By Anshul
module.exports = handler