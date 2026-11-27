let handler = async (m, { conn, args, usedPrefix, command }) => {
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
    if (!args[0]) throw 'usernamenya mana om'
    if (!args[1]) throw 'repo nya mana?'

    let url = `https://github.com/${args[0]}/${args[1]}/archive/refs/heads/main.zip`
    //ByRizkyAdi
    m.reply(`compressing data to file zip*`)
    await conn.sendFile( m.chat, url, 'repo.zip', null, m)
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}
handler.help = ['githubdl']
handler.tags = ['download']
handler.command = /githubdl/i

handler.limit = true

module.exports = handler
