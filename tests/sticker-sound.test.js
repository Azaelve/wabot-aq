/**
 * Tes engine stiker bersuara (lib/stickerSound.js) + plugin .saudio.
 * Hanya fungsi murni dan pemuatan modul yang dites, tanpa jaringan,
 * tanpa ffmpeg, tanpa WhatsApp.
 *
 * Catatan 2026-11-27: plugin .saudio lama (plugins/sticker/saudio.js)
 * DIGANTI oleh plugins/sticker/audiosticker.js (adaptasi Nimzz, maks
 * 25 detik, sesi foto->audio). Engine lama lib/stickerSound.js tetap
 * ada di disk dan tetap dites di sini; tes perintah di bawah memakai
 * plugin baru (command array, bukan RegExp).
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const sound = require('../lib/stickerSound')
const saudio = require('../plugins/sticker/audiosticker')
const { isVideoMedia, isAudioMedia, classifySaudioMedia } = require('../lib/sticker-audio')

test('isVideoMedia mengenali video, bukan audio', () => {
  assert.equal(isVideoMedia({ mtype: 'videoMessage', mimetype: 'video/mp4', seconds: 0.08 }), true)
  assert.equal(isVideoMedia({ mimetype: 'video/mp4' }), true)
  assert.equal(isVideoMedia({ mtype: 'audioMessage', mimetype: 'audio/ogg; codecs=opus' }), false)
  assert.equal(isVideoMedia({ mimetype: 'image/jpeg' }), false)
  assert.equal(isVideoMedia({}), false)
  assert.equal(isVideoMedia(), false)
})

test('classifySaudioMedia: video didahulukan, lalu audio, lalu null', () => {
  // Video dengan caption .saudio: pesan itu sendiri videoMessage.
  assert.equal(classifySaudioMedia({ mtype: 'videoMessage', mimetype: 'video/mp4', seconds: 0.08 }), 'video')
  assert.equal(classifySaudioMedia({ mtype: 'audioMessage', mimetype: 'audio/ogg; codecs=opus' }), 'audio')
  assert.equal(classifySaudioMedia({ mimetype: 'audio/mpeg' }), 'audio')
  assert.equal(classifySaudioMedia({ mtype: 'imageMessage', mimetype: 'image/jpeg' }), null)
  assert.equal(classifySaudioMedia({ mtype: 'conversation' }), null)
  assert.equal(classifySaudioMedia(), null)
  // isAudioMedia sendiri tetap menolak video (penyebab bug lama).
  assert.equal(isAudioMedia({ mtype: 'videoMessage', mimetype: 'video/mp4' }), false)
})

test('lib/stickerSound mengekspor semua fungsi engine', () => {
  for (const name of [
    'hasAudioStream',
    'parseDurationFromOutput',
    'extractAudioFromMedia',
    'convertAudioToWhatsAppOpus',
    'addSoundSha256ToStickerWebP',
    'createSoundSticker',
    'buildSoundStickerMessage',
    'sendSoundSticker',
  ]) {
    assert.equal(typeof sound[name], 'function', name)
  }
  assert.equal(sound.DEFAULT_MAX_SECONDS, 10)
})

test('parseDurationFromOutput membaca durasi ffmpeg', () => {
  assert.equal(sound.parseDurationFromOutput('Duration: 00:00:07.50, start: 0.000000'), 7.5)
  assert.equal(sound.parseDurationFromOutput('Duration: 00:01:02.00'), 62)
  assert.equal(sound.parseDurationFromOutput('tanpa durasi'), 3)
  assert.equal(sound.parseDurationFromOutput(''), 3)
})

test('plugin .saudio terdaftar dengan perintah yang benar', () => {
  assert.equal(typeof saudio, 'function')
  // Plugin baru memakai command array (handler.js mencocokkan persis
  // setelah lowercasing), bukan RegExp seperti plugin lama.
  assert.ok(Array.isArray(saudio.command))
  for (const cmd of ['audiosticker', 'saudio']) {
    assert.ok(saudio.command.includes(cmd), `command ${cmd} hilang`)
  }
  assert.ok(!saudio.command.includes('sticker'), 'sticker bukan command')
  assert.deepEqual(saudio.tags, ['sticker'])
  assert.ok(Array.isArray(saudio.help) && saudio.help.join(' ').includes('saudio'))
  assert.equal(typeof saudio.before, 'function', 'handler.before harus ada (sesi foto->audio)')
  assert.equal(saudio._internals.MAX_DURATION, 25, 'batas baru 25 detik')
})

// --- Perbaikan 2026-11-27: stiker sampai tanpa lagu -----------------------
// Dua akar masalah yang diperbaiki:
// (1) Baileys rc14 membuang StickerMessage.audioMessage (field 26) saat
//     encode — dipatch oleh scripts/patch-baileys-sound-sticker.js.
// (2) WebP stiker tidak membawa "sound-sha256" di EXIF — kini ditulis
//     addSoundSha256ToStickerWebP (dipakai createSoundSticker).
// Tes di bawah memakai ffmpeg bila ada di mesin (ada di HP Termux);
// bila ffmpeg tidak ada, tes dilewati (skip), bukan gagal.

const { spawnSync, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

function ffmpegAda() {
  try {
    return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
  } catch { return false }
}

function buatVideoUji(detik, keluar) {
  // Visual bergerak (testsrc) + nada 440 Hz, durasi jelas — bukan 0,08 dtk.
  execFileSync('ffmpeg', ['-y',
    '-f', 'lavfi', '-i', `testsrc=duration=${detik}:size=512x512:rate=10`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${detik}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', keluar], { stdio: 'ignore' })
}

function buatWebpUji(keluar) {
  // Coba animasi dulu, fallback ke WebP statis bila encoder animasi tak ada.
  for (const enc of ['libwebp_anim', 'libwebp']) {
    try {
      execFileSync('ffmpeg', ['-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=1:size=512x512:rate=10',
        '-c:v', enc, '-loop', '0', keluar], { stdio: 'ignore' })
      return
    } catch { /* coba encoder berikutnya */ }
  }
  throw new Error('tidak ada encoder webp di ffmpeg')
}

