/**
 * Plugin: Audio Sticker (Static & Animated GIF) — ADAPTASI UNTUK WABOT-AQ v2.7.0
 * ============================================================================
 * Sumber asli: ~/workspace/wabot-audiosticker-plugin.js (kiriman Muhammad,
 * 2026-11-27, by Nimzz, untuk @rexxhayanasi/elaina-baileys, gaya ESM).
 * File ini: adaptasi CommonJS untuk Baileys 7.0.0-rc14 di wabot-aq.
 *
 * STATUS: dipasang ke /sdcard/wabot/plugins/sticker/audiosticker.js,
 * MENGGANTIKAN plugins/sticker/saudio.js lama (di-backup ke
 * saudio.js.bak.audiosticker; lib/stickerSound.js lama di-backup ke
 * lib/stickerSound.js.bak.audiosticker tapi tetap ada di disk karena
 * tests/sticker-sound.test.js masih mengujinya).
 *
 * Yang diubah dari aslinya (logika stiker bersuara TIDAK diubah):
 *  - ESM import -> CommonJS require; '@rexxhayanasi/elaina-baileys' ->
 *    'baileys' (7.0.0-rc14).
 *  - Handler wabot: (m, { conn, text, usedPrefix, command, isOwner }),
 *    reply() -> m.reply(), pola yang sama dengan plugin wabot lain.
 *  - Dua socket dipisah: `conn` (LegacyClient, untuk sendMessage/react)
 *    dan `sock = conn.sock || conn` (socket Baileys mentah, untuk
 *    prepareWAMessageMedia / downloadContentFromMessage /
 *    downloadMediaMessage / waUploadToServer / relayMessage).
 *  - handler.before wabot: extra yang diteruskan handler.js TIDAK berisi
 *    text/reply/sock/usedPrefix/command — hanya conn (this) dll. Jadi
 *    before memakai extra.conn + m.reply() + m.text. handler.before
 *    DIDUKUNG wabot (handler.js memanggil plugin.before lalu `continue`
 *    bila true, jadi sesi foto->audio tetap jalan tanpa perintah).
 *  - import('sharp') / import('node-webpmux') dinamis -> require() dalam
 *    try/catch. sharp ADA di node_modules tapi TIDAK BISA dimuat di
 *    Android-arm64 (butuh libvips) -> jalur fallback ffmpeg yang dipakai
 *    untuk gambar. node-webpmux ADA dan bisa dimuat.
 *  - handler.tags jadi ['sticker'] (pengelompokan menu wabot), help
 *    ditambah 'saudio'.
 *
 * Batas (BERUBAH dari .saudio lama): durasi maks 25 DETIK (bukan 10),
 * sesi foto->audio 60 detik. Video >25 detik ditolak dengan pesan batas.
 *
 * Cara kirim (beda dari engine lama lib/stickerSound.js — baca ini):
 *  - Engine lama: stickerMessage.audioMessage (field 26) langsung lewat
 *    relayMessage, mengandalkan patch node_modules WAProto (skrip
 *    scripts/patch-baileys-sound-sticker.js, field 26 sudah ada di disk).
 *  - Plugin ini: runtime patch proto (patchProtoInstance) yang membungkus
 *    StickerMessage.encode (suntik audioMessage tag 210 sesudah encode
 *    dasar) DAN Message.encode (bungkus pesan dalam FutureProofMessage
 *    `audioStickerMessage`, field 134, tag 1074) lewat
 *    sendCombinedAudioSticker + relayMessage. Patch runtime ini MENAMBAH
 *    (bukan menggantikan) patch node_modules — keduanya hidup berdampingan:
 *    patch node_modules membuat StickerMessage.fromObject/encode kenal
 *    field 26, patch runtime menambahkan wrapper FutureProofMessage yang
 *    tidak ada di patch node_modules. Patch runtime idempotent
 *    (flag __audioStickerPatchedV3) dan hanya menambal instance proto
 *    dari require('baileys').
 *  - Perbedaan lain vs engine lama: EXIF plugin ini TIDAK menulis
 *    "sound-sha256" (hanya sticker-pack-* + emoji 🔊); audioMessage
 *    memakai ptt: true (engine lama: ptt false) + waveform yang
 *    di-generate. Bila uji chat menunjukkan suara tetap tidak bunyi,
 *    kandidat perbaikan berikutnya: tambah sound-sha256 ke EXIF
 *    (lihat lib/stickerSound.js:addSoundSha256ToStickerWebP) dan/atau
 *    coba ptt: false.
 *
 * Yang MASIH PERLU DIBUKTIKAN di chat (uji live di sini hanya mock socket,
 * tanpa kirim ke grup nyata): stiker yang dikirim bot benar-benar bersuara
 * di HP penerima, dan handler.before sesi foto->audio jalan di handler
 * wabot yang sebenarnya (bot sedang MATI saat pemasangan — tidak ada
 * proses node, health 000 — jadi bukti ter-load lewat watcher BELUM ADA;
 * restart masih menunggu persetujuan Muhammad).
 */

