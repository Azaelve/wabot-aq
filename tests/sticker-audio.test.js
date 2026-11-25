const test = require('node:test')
const assert = require('node:assert/strict')
const {
  VOICE_MIME,
  DEFAULT_MAX_SECONDS,
  DEFAULT_MAX_BYTES,
  isAudioMedia,
  audioExtension,
  describeAudio,
  planStickerAudio,
  createAudioConfig,
  checkDuration,
  checkSize,
} = require('../lib/sticker-audio')

/* ---- isAudioMedia ---- */

test('isAudioMedia mengenali voice note, audio biasa, dan bukan audio', () => {
  assert.equal(isAudioMedia({ mimetype: 'audio/ogg; codecs=opus', ptt: true }), true)
  assert.equal(isAudioMedia({ mimetype: 'audio/mpeg' }), true)
  assert.equal(isAudioMedia({ mtype: 'audioMessage' }), true)
  assert.equal(isAudioMedia({ ptt: true }), true)
  assert.equal(isAudioMedia({ mimetype: 'image/jpeg' }), false)
  assert.equal(isAudioMedia({ mimetype: 'video/mp4' }), false)
  assert.equal(isAudioMedia({}), false)
  assert.equal(isAudioMedia(null), false)
})

/* ---- audioExtension ---- */

test('audioExtension memetakan mimetype ke ekstensi', () => {
  assert.equal(audioExtension('audio/ogg; codecs=opus'), 'ogg')
  assert.equal(audioExtension('audio/mpeg'), 'mp3')
  assert.equal(audioExtension('audio/mp4'), 'm4a')
  assert.equal(audioExtension('AUDIO/AMR'), 'amr')
  assert.equal(audioExtension('application/octet-stream'), 'ogg')
  assert.equal(audioExtension(null), 'ogg')
})

/* ---- describeAudio ---- */

test('describeAudio memakai mimetype voice note untuk PTT', () => {
  const info = describeAudio({ mimetype: 'audio/mp4', ptt: true, seconds: 3.7 })
  assert.equal(info.mimetype, VOICE_MIME)
  assert.equal(info.ptt, true)
  assert.equal(info.seconds, 3.7)
  assert.equal(info.filename, 'voice.ogg')
})

test('describeAudio mempertahankan mimetype audio biasa', () => {
  const info = describeAudio({ mimetype: 'audio/mpeg', seconds: '12' })
  assert.equal(info.mimetype, 'audio/mpeg')
  assert.equal(info.ptt, false)
  assert.equal(info.seconds, 12)
  assert.equal(info.filename, 'audio.mp3')
})

test('describeAudio memberi nilai aman untuk media kosong', () => {
  const info = describeAudio()
  assert.equal(info.mimetype, VOICE_MIME)
  assert.equal(info.ptt, false)
  assert.equal(info.seconds, 0)
  assert.equal(info.filename, 'audio.ogg')
})

/* ---- planStickerAudio ---- */

test('planStickerAudio mengirim stiker lalu audio asli', () => {
  const sticker = Buffer.from('webp')
  const audio = Buffer.from('ogg')
  const steps = planStickerAudio({ sticker, audio, media: { ptt: true, seconds: 2 } })

  assert.equal(steps.length, 2)
  assert.equal(steps[0].kind, 'sticker')
  assert.equal(steps[0].content, sticker)
  assert.equal(steps[1].kind, 'audio')
  assert.equal(steps[1].content, audio)
  assert.deepEqual(steps[1].options, {
    mimetype: VOICE_MIME,
    ptt: true,
    seconds: 2,
    fileName: 'voice.ogg',
  })
})

test('planStickerAudio menolak buffer kosong', () => {
  assert.throws(() => planStickerAudio({ audio: Buffer.from('a') }), /stiker kosong/)
  assert.throws(() => planStickerAudio({ sticker: Buffer.from('s') }), /audio kosong/)
  assert.throws(() => planStickerAudio({ sticker: Buffer.alloc(0), audio: Buffer.from('a') }), /stiker kosong/)
})

/* ---- createAudioConfig ---- */

test('createAudioConfig memakai default saat tanpa argumen', () => {
  const cfg = createAudioConfig()
  assert.equal(cfg.maxSeconds, DEFAULT_MAX_SECONDS)
  assert.equal(cfg.maxBytes, DEFAULT_MAX_BYTES)
})

test('createAudioConfig menerima override valid', () => {
  const cfg = createAudioConfig({ maxSeconds: 20, maxBytes: 1024 })
  assert.equal(cfg.maxSeconds, 20)
  assert.equal(cfg.maxBytes, 1024)
})

test('createAudioConfig memakai default untuk nilai tidak valid', () => {
  const cfg = createAudioConfig({ maxSeconds: -5, maxBytes: 'bukan angka' })
  assert.equal(cfg.maxSeconds, DEFAULT_MAX_SECONDS)
  assert.equal(cfg.maxBytes, DEFAULT_MAX_BYTES)
})

test('createAudioConfig menerima 0 (tanpa batas)', () => {
  const cfg = createAudioConfig({ maxSeconds: 0, maxBytes: 0 })
  assert.equal(cfg.maxSeconds, 0)
  assert.equal(cfg.maxBytes, 0)
})

test('createAudioConfig memakai default untuk NaN dan Infinity', () => {
  const cfg = createAudioConfig({ maxSeconds: NaN, maxBytes: Infinity })
  assert.equal(cfg.maxSeconds, DEFAULT_MAX_SECONDS)
  assert.equal(cfg.maxBytes, DEFAULT_MAX_BYTES)
})

/* ---- checkDuration ---- */

test('checkDuration menerima durasi dalam batas', () => {
  assert.equal(checkDuration(5, 10).ok, true)
  assert.equal(checkDuration(10, 10).ok, true)
  assert.equal(checkDuration(0, 10).ok, true)
})

test('checkDuration menolak durasi melebihi batas', () => {
  const r = checkDuration(15, 10)
  assert.equal(r.ok, false)
  assert.match(r.message, /15 detik/)
  assert.match(r.message, /maks 10 detik/)
})

test('checkDuration tanpa batas (0) menerima durasi berapa pun', () => {
  assert.equal(checkDuration(9999, 0).ok, true)
})

test('checkDuration memakai default untuk maxSeconds tidak valid', () => {
  const r = checkDuration(DEFAULT_MAX_SECONDS + 1, 'bukan angka')
  assert.equal(r.ok, false)
})

/* ---- checkSize ---- */

test('checkSize menerima ukuran dalam batas', () => {
  assert.equal(checkSize(100, 1024).ok, true)
  assert.equal(checkSize(1024, 1024).ok, true)
})

test('checkSize menolak ukuran melebihi batas', () => {
  const r = checkSize(2000, 1024)
  assert.equal(r.ok, false)
  assert.match(r.message, /2000 byte/)
})

test('checkSize tanpa batas (0) menerima ukuran berapa pun', () => {
  assert.equal(checkSize(999999999, 0).ok, true)
})

test('checkSize memakai default untuk maxBytes tidak valid', () => {
  const r = checkSize(DEFAULT_MAX_BYTES + 1, -1)
  assert.equal(r.ok, false)
})

/* ---- Konstanta bawaan ---- */

test('DEFAULT_MAX_SECONDS adalah 10', () => {
  assert.equal(DEFAULT_MAX_SECONDS, 10)
})

test('DEFAULT_MAX_BYTES adalah 30 MiB', () => {
  assert.equal(DEFAULT_MAX_BYTES, 30 * 1024 * 1024)
})
