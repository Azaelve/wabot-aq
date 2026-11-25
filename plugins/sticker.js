const fs = require('fs')
const path = require('path')
const { MessageType } = require('../lib/wa/message-type')
const { sticker } = require('../lib/sticker')
const {
  isAudioMedia,
  planStickerAudio,
  createAudioConfig,
  checkDuration,
  checkSize,
} = require('../lib/sticker-audio')

// Batas audio stiker (lihat lib/sticker-audio.js).
const audioLimits = createAudioConfig({
  maxSeconds: process.env.STICKER_AUDIO_MAX_SECONDS,
  maxBytes: process.env.STICKER_AUDIO_MAX_BYTES,
})

// Stiker penanda yang dikirim bersama audio aslinya.
const audioCover = () => fs.readFileSync(path.join(__dirname, '../src/sticker-audio.jpg'))

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let q = m.quoted ? m.quoted : m
  let media = q.msg || q

  // Balas voice note: kirim stiker penanda lalu audio aslinya.
  if (isAudioMedia(media)) {
    let durasi = checkDuration(Number(media.seconds || 0), audioLimits.maxSeconds)
    if (!durasi.ok) return m.reply(durasi.message)

    let audio = await q.download()
    if (!audio) throw `balas voice note dengan caption *${usedPrefix + command}*`

    let ukuran = checkSize(audio.length, audioLimits.maxBytes)
    if (!ukuran.ok) return m.reply(ukuran.message)

    let stiker = await sticker(audioCover(), false, global.packname, global.author)
    for (let step of planStickerAudio({ sticker: stiker, audio, media })) {
      if (step.kind === 'sticker') await conn.sendMessage(m.chat, step.content, MessageType.sticker, { quoted: m })
      else await conn.sendMessage(m.chat, step.content, MessageType.audio, { ...step.options, quoted: m })
    }
    return
  }

  let stiker = false
  try {
    let mime = media.mimetype || ''
    if (/image/.test(mime)) {
      let img = await q.download()
      if (!img) throw `balas gambar dengan caption *${usedPrefix + command}*`
      stiker = await sticker(img, false, global.packname, global.author)
    } else if (/video/.test(mime)) {
      if ((q.msg || q).seconds > 11) return m.reply('Maksimal 10 detik!')
      let img = await q.download()
      if (!img) throw `balas video/gif dengan caption *${usedPrefix + command}*`
      stiker = await sticker(img, false, global.packname, global.author)
    } else if (/webp/.test(mime)) {
      let img = await q.download()
      if (!img) throw `balas sticker dengan caption *${usedPrefix + command}*`
      stiker = await sticker(img, false, global.packname, global.author)
    } else if (args[0]) {
      if (isUrl(args[0])) stiker = await sticker(false, args[0], global.packname, global.author)
      else return m.reply('URL tidak valid!')
    }
  } finally {
    if (stiker) conn.sendMessage(m.chat, stiker, MessageType.sticker, {
      quoted: m
    })
    else throw 'Conversion failed'
  }
}
handler.help = ['stiker (caption|reply media|voice note)', 'stiker <url>', 'stikergif (caption|reply media)', 'stikergif <url>']
handler.tags = ['sticker']
handler.command = /^s(tic?ker)?(gif)?(wm)?$/i

module.exports = handler

const isUrl = (text) => {
  return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
}
