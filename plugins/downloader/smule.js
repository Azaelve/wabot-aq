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
    global.API('xteam', '/dl/smule', {
      url: args[0]
    }, 'APIKEY')
    await conn.sendFile(m.chat, undefined, '', '', m)
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}
handler.help = [].map(v => v + ' <url>')
handler.tags = ['downloader']

handler.command = /^\x00s$/i

module.exports = handler
