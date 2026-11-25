/**
 * Pengaturan per grup: fitur, prefix, dan bahasa.
 *
 * Semua fungsi murni — tidak menyentuh database atau WhatsApp. Pemanggil
 * (handler/plugin) yang membaca dan menulis objek `chat.settings`, sehingga
 * modul ini bisa diuji tanpa koneksi.
 *
 * Bentuk data yang disimpan di `global.db.data.chats[jid].settings`:
 *
 * ```js
 * {
 *   features: { antilink: false }, // saklar modul per grup
 *   prefix: 'multi',               // 'multi' | 'none' | karakter prefix
 *   language: 'id',                // 'id' | 'en'
 * }
 * ```
 *
 * `features` adalah saklar tingkat modul: plugin menandai dirinya dengan
 * `handler.feature = 'antilink'` dan `handler.js` melewatinya bila grup
 * mematikan fitur itu. Flag lama (`chat.antiLink`, `chat.welcome`, …) tetap
 * mengatur perilaku di dalam modul, jadi keduanya tidak saling menimpa.
 */

const LANGUAGES = ['id', 'en']
const DEFAULT_LANGUAGE = 'id'

const PREFIX_MULTI = 'multi'
const PREFIX_NONE = 'none'
const MAX_PREFIX_LENGTH = 8

const LANGUAGE_ALIASES = {
  id: ['id', 'ind', 'indonesia', 'id-id', 'bahasa', 'bahasa indonesia'],
  en: ['en', 'eng', 'english', 'en-us', 'en-gb', 'inggris'],
}

const MULTI_ALIASES = ['multi', 'default', 'semua', 'all']
const NONE_ALIASES = ['none', 'off', 'no', 'tanpa', 'tidak', '0']
const TRUE_ALIASES = ['on', 'true', '1', 'enable', 'enabled', 'ya', 'yes', 'aktif', 'nyala']
const FALSE_ALIASES = ['off', 'false', '0', 'disable', 'disabled', 'tidak', 'no', 'mati']

/** Fitur yang boleh diubah lewat perintah, beserta penjelasan singkat. */
const FEATURES = {
  antilink: 'Tolak tautan grup',
  antisticker: 'Tolak stiker',
  antispam: 'Peringatan spam',
  antivirus: 'Bersihkan pesan rusak',
  antitroli: 'Peringatan bug troli',
  simi: 'Balasan Simi',
  welcome: 'Pesan selamat datang',
  detect: 'Deteksi promote/demote',
  delete: 'Anti-hapus pesan',
}

const FEATURE_NAMES = Object.keys(FEATURES)

/** Label fitur untuk tampilan bahasa Inggris; kuncinya sama dengan `FEATURES`. */
const FEATURES_EN = {
  antilink: 'Reject group links',
  antisticker: 'Reject stickers',
  antispam: 'Spam warnings',
  antivirus: 'Clean broken messages',
  antitroli: 'Troli bug warnings',
  simi: 'Simi replies',
  welcome: 'Welcome messages',
  detect: 'Promote/demote detection',
  delete: 'Anti-delete',
}

