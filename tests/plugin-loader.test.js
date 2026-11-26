const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  isPluginFile,
  toPluginKey,
  collectPluginKeys,
  loadPlugins,
  watchPlugins,
} = require('../lib/plugin-loader')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-loader-'))
}

function write(dir, relative, content = 'module.exports = 1\n') {
  const target = path.join(dir, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
  return target
}

test('isPluginFile hanya menerima berkas .js', () => {
  assert.equal(isPluginFile('menu.js'), true)
  assert.equal(isPluginFile('menu.JS'), false)
  assert.equal(isPluginFile('menu.txt'), false)
  assert.equal(isPluginFile(''), false)
  assert.equal(isPluginFile(undefined), false)
})

test('toPluginKey menormalkan pemisah path dan menolak berkas tidak relevan', () => {
  assert.equal(toPluginKey('rpg/adventure.js'), 'rpg/adventure.js')
  assert.equal(toPluginKey('./menu.js'), 'menu.js')
  assert.equal(toPluginKey('menu.js'), 'menu.js')
  assert.equal(toPluginKey('rpg/.rahasia.js'), null)
  assert.equal(toPluginKey('.rahasia.js'), null)
  assert.equal(toPluginKey('menu.txt'), null)
  assert.equal(toPluginKey(''), null)
  assert.equal(toPluginKey(null), null)
  assert.equal(toPluginKey(undefined), null)
})

test('collectPluginKeys menelusuri subfolder dan mengembalikan kunci terurut', () => {
  const dir = tempDir()
  write(dir, 'menu.js')
  write(dir, 'zodiac.js')
  write(dir, 'rpg/adventure.js')
  write(dir, 'rpg/group/party.js')
  write(dir, 'catatan.txt')
  write(dir, '.tersembunyi/rahasia.js')

  assert.deepEqual(collectPluginKeys(dir), [
    'menu.js',
    'rpg/adventure.js',
    'rpg/group/party.js',
    'zodiac.js',
  ])
})

test('collectPluginKeys mengembalikan daftar kosong untuk folder yang tidak ada', () => {
  assert.deepEqual(collectPluginKeys(path.join(tempDir(), 'tidak-ada')), [])
})

test('loadPlugins memetakan kunci relatif ke hasil require', () => {
  const dir = tempDir()
  write(dir, 'menu.js', 'module.exports = { nama: "menu" }\n')
  write(dir, 'rpg/adventure.js', 'module.exports = { nama: "adventure" }\n')

  const plugins = loadPlugins(dir)

  assert.deepEqual(Object.keys(plugins), ['menu.js', 'rpg/adventure.js'])
  assert.equal(plugins['menu.js'].nama, 'menu')
  assert.equal(plugins['rpg/adventure.js'].nama, 'adventure')
})

test('loadPlugins melewati plugin yang gagal dan melaporkannya ke onError', () => {
  const dir = tempDir()
  write(dir, 'baik.js', 'module.exports = 1\n')
  write(dir, 'rusak.js', 'throw new Error("rusak")\n')

  const gagal = []
  const plugins = loadPlugins(dir, { onError: (e, key) => gagal.push(key + ': ' + e.message) })

  assert.deepEqual(Object.keys(plugins), ['baik.js'])
  assert.deepEqual(gagal, ['rusak.js: rusak'])
})

test('loadPlugins memakai require yang disuntikkan tanpa menyentuh berkas asli', () => {
  const dir = tempDir()
  write(dir, 'menu.js')

  const diminta = []
  const plugins = loadPlugins(dir, {
    require: target => {
      diminta.push(path.basename(target))
      return { dariStub: true }
    },
  })

  assert.deepEqual(diminta, ['menu.js'])
  assert.deepEqual(plugins['menu.js'], { dariStub: true })
})

test('watchPlugins memakai pemantauan rekursif bila didukung', () => {
  const dir = tempDir()
  write(dir, 'menu.js')

  let ditutup = 0
  const hasil = watchPlugins(dir, () => { }, {
    watch: () => ({ close: () => { ditutup++ } }),
  })

  assert.equal(hasil.recursive, true)
  hasil.close()
  assert.equal(ditutup, 1)
})

test('watchPlugins mundur ke pemantauan per folder dan memberi awalan path', () => {
  const dir = tempDir()
  write(dir, 'menu.js')
  write(dir, 'rpg/adventure.js')

  const dipantau = []
  const warnAsli = console.warn
  console.warn = () => { }
  let hasil
  let pesan = null
  try {
    hasil = watchPlugins(dir, (event, key) => { pesan = { event, key } }, {
      watch: (target, a, b) => {
        if (a && a.recursive) throw new Error('rekursif tidak didukung')
        const listener = typeof a === 'function' ? a : b
        const nama = path.relative(dir, target) || '.'
        dipantau.push(nama)
        assert.equal(typeof listener, 'function')
        return { close: () => dipantau.push('tutup:' + nama) }
      },
    })
  } finally {
    console.warn = warnAsli
  }

  assert.equal(hasil.recursive, false)
  assert.deepEqual(dipantau.slice().sort(), ['.', 'rpg'])
  assert.equal(pesan, null, 'listener tidak dipanggil saat pemasangan')

  hasil.close()
  assert.equal(dipantau.filter(v => v.startsWith('tutup:')).length, 2)
})