const {
  prepareWAMessageMedia,
  proto,
  downloadMediaMessage,
  downloadContentFromMessage
} = require('baileys')
const { randomBytes } = require('node:crypto')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const execFileAsync = promisify(execFile)
const MAX_DURATION = 25
const SESSION_SECONDS = 60

if (!globalThis.__audioStickerSessions) {
  globalThis.__audioStickerSessions = new Map()
}
const sessions = globalThis.__audioStickerSessions

function patchProtoInstance(p) {
  const M = p?.Message
  if (!M || M.__audioStickerPatchedV3) return

  if (M.StickerMessage) {
    const prevStickerEncode = M.StickerMessage.encode
    M.StickerMessage.encode = function (message, writer) {
      const audio = message?.audioMessage
      if (audio && Object.prototype.hasOwnProperty.call(message, 'audioMessage')) {
        delete message.audioMessage
      }
      const w = prevStickerEncode.call(this, message, writer)
      if (audio && M.AudioMessage) {
        message.audioMessage = audio
        M.AudioMessage.encode(audio, w.uint32(210).fork()).ldelim()
      }
      return w
    }

    if (typeof M.StickerMessage.fromObject === 'function') {
      const prevStickerFromObj = M.StickerMessage.fromObject
      M.StickerMessage.fromObject = function (object) {
        const msg = prevStickerFromObj.call(this, object)
        if (object?.audioMessage) {
          msg.audioMessage = M.AudioMessage?.fromObject
            ? M.AudioMessage.fromObject(object.audioMessage)
            : object.audioMessage
        }
        return msg
      }
    }
  }

  const prevMsgEncode = M.encode
  M.encode = function (message, writer) {
    const asm = message?.audioStickerMessage
    if (asm) {
      if (Object.prototype.hasOwnProperty.call(message, 'stickerMessage')) {
        delete message.stickerMessage
      }
      if (Object.prototype.hasOwnProperty.call(message, 'audioStickerMessage')) {
        delete message.audioStickerMessage
      }
    }
    const w = prevMsgEncode.call(this, message, writer)
    if (asm && M.FutureProofMessage) {
      message.audioStickerMessage = asm
      M.FutureProofMessage.encode(asm, w.uint32(1074).fork()).ldelim()
    }
    return w
  }

  if (typeof M.fromObject === 'function') {
    const prevMsgFromObj = M.fromObject
    M.fromObject = function (object) {
      const msg = prevMsgFromObj.call(this, object)
      if (object?.audioStickerMessage) {
        const inner = object.audioStickerMessage.message || object.audioStickerMessage
        if (inner?.stickerMessage && object.audioStickerMessage.message?.stickerMessage?.audioMessage) {
          inner.stickerMessage.audioMessage = object.audioStickerMessage.message.stickerMessage.audioMessage
        }
        msg.audioStickerMessage = { message: inner }
        delete msg.stickerMessage
        if (inner) {
          Object.setPrototypeOf(msg, inner)
        }
      }
      return msg
    }
  }

  M.__audioStickerPatchedV3 = true
}

function ensurePatched() {
  patchProtoInstance(proto)
  for (const pkg of ['baileys', '@whiskeysockets/baileys']) {
    try {
      const mod = require(pkg)
      if (mod?.proto) patchProtoInstance(mod.proto)
      if (mod?.default?.proto) patchProtoInstance(mod.default.proto)
    } catch {}
  }
}

function getSessionKey(m) {
  return `${m.chat}:${m.sender}`
}

function clearUserSession(key) {
  const existing = sessions.get(key)
  if (existing?.timer) clearTimeout(existing.timer)
  sessions.delete(key)
}

function unwrapMessageContainer(raw) {
  let cur = raw
  for (let i = 0; i < 6 && cur; i++) {
    const next =
      cur.ephemeralMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message ||
      cur.viewOnceMessage?.message ||
      cur.documentWithCaptionMessage?.message ||
      cur.editedMessage?.message
    if (!next) break
    cur = next
  }
  return cur || {}
}

