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
  // done: file asli diakhiri `throw json.result` setelah semua story terkirim
  // (bug bawaan, dibiarkan apa adanya) — tanpa flag ini ❌ ikut terkirim
  // padahal pengiriman sudah sukses, jadi ❌ hanya dikirim bila gagal sebelum selesai.
  let done = false
  try {
    await react('⏳')
    if (!args[0]) throw 'Uhm...url nya mana?'
    let res = await fetch(global.API('xteam', '/dl/igs', {
      nama: args[0]
    }, 'APIKEY'))
    let json = await res.json()
    if (res.status != 200) throw json
    if (json.result.error) throw json.result.message
    let { username, storylist } = json.result
    let dateConfig = {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }
    for (let { url, type, taken_at } of storylist)
      await conn.sendFile(m.chat, url, 'ig' + (type == 'video' ? '.mp4' : '.jpg'), `
@${username}
Memposting pada ${new Date(taken_at * 1000).toLocaleDateString('id', dateConfig)}
`, m)
    await react('✅')
    done = true
    throw json.result
  } catch (e) {
    if (!done) await react('❌')
    throw e
  }
}
handler.help = ['igstory'].map(v => v + ' <username>')
handler.tags = ['downloader']

handler.command = /^(igs(tory)?)$/i

module.exports = handler
