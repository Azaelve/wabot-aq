let fetch = require('node-fetch')
let handler = async (m, { conn, args }) => {
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
    if (!args[0]) throw 'Uhm...url nya mana?'
    let res = await fetch(global.API('xteam', '/dl/ig', {
      url: args[0]
    }, 'APIKEY'))
    if (res.status !== 200) throw await res.text()
    let json = await res.json()
    if (!json.status || !json.result) throw json.message || 'Gagal mengambil media'
    let { name, username, likes, caption, data } = json.result
    let text = [
      name && `Nama: ${name}`,
      username && `Username: *(@${username})*`,
      likes && `${likes} Likes`,
      caption && `Caption:\n${caption}`,
    ].filter(Boolean).join('\n') || 'Instagram'
    for (let i = 0; i < data.length; i++) {
      let { data: url, type, filename } = data[i]
      await conn.sendFile(m.chat, url, filename || `ig${i + 1}.${type == 'video' ? 'mp4' : 'jpg'}`, i == 0 ? text : '', m)
    }
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}
handler.help = ['ig'].map(v => v + ' <url>')
handler.tags = ['downloader']

handler.command = /^(ig(dl)?)$/i

module.exports = handler