function detectMediaInfo(node) {
  if (!node) return { kind: null, mime: '', seconds: 0, mediaObj: null, dlType: null }

  const container = unwrapMessageContainer(node.message || node.fakeObj?.message || {})
  const mtype =
    node.mtype ||
    node.type ||
    Object.keys(container).find(k =>
      /imageMessage|videoMessage|stickerMessage|audioMessage|documentMessage/i.test(k)
    ) ||
    ''

  const directMsg =
    node.msg && typeof node.msg === 'object' && (node.msg.mediaKey || node.msg.url || node.msg.directPath || node.msg.mimetype)
      ? node.msg
      : null

  const mediaObj =
    directMsg ||
    container[mtype] ||
    container.videoMessage ||
    container.imageMessage ||
    container.stickerMessage ||
    container.audioMessage ||
    container.documentMessage ||
    (node.mediaKey || node.url || node.directPath ? node : null)

  const mime = String(node.mimetype || mediaObj?.mimetype || '').toLowerCase()
  const seconds = Number(mediaObj?.seconds || node.seconds || node.msg?.seconds || 0)

  if (/video/i.test(mime) || /videoMessage/i.test(mtype)) {
    const dlType = /documentMessage/i.test(mtype) ? 'document' : 'video'
    return { kind: 'video', mime: mime || 'video/mp4', seconds, mediaObj, dlType }
  }
  if (/webp/i.test(mime) || /stickerMessage/i.test(mtype)) {
    const isAnim = Boolean(mediaObj?.isAnimated)
    return { kind: 'webp', mime: 'image/webp', seconds, isAnimated: isAnim, mediaObj, dlType: 'sticker' }
  }
  if (/image/i.test(mime) || /imageMessage/i.test(mtype)) {
    const dlType = /documentMessage/i.test(mtype) ? 'document' : 'image'
    return { kind: 'image', mime: mime || 'image/jpeg', seconds: 0, mediaObj, dlType }
  }
  if (/audio|ogg|opus|mpeg|mp3|wav|m4a|aac/i.test(mime) || /audioMessage/i.test(mtype)) {
    const dlType = /documentMessage/i.test(mtype) ? 'document' : 'audio'
    return { kind: 'audio', mime: mime || 'audio/mpeg', seconds, mediaObj, dlType }
  }
  return { kind: null, mime: '', seconds: 0, mediaObj: null, dlType: null }
}

async function downloadBuffer(node, info, client) {
  if (!node) return null

  if (info?.mediaObj && info?.dlType && (info.mediaObj.mediaKey || info.mediaObj.directPath || info.mediaObj.url)) {
    try {
      const stream = await downloadContentFromMessage(info.mediaObj, info.dlType)
      const chunks = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      const buf = Buffer.concat(chunks)
      if (buf.length) return buf
    } catch {}
  }

  if (node.fakeObj?.message || node.message) {
    try {
      const msgObj = node.fakeObj?.message ? node.fakeObj : node
      const buf = await downloadMediaMessage(
        msgObj,
        'buffer',
        {},
        {
          logger: { info: () => {}, error: () => {}, warn: () => {} },
          reuploadRequest: client?.updateMediaMessage
        }
      )
      if (buf?.length) return buf
    } catch {}
  }

  if (info?.mediaObj && info?.dlType) {
    try {
      const synthetic = {
        key: node.key || { remoteJid: node.chat || 'status@broadcast', id: '0' },
        message: { [`${info.dlType}Message`]: info.mediaObj }
      }
      const buf = await downloadMediaMessage(
        synthetic,
        'buffer',
        {},
        {
          logger: { info: () => {}, error: () => {}, warn: () => {} },
          reuploadRequest: client?.updateMediaMessage
        }
      )
      if (buf?.length) return buf
    } catch {}
  }

  if (typeof node.download === 'function') {
    try {
      const buf = await node.download()
      if (buf?.length) return buf
    } catch {}
  }

  return null
}

function buildExifPayload(packname, author) {
  const json = {
    'sticker-pack-id': 'com.alya.ai.audiosticker',
    'sticker-pack-name': String(packname ?? ''),
    'sticker-pack-publisher': String(author ?? ''),
    emojis: ['🔊']
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)
  return exif
}

