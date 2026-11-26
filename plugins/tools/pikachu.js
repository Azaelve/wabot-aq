const { sticker } = require('../../lib/sticker')
const { MessageType } = require('../../lib/wa/message-type')

// some-random-api.ml sudah mati; gambar resmi PokeAPI masih hidup.
const PIKACHU = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'

let handler = async(m, { conn }) => {
  let stiker = await sticker(null, PIKACHU, global.packname, global.author)
  if (stiker) return conn.sendMessage(m.chat, stiker, MessageType.sticker, {
    quoted: m
  })
  throw stiker.toString()
}
handler.help = ['pikachu']
handler.tags = ['internet']
handler.customPrefix = /^pik{1,2}a(c{1,2}hu)?$/i
handler.command = new RegExp

module.exports = handler
