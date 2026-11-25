const test = require('node:test')
const assert = require('node:assert/strict')
const { MAX_TEXT, cleanText, normalizeEmojis, buildMeta, buildExif, parseExif, addExif, readExif } = require('../lib/sticker-exif')

/** WebP minimal (RIFF/WEBP + satu chunk VP8L) untuk menguji node-webpmux. */
function fakeWebp(payload = Buffer.from([0x2f, 0x00, 0x00, 0x00, 0x00])) {
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b }
  const chunk = Buffer.concat([Buffer.from('VP8L'), u32(payload.length), payload, Buffer.from([0])])
  const body = Buffer.concat([Buffer.from('WEBP'), chunk])
  return Buffer.concat([Buffer.from('RIFF'), u32(body.length), body])
}

test('cleanText membuang karakter kontrol dan membatasi panjang', () => {
  assert.equal(cleanText('  Paket  Stiker  '), 'Paket  Stiker')
  assert.equal(cleanText('a\u0000b\u001fc'), 'a b c')
  assert.equal(cleanText(null), '')
  assert.equal(cleanText('x'.repeat(300)).length, MAX_TEXT)
})

test('normalizeEmojis default 🤖 dan membuang entri kosong', () => {
  assert.deepEqual(normalizeEmojis([]), ['🤖'])
  assert.deepEqual(normalizeEmojis(['', '  ']), ['🤖'])
  assert.deepEqual(normalizeEmojis(['😀', '', '🔥']), ['😀', '🔥'])
})

test('buildMeta mengisi id paket, nama, pembuat, dan emoji', () => {
  const meta = buildMeta({ packname: ' Paket ', author: 'Penulis', emojis: ['😀'] })
  assert.equal(meta['sticker-pack-name'], 'Paket')
  assert.equal(meta['sticker-pack-publisher'], 'Penulis')
  assert.deepEqual(meta.emojis, ['😀'])
  assert.match(meta['sticker-pack-id'], /^[0-9a-f]{64}$/)
})

test('buildMeta mempertahankan id paket dan field tambahan', () => {
  const meta = buildMeta({ packname: 'A', author: 'B', extra: { 'sticker-pack-id': 'abc', name: 'stiker' } })
  assert.equal(meta['sticker-pack-id'], 'abc')
  assert.equal(meta.name, 'stiker')
})

test('buildExif menulis panjang JSON di header dan bisa dibaca kembali', () => {
  const meta = buildMeta({ packname: 'Paket Uji', author: 'Tester', emojis: ['🤖'] })
  const exif = buildExif(meta)
  assert.equal(exif.subarray(0, 4).toString('hex'), '49492a00')
  assert.equal(exif.readUIntLE(14, 4), exif.length - 22)
  assert.deepEqual(parseExif(exif), meta)
})

test('parseExif mengembalikan null untuk data yang tidak valid', () => {
  assert.equal(parseExif(null), null)
  assert.equal(parseExif(Buffer.alloc(0)), null)
  assert.equal(parseExif(Buffer.from('bukan exif')), null)
  assert.equal(parseExif(Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x7b])), null)
})

test('parseExif melewati header apa pun sebelum JSON', () => {
  const meta = { 'sticker-pack-name': 'Uji' }
  const raw = Buffer.concat([Buffer.from([1, 2, 3, 4, 5]), Buffer.from(JSON.stringify(meta))])
  assert.deepEqual(parseExif(raw), meta)
})

test('addExif menulis metadata ke webp dan readExif membacanya', async () => {
  const webp = fakeWebp()
  assert.equal(await readExif(webp), null)

  const out = await addExif(webp, 'Paket Uji', 'Tester', ['😀'], { name: 'stiker' })
  assert.equal(out.subarray(0, 4).toString(), 'RIFF')
  assert.equal(out.subarray(8, 12).toString(), 'WEBP')

  const meta = await readExif(out)
  assert.equal(meta['sticker-pack-name'], 'Paket Uji')
  assert.equal(meta['sticker-pack-publisher'], 'Tester')
  assert.deepEqual(meta.emojis, ['😀'])
  assert.equal(meta.name, 'stiker')
  assert.match(meta['sticker-pack-id'], /^[0-9a-f]{64}$/)
})
