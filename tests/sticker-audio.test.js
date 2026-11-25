const test = require('node:test')
const assert = require('node:assert/strict')
const {
  VOICE_MIME,
  isAudioMedia,
  audioExtension,
  describeAudio,
  planStickerAudio,
} = require('../lib/sticker-audio')

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

test('audioExtension memetakan mimetype ke ekstensi', () => {
  assert.equal(audioExtension('audio/ogg; codecs=opus'), 'ogg')
  assert.equal(audioExtension('audio/mpeg'), 'mp3')
  assert.equal(audioExtension('audio/mp4'), 'm4a')
  assert.equal(audioExtension('AUDIO/AMR'), 'amr')
  assert.equal(audioExtension('application/octet-stream'), 'ogg')
  assert.equal(audioExtension(null), 'ogg')
})

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
