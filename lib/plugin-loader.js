/**
 * Pemuat plugin: menemukan berkas `.js` di folder plugin secara rekursif dan
 * mengubahnya menjadi peta `{ kunci: hasil require }`.
 *
 * Kunci plugin adalah path relatif dengan pemisah `/`, jadi
 * `plugins/rpg/adventure.js` menjadi `rpg/adventure.js`. Berkas yang langsung
 * berada di folder plugin tetap memakai nama berkasnya saja (`template.js`),
 * sehingga kunci plugin lama tidak berubah dan statistik/cooldown yang sudah
 * tersimpan tetap menunjuk perintah yang sama.
 *
 * Modul ini tidak menyentuh WhatsApp atau database; pemanggil (`main.js`) yang
 * menaruh hasilnya di `global.plugins`. Karena itu loader bisa diuji memakai
 * folder sementara tanpa membuka koneksi.
 */
const fs = require('fs')
const path = require('path')

const PLUGIN_FILE = /\.js$/

/**
 * @param {String} filename nama berkas
 * @returns {Boolean} true bila berkas plugin (berakhiran `.js`)
 */
function isPluginFile(filename) {
  return PLUGIN_FILE.test(filename || '')
}

/**
 * Ubah nama berkas dari `fs.watch` menjadi kunci plugin.
 *
 * `fs.watch` bisa mengirim path relatif ke folder yang dipantau
 * (`rpg/adventure.js`) atau `null` saat event tidak informatif. Berkas di
 * subfolder tersembunyi dan berkas bukan `.js` diabaikan.
 *
 * @param {String} filename
 * @returns {String|null} kunci plugin, atau null bila tidak relevan
 */
function toPluginKey(filename) {
  if (typeof filename !== 'string' || !filename) return null
  let key = filename.split(path.sep).join('/').replace(/^\.\//, '')
  if (key.split('/').some(part => part === '' || part.startsWith('.'))) return null
  return isPluginFile(key) ? key : null
}

/**
 * Kumpulkan kunci plugin secara rekursif, terurut supaya urutan muat stabil
 * (dulu `fs.readdirSync` mengembalikan urutan direktori apa adanya).
 *
 * @param {String} dir folder plugin
 * @param {String} [prefix] awalan relatif, mis. `rpg/`
 * @returns {String[]} daftar kunci plugin
 */
function collectPluginKeys(dir, prefix = '') {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return []
  }
  let keys = []
  for (let entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      keys = keys.concat(collectPluginKeys(path.join(dir, entry.name), prefix + entry.name + '/'))
      continue
    }
    if (!entry.isFile() || !isPluginFile(entry.name)) continue
    keys.push(prefix + entry.name)
  }
  return keys.sort((a, b) => a.localeCompare(b))
}

/**
 * Muat semua plugin di folder (rekursif).
 *
 * @param {String} dir folder plugin
 * @param {Object} [options]
 * @param {Function} [options.require] pengganti `require` (untuk tes)
 * @param {Function} [options.onError] dipanggil `(error, key)` bila satu plugin gagal
 * @returns {Object} peta kunci plugin ke handler
 */
function loadPlugins(dir, { require: req = require, onError } = {}) {
  let plugins = {}
  for (let key of collectPluginKeys(dir)) {
    try {
      plugins[key] = req(path.join(dir, key))
    } catch (e) {
      if (typeof onError === 'function') onError(e, key)
      else console.error(e)
    }
  }
  return plugins
}

/**
 * Pantau folder plugin beserta subfoldernya.
 *
 * `{ recursive: true }` dicoba lebih dulu; bila platform menolaknya, setiap
 * folder dipantau terpisah dan nama berkas dari `fs.watch` diberi awalan path
 * relatifnya supaya kuncinya tetap sama.
 *
 * @param {String} dir folder plugin
 * @param {Function} onChange dipanggil `(event, key)` untuk setiap perubahan
 * @param {Object} [options]
 * @param {Function} [options.watch] pengganti `fs.watch` (untuk tes)
 * @returns {{ recursive: Boolean, close: Function }}
 */
function watchPlugins(dir, onChange, { watch = fs.watch } = {}) {
  const closers = []

  function closeAll() {
    for (let watcher of closers) {
      try {
        watcher.close()
      } catch (e) { }
    }
    closers.length = 0
  }

  try {
    closers.push(watch(dir, { recursive: true }, onChange))
    return { recursive: true, close: closeAll }
  } catch (e) {
    console.warn('[plugins] pemantauan rekursif tidak didukung:', e.message)
  }

  const walk = (current, prefix) => {
    try {
      closers.push(watch(current, (event, filename) => onChange(event, filename ? prefix + filename : null)))
    } catch (e) {
      console.error(e)
    }
    for (let entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(path.join(current, entry.name), prefix + entry.name + '/')
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir, '')
  return { recursive: false, close: closeAll }
}

module.exports = { isPluginFile, toPluginKey, collectPluginKeys, loadPlugins, watchPlugins }