function injectExifRiffFallback(webpBuffer, exifData) {
  if (
    !Buffer.isBuffer(webpBuffer) ||
    webpBuffer.length < 16 ||
    webpBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
    webpBuffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return webpBuffer
  }

  const chunks = []
  let offset = 12
  let hasVp8x = false
  let isAnim = false

  while (offset + 8 <= webpBuffer.length) {
    const id = webpBuffer.toString('ascii', offset, offset + 4)
    const size = webpBuffer.readUInt32LE(offset + 4)
    const padded = size + (size % 2)
    const end = Math.min(webpBuffer.length, offset + 8 + padded)
    const rawChunk = Buffer.from(webpBuffer.subarray(offset, end))

    if (id === 'VP8X') hasVp8x = true
    if (id === 'ANIM' || id === 'ANMF') isAnim = true
    if (id !== 'EXIF') chunks.push({ id, rawChunk })

    offset = end
  }

  if (!hasVp8x) {
    const vp8x = Buffer.alloc(18)
    vp8x.write('VP8X', 0, 4, 'ascii')
    vp8x.writeUInt32LE(10, 4)
    vp8x[8] = 0x18
    vp8x.writeUIntLE(511, 12, 3)
    vp8x.writeUIntLE(511, 15, 3)
    chunks.unshift({ id: 'VP8X', rawChunk: vp8x })
  } else {
    const vp8xEntry = chunks.find(c => c.id === 'VP8X')
    if (vp8xEntry && vp8xEntry.rawChunk.length >= 18) {
      vp8xEntry.rawChunk[8] |= 0x08
      if (isAnim) vp8xEntry.rawChunk[8] |= 0x02
    }
  }

  const padByte = exifData.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0)
  const exifHeader = Buffer.alloc(8)
  exifHeader.write('EXIF', 0, 4, 'ascii')
  exifHeader.writeUInt32LE(exifData.length, 4)
  chunks.push({ id: 'EXIF', rawChunk: Buffer.concat([exifHeader, exifData, padByte]) })

  const body = Buffer.concat(chunks.map(c => c.rawChunk))
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 4, 'ascii')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WEBP', 8, 4, 'ascii')

  return Buffer.concat([header, body])
}

async function addStickerExif(webpBuffer, packname, author) {
  const exifData = buildExifPayload(packname, author)
  try {
    const webpMod = require('node-webpmux')
    const WebpImage = webpMod.default?.Image || webpMod.Image || webpMod.default
    if (WebpImage) {
      const img = new WebpImage()
      await img.load(webpBuffer)
      img.exif = exifData
      return await img.save(null)
    }
  } catch {}
  return injectExifRiffFallback(webpBuffer, exifData)
}

function isWebpAnimated(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return false
  if (buf.toString('ascii', 12, 16) === 'VP8X' && (buf[20] & 0x02) !== 0) return true
  return buf.includes(Buffer.from('ANIM'))
}

async function videoBufferToAnimatedWebp(buffer) {
  const tmpId = randomBytes(6).toString('hex')
  const inPath = path.join(os.tmpdir(), `as_vid_${tmpId}.mp4`)
  const outPath = path.join(os.tmpdir(), `as_out_${tmpId}.webp`)

  const encodeAttempt = async (fps, qv) => {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inPath,
      '-t', String(MAX_DURATION),
      '-vf', `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`,
      '-c:v', 'libwebp',
      '-lossless', '0',
      '-compression_level', '6',
      '-q:v', String(qv),
      '-loop', '0',
      '-preset', 'picture',
      '-an',
      // ffmpeg 9.1 di HP tidak lagi kenal '-vsync' (dihapus); padanannya
      // '-fps_mode passthrough' (= vsync 0). Filter fps= di atas sudah
      // mengatur laju frame, jadi ini hanya menjaga perilaku lama.
      '-fps_mode', 'passthrough',
      outPath
    ])
    return await fs.readFile(outPath)
  }

  try {
    await fs.writeFile(inPath, buffer)
    const profiles = [
      [10, 50],
      [8, 36],
      [6, 24],
      [5, 16]
    ]
    let webp = null
    for (const [fps, qv] of profiles) {
      webp = await encodeAttempt(fps, qv)
      if (webp.length <= 880 * 1024) break
    }
    return webp
  } finally {
    await fs.unlink(inPath).catch(() => {})
    await fs.unlink(outPath).catch(() => {})
  }
}

