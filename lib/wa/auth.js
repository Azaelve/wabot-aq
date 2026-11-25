/**
 * Penyimpanan kredensial WhatsApp di folder (bukan satu berkas JSON seperti
 * Baileys 3.x), memakai helper resmi Baileys 7.
 */
const path = require('path')
const baileys = require('baileys')

/**
 * Siapkan state auth multi-file.
 * @param {String} dir folder penyimpanan (default: wa-auth)
 * @returns {Promise<{state: Object, saveCreds: Function, dir: String}>}
 */
async function loadAuth(dir = path.join(__dirname, '..', '..', 'wa-auth')) {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(dir)
  return { state, saveCreds, dir }
}

module.exports = { loadAuth }
