const test = require('node:test')
const assert = require('node:assert/strict')
const { ChatStore } = require('../lib/wa/chats')
const { LegacyClient } = require('../lib/wa/legacy')

const silent = { info() { }, warn() { }, error() { } }

test('all() mengembalikan seluruh chat seperti ChatManager lama', () => {
  const chats = new ChatStore()
  chats.get('1@g.us')
  chats.get('2@s.whatsapp.net')
  const all = chats.all()
  assert.equal(all.length, 2)
  assert.deepEqual(all.map(v => v.jid).sort(), ['1@g.us', '2@s.whatsapp.net'])
})

test('get() selalu memberi bentuk { jid, metadata, presences, read_only }', () => {
  const chats = new ChatStore()
  const chat = chats.get('1@g.us')
  assert.equal(chat.jid, '1@g.us')
  assert.equal(chat.metadata, undefined)
  assert.deepEqual(chat.presences, {})
  assert.equal(chat.read_only, false)
  assert.deepEqual(Object.keys(chats.get('1@g.us').presences), [])
  assert.equal(chats.all().length, 1)
})

test('entri yang diset manual tetap mendapat jid', () => {
  const chats = new ChatStore()
  chats.set('3@g.us', { metadata: { subject: 'Grup' } })
  assert.equal(chats.get('3@g.us').jid, '3@g.us')
  assert.equal(chats.all()[0].metadata.subject, 'Grup')
})

test('LegacyClient memakai ChatStore, bukan Map polos', () => {
  const conn = new LegacyClient({ ev: { on() { } } }, { logger: silent })
  assert.ok(conn.chats instanceof ChatStore)
  assert.equal(typeof conn.chats.all, 'function')
  conn.chats.get('x@g.us').read_only = true
  assert.equal(conn.chats.all().filter(v => v.jid.endsWith('@g.us') && !v.read_only).length, 0)
})
