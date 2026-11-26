let fetch = require("node-fetch")
let handler = async (m, { conn }) => {
  // some-random-api.ml sudah mati (NXDOMAIN). meme-api.com masih hidup dan
  // mengembalikan { title, url, author } — bukan { image, caption }.
  let res = await fetch('https://meme-api.com/gimme')
  if (!res.ok) throw await res.text()
  let json = await res.json()
  if (!json.url) throw 'Err!'
  conn.sendFile(m.chat, json.url, 'meme.png', json.title, m)
}

handler.help = ['meme']
handler.tags = ['internet']

handler.command = /^(meme)$/i

handler.group = true

module.exports = handler
