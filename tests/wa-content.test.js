const test = require('node:test')
const assert = require('node:assert/strict')
const { buildContent, contentKey, isMediaType } = require('../lib/wa/content')
const { MessageType, Presence, GroupSettingChange, WA_MESSAGE_STUB_TYPES, newMessagesDB } = require('../lib/wa/message-type')

test('MessageType mempertahankan nilai lama', () => {
  assert.equal(MessageType.text, 'conversation')
  assert.equal(MessageType.image, 'imageMessage')
  assert.equal(MessageType.document, 'documentMessage')
  assert.equal(MessageType.sticker, 'stickerMessage')
})

test('teks dibungkus sebagai { text }', () => {
  assert.deepEqual(buildContent(MessageType.text, 'halo'), { text: 'halo' })
  assert.deepEqual(buildContent(undefined, 'hai'), { text: 'hai' })
  assert.deepEqual(buildContent('conversation', 123), { text: '123' })
})

test('gambar membawa caption dan mimetype', () => {
  const buffer = Buffer.from('x')
  const out = buildContent(MessageType.image, buffer, { caption: 'cap' })
  assert.equal(out.image, buffer)
  assert.equal(out.caption, 'cap')
  assert.equal(out.mimetype, 'image/jpeg')
})

test('video, audio ptt, dokumen, stiker', () => {
  const buffer = Buffer.from('x')
  assert.equal(buildContent(MessageType.video, buffer, { mimetype: 'video/mp4' }).video, buffer)
  assert.equal(buildContent(MessageType.audio, buffer, { ptt: true }).ptt, true)
  const doc = buildContent(MessageType.document, buffer, { filename: 'a.pdf', mimetype: 'application/pdf' })
  assert.equal(doc.fileName, 'a.pdf')
  assert.equal(doc.document, buffer)
  assert.equal(buildContent(MessageType.sticker, buffer).sticker, buffer)
})

test('opsi quoted tidak ikut ke konten', () => {
  const out = buildContent(MessageType.text, 'x', { quoted: { key: {} } })
  assert.deepEqual(out, { text: 'x' })
})

test('kontak dinormalisasi menjadi contacts', () => {
  const out = buildContent(MessageType.contact, 'BEGIN:VCARD', { name: 'Budi' })
  assert.equal(out.contacts.displayName, 'Budi')
  assert.equal(out.contacts.contacts[0].vcard, 'BEGIN:VCARD')
})

test('helper tipe', () => {
  assert.equal(contentKey({ imageMessage: {} }), 'imageMessage')
  assert.equal(contentKey(null), '')
  assert.equal(isMediaType(MessageType.image), true)
  assert.equal(isMediaType(MessageType.text), false)
})

test('shim konstanta lain tetap tersedia', () => {
  assert.equal(Presence.composing, 'composing')
  assert.equal(GroupSettingChange.announcement, 'announcement')
  assert.ok(WA_MESSAGE_STUB_TYPES.includes('protocolMessage'))
  assert.ok(new newMessagesDB() instanceof newMessagesDB)
})
