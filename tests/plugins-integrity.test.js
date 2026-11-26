const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const AKAR = path.join(__dirname, '..')
const FOLDER_PLUGIN = path.join(AKAR, 'plugins')

function kumpulkanBerkas(dir, hasil = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      kumpulkanBerkas(target, hasil)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) hasil.push(target)
  }
  return hasil
}

const berkasPlugin = kumpulkanBerkas(FOLDER_PLUGIN)

test('folder plugins bisa ditelusuri dan berisi seluruh plugin', () => {
  assert.ok(berkasPlugin.length > 200, 'berkas plugin ditemukan: ' + berkasPlugin.length)
})

test('setiap berkas plugin bisa di-require tanpa melempar error', () => {
  const gagal = []
  for (const berkas of berkasPlugin) {
    try {
      require(berkas)
    } catch (e) {
      gagal.push(path.relative(AKAR, berkas) + ' :: ' + String(e.message).split('\n')[0])
    }
  }
  assert.deepEqual(gagal, [], 'plugin gagal dimuat:\n' + gagal.join('\n'))
})

test('setiap require relatif di plugins/ menunjuk berkas yang benar-benar ada', () => {
  const rusak = []
  for (const berkas of berkasPlugin) {
    const isi = fs.readFileSync(berkas, 'utf8')
    for (const cocok of isi.matchAll(/require\(\s*['"](\.[^'"]*)['"]\s*\)/g)) {
      const tujuan = path.resolve(path.dirname(berkas), cocok[1])
      const ada = [
        tujuan,
        tujuan + '.js',
        path.join(tujuan, 'index.js'),
        path.join(tujuan, 'package.json'),
      ].some(kandidat => fs.existsSync(kandidat))
      if (!ada) rusak.push(path.relative(AKAR, berkas) + " -> require('" + cocok[1] + "')")
    }
  }
  assert.deepEqual(rusak, [], 'require relatif rusak:\n' + rusak.join('\n'))
})
