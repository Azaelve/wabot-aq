'use strict'
/**
 * Tes plugin Audio Sticker (adaptasi Nimzz untuk wabot-aq).
 * Dijalankan di HP: node --test tests/audiosticker.test.js
 * Semua tes di sini tanpa jaringan dan tanpa kirim ke WhatsApp.
 * Tes proto memakai instance baileys yang sama dengan plugin.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { proto } = require('baileys')
const handler = require('../plugins/sticker/audiosticker')
const internals = handler._internals

test('handler terdaftar dengan command audiosticker + saudio', () => {
  assert.equal(typeof handler, 'function')
  assert.ok(Array.isArray(handler.command))
  for (const cmd of ['audiosticker', 'stikeraudio', 'stickeraudio', 'figurinhasom', 'saudio']) {
    assert.ok(handler.command.includes(cmd), `command ${cmd} hilang`)
  }
  assert.equal(typeof handler.before, 'function', 'handler.before harus ada (sesi foto->audio)')
  assert.equal(internals.MAX_DURATION, 25, 'batas baru plugin ini 25 detik, bukan 10')
  assert.equal(internals.SESSION_SECONDS, 60)
})

test('detectMediaInfo mengenali video/audio/gambar gaya wabot (m.msg)', () => {
  const video = internals.detectMediaInfo({
    mtype: 'videoMessage',
    msg: { mimetype: 'video/mp4', seconds: 3, mediaKey: Buffer.alloc(32), url: 'https://x' }
  })
  assert.equal(video.kind, 'video')
  assert.equal(video.seconds, 3)
  assert.equal(video.dlType, 'video')

  const audio = internals.detectMediaInfo({
    mtype: 'audioMessage',
    msg: { mimetype: 'audio/ogg; codecs=opus', seconds: 5, mediaKey: Buffer.alloc(32), url: 'https://x' }
  })
  assert.equal(audio.kind, 'audio')
  assert.equal(audio.dlType, 'audio')

  const image = internals.detectMediaInfo({
    mtype: 'imageMessage',
    msg: { mimetype: 'image/jpeg', mediaKey: Buffer.alloc(32), url: 'https://x' }
  })
  assert.equal(image.kind, 'image')

  assert.equal(internals.detectMediaInfo(null).kind, null)
  assert.equal(internals.detectMediaInfo({ mtype: 'conversation', msg: {} }).kind, null)
})

test('patchProtoInstance idempotent dan roundtrip audioStickerMessage', () => {
  internals.patchProtoInstance(proto)
  const before = proto.Message.__audioStickerPatchedV3
  internals.patchProtoInstance(proto) // jalan kedua tidak boleh menambal ulang
  assert.equal(proto.Message.__audioStickerPatchedV3, true)
  assert.equal(before, true)

  const audioMessage = {
    mimetype: 'audio/ogg; codecs=opus',
    seconds: 3,
    ptt: true,
    url: 'https://mmg.whatsapp.net/fake',
    directPath: '/fake/direct/path',
    mediaKey: Buffer.alloc(32),
    fileSha256: Buffer.alloc(32),
    fileEncSha256: Buffer.alloc(32),
    fileLength: 1234
  }
  const prepared = {
    stickerMessage: {
      mimetype: 'image/webp',
      isAnimated: true,
      url: 'https://mmg.whatsapp.net/fake',
      directPath: '/fake/direct/path',
      mediaKey: Buffer.alloc(32),
      fileSha256: Buffer.alloc(32),
      fileEncSha256: Buffer.alloc(32),
      fileLength: 5678,
      audioMessage
    }
  }
  // Bentuk payload persis seperti sendCombinedAudioSticker (tanpa relay).
  const payload = {
    __proto__: prepared,
    audioStickerMessage: { message: prepared },
    messageContextInfo: { messageSecret: Buffer.alloc(32) }
  }
  const bytes = proto.Message.encode(payload).finish()
  assert.ok(bytes.length > 0)
  // Catatan: proto.Message.decode() Baileys TIDAK kenal field 134
  // (audioStickerMessage) — field itu hanya dikenal klien WhatsApp — jadi
  // decode langsung akan membuangnya. Verifikasi lewat pembacaan field
  // mentah: cari field 134 di kawat, decode sebagai FutureProofMessage,
  // lalu periksa pesan di dalamnya.
  const Reader = require('protobufjs/minimal').Reader
  const reader = Reader.create(bytes)
  let fpmBytes = null
  while (reader.pos < reader.len) {
    const tag = reader.uint32()
    const field = tag >>> 3
    const wire = tag & 7
    if (field === 134 && wire === 2) {
      fpmBytes = reader.bytes()
    } else {
      reader.skipType(wire)
    }
  }
  assert.ok(fpmBytes, 'field 134 (audioStickerMessage) tidak ada di pesan kawat')
  const fpm = proto.Message.FutureProofMessage.decode(fpmBytes)
  const inner = fpm.message
  assert.ok(inner && inner.stickerMessage, 'stickerMessage di dalam wrapper hilang')
  assert.equal(inner.stickerMessage.isAnimated, true)
  assert.ok(inner.stickerMessage.audioMessage, 'audioMessage di dalam stiker hilang setelah encode/decode')
  assert.equal(inner.stickerMessage.audioMessage.seconds, 3)
  assert.equal(inner.stickerMessage.audioMessage.mimetype, 'audio/ogg; codecs=opus')
})

test('buildExifPayload menulis pack + emoji speaker', () => {
  const exif = internals.buildExifPayload('PackKu', 'Nimzz')
  assert.ok(Buffer.isBuffer(exif))
  const text = exif.toString('utf-8')
  assert.ok(text.includes('PackKu'))
  assert.ok(text.includes('Nimzz'))
  assert.ok(text.includes('🔊'))
  assert.ok(text.includes('com.alya.ai.audiosticker'))
  assert.equal(exif.readUIntLE(14, 4), Buffer.from(JSON.stringify({
    'sticker-pack-id': 'com.alya.ai.audiosticker',
    'sticker-pack-name': 'PackKu',
    'sticker-pack-publisher': 'Nimzz',
    emojis: ['🔊']
  }), 'utf-8').length)
})

test('injectExifRiffFallback menambah EXIF dan menjaga RIFF/WEBP', () => {
  // WebP minimal: RIFF + WEBP + VP8X (tanpa flag) + VP8L 4 byte.
  const vp8x = Buffer.alloc(18)
  vp8x.write('VP8X', 0, 4, 'ascii')
  vp8x.writeUInt32LE(10, 4)
  const vp8l = Buffer.alloc(12)
  vp8l.write('VP8L', 0, 4, 'ascii')
  vp8l.writeUInt32LE(4, 4)
  const body = Buffer.concat([vp8x, vp8l])
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 4, 'ascii')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WEBP', 8, 4, 'ascii')
  const webp = Buffer.concat([header, body])

  const out = internals.injectExifRiffFallback(webp, internals.buildExifPayload('P', 'A'))
  assert.equal(out.toString('ascii', 0, 4), 'RIFF')
  assert.equal(out.toString('ascii', 8, 12), 'WEBP')
  assert.ok(out.includes(Buffer.from('EXIF')), 'chunk EXIF tidak ada')
  assert.ok(out.includes(Buffer.from('sticker-pack-name')), 'JSON EXIF tidak ada')
  // Flag EXIF (0x08) harus disetel di VP8X.
  assert.notEqual(out[20] & 0x08, 0)
  // Bukan WebP -> dikembalikan apa adanya.
  const notWebp = Buffer.from('bukan webp')
  assert.equal(internals.injectExifRiffFallback(notWebp, Buffer.alloc(4)), notWebp)
})

test('isWebpAnimated mendeteksi VP8X animasi dan chunk ANIM', () => {
  const anim = Buffer.alloc(30)
  anim.write('RIFF', 0, 4, 'ascii')
  anim.write('WEBP', 8, 4, 'ascii')
  anim.write('VP8X', 12, 4, 'ascii')
  anim[20] = 0x02
  assert.equal(internals.isWebpAnimated(anim), true)
  const statik = Buffer.from(anim)
  statik[20] = 0x00
  assert.equal(internals.isWebpAnimated(statik), false)
  assert.equal(internals.isWebpAnimated(Buffer.from('x'.repeat(20) + 'ANIM' + 'x'.repeat(6))), true)
  assert.equal(internals.isWebpAnimated(Buffer.alloc(10)), false)
})

test('parseFfmpegDuration + generateWaveform', () => {
  assert.equal(internals.parseFfmpegDuration('frame=1 time=00:00:02.50 bitrate=1'), 2.5)
  assert.equal(internals.parseFfmpegDuration('time=00:01:00.00 time=00:00:03.25'), 3.25)
  assert.equal(internals.parseFfmpegDuration('tidak ada waktu'), 0)
  const wf1 = internals.generateWaveform(Buffer.from('abc'))
  const wf2 = internals.generateWaveform(Buffer.from('abc'))
  assert.equal(wf1.length, 64)
  assert.deepEqual(wf1, wf2, 'waveform harus deterministik')
  for (const v of wf1) assert.ok(v >= 18 && v <= 93)
})
