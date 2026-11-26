/**
 * Helper JID untuk dua skema alamat WhatsApp.
 *
 * WhatsApp kini mengirim sebagian pesan dengan alamat LID (`123@lid`), sementara
 * metadata grup, database pengguna, dan sapaan menu memakai nomor telepon
 * (`628xx@s.whatsapp.net`). Fungsi di berkas ini menyatukan keduanya tanpa
 * mengubah plugin satu per satu.
 */

/** True bila JID memakai skema LID. */
function isLid(jid) {
  return /@lid$/i.test(String(jid == null ? '' : jid))
}

/** Bagian angka saja dari sebuah JID (tanpa `@server` dan tanpa `:device`). */
function bareNumber(jid) {
  return String(jid == null ? '' : jid).split('@')[0].split(':')[0]
}

/**
 * Pilih alamat nomor telepon bila alamat utama memakai LID.
 * @param {String} primary alamat utama (`remoteJid` / `participant`)
 * @param {String} [alt] alamat alternatif (`remoteJidAlt` / `participantAlt`)
 * @returns {String} alamat yang dipakai
 */
function preferPn(primary, alt) {
  const main = String(primary == null ? '' : primary)
  if (!alt) return main
  return isLid(main) ? String(alt) : main
}

/**
 * Tambahkan bentuk lama pada daftar peserta grup Baileys 7.
 *
 * Baileys 7 memakai `id` dan `admin` (`'admin' | 'superadmin' | null`),
 * sedangkan plugin wabot-aq membaca `jid`, `isAdmin`, dan `isSuperAdmin`.
 *
 * @param {Object} metadata hasil `sock.groupMetadata`
 * @returns {Object} metadata yang sama dengan peserta bentuk lama
 */
function legacyParticipants(metadata) {
  if (!metadata || !Array.isArray(metadata.participants)) return metadata
  metadata.participants = metadata.participants.map(p => {
    if (!p) return p
    return {
      ...p,
      jid: p.jid || p.id,
      isAdmin: p.isAdmin === true || p.admin === 'admin' || p.admin === 'superadmin',
      isSuperAdmin: p.isSuperAdmin === true || p.admin === 'superadmin',
    }
  })
  return metadata
}

/**
 * Cari peserta grup yang cocok dengan sebuah JID.
 *
 * Pencocokan pertama memakai alamat persis, lalu angka pada skema yang sama,
 * jadi nomor LID tidak pernah tertukar dengan nomor telepon.
 *
 * @param {Array} participants daftar peserta
 * @param {String} jid JID yang dicari
 * @returns {Object|undefined}
 */
function findParticipant(participants, jid) {
  const list = Array.isArray(participants) ? participants : []
  const target = String(jid == null ? '' : jid)
  if (!target) return undefined
  const fields = p => [p.id, p.jid, p.lid, p.phoneNumber].filter(Boolean).map(String)
  return list.find(p => p && fields(p).includes(target)) ||
    list.find(p => p && fields(p).some(v => isLid(v) === isLid(target) && bareNumber(v) === bareNumber(target)))
}

/** True bila peserta punya hak admin (`admin` maupun `superadmin`). */
function isAdminParticipant(participant) {
  if (!participant) return false
  return participant.admin === 'admin' ||
    participant.admin === 'superadmin' ||
    participant.isAdmin === true ||
    participant.isSuperAdmin === true
}

module.exports = { isLid, bareNumber, preferPn, legacyParticipants, findParticipant, isAdminParticipant }