const MESSAGES = {
  id: {
    rowner: 'Perintah ini hanya dapat digunakan oleh _*OWWNER!1!1!*_',
    owner: 'Perintah ini hanya dapat digunakan oleh _*Owner Bot*_!',
    mods: 'Perintah ini hanya dapat digunakan oleh _*Moderator*_ !',
    staff: 'Perintah ini hanya dapat digunakan oleh _*Staff Bot*_ !',
    premium: 'Perintah ini hanya untuk member _*Premium*_ !',
    group: 'Perintah ini hanya dapat digunakan di grup!',
    private: 'Perintah ini hanya dapat digunakan di Chat Pribadi!',
    admin: 'Perintah ini hanya untuk *Admin* grup!',
    botAdmin: 'Jadikan bot sebagai *Admin* untuk menggunakan perintah ini!',
    unreg: 'Silahkan daftar untuk menggunakan fitur ini dengan cara mengetik:\n\n*#daftar nama.umur*\n\nContoh: *#daftar Manusia.16*',
    settings_title: 'Pengaturan grup ini',
    settings_prefix_label: 'Prefix',
    settings_language_label: 'Bahasa',
    settings_saved: '*{key}* diatur ke *{value}*',
    settings_unchanged: '*{key}* tidak berubah',
    settings_usage: 'Format salah. Contoh:\n\n*{prefix}grup* — lihat pengaturan\n*{prefix}grup prefix !* — ganti prefix\n*{prefix}grup prefix none* — tanpa prefix\n*{prefix}grup prefix multi* — kembali ke prefix bawaan\n*{prefix}grup bahasa id* / *en* — ganti bahasa\n*{prefix}grup fitur antilink off* — matikan fitur\n*{prefix}grup fitur antilink* — balikkan saklar\n*{prefix}grup reset* — kembalikan semua',
    settings_unknown_feature: 'Fitur *{value}* tidak dikenal. Pilihan: {list}',
    settings_bad_value: 'Nilai *{value}* tidak valid untuk *{key}*.',
    settings_prefix_chars: 'karakter {value}',
    settings_feature_on: 'nyala',
    settings_feature_off: 'mati',
  },
  en: {
    rowner: 'This command is only for the _*OWNER*_!',
    owner: 'This command is only for the _*Bot Owner*_!',
    mods: 'This command is only for _*Moderators*_!',
    staff: 'This command is only for the _*Bot Staff*_!',
    premium: 'This command is only for _*Premium*_ members!',
    group: 'This command can only be used in a group!',
    private: 'This command can only be used in a private chat!',
    admin: 'This command is only for *group Admins*!',
    botAdmin: 'Make the bot a *group Admin* to use this command!',
    unreg: 'Please register first by sending:\n\n*#daftar name.age*\n\nExample: *#daftar Human.16*',
    settings_title: 'Settings for this group',
    settings_prefix_label: 'Prefix',
    settings_language_label: 'Language',
    settings_saved: '*{key}* is set to *{value}*',
    settings_unchanged: '*{key}* is unchanged',
    settings_usage: 'Wrong format. Examples:\n\n*{prefix}grup* — show settings\n*{prefix}grup prefix !* — change prefix\n*{prefix}grup prefix none* — no prefix\n*{prefix}grup prefix multi* — back to the default prefix\n*{prefix}grup bahasa id* / *en* — change language\n*{prefix}grup fitur antilink off* — disable a feature\n*{prefix}grup fitur antilink* — toggle a feature\n*{prefix}grup reset* — restore everything',
    settings_unknown_feature: 'Unknown feature *{value}*. Options: {list}',
    settings_bad_value: '*{value}* is not a valid *{key}*.',
    settings_prefix_chars: 'characters {value}',
    settings_feature_on: 'on',
    settings_feature_off: 'off',
  },
}

/**
 * @param {*} value
 * @returns {String|null} `id`, `en`, atau null bila tidak dikenal
 */
function normalizeLanguage(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase()
  if (!text) return null
  for (const lang of LANGUAGES) {
    if (LANGUAGE_ALIASES[lang].includes(text)) return lang
  }
  return null
}

/**
 * @param {*} value
 * @returns {String|null} `multi`, `none`, karakter prefix, atau null bila tidak valid
 */
function normalizePrefix(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const lower = text.toLowerCase()
  if (MULTI_ALIASES.includes(lower)) return PREFIX_MULTI
  if (NONE_ALIASES.includes(lower)) return PREFIX_NONE
  if (/\s/.test(text) || text.length > MAX_PREFIX_LENGTH) return null
  return text
}

/**
 * @param {*} value
 * @returns {Boolean|null} null bila nilainya tidak dikenali
 */
function toBoolean(value) {
  if (typeof value === 'boolean') return value
  const text = String(value == null ? '' : value).trim().toLowerCase()
  if (TRUE_ALIASES.includes(text)) return true
  if (FALSE_ALIASES.includes(text)) return false
  return null
}

/**
 * Nama fitur tidak peka huruf besar/kecil.
 * @param {*} name
 * @returns {String} nama kanonik, atau string kosong
 */
function normalizeFeatureName(name) {
  const text = String(name == null ? '' : name).trim().toLowerCase()
  return FEATURE_NAMES.includes(text) ? text : ''
}

/**
 * Lengkapi objek pengaturan dengan nilai bawaan dan buang isian yang tidak valid.
 *
 * Idempoten: `createSettings(createSettings(x))` sama dengan `createSettings(x)`.
 *
 * @param {Object} [input]
 * @returns {{ features: Object<String, Boolean>, prefix: String, language: String }}
 */
function createSettings(input) {
  const source = input && typeof input === 'object' ? input : {}
  const features = {}
  const raw = source.features && typeof source.features === 'object' ? source.features : {}
  for (const [name, enabled] of Object.entries(raw)) {
    const key = normalizeFeatureName(name)
    if (key && typeof enabled === 'boolean') features[key] = enabled
  }
  return {
    features,
    prefix: normalizePrefix(source.prefix) || PREFIX_MULTI,
    language: normalizeLanguage(source.language) || DEFAULT_LANGUAGE,
  }
}

/**
 * Terapkan perubahan pada pengaturan dan kembalikan objek baru.
 *
 * `feature` tanpa `enabled` membalik saklar yang sekarang. Isian yang tidak
 * valid tidak mengubah apa pun dan dilaporkan di `errors`.
 *
 * @param {Object} settings pengaturan lama
 * @param {Object} [patch] `{ prefix, language, feature, enabled, features }`
 * @returns {{ settings: Object, changed: String[], errors: String[] }}
 */
