const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeJid, toJidSet, resolveRoles, checkAccess } = require('../lib/permission')

const OWNER = '628111@s.whatsapp.net'
const STAFF = '628222@s.whatsapp.net'
const USER = '628333@s.whatsapp.net'

test('normalizeJid menerima nomor, JID, dan teks berpemisah', () => {
  assert.equal(normalizeJid('628111'), '628111@s.whatsapp.net')
  assert.equal(normalizeJid('+62 811-1'), '628111@s.whatsapp.net')
  assert.equal(normalizeJid('628111@s.whatsapp.net'), '628111@s.whatsapp.net')
  assert.equal(normalizeJid('628111:3@s.whatsapp.net'), '6281113@s.whatsapp.net')
  assert.equal(normalizeJid(''), '')
  assert.equal(normalizeJid(null), '')
})

test('toJidSet membuang entri tanpa digit', () => {
  const set = toJidSet(['628111', '', null, 'abc'])
  assert.deepEqual([...set], ['628111@s.whatsapp.net'])
})

test('owner dikenali dari daftar, nomor bot, dan pesan fromMe', () => {
  const base = { owner: ['628111'], staff: ['628222'] }
  assert.equal(resolveRoles(OWNER, base).role, 'owner')
  assert.equal(resolveRoles(USER, { ...base, botJid: USER }).isROwner, true)
  assert.equal(resolveRoles(USER, { ...base, fromMe: true }).role, 'owner')
})

test('staff satu lapis di bawah owner dan mencakup mods', () => {
  const roles = resolveRoles(STAFF, { owner: ['628111'], staff: ['628222'], mods: [], prems: [] })
  assert.equal(roles.isStaff, true)
  assert.equal(roles.isMods, true)
  assert.equal(roles.isROwner, false)
  assert.equal(roles.isOwner, false)
  assert.equal(roles.role, 'staff')
})

test('flag staff di database menaikkan peran user', () => {
  const roles = resolveRoles(USER, { owner: [], staff: [], user: { staff: true } })
  assert.equal(roles.isStaff, true)
  assert.equal(roles.role, 'staff')
})

test('user biasa mendapat peran user tanpa hak khusus', () => {
  const roles = resolveRoles(USER, { owner: ['628111'], staff: ['628222'], mods: ['628444'], prems: ['628555'] })
  assert.deepEqual(
    { isROwner: roles.isROwner, isOwner: roles.isOwner, isStaff: roles.isStaff, isMods: roles.isMods, isPrems: roles.isPrems, role: roles.role },
    { isROwner: false, isOwner: false, isStaff: false, isMods: false, isPrems: false, role: 'user' }
  )
})

test('premium dan mods tetap berfungsi seperti sebelumnya', () => {
  const prems = resolveRoles('628555', { prems: ['628555'] })
  assert.equal(prems.isPrems, true)
  assert.equal(prems.role, 'premium')
  const mods = resolveRoles('628444', { mods: ['628444'] })
  assert.equal(mods.isMods, true)
  assert.equal(mods.isStaff, false)
  assert.equal(mods.role, 'mods')
})

test('checkAccess tanpa syarat selalu mengizinkan', () => {
  assert.deepEqual(checkAccess({}, {}), { allowed: true, reason: '' })
  assert.deepEqual(checkAccess(null, null), { allowed: true, reason: '' })
})

test('checkAccess menolak dengan alasan yang tepat', () => {
  const user = resolveRoles(USER, {})
  const staff = resolveRoles(STAFF, { staff: ['628222'] })
  const owner = resolveRoles(OWNER, { owner: ['628111'] })

  assert.deepEqual(checkAccess({ staff: true }, user), { allowed: false, reason: 'staff' })
  assert.deepEqual(checkAccess({ staff: true }, staff), { allowed: true, reason: '' })
  assert.deepEqual(checkAccess({ staff: true }, owner), { allowed: true, reason: '' })

  assert.deepEqual(checkAccess({ mods: true }, staff), { allowed: true, reason: '' })
  assert.deepEqual(checkAccess({ mods: true }, user), { allowed: false, reason: 'mods' })

  assert.deepEqual(checkAccess({ premium: true }, user), { allowed: false, reason: 'premium' })
  assert.deepEqual(checkAccess({ owner: true }, staff), { allowed: false, reason: 'owner' })
  assert.deepEqual(checkAccess({ owner: true }, owner), { allowed: true, reason: '' })

  assert.deepEqual(checkAccess({ rowner: true }, owner), { allowed: true, reason: '' })
  assert.deepEqual(checkAccess({ rowner: true }, resolveRoles(USER, { fromMe: true })), { allowed: false, reason: 'rowner' })
})

test('plugin rowner+owner memberi alasan owner seperti perilaku lama', () => {
  const roles = resolveRoles(USER, {})
  assert.deepEqual(checkAccess({ rowner: true, owner: true }, roles), { allowed: false, reason: 'owner' })
})