test('proto StickerMessage field 26 dipertahankan saat encode (patch WAProto)', (t) => {
  // Tanpa patch scripts/patch-baileys-sound-sticker.js, tes ini GAGAL:
  // audioMessage dibuang diam-diam saat encode (terbukti 38 byte).
  const { proto } = require('baileys')
  const sm = proto.Message.StickerMessage.fromObject({
    mimetype: 'image/webp',
    isAnimated: true,
    audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 2, ptt: false },
  })
  const bytes = proto.Message.StickerMessage.encode(sm).finish()
  const balik = proto.Message.StickerMessage.decode(bytes)
  assert.ok(balik.audioMessage, 'audioMessage hilang setelah encode->decode')
  assert.equal(balik.audioMessage.seconds, 2)
  assert.equal(balik.audioMessage.mimetype, 'audio/ogg; codecs=opus')
  // Jalur relayMessage: pesan utuh (Message > stickerMessage) juga lolos.
  const penuh = proto.Message.decode(proto.Message.encode({ stickerMessage: sm }).finish())
  assert.ok(penuh.stickerMessage && penuh.stickerMessage.audioMessage, 'audioMessage hilang di dalam Message')
  assert.equal(penuh.stickerMessage.audioMessage.seconds, 2)
  // Stiker biasa (tanpa audio) tidak rusak oleh patch.
  const biasa = proto.Message.StickerMessage.fromObject({ mimetype: 'image/webp', isAnimated: true })
  const biasaBalik = proto.Message.StickerMessage.decode(proto.Message.StickerMessage.encode(biasa).finish())
  assert.equal(biasaBalik.audioMessage, null)
  assert.equal(biasaBalik.mimetype, 'image/webp')
})

