/**
 * Kompatibilitas: dulu berkas ini berisi 1126 baris emulasi Baileys 3.x.
 * Sekarang seluruh logika pindah ke lib/wa/ dan di sini hanya re-export
 * helper yang masih dipakai (`smsg`).
 */
const { smsg, unwrapMessage, extractText, toLegacyMessage } = require('./wa/normalize')

module.exports = { smsg, unwrapMessage, extractText, toLegacyMessage }
