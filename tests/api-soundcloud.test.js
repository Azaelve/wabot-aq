const test = require('node:test')
const assert = require('node:assert/strict')
const { parsePlaylist, formatDuration, safeName } = require('../lib/api/scrapers/soundcloud')

test('parsePlaylist mengambil init segment dan segmen absolut', () => {
  const playlist = [
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    '#EXT-X-MAP:URI="https://cdn.example.com/init.mp4"',
    '#EXTINF:10,',
    'seg-1.m4s',
    '#EXTINF:10,',
    'https://cdn.example.com/seg-2.m4s',
    '',
  ].join('\n')
  const out = parsePlaylist(playlist, 'https://cdn.example.com/media/playlist.m3u8')
  assert.equal(out.init, 'https://cdn.example.com/init.mp4')
  assert.deepEqual(out.segments, [
    'https://cdn.example.com/media/seg-1.m4s',
    'https://cdn.example.com/seg-2.m4s',
  ])
})

test('parsePlaylist aman untuk teks kosong', () => {
  assert.deepEqual(parsePlaylist(''), { init: null, segments: [] })
  assert.deepEqual(parsePlaylist(null), { init: null, segments: [] })
})

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(65000), '1:05')
  assert.equal(formatDuration(3600000), '60:00')
})

test('safeName merapikan judul', () => {
  assert.equal(safeName('Lagu Baru (Official)'), 'Lagu_Baru_Official')
  assert.equal(safeName(''), 'track')
  assert.equal(safeName(null), 'track')
})
