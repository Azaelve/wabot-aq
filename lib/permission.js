/**
 * Peran pengguna dan pemeriksaan akses plugin.
 *
 * Fungsi murni: seluruh daftar peran disuntik dari luar (config/database),
 * sehingga bisa diuji tanpa koneksi WhatsApp. Dua lapis peran yang dipakai:
 *
 * - **owner**  — pemilik bot (`global.owner`) dan nomor bot itu sendiri.
 * - **staff**  — pengelola yang boleh memakai perintah internal, ditunjuk
 *                lewat `global.staff` atau flag `staff` di database user.
 *
 * `mods` dan `premium` tetap didukung seperti sebelumnya.
 */

/**
 * Ubah nomor, JID, atau teks apa pun menjadi JID standar `628...@s.whatsapp.net`.
 * @param {String} value
 * @returns {String} JID, atau string kosong bila tidak ada digit
 */
function normalizeJid(value) {
  const digits = String(value == null ? '' : value).replace(/[^0-9]/g, '')
  return digits ? digits + '@s.whatsapp.net' : ''
}

/**
 * @param {String[]} list nomor/JID
 * @returns {Set<String>}
 */
function toJidSet(list = []) {
  const set = new Set()
  for (const item of list || []) {
    const jid = normalizeJid(item)
    if (jid) set.add(jid)
  }
  return set
}

/**
 * Tentukan peran seorang pengirim.
 *
 * @param {String} sender JID pengirim
 * @param {Object} [options]
 * @param {String[]} [options.owner] daftar owner (`global.owner`)
 * @param {String[]} [options.staff] daftar staff (`global.staff`)
 * @param {String[]} [options.mods] daftar moderator (`global.mods`)
 * @param {String[]} [options.prems] daftar premium (`global.prems`)
 * @param {Object} [options.user] baris user di database (dipakai flag `staff`)
 * @param {String} [options.botJid] nomor bot; selalu dianggap owner
 * @param {Boolean} [options.fromMe] pesan dikirim dari perangkat bot sendiri
 * @returns {{ jid: String, isROwner: Boolean, isOwner: Boolean, isStaff: Boolean,
 *            isMods: Boolean, isPrems: Boolean, role: String }}
 */
function resolveRoles(sender, options = {}) {
  const jid = normalizeJid(sender)
  const owner = toJidSet(options.owner)
  const botJid = normalizeJid(options.botJid)
  if (botJid) owner.add(botJid)

  const staff = toJidSet(options.staff)
  const mods = toJidSet(options.mods)
  const prems = toJidSet(options.prems)
  const dbStaff = !!(options.user && options.user.staff)

  const isROwner = !!jid && owner.has(jid)
  const isOwner = isROwner || !!options.fromMe
  const isStaff = isOwner || (!!jid && staff.has(jid)) || dbStaff
  const isMods = isStaff || (!!jid && mods.has(jid))
  const isPrems = isROwner || (!!jid && prems.has(jid))

  // `fromMe` (pesan dari perangkat bot) setara owner untuk penamaan peran,
  // sementara `isROwner` tetap hanya untuk nomor owner di config.
  const role = isOwner ? 'owner'
    : isStaff ? 'staff'
      : isMods ? 'mods'
        : isPrems ? 'premium'
          : 'user'

  return { jid, isROwner, isOwner, isStaff, isMods, isPrems, role }
}

/**
 * Periksa apakah peran yang dimiliki cukup untuk menjalankan plugin.
 * Urutannya sama dengan pemeriksaan lama di `handler.js`, ditambah `staff`.
 *
 * @param {Object} plugin modul plugin (flag `rowner`/`owner`/`staff`/`mods`/`premium`)
 * @param {Object} roles hasil `resolveRoles`
 * @returns {{ allowed: Boolean, reason: String }} `reason` dipakai untuk `fail()`
 */
function checkAccess(plugin, roles) {
  const flags = plugin || {}
  const peran = roles || {}
  const deny = reason => ({ allowed: false, reason })

  if (flags.rowner && flags.owner && !(peran.isROwner || peran.isOwner)) return deny('owner')
  if (flags.rowner && !peran.isROwner) return deny('rowner')
  if (flags.owner && !peran.isOwner) return deny('owner')
  if (flags.staff && !peran.isStaff) return deny('staff')
  if (flags.mods && !peran.isMods) return deny('mods')
  if (flags.premium && !peran.isPrems) return deny('premium')

  return { allowed: true, reason: '' }
}

module.exports = { normalizeJid, toJidSet, resolveRoles, checkAccess }