function updateSettings(settings, patch) {
  const current = createSettings(settings)
  const next = { ...current, features: { ...current.features } }
  const changes = patch && typeof patch === 'object' ? patch : {}
  const changed = []
  const errors = []

  if (changes.prefix !== undefined) {
    const prefix = normalizePrefix(changes.prefix)
    if (prefix === null) errors.push('prefix')
    else if (prefix !== next.prefix) {
      next.prefix = prefix
      changed.push('prefix')
    }
  }

  if (changes.language !== undefined) {
    const language = normalizeLanguage(changes.language)
    if (language === null) errors.push('language')
    else if (language !== next.language) {
      next.language = language
      changed.push('language')
    }
  }

  const entries = []
  if (changes.features && typeof changes.features === 'object') {
    for (const [name, enabled] of Object.entries(changes.features)) entries.push([name, enabled])
  }
  if (changes.feature !== undefined) entries.push([changes.feature, changes.enabled])

  for (const [name, enabled] of entries) {
    const key = normalizeFeatureName(name)
    if (!key) {
      errors.push('feature:' + String(name))
      continue
    }
    const value = enabled === undefined ? !next.features[key] : toBoolean(enabled)
    if (value === null) {
      errors.push('value:' + key)
      continue
    }
    if (next.features[key] !== value) {
      next.features[key] = value
      changed.push('feature:' + key)
    }
  }

  return { settings: next, changed, errors }
}

/**
 * @param {Object} settings
 * @param {String} name
 * @param {Boolean} [fallback] nilai bila fitur belum pernah diatur
 * @returns {Boolean}
 */
function isFeatureEnabled(settings, name, fallback = true) {
  const key = normalizeFeatureName(name)
  const features = settings && settings.features
  if (!key || !features || typeof features !== 'object') return fallback
  if (!(key in features)) return fallback
  return features[key] !== false
}

/** @param {String} text */
function escapePrefix(text) {
  return String(text).replace(/[|\\{}()[\]^$+*?.\-^]/g, '\\$&')
}

/**
 * Bentuk prefix yang dipakai handler untuk grup ini.
 *
 * @param {Object} settings
 * @param {RegExp|String[]|String} fallback prefix global (`global.prefix`)
 * @returns {RegExp|String[]|String} `/(?!)/` bila prefix dimatikan
 */
function resolvePrefix(settings, fallback) {
  const mode = settings && settings.prefix
  if (mode === PREFIX_NONE) return /(?!)/ // tidak pernah cocok
  if (!mode || mode === PREFIX_MULTI) return fallback
  return new RegExp('^[' + escapePrefix(mode) + ']')
}

/**
 * @param {Object} settings
 * @returns {String} `id` atau `en`
 */
function resolveLanguage(settings) {
  return normalizeLanguage(settings && settings.language) || DEFAULT_LANGUAGE
}

/**
 * Terjemahkan kunci pesan. Kunci yang tidak ada dikembalikan apa adanya.
 *
 * @param {String} lang
 * @param {String} key
 * @param {Object} [params] pengganti `{nama}`
 * @returns {String}
 */
function translate(lang, key, params) {
  const table = MESSAGES[normalizeLanguage(lang)] || MESSAGES[DEFAULT_LANGUAGE]
  const template = table[key] !== undefined ? table[key] : MESSAGES[DEFAULT_LANGUAGE][key]
  if (template === undefined) return String(key)
  const values = params && typeof params === 'object' ? params : {}
  return String(template).replace(/\{(\w+)\}/g, (all, name) =>
    values[name] === undefined ? all : String(values[name]))
}

/**
 * Pesan untuk `global.dfail`; string kosong bila tipe tidak dikenal.
 *
 * @param {String} type
 * @param {String} [lang]
 * @returns {String}
 */
function failMessage(type, lang) {
  const key = String(type == null ? '' : type)
  const has = MESSAGES[normalizeLanguage(lang) || DEFAULT_LANGUAGE][key] !== undefined ||
    MESSAGES[DEFAULT_LANGUAGE][key] !== undefined
  return has ? translate(lang, key) : ''
}

module.exports = {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  PREFIX_MULTI,
  PREFIX_NONE,
  FEATURES,
  FEATURES_EN,
  FEATURE_NAMES,
  normalizeLanguage,
  normalizePrefix,
  normalizeFeatureName,
  toBoolean,
  createSettings,
  updateSettings,
  isFeatureEnabled,
  resolvePrefix,
  resolveLanguage,
  translate,
  failMessage,
}