async function imageBufferToWebp(buffer) {
  try {
    const sharp = require('sharp').default || require('sharp')
    return await sharp(buffer, { animated: true })
      .rotate()
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    // sharp tidak bisa dimuat di Android-arm64 (butuh libvips) -> ffmpeg.
    const tmpId = randomBytes(6).toString('hex')
    const inPath = path.join(os.tmpdir(), `as_img_${tmpId}.jpg`)
    const outPath = path.join(os.tmpdir(), `as_img_out_${tmpId}.webp`)
    try {
      await fs.writeFile(inPath, buffer)
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', inPath,
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1',
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-q:v', '80',
        '-an',
        outPath
      ])
      return await fs.readFile(outPath)
    } finally {
      await fs.unlink(inPath).catch(() => {})
      await fs.unlink(outPath).catch(() => {})
    }
  }
}

async function buildStickerWithExif(buffer, kind, packname, author) {
  let rawWebp = buffer
  if (kind === 'video') {
    rawWebp = await videoBufferToAnimatedWebp(buffer)
  } else if (kind === 'image') {
    rawWebp = await imageBufferToWebp(buffer)
  }
  return await addStickerExif(rawWebp, packname, author)
}

function parseFfmpegDuration(stderrText) {
  const matches = [...String(stderrText || '').matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)]
  if (!matches.length) return 0
  const last = matches[matches.length - 1]
  const sec = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3])
  return Number.isFinite(sec) ? sec : 0
}

function generateWaveform(seedBuf, length = 64) {
  const wf = Buffer.alloc(length)
  for (let i = 0; i < length; i++) {
    const b = seedBuf && seedBuf.length ? seedBuf[(i * 19 + 7) % seedBuf.length] : i * 11
    wf[i] = 18 + (b % 76)
  }
  return wf
}

async function convertToOggOpus(buffer, ext = 'mp3') {
  const tmpId = randomBytes(6).toString('hex')
  const inPath = path.join(os.tmpdir(), `ptt_in_${tmpId}.${ext}`)
  const outPath = path.join(os.tmpdir(), `ptt_out_${tmpId}.ogg`)
  try {
    await fs.writeFile(inPath, buffer)
    const { stderr } = await execFileAsync('ffmpeg', [
      '-y',
      '-i', inPath,
      '-vn',
      '-map', '0:a:0',
      '-t', String(MAX_DURATION),
      '-af', 'aresample=48000:async=1:first_pts=0',
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-vbr', 'on',
      '-compression_level', '10',
      '-ac', '1',
      '-ar', '48000',
      '-application', 'audio',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'ogg',
      outPath
    ])
    const oggBuffer = await fs.readFile(outPath)
    if (!oggBuffer || oggBuffer.length < 200) {
      throw new Error('Jalur audio kosong atau terlalu pendek.')
    }
    const realSeconds = parseFfmpegDuration(stderr)
    return { oggBuffer, realSeconds }
  } finally {
    await fs.unlink(inPath).catch(() => {})
    await fs.unlink(outPath).catch(() => {})
  }
}

async function buildAudioMessageFromBuffer(client, buffer, ext, fallbackSeconds = 0) {
  const { oggBuffer, realSeconds } = await convertToOggOpus(buffer, ext)

  const { audioMessage } = await prepareWAMessageMedia(
    { audio: oggBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true },
    { upload: client.waUploadToServer }
  )

  const chosenSec = realSeconds > 0 ? realSeconds : fallbackSeconds > 0 ? fallbackSeconds : 5
  const finalSeconds = Math.max(1, Math.min(MAX_DURATION, Math.round(chosenSec)))

  audioMessage.seconds = finalSeconds
  audioMessage.ptt = true
  audioMessage.mimetype = 'audio/ogg; codecs=opus'
  if (!audioMessage.waveform || !audioMessage.waveform.length) {
    audioMessage.waveform = generateWaveform(oggBuffer)
  }

  return audioMessage
}

async function sendCombinedAudioSticker(client, chat, stickerBuffer, isAnimated, audioMsg) {
  await ensurePatched()

  const prepared = await prepareWAMessageMedia(
    { sticker: stickerBuffer, isAnimated },
    { upload: client.waUploadToServer }
  )

  prepared.stickerMessage.isAnimated = Boolean(isAnimated)
  prepared.stickerMessage.audioMessage = audioMsg

  const payload = {
    __proto__: prepared,
    audioStickerMessage: { message: prepared },
    messageContextInfo: { messageSecret: randomBytes(32) }
  }

  await client.relayMessage(chat, payload, {})
}

