const test = require('node:test')
const assert = require('node:assert/strict')
const { LegacyClient, detectType, mimeOf } = require('../lib/wa/legacy')
const { MessageType } = require('../lib/wa/message-type')

const silent = { info() { }, warn() { }, error() { } }

function fakeSocket() {
  const sent = []
  const sock = {
    sent,
    ev: { on() { } },
    sendMessage: async (jid, payload, options) => { sent.push({ jid, payload, options }); return { key: { id: 'ID1' } } },
    groupMetadata: async jid => ({ id: jid, subject: 'Grup Uji' }),
    profilePictureUrl: async () => 'https://example.com/pp.jpg',
    relayMessage: async (jid, message) => { sent.push({ relay: true, jid, message }) },
    readMessages: async () => true,
  }
  return sock
}

test('sendMessage menerjemahkan tipe lama', async () => {
  const sock = fakeSocket()
  const conn = new LegacyClient(sock, { logger: silent })
  await conn.sendMessage('1@s.whatsapp.net', 'halo', MessageType.text)
  await conn.sendMessage('1@s.whatsapp.net', Buffer.from('img'), MessageType.image, { caption: 'cap' })
  assert.deepEqual(sock.sent[0].payload, { text: 'halo' })
  assert.equal(sock.sent[1].payload.image.length, 3)
  assert.equal(sock.sent[1].payload.caption, 'cap')
})

test('reply memakai quoted', async () => {
  const sock = fakeSocket()
  const conn = new LegacyClient(sock, { logger: silent })
  const quoted = { key: { id: 'Q' } }
  await conn.reply('1@s.whatsapp.net', 'jawab', quoted)
  assert.equal(sock.sent[0].payload.text, 'jawab')
  assert.equal(sock.sent[0].options.quoted, quoted)
})

test('sendFile menerima Buffer, nama berkas, dan opsi gaya lama', async () => {
  const sock = fakeSocket()
  const conn = new LegacyClient(sock, { logger: silent })
  await conn.sendFile('1@s.whatsapp.net', Buffer.from('png'), 'foto.png', 'caption', null, false, { contextInfo: { mentionedJid: [] } })
  const payload = sock.sent[0].payload
  assert.equal(payload.image.toString(), 'png')
  assert.equal(payload.mimetype, 'image/png')
  assert.equal(payload.caption, 'caption')
})

test('detectType dan mimeOf', async () => {
  assert.equal(await detectType(Buffer.from('x'), 'a.webp'), MessageType.sticker)
  assert.equal(await detectType(Buffer.from('x'), 'a.png'), MessageType.image)
  assert.equal(await detectType(Buffer.from('x'), 'a.mp4'), MessageType.video)
  assert.equal(await detectType(Buffer.from('x'), 'a.bin'), MessageType.document)
  assert.equal(mimeOf('a.pdf'), 'application/pdf')
  assert.equal(mimeOf('a.unknown'), 'application/octet-stream')
})

test('groupMetadata di-cache, profil & kompatibilitas lain tersedia', async () => {
  const sock = fakeSocket()
  const conn = new LegacyClient(sock, { logger: silent })
  const first = await conn.groupMetadata('1@g.us')
  const second = await conn.groupMetadata('1@g.us')
  assert.equal(first, second)
  assert.equal(await conn.getProfilePicture('1@s.whatsapp.net'), 'https://example.com/pp.jpg')
  assert.equal(conn.generateMessageTag().length, 16)
  await conn.sendButton('1@s.whatsapp.net', 'teks', 'footer', 'Beli', '.buy', null)
  await conn.send2Button('1@s.whatsapp.net', 'teks', 'footer', 'A', '.a', 'B', '.b', null)
  assert.match(sock.sent[0].payload.text, /Beli/)
  assert.match(sock.sent[1].payload.text, /\.a/)
  assert.match(sock.sent[1].payload.text, /\.b/)
})

test('antarmuka legacy lengkap untuk handler', () => {
  const conn = new LegacyClient(fakeSocket(), { logger: silent })
  for (const method of ['sendMessage', 'sendFile', 'reply', 'groupMetadata', 'updateProfilePicture', 'chatRead', 'relayWAMessage', 'updateMediaMessage', 'downloadMedia', 'getName', 'sendButton', 'send2Button', 'generateMessageTag']) {
    assert.equal(typeof conn[method], 'function', method)
  }
  assert.ok(conn.chats instanceof Map)
  assert.ok(Array.isArray(conn.blocklist))
  assert.equal(conn.getName('628@s.whatsapp.net'), '+628')
})
