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
    let res = await fetch(global.API('xteam', '/dl/twitter', { url: args[0] }, 'APIKEY'))
    if (res.status != 200) throw await res.text()
    let json = await res.json()
    if (!json.status) throw json
    let { name, username, caption, quality, format, size, video_url } = json.result
    await conn.sendFile(m.chat, video_url, 'file.mp4', `
Name: ${name}
Username: ${username}
Caption: ${caption}
Quality: ${quality}
Format: ${format}
Size: ${size}
  `.trim(), m)
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}
handler.help = ['twitter'].map(v => v + ' <url>')
handler.tags = ['downloader']

handler.command = /^twitter$/i

handler.limit = true

module.exports = handler
