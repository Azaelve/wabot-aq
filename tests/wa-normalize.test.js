const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizePhone, unwrapMessage, extractText, toLegacyMessage, smsg } = require('../lib/wa/normalize')
const { MessageType } = require('../lib/wa/message-type')

test('normalizePhone hanya menyisakan digit', () => {
  assert.equal(normalizePhone('+62 851-7896-4685'), '6285178964685')
  assert.equal(normalizePhone('6285178964685'), '6285178964685')
  assert.throws(() => normalizePhone(''), /wajib diisi/)
  assert.throws(() => normalizePhone('123'), /tidak valid/)
})

test('unwrapMessage membuka viewOnce dan ephemeral', () => {
  const inner = { imageMessage: { caption: 'dalam' } }
  assert.deepEqual(unwrapMessage({ viewOnceMessage: { message: inner } }), inner)
  assert.deepEqual(unwrapMessage({ ephemeralMessage: { message: inner } }), inner)
  assert.deepEqual(unwrapMessage(inner), inner)
})

test('extractText dari teks, caption, dan tombol', () => {
  assert.equal(extractText({ conversation: 'halo' }), 'halo')
  assert.equal(extractText({ extendedTextMessage: { text: 'hai' } }), 'hai')
  assert.equal(extractText({ imageMessage: { caption: 'foto' } }), 'foto')
  assert.equal(extractText({ buttonsMessage: { contentText: 'pilih' } }), 'pilih')
  assert.equal(extractText({ stickerMessage: {} }), '')
})

test('toLegacyMessage membentuk m untuk chat pribadi', () => {
  const raw = {
    key: { remoteJid: '628@s.whatsapp.net', fromMe: false, id: 'ABC' },
    message: { conversation: 'tes' },
    pushName: 'Aza',
    messageTimestamp: 1700000000,
  }
  const m = toLegacyMessage(raw)
  assert.equal(m.chat, '628@s.whatsapp.net')
  assert.equal(m.sender, m.chat)
  assert.equal(m.isGroup, false)
  assert.equal(m.mtype, MessageType.text)
  assert.equal(m.text, 'tes')
  assert.equal(m.isMedia, false)
})

test('toLegacyMessage memakai participant untuk grup', () => {
  const raw = {
    key: { remoteJid: '123@g.us', participant: '456@s.whatsapp.net', id: 'X' },
    message: { imageMessage: { caption: 'gambar' } },
  }
  const m = toLegacyMessage(raw)
  assert.equal(m.isGroup, true)
  assert.equal(m.sender, '456@s.whatsapp.net')
  assert.equal(m.mtype, MessageType.image)
  assert.equal(m.isMedia, true)
  assert.equal(m.text, 'gambar')
})

test('smsg menambahkan reply, download, quoted, mentionedJid', async () => {
  const sent = []
  const conn = {
    chats: new Map(),
    sendMessage: async (jid, content, type, options) => { sent.push({ jid, content, type, options }) },
    downloadMedia: async () => Buffer.from('media'),
  }
  const m = toLegacyMessage({
    key: { remoteJid: '1@s.whatsapp.net', id: 'A' },
    message: {
      extendedTextMessage: {
        text: 'balas',
        contextInfo: {
          stanzaId: 'Q1',
          participant: '2@s.whatsapp.net',
          mentionedJid: ['2@s.whatsapp.net'],
          quotedMessage: { imageMessage: { caption: 'gambar lama', mimetype: 'image/jpeg' } },
        },
      },
    },
  })
  smsg(conn, m)
  assert.deepEqual(m.mentionedJid, ['2@s.whatsapp.net'])
  assert.equal(m.quoted.text, 'gambar lama')
  assert.equal(m.quoted.mtype, MessageType.image)
  assert.equal(m.quoted.mimetype, 'image/jpeg')
  assert.ok((await m.download()).equals(Buffer.from('media')))
  await m.reply('jawab')
  assert.equal(sent[0].content, 'jawab')
  assert.equal(sent[0].type, MessageType.text)
  assert.equal(sent[0].options.quoted, m)
})