function startStickerSession({ m, client, send, stickerBuffer, isAnimated, packname, author, usedPrefix, command }) {
  const key = getSessionKey(m)
  clearUserSession(key)

  const timer = setTimeout(() => {
    if (sessions.has(key)) {
      sessions.delete(key)
      if (client?.sendMessage) {
        client.sendMessage(m.chat, {
          text: `⏰ *SESI AUDIO STICKER BERAKHIR*\n> _Waktu tunggu ${SESSION_SECONDS} detik telah habis. Silakan kirim ulang foto jika ingin membuat Audio Sticker._`
        }, { quoted: m }).catch(() => {})
      }
    }
  }, SESSION_SECONDS * 1000)

  sessions.set(key, {
    stickerBuffer,
    isAnimated,
    packname,
    author,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
    processing: false,
    timer
  })

  return send(
    `✦ *SESI AUDIO STICKER AKTIF* ✦\n` +
    `> _Media stiker berhasil disimpan ke dalam sesi sementara._\n\n` +
    `╭─「 *DETAIL SESI* 」\n` +
    `│ ◦ *Pack* : *${packname}*\n` +
    `│ ◦ *Author* : *${author}*\n` +
    `│ ◦ *Tipe* : \`${isAnimated ? 'Animated GIF' : 'Static Image'}\`\n` +
    `│ ◦ *Durasi Audio Maks* : \`${MAX_DURATION} Detik\`\n` +
    `│ ◦ *Estimasi Waktu* : \`${SESSION_SECONDS} Detik\`\n` +
    `╰───────────────\n\n` +
    `╭─「 *LANGKAH SELANJUTNYA* 」\n` +
    `│ 1. Kirim *Audio MP3 / Voice Note / Video* langsung ke chat ini\n` +
    `│ 2. Atau *Reply Audio / Voice Note / Video* dengan \`${usedPrefix}${command}\`\n` +
    `│ 3. Ketik \`${usedPrefix}${command} batal\` untuk membatalkan\n` +
    `╰───────────────`
  )
}

