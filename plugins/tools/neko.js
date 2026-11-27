// xie hua piao piao batman membuka kulkas dan mngambil semangka lalu memberikan mayo di atas semangka

let fetch = require('node-fetch')
let handler = async(m, { conn }) => {
  let res = await fetch('https://nekos.life/api/v2/img/neko')
  if (!res.ok) throw await res.text()
  let json = await res.json()
  if (!json.url) throw 'Error!'
  conn.sendFile(m.chat, json.url, '', 'Nyaa', m)
}
handler.help = ['neko']
handler.tags = ['internet']
handler.command = /^neko$/i
//Endpoint diganti 2026-11-27: api.waifu.pics mati (DNS ENOTFOUND) -> nekos.life (bentuk respons sama: {url})

module.exports = handler
