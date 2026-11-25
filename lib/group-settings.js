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

const DEFAULT_LANGUAGE = 'id'
const PREFIX_MULTI = 'multi'
const PREFIX_NONE = 'none'

const LANGUAGE_CODES = {
  id: 'id',
  ind: 'id',
  indonesia: 'id',
  'id-id': 'id',
  bahasa: 'id',
  'bahasa indonesia': 'id',
  en: 'en',
  eng: 'en',
  english: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  inggris: 'en',
}

const MULTI_ALIASES = ['multi', 'default']
const NONE_ALIASES = ['none', 'off', 'tanpa']
const TRUE_ALIASES = ['on', 'true', '1', 'ya', 'yes', 'aktif', 'nyala']
const FALSE_ALIASES = ['off', 'false', '0', 'tidak', 'no', 'mati']

/**
 * Fitur yang boleh diubah, dengan label per bahasa.
 * Hanya fitur yang benar-benar dipakai plugin (`handler.feature`).
 */
const FEATURES = {
  antilink: { id: 'Tolak tautan grup', en: 'Reject group links' },
  antisticker: { id: 'Tolak stiker', en: 'Reject stickers' },
  antispam: { id: 'Peringatan spam', en: 'Spam warnings' },
  antivirus: { id: 'Bersihkan pesan rusak', en: 'Clean broken messages' },
  antitroli: { id: 'Peringatan bug troli', en: 'Troli bug warnings' },
  simi: { id: 'Balasan Simi', en: 'Simi replies' },
}

const FEATURE_NAMES = Object.keys(FEATURES)

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
    settings_features_label: 'Fitur',
    settings_feature_word: 'fitur',
    settings_saved: '*{key}* diatur ke *{value}*',
    settings_unchanged: '*{key}* tidak berubah',
    settings_usage: 'Format salah. Contoh:\n\n*{prefix}grup* — lihat pengaturan\n*{prefix}grup prefix !* — ganti prefix\n*{prefix}grup prefix none* — tanpa prefix\n*{prefix}grup prefix multi* — kembali ke prefix bawaan\n*{prefix}grup bahasa id* / *en* — ganti bahasa\n*{prefix}grup fitur antilink off* — matikan fitur\n*{prefix}grup fitur antilink* — balikkan saklar\n*{prefix}grup reset* — kembalikan semua',
    settings_unknown_feature: 'Fitur *{value}* tidak dikenal. Pilihan: {list}',
    settings_bad_value: 'Nilai *{value}* tidak valid untuk *{key}*.',
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
    settings_features_label: 'Features',
    settings_feature_word: 'feature',
    settings_saved: '*{key}* is set to *{value}*',
    settings_unchanged: '*{key}* is unchanged',
    settings_usage: 'Wrong format. Examples:\n\n*{prefix}grup* — show settings\n*{prefix}grup prefix !* — change prefix\n*{prefix}grup prefix none* — no prefix\n*{prefix}grup prefix multi* — back to the default prefix\n*{prefix}grup bahasa id* / *en* — change language\n*{prefix}grup fitur antilink off* — disable a feature\n*{prefix}grup fitur antilink* — toggle a feature\n*{prefix}grup reset* — restore everything',
    settings_unknown_feature: 'Unknown feature *{value}*. Options: {list}',
    settings_bad_value: '*{value}* is not a valid *{key}*.',
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
  return LANGUAGE_CODES[text] || null
}

/**
 * Prefix tidak boleh kosong atau mengandung spasi; selain itu bebas.
 * @param {*} value
 * @returns {String|null} `multi`, `none`, karakter prefix, atau null bila tidak valid
 */
function normalizePrefix(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text || /\s/.test(text)) return null
  const lower = text.toLowerCase()
  if (MULTI_ALIASES.includes(lower)) return PREFIX_MULTI
  if (NONE_ALIASES.includes(lower)) return PREFIX_NONE
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
  const raw = source.features && typeof source.features === 'object' ? source.features : {}
  const features = {}
  for (const name of FEATURE_NAMES) {
    if (typeof raw[name] === 'boolean') features[name] = raw[name]
  }
  return {
    features,
    prefix: normalizePrefix(source.prefix) || PREFIX_MULTI,
    language: normalizeLanguage(source.language) || DEFAULT_LANGUAGE,
  }
}

/**
 * Terapkan satu perubahan pada pengaturan dan kembalikan objek baru.
 *
 * `enabled` harus boolean; bila tidak diberikan, saklar fitur dibalik.
 * Isian yang tidak valid tidak mengubah apa pun dan dilaporkan di `errors`
 * sebagai `{ field, value }` dengan `field` = `prefix`, `language`, atau `feature`.
 *
 * @param {Object} settings pengaturan lama
 * @param {Object} [patch] `{ prefix, language, feature, enabled }`
 * @returns {{ settings: Object, changed: Boolean, errors: Object[] }}
 */
function updateSettings(settings, patch) {
  const current = createSettings(settings)
  const next = { ...current, features: { ...current.features } }
  const changes = patch && typeof patch === 'object' ? patch : {}
  const errors = []
  let changed = false

  if (changes.prefix !== undefined) {
    const prefix = normalizePrefix(changes.prefix)
    if (prefix === null) errors.push({ field: 'prefix', value: changes.prefix })
    else if (prefix !== next.prefix) {
      next.prefix = prefix
      changed = true
    }
  }

  if (changes.language !== undefined) {
    const language = normalizeLanguage(changes.language)
    if (language === null) errors.push({ field: 'language', value: changes.language })
    else if (language !== next.language) {
      next.language = language
      changed = true
    }
  }

  if (changes.feature !== undefined) {
    const name = normalizeFeatureName(changes.feature)
    if (!name) errors.push({ field: 'feature', value: changes.feature })
    else {
      const enabled = changes.enabled === undefined ? !next.features[name] : changes.enabled === true
      if (next.features[name] !== enabled) {
        next.features[name] = enabled
        changed = true
      }
    }
  }

  return { settings: next, changed, errors }
}

/**
 * @param {Object} settings
 * @param {String} name nama fitur kanonik (lihat `FEATURES`)
 * @returns {Boolean} true kecuali grup mematikan fitur itu
 */
function isFeatureEnabled(settings, name) {
  return !(settings && settings.features && settings.features[name] === false)
}

/** @param {String} text */
function escapePrefix(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
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
  if (MESSAGES[DEFAULT_LANGUAGE][key] === undefined) return ''
  return translate(lang, key)
}

module.exports = {
  FEATURES,
  normalizeLanguage,
  normalizePrefix,
  toBoolean,
  createSettings,
  updateSettings,
  isFeatureEnabled,
  resolvePrefix,
  resolveLanguage,
  translate,
  failMessage,
}
