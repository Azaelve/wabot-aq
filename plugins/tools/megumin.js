let fetch = require('node-fetch')
let handler = async(m, { conn }) => {
  //Endpoint diganti 2026-11-27: api.waifu.pics mati (DNS ENOTFOUND).
  //Tidak ada endpoint khusus Megumin yang bisa dijangkau dari HP (waifu.im juga tidak bisa dijangkau;
  //nekos.life tidak punya kategori megumin) — sementara memakai gambar waifu acak dari nekos.life
  //sampai ada sumber khusus Megumin yang masih hidup.
  //Dicek 2026-11-28: waifu-api fork KorryKatti (pengganti waifu.im) juga tidak punya tag megumin (hanya 25 tag).
  let res = await fetch('https://nekos.life/api/v2/img/waifu')
  if (!res.ok) throw await res.text()
  let json = await res.json()
  if (!json.url) throw 'Error!'
  conn.sendFile(m.chat, json.url, '', '@Daeho', m)
}
handler.help = ['megumin']
handler.tags = ['internet']
handler.command = /^(megumin)$/i
//ftwrr
module.exports = handler