async function consumeSessionWithAudio(m, client, send, react, session, audioNode, audioInfo) {
  const key = getSessionKey(m)
  session.processing = true
  await react('⏳')

  try {
    const audioBuf = await downloadBuffer(audioNode, audioInfo, client)
    if (!audioBuf || !audioBuf.length) throw new Error('Gagal mengunduh file audio/video.')

    const ext =
      audioInfo.kind === 'video'
        ? 'mp4'
        : /ogg|opus/i.test(audioInfo.mime)
          ? 'ogg'
          : /mp4|m4a|aac/i.test(audioInfo.mime)
            ? 'm4a'
            : 'mp3'

    const audioMsg = await buildAudioMessageFromBuffer(client, audioBuf, ext, audioInfo.seconds)

    await sendCombinedAudioSticker(
      client,
      m.chat,
      session.stickerBuffer,
      session.isAnimated,
      audioMsg
    )

    clearUserSession(key)
    await react('✅')
  } catch (err) {
    session.processing = false
    console.error('[AUDIOSTICKER SESSION ERROR]', err)
    await react('❌')
    await send(`❌ Gagal menggabungkan suara ke stiker: ${err?.message || String(err)}`)
  }
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner } = {}) => {
  // wabot: conn = LegacyClient (this). Socket Baileys mentah ada di conn.sock.
  const rawSock = (conn && conn.sock) || conn
  const send = (t) => m.reply(t)
  // DIPERBAIKI 2026-11-27: reaksi dikirim lewat socket Baileys mentah (conn.sock), bukan conn.sendMessage (LegacyClient) — yang lama diduga dirender sebagai gelembung kosong.
  const react = async (emoji) => {
    try {
      const sock = (conn && conn.sock) || conn
      if (sock?.sendMessage) {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
      }
    } catch {}
  }

  const key = getSessionKey(m)
  const activeSession = sessions.get(key)
  const rawText = String(text || '').trim()

  if (/^(batal|cancel|stop)$/i.test(rawText)) {
    if (!activeSession) return send('⚠️ Tidak ada sesi Audio Sticker yang sedang aktif.')
    clearUserSession(key)
    await react('✅')
    return send('✅ Sesi Audio Sticker berhasil dibatalkan.')
  }

  const ownInfo = detectMediaInfo(m)
  const quoted = m.quoted
  const quotedInfo = detectMediaInfo(quoted)

  const hasOwnVisual = ownInfo.kind === 'video' || ownInfo.kind === 'image' || ownInfo.kind === 'webp'
  const hasQuotedVisual = quotedInfo.kind === 'video' || quotedInfo.kind === 'image' || quotedInfo.kind === 'webp'
  const hasOwnAudio = ownInfo.kind === 'audio'
  const hasQuotedAudio = quotedInfo.kind === 'audio'

  if (activeSession && !activeSession.processing && (hasOwnAudio || hasQuotedAudio) && !hasOwnVisual) {
    const targetAudioNode = hasOwnAudio ? m : quoted
    const targetAudioInfo = hasOwnAudio ? ownInfo : quotedInfo
    return await consumeSessionWithAudio(m, rawSock, send, react, activeSession, targetAudioNode, targetAudioInfo)
  }

  if (!hasOwnVisual && !hasQuotedVisual && !hasOwnAudio && !hasQuotedAudio) {
    if (activeSession) {
      const remSec = Math.max(1, Math.ceil((activeSession.expiresAt - Date.now()) / 1000))
      return send(
        `⏳ *SESI MASIH AKTIF (${remSec} DETIK)*\n\n` +
        `Silakan kirim *Audio MP3 / Voice Note* atau reply sebuah audio dengan \`${usedPrefix}${command}\`.\n` +
        `Ketik \`${usedPrefix}${command} batal\` untuk membatalkan sesi.`
      )
    }

    return send(
      `✦ *AUDIO STICKER GENERATOR* ✦\n` +
      `> _Buat stiker gambar atau GIF bergerak yang mengeluarkan suara saat diketuk._\n\n` +
      `╭─「 *CARA PAKAI (VERSI FOTO)* 」\n` +
      `│ 1. Kirim/Reply *Foto* dengan \`${usedPrefix}${command}\`\n` +
      `│ 2. Bot akan membuka sesi selama *${SESSION_SECONDS} detik*\n` +
      `│ 3. Kirim/Reply *Audio MP3 / Voice Note* (maks ${MAX_DURATION}d)!\n` +
      `╰───────────────\n\n` +
      `╭─「 *CARA PAKAI (VERSI VIDEO)* 」\n` +
      `│ ◦ Kirim/Reply *Video (maks ${MAX_DURATION} detik)* dengan \`${usedPrefix}${command}\`\n` +
      `│   _(Otomatis jadi stiker GIF bergerak + suara video)_\n` +
      `│ ◦ Custom Pack: \`${usedPrefix}${command} PackName|Author\`\n` +
      `╰───────────────`
    )
  }

  if (!hasOwnVisual && !hasQuotedVisual && (hasOwnAudio || hasQuotedAudio)) {
    return send(
      `⚠️ *FOTO / STIKER BELUM DIPILIH*\n\n` +
      `Silakan kirim atau reply *Foto / Stiker* terlebih dahulu dengan perintah \`${usedPrefix}${command}\`, lalu bot akan memberikan waktu *${SESSION_SECONDS} detik* untuk membalas audio ini.`
    )
  }

  await react('⏳')

  try {
    await ensurePatched()

    const [customPack, customAuth] = rawText.includes('|')
      ? rawText.split('|').map(s => s.trim())
      : [rawText, '']

    const packname =
      customPack ||
      global.packname ||
      global.stickpack ||
      global.namaBot ||
      'Alya AI'

    const author =
      customAuth ||
      global.author ||
      global.stickauth ||
      global.namaOwner ||
      m.pushName ||
      'Sticker'

    const visualNode = hasOwnVisual ? m : quoted
    const visualInfo = hasOwnVisual ? ownInfo : quotedInfo
    const isVideo = visualInfo.kind === 'video'
    const videoSeconds = visualInfo.seconds || 0

    if (isVideo && videoSeconds > MAX_DURATION) {
      await react('❌')
      return send(`⚠️ Durasi video maksimal *${MAX_DURATION} detik* untuk dijadikan Audio Sticker.`)
    }

    const visualData = await downloadBuffer(visualNode, visualInfo, rawSock)
    if (!visualData || !visualData.length) {
      throw new Error('Gagal mengunduh media foto/video.')
    }

    const stickerBuffer = await buildStickerWithExif(visualData, visualInfo.kind, packname, author)
    const isAnimated = isVideo || isWebpAnimated(stickerBuffer)

    if (hasOwnVisual && hasQuotedAudio) {
      const audioBuf = await downloadBuffer(quoted, quotedInfo, rawSock)
      if (!audioBuf || !audioBuf.length) throw new Error('Gagal mengunduh audio yang di-reply.')
      const ext = /ogg|opus/i.test(quotedInfo.mime) ? 'ogg' : /mp4|m4a|aac/i.test(quotedInfo.mime) ? 'm4a' : 'mp3'
      const audioMsg = await buildAudioMessageFromBuffer(rawSock, audioBuf, ext, quotedInfo.seconds)
      await sendCombinedAudioSticker(rawSock, m.chat, stickerBuffer, isAnimated, audioMsg)
      clearUserSession(key)
      await react('✅')
      return
    }

    if (isVideo) {
      try {
        const audioMsg = await buildAudioMessageFromBuffer(rawSock, visualData, 'mp4', videoSeconds)
        await sendCombinedAudioSticker(rawSock, m.chat, stickerBuffer, true, audioMsg)
        clearUserSession(key)
        await react('✅')
        return
      } catch {
        await react('⏳')
        return await startStickerSession({
          m,
          client: conn,
          send,
          stickerBuffer,
          isAnimated: true,
          packname,
          author,
          usedPrefix,
          command
        })
      }
    }

    return await startStickerSession({
      m,
      client: conn,
      send,
      stickerBuffer,
      isAnimated,
      packname,
      author,
      usedPrefix,
      command
    })
  } catch (e) {
    console.error('[AUDIOSTICKER ERROR]', e)
    await react('❌')
    await send(`❌ Gagal memproses media: ${e?.message || String(e)}`)
  }
}

