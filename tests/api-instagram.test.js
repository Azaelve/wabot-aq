const test = require('node:test')
const assert = require('node:assert/strict')
const { parseInstagramUrl, normalizeItem } = require('../lib/api/scrapers/instagram')

test('parseInstagramUrl menerima p, reel, reels, dan tv', () => {
  assert.deepEqual(parseInstagramUrl('https://www.instagram.com/p/CmUv48DLvxd/'), {
    url: 'https://www.instagram.com/p/CmUv48DLvxd/',
    shortcode: 'CmUv48DLvxd',
    kind: 'p',
  })
  assert.equal(parseInstagramUrl('https://instagram.com/reel/ABC123/').kind, 'reel')
  assert.equal(parseInstagramUrl('https://instagram.com/reels/ABC123/').url, 'https://www.instagram.com/reel/ABC123/')
  assert.equal(parseInstagramUrl('https://m.instagram.com/tv/ABC123/?utm=1').shortcode, 'ABC123')
})

test('parseInstagramUrl menolak URL lain', () => {
  assert.throws(() => parseInstagramUrl('https://www.tiktok.com/@a/video/1'), /tidak valid/)
  assert.throws(() => parseInstagramUrl(''), /tidak valid/)
  assert.throws(() => parseInstagramUrl(null), /tidak valid/)
})

test('normalizeItem menyeragamkan item dan memberi nama berkas', () => {
  const image = normalizeItem({ type: 'image', url: 'https://cdn/1.jpg' }, 0, 'SC')
  assert.deepEqual(image, {
    type: 'image',
    url: 'https://cdn/1.jpg',
    thumbnail: null,
    filename: 'instagram-SC-1.jpg',
  })
  const video = normalizeItem({ type: 'video', url: 'https://cdn/2.mp4', thumbnailUrl: 'https://cdn/t.jpg', filename: 'v.mp4' }, 1, 'SC')
  assert.equal(video.type, 'video')
  assert.equal(video.thumbnail, 'https://cdn/t.jpg')
  assert.equal(video.filename, 'v.mp4')
  assert.equal(normalizeItem({ url: '' }, 2, 'SC'), null)
  assert.equal(normalizeItem(null, 3, 'SC'), null)
})
