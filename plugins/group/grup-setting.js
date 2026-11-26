let {
  FEATURES,
  createSettings,
  updateSettings,
  isFeatureEnabled,
  resolveLanguage,
  translate,
  toBoolean,
} = require('../../lib/group-settings')

/** Daftar pengaturan grup dalam bahasa yang dipilih. */
function render(settings, lang) {
  let lines = [
    `*${translate(lang, 'settings_title')}*`,
    '',
    `◦ ${translate(lang, 'settings_prefix_label')}: ${settings.prefix}`,
    `◦ ${translate(lang, 'settings_language_label')}: ${settings.language}`,
    `◦ ${translate(lang, 'settings_features_label')}:`,
  ]
  for (let name of Object.keys(FEATURES)) {
    lines.push(`  ${isFeatureEnabled(settings, name) ? '✓' : '✗'} ${name} — ${FEATURES[name][lang]}`)
  }
  return lines.join('\n')
}

let handler = async (m, { usedPrefix, args }) => {
  let chat = global.db.data.chats[m.chat]
  chat.settings = createSettings(chat.settings)
  let lang = resolveLanguage(chat.settings)
  let t = (key, params) => translate(lang, key, params)
  let sub = (args[0] || '').trim().toLowerCase()
  let value = (args[1] || '').trim()
  let flag = (args[2] || '').trim()
  let usage = () => m.reply(t('settings_usage', { prefix: usedPrefix }))

  if (!sub) return m.reply(render(chat.settings, lang))

  if (sub === 'reset') {
    chat.settings = createSettings()
    return m.reply(render(chat.settings, resolveLanguage(chat.settings)))
  }

  // Setiap perintah mengubah satu isian, jadi satu patch dan satu label.
  let patch
  let name = ''
  let label
  if (sub === 'prefix') {
    if (!value) return usage()
    patch = { prefix: value }
    label = t('settings_prefix_label')
  } else if (sub === 'bahasa' || sub === 'language') {
    if (!value) return usage()
    patch = { language: value }
    label = t('settings_language_label')
  } else if (sub === 'fitur' || sub === 'feature') {
    if (!value) return usage()
    name = value.toLowerCase()
    let enabled = flag ? toBoolean(flag) : undefined
    if (enabled === null) {
      return m.reply(t('settings_bad_value', { key: `${t('settings_feature_word')} ${name}`, value: flag }))
    }
    patch = { feature: name, enabled }
    label = `${t('settings_feature_word')} ${name}`
  } else return usage()

  let result = updateSettings(chat.settings, patch)
  for (let error of result.errors) {
    m.reply(error.field === 'feature'
      ? t('settings_unknown_feature', { value: error.value, list: Object.keys(FEATURES).join(', ') })
      : t('settings_bad_value', { key: error.field, value: error.value }))
  }
  if (result.errors.length) return

  chat.settings = result.settings
  if (!result.changed) return m.reply(t('settings_unchanged', { key: label }))

  let shown
  if (sub === 'prefix') shown = chat.settings.prefix
  else if (name) shown = isFeatureEnabled(chat.settings, name) ? t('settings_feature_on') : t('settings_feature_off')
  else shown = chat.settings.language
  m.reply(t('settings_saved', { key: label, value: shown }))
}

handler.help = ['grup']
handler.tags = ['group', 'owner']
handler.command = /^grup$/i
handler.group = true
handler.staff = true

module.exports = handler