handler.before = async (m, extra = {}) => {
  // wabot: extra dari handler.js TIDAK berisi text/reply/sock/usedPrefix/
  // command — hanya conn (this = LegacyClient) dkk. Jadi pakai extra.conn
  // + m.reply() + m.text di sini.
  if (!m || m.fromMe) return false
  const key = getSessionKey(m)
  const session = sessions.get(key)
  if (!session || session.processing) return false

  if (Date.now() > session.expiresAt) {
    clearUserSession(key)
    return false
  }

  const bodyText = String(m.text || m.body || '').trim()
  if (/^[./!#]?(audiosticker|stikeraudio|stickeraudio|figurinhasom|saudio)\b/i.test(bodyText)) {
    return false
  }

  const ownInfo = detectMediaInfo(m)
  const quoted = m.quoted
  const quotedInfo = detectMediaInfo(quoted)

  const isDirectAudio = ownInfo.kind === 'audio'
  const isReplyToAudio = !bodyText && quotedInfo.kind === 'audio'

  if (!isDirectAudio && !isReplyToAudio) return false

  const conn = extra.conn
  const rawSock = (conn && conn.sock) || conn
  const send = (t) => m.reply(t)
  // DIPERBAIKI 2026-11-27: reaksi dikirim lewat socket Baileys mentah (conn.sock), bukan conn.sendMessage (LegacyClient) — yang lama diduga dirender sebagai gelembung kosong.
  const react = async (emoji) => {
    try {
      const sock = (conn && conn.sock) || conn
      if (sock?.sendMessage) {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
      }
    } catch {}
  }

  const targetNode = isDirectAudio ? m : quoted
  const targetInfo = isDirectAudio ? ownInfo : quotedInfo

  await consumeSessionWithAudio(m, rawSock, send, react, session, targetNode, targetInfo)
  return true
}

handler.command = ['audiosticker', 'stikeraudio', 'stickeraudio', 'figurinhasom', 'saudio']
handler.tags = ['sticker']
handler.help = ['audiosticker [pack|author]', 'saudio']
handler.desc = 'Membuat stiker gambar/GIF bersuara (Audio Sticker) maks 25 detik dengan sistem sesi'
handler.limit = true

handler._internals = {
  patchProtoInstance,
  ensurePatched,
  detectMediaInfo,
  downloadBuffer,
  buildExifPayload,
  injectExifRiffFallback,
  addStickerExif,
  isWebpAnimated,
  videoBufferToAnimatedWebp,
  imageBufferToWebp,
  buildStickerWithExif,
  parseFfmpegDuration,
  generateWaveform,
  convertToOggOpus,
  buildAudioMessageFromBuffer,
  sendCombinedAudioSticker,
  startStickerSession,
  consumeSessionWithAudio,
  sessions,
  MAX_DURATION,
  SESSION_SECONDS
}

module.exports = handler
