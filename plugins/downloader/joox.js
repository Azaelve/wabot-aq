const { joox } = require('../../lib/scrape_joox')

const isUrl = str => /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi.test(str)
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const react = async (emoji) => {
    try {
      const sock = (conn && conn.sock) || conn
      if (sock?.sendMessage) {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
      }
    } catch {}
  }
  try {
    await react('⏳')
    if (!text) throw `*Perintah ini untuk mencari lagu joox berdasarkan pencarian*\n\ncontoh:\n${usedPrefix + command} akad`
    if (isUrl(text)) throw `*Perintah ini untuk mencari lagu joox berdasarkan pencarian bukan link*\n\ncontoh:\n${usedPrefix + command} akad`
    let json = await joox(text)
    let result = json.data[Math.floor(Math.random() * json.data.length)]
    let pesan = `
*Penyanyi:* ${result.penyanyi}
*Judul:* ${result.lagu}
*Album:* ${result.album}
*Diterbitkan:* ${result.publish}
*Link:* ${result.mp3}
`.trim()
    await conn.sendFile(m.chat, result.img, 'error.jpg', pesan, m, false, { thumbnail: Buffer.alloc(0) })
    await conn.sendFile(m.chat, result.mp3, 'error.mp3', '', m, false, { mimetype: 'audio/mp4' })
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}

handler.help = ['joox'].map(v => v + ' <judul>')
handler.tags = ['downloader']
handler.command = /^joox$/i
handler.limit = true
handler.premium = true // hapus aja kalau saya sengaja premium makan kuota termux :)
module.exports = handler
