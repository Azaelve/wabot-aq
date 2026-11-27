let fs = require('fs')
let path = require('path')
let chalk = require('chalk')

global.owner = ['6287761341189'] // Put your number here
global.mods = [] // Want some help?
global.staff = [] // Staff: boleh memakai perintah internal (di bawah owner, di atas mods)
global.prems = [] // Premium user has unlimited limit
// API lokal pengganti (lihat lib/localapi.js)
// Semua penyedia lama (xteam, zahir, zeks, LeysCoder, nrtm) sudah mati.
global.localAPIPort = +(process.env.LOCAL_API_PORT || 3001)
const localAPI = `http://127.0.0.1:${global.localAPIPort}`

global.APIs = { // API Prefix
  local: localAPI,
  nrtm: localAPI,
  xteam: localAPI,
  zahir: localAPI,
  zeks: localAPI,
  LeysCoder: localAPI,
  pencarikode: localAPI
}
global.APIKeys = { // APIKey Here
  [localAPI]: 'wabotlocalapikey'
}

// Sticker WM

const file_exif = path.join(__dirname, 'lib/exif.json')
function readExif() {
  let stickerpack = {}
  try {
    stickerpack = JSON.parse(fs.readFileSync(file_exif))
  } catch (e) {
    console.error(e)
  }
  global.packname = stickerpack.spackname || 'I hope you\'re fine'
  global.author = stickerpack.sauthor || 'Nurutomo'
}
readExif()

fs.watchFile(file_exif, () => {
  console.log(chalk.redBright("Update 'exif.json'"))
  readExif()
})


global.multiplier = 69 // The higher, The harder levelup


let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  delete require.cache[file]
  require(file)
})
