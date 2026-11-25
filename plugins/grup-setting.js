let {
  createSettings,
  updateSettings,
  FEATURES,
  FEATURES_EN,
  resolveLanguage,
  translate,
} = require('../lib/group-settings')

/** Baris ringkas untuk daftar pengaturan. */
function render(chat, lang) {
  let t = (key, params) => translate(lang, key, params)
  let settings = chat.settings
  let showPrefix = settings.prefix === 'multi'
    ? '(multi)'
    : settings.prefix === 'none'
      ? t('settings_prefix_chars', { value: 'none' })
      : t('settings_prefix_chars', { value: settings.prefix })
  let labels = lang === 'en' ? FEATURES_EN : FEATURES
  let lines = [
    `*${t('settings_title')}*`,
    '',
    `◦ ${t('settings_prefix_label')}: ${showPrefix}`,
    `◦ ${t('settings_language_label')}: ${settings.language}`,
    '◦ ' + (lang === 'en' ? 'Features' : 'Fitur') + ':',
  ]
  for (let name of Object.keys(FEATURES)) {
    let enabled = settings.features[name] !== false
    lines.push(`  ${enabled ? '✓' : '✗'} ${name} — ${labels[name]}`)
  }
  return lines.join('\n')
}

let handler = async (m, { usedPrefix, command, args }) => {
  let chat = global.db.data.chats[m.chat]
  chat.settings = createSettings(chat.settings)
  let lang = resolveLanguage(chat.settings)
  let t = (key, params) => translate(lang, key, params)
  let sub = (args[0] || '').toLowerCase()
  let value = (args[1] || '').trim()
  let usage = () => m.reply(t('settings_usage', { prefix: usedPrefix }))

  if (!sub || /^(list|status|show|info)$/.test(sub)) {
    return m.reply(render(chat, lang))
  }

  if (sub === 'reset') {
    chat.settings = createSettings()
    return m.reply(render(chat, resolveLanguage(chat.settings)))
  }

  let patch
  let key
  if (sub === 'prefix') {
    if (!value) return usage()
    patch = { prefix: value }
    key = 'prefix'
  } else if (['bahasa', 'language', 'lang', 'bhs'].includes(sub)) {
    if (!value) return usage()
    patch = { language: value }
    key = 'bahasa'
  } else if (['fitur', 'feature'].includes(sub)) {
    if (!value) return usage()
    patch = { feature: value, enabled: args[2] }
    key = 'fitur ' + value
  } else {
    return usage()
  }

  let result = updateSettings(chat.settings, patch)
  if (result.errors.length) {
    for (let error of result.errors) {
      if (error.startsWith('feature:')) {
        m.reply(t('settings_unknown_feature', {
          value: error.slice('feature:'.length),
          list: Object.keys(FEATURES).join(', '),
        }))
      } else if (error.startsWith('value:')) {
        m.reply(t('settings_bad_value', { key: error.slice('value:'.length), value: args[2] }))
      } else {
        m.reply(t('settings_bad_value', { key: error, value }))
      }
    }
    return
  }

  chat.settings = result.settings
  if (!result.changed.length) return m.reply(t('settings_unchanged', { key }))

  let shown
  if (key === 'prefix') {
    shown = chat.settings.prefix === 'none' ? 'none' : chat.settings.prefix
  } else if (key === 'bahasa') {
    shown = chat.settings.language
  } else {
    let name = key.slice('fitur '.length)
    shown = chat.settings.features[name] !== false ? t('settings_feature_on') : t('settings_feature_off')
  }
  m.reply(t('settings_saved', { key, value: shown }))
}

handler.help = ['grup']
handler.tags = ['group', 'owner']
handler.command = /^(grup|groupset|gsetting|setgrup)$/i
handler.group = true
handler.staff = true
handler.exp = 0

module.exports = handler