test('addSoundSha256ToStickerWebP menulis hash & mempertahankan meta pack', async (t) => {
  if (!ffmpegAda()) return t.skip('ffmpeg tidak tersedia')
  assert.equal(typeof sound.addSoundSha256ToStickerWebP, 'function')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saudio-test-'))
  try {
    const webpPath = path.join(dir, 'uji.webp')
    buatWebpUji(webpPath)
    const { addExif, readExif } = require('../lib/sticker-exif')
    const berExif = await addExif(fs.readFileSync(webpPath), 'PackUji', 'AuthorUji', ['🔊'])
    const hash = crypto.createHash('sha256').update(Buffer.from('audio-palsu')).digest('hex')
    const hasil = await sound.addSoundSha256ToStickerWebP(berExif, hash)
    assert.equal(hasil.toString('ascii', 0, 4), 'RIFF')
    assert.equal(hasil.toString('ascii', 8, 12), 'WEBP')
    const meta = await readExif(hasil)
    assert.ok(meta, 'EXIF tidak terbaca setelah injeksi')
    assert.equal(meta['sound-sha256'], hash, 'sound-sha256 di EXIF tidak sama dengan hash audio')
    assert.equal(meta['sticker-pack-name'], 'PackUji', 'meta pack hilang setelah injeksi (harus digabung, bukan diganti)')
    assert.equal(meta['sticker-pack-publisher'], 'AuthorUji')
    // Input bukan WebP / hash bukan hex harus ditolak.
    await assert.rejects(sound.addSoundSha256ToStickerWebP(Buffer.from('bukan webp'), hash))
    await assert.rejects(sound.addSoundSha256ToStickerWebP(hasil, 'bukan-hex'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('createSoundSticker: video 2 dtk bersuara -> EXIF sound-sha256 cocok', async (t) => {
  if (!ffmpegAda()) return t.skip('ffmpeg tidak tersedia')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saudio-test-'))
  try {
    const videoPath = path.join(dir, 'uji.mp4')
    buatVideoUji(2, videoPath)
    const video = fs.readFileSync(videoPath)
    const hasil = await sound.createSoundSticker(video, { packname: 'PackUji', author: 'AuthorUji' })
    assert.equal(hasil.hasSound, true, 'video 2 dtk bersuara harus hasSound=true')
    assert.ok(Buffer.isBuffer(hasil.audio) && hasil.audio.length > 100, 'audio Opus terlalu kecil')
    assert.equal(hasil.audio.toString('ascii', 0, 4), 'OggS', 'audio harus Ogg Opus')
    assert.equal(hasil.sticker.toString('ascii', 0, 4), 'RIFF')
    assert.equal(hasil.sticker.toString('ascii', 8, 12), 'WEBP')
    assert.ok(hasil.duration >= 1.5 && hasil.duration <= 2.5, `durasi harus ~2 dtk, dapat ${hasil.duration}`)
    const { readExif } = require('../lib/sticker-exif')
    const meta = await readExif(hasil.sticker)
    assert.ok(meta && meta['sound-sha256'], 'stiker harus membawa sound-sha256 di EXIF')
    assert.equal(meta['sound-sha256'],
      crypto.createHash('sha256').update(hasil.audio).digest('hex'),
      'sound-sha256 di EXIF harus sama dengan SHA-256 audio yang dikirim')
    assert.equal(typeof hasil.soundSha256, 'string')
    assert.equal(hasil.soundSha256, meta['sound-sha256'])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('durasi klip sangat pendek dilaporkan apa adanya (bukan dibulatkan ke 1 dtk)', async (t) => {
  if (!ffmpegAda()) return t.skip('ffmpeg tidak tersedia')
  assert.equal(sound.parseDurationFromOutput('Duration: 00:00:00.08, start: 0.000000'), 0.1)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saudio-test-'))
  try {
    const videoPath = path.join(dir, 'pendek.mp4')
    buatVideoUji(0.08, videoPath)
    const hasil = await sound.extractAudioFromMedia(fs.readFileSync(videoPath), {})
    // Sebelum perbaikan: durasi dilaporkan 1 (Math.max(1, ...)) padahal
    // audio aslinya cuma 0,08 dtk. Sekarang harus ~0,1 dtk.
    assert.ok(hasil.duration <= 0.5, `durasi klip 0,08 dtk harus dilaporkan ~0,1, dapat ${hasil.duration}`)
    assert.ok(hasil.buffer.length > 0, 'audio tetap diekstrak meski sangat pendek')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
