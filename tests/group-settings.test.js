const test = require('node:test')
const assert = require('node:assert/strict')
const {
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
  assert.equal(normalizePrefix('terlalupanjang'), null)
})

test('normalizeFeatureName tidak peka huruf besar/kecil dan menolak nama asing', () => {
  assert.equal(normalizeFeatureName('AntiLink'), 'antilink')
  assert.equal(normalizeFeatureName(' simi '), 'simi')
  assert.equal(normalizeFeatureName('ngawur'), '')
  assert.equal(normalizeFeatureName(null), '')
  assert.deepEqual(FEATURE_NAMES, Object.keys(FEATURES))
  assert.deepEqual(Object.keys(FEATURES_EN), FEATURE_NAMES)
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
  assert.deepEqual(changed, ['prefix', 'language'])
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
  assert.deepEqual(changed, [])
  assert.deepEqual(errors, [])
})

test('updateSettings melaporkan nilai tidak valid tanpa mengubah apa pun', () => {
  const old = createSettings({ prefix: '!', language: 'id' })
  const { settings, changed, errors } = updateSettings(old, { prefix: 'dua kata', language: 'xx' })
  assert.deepEqual(changed, [])
  assert.deepEqual(errors, ['prefix', 'language'])
  assert.deepEqual(settings, old)
})

test('updateSettings mengatur dan membalik saklar fitur', () => {
  let result = updateSettings(createSettings(), { feature: 'AntiLink', enabled: 'off' })
  assert.deepEqual(result.changed, ['feature:antilink'])
  assert.equal(result.settings.features.antilink, false)

  result = updateSettings(result.settings, { feature: 'antilink' })
  assert.deepEqual(result.changed, ['feature:antilink'])
  assert.equal(result.settings.features.antilink, true)

  result = updateSettings(result.settings, { feature: 'antilink' })
  assert.equal(result.settings.features.antilink, false)
})

test('updateSettings menerima banyak fitur sekaligus dan menolak nama asing', () => {
  const { settings, changed, errors } = updateSettings(createSettings(), {
    features: { simi: false, welcome: true, ngawur: true },
  })
  assert.deepEqual(settings.features, { simi: false, welcome: true })
  assert.deepEqual(changed, ['feature:simi', 'feature:welcome'])
  assert.deepEqual(errors, ['feature:ngawur'])
})

test('updateSettings menolak nilai boolean yang tidak dikenal', () => {
  const { settings, changed, errors } = updateSettings(createSettings(), { feature: 'simi', enabled: 'kadang' })
  assert.deepEqual(changed, [])
  assert.deepEqual(errors, ['value:simi'])
  assert.deepEqual(settings.features, {})
})

test('isFeatureEnabled memakai bawaan true dan hanya false yang mematikan', () => {
  assert.equal(isFeatureEnabled(createSettings(), 'antilink'), true)
  assert.equal(isFeatureEnabled({ features: { antilink: false } }, 'antilink'), false)
  assert.equal(isFeatureEnabled({ features: { antilink: true } }, 'antilink'), true)
  assert.equal(isFeatureEnabled({}, 'antilink', false), false)
  assert.equal(isFeatureEnabled(createSettings(), 'ngawur', false), false)
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
