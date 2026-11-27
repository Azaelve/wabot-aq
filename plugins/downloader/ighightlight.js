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
    let res = await fetch(global.API('xteam', '/dl/ighighlight', {
      nama: args[0]
    }, 'APIKEY'))
    let json = await res.json()
    if (json.result.error) throw json.result.message
    let { username, items } = json.result
    for (let { thumbnail, isVideo, url } of items) {
      thumbnail = await (await fetch(thumbnail)).buffer()
      await conn.sendFile(m.chat, url, 'ig' + (isVideo ? '.mp4' : '.jpg'), `@${username}`, m, false, {
        thumbnail
      })
    }
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}
handler.help = ['ighighlight'].map(v => v + ' <username>')
handler.tags = ['downloader']

handler.command = /^(ighighlight?)$/i

module.exports = handler
