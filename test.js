let fs = require('fs')
let path = require('path')
let { spawnSync } = require('child_process')

let skip = new Set(['node_modules', '.git', 'tmp', 'session'])
let dirs = new Set(['.', ...Object.values(require('./package.json').directories || {})])

/**
 * Kumpulkan seluruh berkas .js di dalam folder, termasuk subfolder
 * (mis. lib/api/routes/), tanpa menyentuh node_modules/tmp.
 * @param {String} folder
 * @param {String[]} out
 */
function walk(folder, out = []) {
  if (!fs.existsSync(folder)) return out
  for (let entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    let full = path.join(folder, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

let files = []
for (let dir of dirs) files.push(...walk(path.join(__dirname, dir)))
files = [...new Set(files)].filter(file => path.resolve(file) !== path.resolve(__filename))

let failed = []
for (let file of files) {
  console.error('Checking', path.relative(__dirname, file))
  let { status, stderr } = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (status !== 0) {
    failed.push(file)
    console.error(stderr)
  }
}

if (failed.length) {
  console.error(`\n${failed.length} file gagal diperiksa:\n` + failed.map(v => ' - ' + path.relative(__dirname, v)).join('\n'))
  process.exit(1)
}
console.log(`\nSelesai: ${files.length} file lolos syntax check`)
