const test = require('node:test')
const assert = require('node:assert/strict')
const { parseTikTokUrl, normalizeTikloapp, videoResult, photoResult } = require('../lib/api/scrapers/tiktok')

test('parseTikTokUrl menerima bentuk URL TikTok umum', () => {
  assert.equal(parseTikTokUrl('https://www.tiktok.com/@tiktok/video/7106594312292453675'), 'https://www.tiktok.com/@tiktok/video/7106594312292453675')
  assert.equal(parseTikTokUrl('  https://vm.tiktok.com/ZMabc/  '), 'https://vm.tiktok.com/ZMabc/')
  assert.throws(() => parseTikTokUrl('https://www.instagram.com/p/abc/'), /tidak valid/)
  assert.throws(() => parseTikTokUrl(''), /tidak valid/)
})

test('normalizeTikloapp mengubah video menjadi hasil seragam', () => {
  const out = normalizeTikloapp({
    ok: true,
    id: '7106594312292453675',
    type: 'video',
    title: 'judul',
    author: 'TikTok',
    duration: 24,
    cover: 'https://cdn/cover.webp',
    links: { hd: 'https://cdn/hd.mp4', nowm: 'https://cdn/nowm.mp4' },
  })
  assert.deepEqual(out, {
    type: 'video',
    id: '7106594312292453675',
    title: 'judul',
    author: 'TikTok',
    duration: 24,
    cover: 'https://cdn/cover.webp',
    video: 'https://cdn/nowm.mp4',
    images: [],
    live: [],
  })
})

test('normalizeTikloapp menerima foto/live photo', () => {
  const out = normalizeTikloapp({ ok: true, type: 'images', images: ['https://cdn/1.jpg', null], live: ['https://cdn/1.mp4'] })
  assert.equal(out.type, 'photos')
  assert.deepEqual(out.images, ['https://cdn/1.jpg'])
  assert.deepEqual(out.live, ['https://cdn/1.mp4'])
  assert.equal(out.cover, 'https://cdn/1.jpg')
})

test('normalizeTikloapp menolak respons gagal', () => {
  assert.equal(normalizeTikloapp({ ok: false, error: 'The request timed out.' }), null)
  assert.equal(normalizeTikloapp(null), null)
  assert.equal(normalizeTikloapp({ ok: true, type: 'video', links: {} }), null)
})

test('bentuk hasil dasar', () => {
  assert.equal(videoResult({ video: 'https://x/v.mp4' }).images.length, 0)
  assert.equal(photoResult({ images: ['a', 'b'] }).cover, 'a')
})
