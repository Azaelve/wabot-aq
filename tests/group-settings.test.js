const test = require('node:test')
const assert = require('node:assert/strict')
const {
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
} = require('../lib/group-settings')

test('normalizeLanguage menerima kode dan nama bahasa', () => {
  assert.equal(normalizeLanguage('id'), 'id')
  assert.equal(normalizeLanguage('  ID-ID '), 'id')
  assert.equal(normalizeLanguage('Bahasa Indonesia'), 'id')
  assert.equal(normalizeLanguage('en'), 'en')
  assert.equal(normalizeLanguage('English'), 'en')
  assert.equal(normalizeLanguage('ja'), null)
  assert.equal(normalizeLanguage(''), null)
  assert.equal(normalizeLanguage(undefined), null)
})

test('normalizePrefix membedakan mode multi, tanpa prefix, dan karakter', () => {
  assert.equal(normalizePrefix('multi'), 'multi')
  assert.equal(normalizePrefix('DEFAULT'), 'multi')
  assert.equal(normalizePrefix('none'), 'none')
  assert.equal(normalizePrefix('off'), 'none')
  assert.equal(normalizePrefix('!'), '!')
  assert.equal(normalizePrefix(' #$ '), '#$')
  assert.equal(normalizePrefix(''), null)
  assert.equal(normalizePrefix('spasi spasi'), null)
})

test('toBoolean mengenali nilai on/off umum dan mengembalikan null untuk sisanya', () => {
  assert.equal(toBoolean(true), true)
  assert.equal(toBoolean('on'), true)
  assert.equal(toBoolean('NYALA'), true)
  assert.equal(toBoolean('0'), false)
  assert.equal(toBoolean('mati'), false)
  assert.equal(toBoolean('kadang'), null)
  assert.equal(toBoolean(undefined), null)
})

test('createSettings mengisi bawaan dan membuang isian rusak', () => {
  assert.deepEqual(createSettings(), { features: {}, prefix: 'multi', language: 'id' })
  assert.deepEqual(createSettings(null), { features: {}, prefix: 'multi', language: 'id' })
  assert.deepEqual(
    createSettings({ features: { antilink: false, ngawur: false, simi: 'ya' }, prefix: '#', language: 'en' }),
    { features: { antilink: false }, prefix: '#', language: 'en' }
  )
  assert.deepEqual(createSettings({ prefix: 'bukan prefix', language: 'xx' }), { features: {}, prefix: 'multi', language: 'id' })
})

test('createSettings idempoten', () => {
  const once = createSettings({ features: { antilink: true }, prefix: '!', language: 'en' })
  assert.deepEqual(createSettings(once), once)
})

test('updateSettings mengganti prefix dan bahasa tanpa mengubah objek lama', () => {
  const old = createSettings({ features: { antilink: false } })
  const { settings, changed, errors } = updateSettings(old, { prefix: '/', language: 'en' })
  assert.equal(changed, true)
  assert.deepEqual(errors, [])
  assert.equal(settings.prefix, '/')
  assert.equal(settings.language, 'en')
  assert.deepEqual(settings.features, { antilink: false })
  assert.equal(old.prefix, 'multi')
  assert.equal(old.language, 'id')
})

test('updateSettings tidak menandai perubahan bila nilainya sama', () => {
  const old = createSettings({ prefix: '!', language: 'en' })
  const { changed, errors } = updateSettings(old, { prefix: '!', language: 'en' })
  assert.equal(changed, false)
  assert.deepEqual(errors, [])
})

test('updateSettings melaporkan nilai tidak valid tanpa mengubah apa pun', () => {
  const old = createSettings({ prefix: '!', language: 'id' })
  const { settings, changed, errors } = updateSettings(old, { prefix: 'dua kata', language: 'xx' })
  assert.equal(changed, false)
  assert.deepEqual(errors, [
    { field: 'prefix', value: 'dua kata' },
    { field: 'language', value: 'xx' },
  ])
  assert.deepEqual(settings, old)
})

