let fetch = require('node-fetch')

let handler = async (m, { conn, command, text }) => {
  if (!text) throw 'Cari lagu apa?'
  let isDownload = /^(scdl|scplay|soundclouddl)$/i.test(command)

  if (isDownload) {
    let res = await fetch(global.API('xteam', '/dl/soundcloud', { url: text }, 'APIKEY'))
    if (res.status !== 200) throw await res.text()
    let buffer = await res.buffer()
    let name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)
    return conn.sendFile(m.chat, buffer, (name && name[1]) || 'soundcloud.m4a', `*SoundCloud*\n${text}`, m, false, { mimetype: 'audio/mp4' })
  }

  let res = await fetch(global.API('xteam', '/api/soundcloud', { q: text, limit: 5 }, 'APIKEY'))
  if (res.status !== 200) throw await res.text()
  let json = await res.json()
  if (!json.status || !json.result || !json.result.tracks.length) throw 'Lagu tidak ditemukan'
  let list = json.result.tracks.map((t, i) => `${i + 1}. *${t.title}*\n   ${t.user} • ${t.duration_label}\n   ${t.permalink}`).join('\n\n')
  m.reply(`Hasil pencarian *${text}* (${json.result.total} total):\n\n${list}\n\nUnduh dengan:\n*.scdl <link>*`)
}
handler.help = ['sc <judul>', 'scdl <link>']
handler.tags = ['downloader']
handler.command = /^(sc|soundcloud|scdl|scplay|soundclouddl)$/i

module.exports = handler
