let fetch = require('node-fetch')
let handler = async (m, { conn, args }) => {
  if (!args[0]) throw 'Uhm...url nya mana?'
  let res = await fetch(global.API('xteam', '/dl/tiktok', {
    url: args[0]
  }, 'APIKEY'))
  if (res.status !== 200) throw await res.text()
  let json = await res.json()
  if (!json.status || !json.result) throw json.message || 'Gagal mengambil media'
  let { name, caption, link_dl1, images, live, type } = json.result
  let txt = `
    - *By:* ${name}
    - *Caption:*
    ${caption}
      `.trim()
  if (images && images.length) {
    // Postingan foto / live photo: kirim tiap slide, sertakan pasangan live-nya.
    for (let i = 0; i < images.length; i++) {
      await conn.sendFile(m.chat, images[i], `tiktok_${i + 1}.jpg`, i === 0 ? txt : '', m)
      if (live && live[i]) await conn.sendFile(m.chat, live[i], `tiktok_${i + 1}_live.mp4`, '', m)
    }
    return
  }
  if (type === 'video' && link_dl1) {
    await conn.sendFile(m.chat, link_dl1, 'tiktok.mp4', txt, m)
    return
  }
  throw 'Gagal mengambil url download'
}
handler.help = ['tiktok'].map(v => v + ' <url>')
handler.tags = ['downloader']

handler.command = /^(tik(tok)?(dl)?)$/i

module.exports = handler
