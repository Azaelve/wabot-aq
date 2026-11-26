const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isLid,
  bareNumber,
  preferPn,
  legacyParticipants,
  findParticipant,
  isAdminParticipant,
} = require('../lib/wa/jid')
const { toLegacyMessage } = require('../lib/wa/normalize')
const { LegacyClient } = require('../lib/wa/legacy')

const PN = '6285178964685@s.whatsapp.net'
const LID = '159442842685597@lid'
const silent = { info() { }, warn() { }, error() { } }

test('isLid hanya benar untuk alamat @lid', () => {
  assert.equal(isLid(LID), true)
  assert.equal(isLid(PN), false)
  assert.equal(isLid(''), false)
  assert.equal(isLid(undefined), false)
})

test('bareNumber membuang server dan device', () => {
  assert.equal(bareNumber('6285178964685:9@s.whatsapp.net'), '6285178964685')
  assert.equal(bareNumber(LID), '159442842685597')
})

test('preferPn memakai alamat nomor telepon saat utama LID', () => {
  assert.equal(preferPn(LID, PN), PN)
  assert.equal(preferPn(PN, LID), PN)
  assert.equal(preferPn(LID, undefined), LID)
  assert.equal(preferPn('', PN), '')
})

test('legacyParticipants melengkapi jid, isAdmin, isSuperAdmin', () => {
  const metadata = legacyParticipants({
    subject: 'Grup Uji',
    participants: [
      { id: PN, admin: 'superadmin' },
      { id: '628111@s.whatsapp.net', admin: 'admin' },
      { id: '628222@s.whatsapp.net', admin: null },
    ],
  })
  assert.equal(metadata.participants[0].jid, PN)
  assert.equal(metadata.participants[0].isAdmin, true)
  assert.equal(metadata.participants[0].isSuperAdmin, true)
  assert.equal(metadata.participants[1].isAdmin, true)
  assert.equal(metadata.participants[1].isSuperAdmin, false)
  assert.equal(metadata.participants[2].isAdmin, false)
  assert.equal(legacyParticipants(undefined), undefined)
})

test('findParticipant menemukan peserta lewat id, jid, atau lid', () => {
  const participants = [
    { id: PN, lid: LID, admin: 'admin' },
    { id: '628999@s.whatsapp.net', admin: null },
  ]
  assert.equal(findParticipant(participants, PN).id, PN)
  assert.equal(findParticipant(participants, LID).id, PN)
  assert.equal(findParticipant(participants, '6285178964685:4@s.whatsapp.net').id, PN)
})

test('findParticipant tidak mencampur nomor LID dengan nomor telepon', () => {
  const participants = [{ id: '159442842685597@s.whatsapp.net', admin: null }]
  assert.equal(findParticipant(participants, LID), undefined)
  assert.equal(findParticipant([], PN), undefined)
  assert.equal(findParticipant(undefined, PN), undefined)
  assert.equal(findParticipant(participants, ''), undefined)
})

test('isAdminParticipant membaca bentuk lama dan baru', () => {
  assert.equal(isAdminParticipant({ admin: 'admin' }), true)
  assert.equal(isAdminParticipant({ admin: 'superadmin' }), true)
  assert.equal(isAdminParticipant({ isAdmin: true }), true)
  assert.equal(isAdminParticipant({ admin: null }), false)
  assert.equal(isAdminParticipant(undefined), false)
})

test('toLegacyMessage menormalkan sender LID ke nomor telepon', () => {
  const priv = toLegacyMessage({
    key: { remoteJid: LID, remoteJidAlt: PN, fromMe: false },
    message: { conversation: 'hai' },
    pushName: 'Lionnetter',
  })
  assert.equal(priv.chat, LID)
  assert.equal(priv.sender, PN)
  assert.equal(priv.isGroup, false)

  const grup = toLegacyMessage({
    key: {
      remoteJid: '120363164893652056@g.us',
      participant: LID,
      participantAlt: PN,
    },
    message: { conversation: '.menu' },
    pushName: 'Lionnetter',
  })
  assert.equal(grup.chat, '120363164893652056@g.us')
  assert.equal(grup.sender, PN)
  assert.equal(grup.isGroup, true)
})

test('toLegacyMessage membiarkan alamat nomor telepon apa adanya', () => {
  const m = toLegacyMessage({
    key: { remoteJid: PN, participant: PN },
    message: { conversation: 'hai' },
  })
  assert.equal(m.sender, PN)
})

test('getName memakai pushName yang tersimpan', () => {
  const conn = new LegacyClient({ ev: { on() { } } }, { logger: silent })
  conn.saveName(PN, 'Lionnetter')
  assert.equal(conn.getName(PN), 'Lionnetter')
  assert.equal(conn.getName('6285178964685:12@s.whatsapp.net'), 'Lionnetter')
})

test('getName memakai nama pada skema yang sama saja', () => {
  const conn = new LegacyClient({ ev: { on() { } } }, { logger: silent })
  conn.saveName(LID, 'Dari LID')
  assert.equal(conn.getName(LID), 'Dari LID')
  assert.equal(conn.getName('159442842685597@s.whatsapp.net'), '+159442842685597')
})

test('getName jatuh ke nomor telepon bila nama belum ada', () => {
  const conn = new LegacyClient({ ev: { on() { } } }, { logger: silent })
  assert.equal(conn.getName(PN), '+6285178964685')
  assert.equal(conn.getName(''), '')
})

test('groupMetadata menyimpan subject grup sebagai nama', async () => {
  const conn = new LegacyClient({
    ev: { on() { } },
    groupMetadata: async jid => ({ id: jid, subject: 'Grup Uji', participants: [{ id: PN, admin: 'admin' }] }),
  }, { logger: silent })
  const metadata = await conn.groupMetadata('120363164893652056@g.us')
  assert.equal(metadata.participants[0].jid, PN)
  assert.equal(metadata.participants[0].isAdmin, true)
  assert.equal(conn.getName('120363164893652056@g.us'), 'Grup Uji')
})