test('updateSettings mengatur dan membalik saklar fitur', () => {
  let result = updateSettings(createSettings(), { feature: 'AntiLink', enabled: false })
  assert.equal(result.changed, true)
  assert.equal(result.settings.features.antilink, false)

  result = updateSettings(result.settings, { feature: 'antilink' })
  assert.equal(result.changed, true)
  assert.equal(result.settings.features.antilink, true)

  result = updateSettings(result.settings, { feature: 'antilink' })
  assert.equal(result.settings.features.antilink, false)
})

test('updateSettings menolak nama fitur asing', () => {
  const { settings, changed, errors } = updateSettings(createSettings(), { feature: 'ngawur', enabled: false })
  assert.equal(changed, false)
  assert.deepEqual(errors, [{ field: 'feature', value: 'ngawur' }])
  assert.deepEqual(settings.features, {})
})

test('FEATURES mencakup semua nama dengan label dua bahasa', () => {
  for (const [name, label] of Object.entries(FEATURES)) {
    assert.match(name, /^[a-z]+$/)
    assert.equal(typeof label.id, 'string')
    assert.equal(typeof label.en, 'string')
  }
})

test('isFeatureEnabled hanya dimatikan oleh nilai false', () => {
  assert.equal(isFeatureEnabled(createSettings(), 'antilink'), true)
  assert.equal(isFeatureEnabled({ features: { antilink: false } }, 'antilink'), false)
  assert.equal(isFeatureEnabled({ features: { antilink: true } }, 'antilink'), true)
  assert.equal(isFeatureEnabled({}, 'antilink'), true)
  assert.equal(isFeatureEnabled(null, 'simi'), true)
})

test('resolvePrefix mengikuti pengaturan grup', () => {
  const global = /^[./!]/
  assert.equal(resolvePrefix({ prefix: 'multi' }, global), global)
  assert.equal(resolvePrefix({}, global), global)

  const none = resolvePrefix({ prefix: 'none' }, global)
  assert.ok(none instanceof RegExp)
  assert.equal(none.exec('.ping'), null)

  const custom = resolvePrefix({ prefix: '!' }, global)
  assert.ok(custom.test('!ping'))
  assert.equal(custom.exec('.ping'), null)
})

test('resolvePrefix meloloskan karakter khusus regex', () => {
  for (const prefix of ['.', '*', '^', '-', '+', '(', '[', '\\']) {
    const re = resolvePrefix({ prefix }, /^[.]/)
    assert.ok(re.test(prefix + 'ping'), 'prefix ' + prefix)
    assert.equal(re.exec('ping'), null, 'prefix ' + prefix)
  }
})

test('resolveLanguage selalu memberi bahasa yang didukung', () => {
  assert.equal(resolveLanguage({ language: 'en' }), 'en')
  assert.equal(resolveLanguage({ language: 'xx' }), 'id')
  assert.equal(resolveLanguage(null), 'id')
})

test('translate memakai bahasa yang diminta dan mengganti parameter', () => {
  assert.match(translate('id', 'settings_saved', { key: 'prefix', value: '!' }), /prefix.*!/)
  assert.match(translate('en', 'settings_saved', { key: 'prefix', value: '!' }), /prefix.*!/)
  assert.match(translate('en', 'settings_usage', { prefix: '.' }), /\.grup/)
  assert.equal(translate('id', 'tidak_ada'), 'tidak_ada')
  assert.equal(translate('xx', 'owner'), translate('id', 'owner'))
})

test('failMessage mengosongkan tipe yang tidak dikenal', () => {
  assert.match(failMessage('staff', 'id'), /Staff Bot/)
  assert.match(failMessage('staff', 'en'), /Bot Staff/)
  assert.equal(failMessage('entah', 'id'), '')
  assert.equal(failMessage(undefined, 'id'), '')
})
