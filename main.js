require('./config.js')
const cloudDBAdapter = require('./lib/cloudDBAdapter')
const { generate } = require('qrcode-terminal')
const syntaxerror = require('syntax-error')
const wa = require('./lib/wa')
const { promisify } = require('util')
const yargs = require('yargs/yargs')
const Readline = require('readline')
const cp = require('child_process')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')
var low
try {
  low = require('lowdb')
} catch (e) {
  low = require('./lib/lowdb')
}
const { Low, JSONFile } = low

const rl = Readline.createInterface(process.stdin, process.stdout)

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')
global.timestamp = {
  start: new Date
}
const PORT = process.env.PORT || 3000
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

global.prefix = new RegExp('^[' + (opts['prefix'] || '‎xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') ?
    new cloudDBAdapter(opts['db']) :
    new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`)
)
global.DATABASE = global.db // Backwards Compatibility

/**
 * Nomor untuk metode pairing code, mis. `node . --pairing 6285178964685`.
 * Tanpa opsi ini bot memakai QR seperti biasa.
 */
const pairingPhone = opts['pairing'] || opts['pairing-code'] || process.env.WA_PAIRING_NUMBER || ''
const authDir = opts['session'] || process.env.WA_AUTH_DIR || 'wa-auth'

global.conn = null
let conn = null

if (opts['test']) {
  // Mode uji tanpa koneksi WhatsApp: socket palsu agar plugin tetap termuat.
  const { LegacyClient } = require('./lib/wa/legacy')
  const fakeSocket = { ev: { on() { } }, sendMessage: async () => ({ key: { id: 'TEST' } }) }
  conn = new LegacyClient(fakeSocket)
  conn.user = { jid: '2219191@s.whatsapp.net', name: 'test', phone: {} }
  global.conn = conn
  rl.on('line', line => {
    conn.emit('chat-update', {
      jid: conn.user.jid,
      hasNewMessage: true,
      count: 1,
      messages: { all: () => [{ chat: conn.user.jid, sender: conn.user.jid, text: line.trim(), mtype: 'conversation', msg: {}, key: { remoteJid: conn.user.jid, fromMe: false }, reply: () => { } }] }
    })
  })
} else {
  rl.on('line', line => {
    if (process.send) process.send(line.trim())
  })
}

if (!opts['test']) setInterval(async () => {
  await global.db.write()
}, 60 * 1000) // Save every minute
if (opts['server']) require('./server')(global.conn, PORT)
// API lokal pengganti layanan yang sudah mati (lihat lib/localapi.js)
require('./lib/localapi').start(global.localAPIPort)

process.on('uncaughtException', console.error)

loadDatabase()
async function loadDatabase() {
  await global.db.read()
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = _.chain(global.db.data)
}

let isInit = true
global.reloadHandler = function () {
  let handler = require('./handler')
  if (!isInit) {
    conn.off('chat-update', conn.handler)
    conn.off('message-delete', conn.onDelete)
    conn.off('group-participants-update', conn.onParticipantsUpdate)
    conn.off('CB:action,,call', conn.onCall)
  }
  conn.welcome = 'Hai, @user!\nSelamat datang di grup @subject\n\n@desc'
  conn.bye = 'Selamat tinggal @user!'
  conn.spromote = '@user sekarang admin!'
  conn.sdemote = '@user sekarang bukan admin!'
  conn.handler = handler.handler
  conn.onDelete = handler.delete
  conn.onParticipantsUpdate = handler.participantsUpdate
  conn.onCall = handler.onCall
  conn.on('chat-update', conn.handler)
  conn.on('message-delete', conn.onDelete)
  conn.on('group-participants-update', conn.onParticipantsUpdate)
  conn.on('CB:action,,call', conn.onCall)
  if (isInit) {
    conn.on('error', console.error)
    conn.on('close', () => {
      setTimeout(async () => {
        try {
          if (!opts['test']) await startConnection()
        } catch (e) {
          console.error(e)
        }
      }, 5000)
    })
  }
  isInit = false
  return true
}

/**
 * Buka koneksi WhatsApp (pairing code atau QR) lalu pasang handler.
 */
async function startConnection() {
  conn = await wa.connect({
    phone: pairingPhone,
    authDir,
    logger: console,
    onQR: qr => generate(qr, { small: false }),
    onPairingCode: (code, phone) => {
      console.log('\n==================================================')
      console.log('  KODE PAIRING WHATSAPP untuk +' + phone)
      console.log('  ' + code)
      console.log('  Masukkan di WhatsApp > Perangkat tertaut >')
      console.log('  Tautkan dengan nomor telepon.')
      console.log('==================================================\n')
      try {
        fs.writeFileSync(path.join(__dirname, 'pairing-code.txt'), code + '\n')
      } catch (e) { }
    },
  })
  global.conn = conn
  if (opts['server']) require('./server')(global.conn, PORT)
  conn.on('open', () => {
    global.timestamp.connect = new Date
    console.log('[wa] terhubung sebagai', conn.user.jid)
  })
  global.reloadHandler()
}

if (!opts['test']) startConnection().catch(e => {
  console.error('[wa] gagal memulai koneksi:', e)
})

// Plugin Loader
let pluginFolder = path.join(__dirname, 'plugins')
let pluginFilter = filename => /\.js$/.test(filename)
global.plugins = {}
for (let filename of fs.readdirSync(pluginFolder).filter(pluginFilter)) {
  try {
    global.plugins[filename] = require(path.join(pluginFolder, filename))
  } catch (e) {
    console.error(e)
    delete global.plugins[filename]
  }
}
console.log(Object.keys(global.plugins))
global.reload = (_event, filename) => {
  if (pluginFilter(filename)) {
    let dir = path.join(pluginFolder, filename)
    if (dir in require.cache) {
      delete require.cache[dir]
      if (fs.existsSync(dir)) console.info(`re - require plugin '${filename}'`)
      else {
        console.warn(`deleted plugin '${filename}'`)
        return delete global.plugins[filename]
      }
    } else console.info(`requiring new plugin '${filename}'`)
    let err = syntaxerror(fs.readFileSync(dir), filename)
    if (err) console.error(`syntax error while loading '${filename}'\n${err}`)
    else try {
      global.plugins[filename] = require(dir)
    } catch (e) {
      console.error(e)
    } finally {
      global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
    }
  }
}
Object.freeze(global.reload)
fs.watch(path.join(__dirname, 'plugins'), global.reload)
if (opts['test']) global.reloadHandler()



// Quick Test
async function _quickTest() {
  let test = await Promise.all([
    cp.spawn('ffmpeg', ['-version']),
    cp.spawn('ffprobe', ['-version']),
    cp.spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    cp.spawn('convert', ['-version']),
    cp.spawn('magick', ['-version']),
    cp.spawn('gm', ['-version']),
  ].map(p => {
    return Promise.race([
      new Promise(resolve => {
        p.on('close', code => {
          resolve(code !== 127)
        })
      }),
      new Promise(resolve => {
        p.on('error', _ => resolve(false))
      })
    ])
  }))
  let [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm] = test
  console.log(test)
  let s = global.support = {
    ffmpeg,
    ffprobe,
    ffmpegWebp,
    convert,
    magick,
    gm
  }
  require('./lib/sticker').support = s
  Object.freeze(global.support)

  if (!s.ffmpeg) console.warn('Please install ffmpeg for sending videos (pkg install ffmpeg)')
  if (s.ffmpeg && !s.ffmpegWebp) console.warn('Stickers may not animated without libwebp on ffmpeg (--enable-ibwebp while compiling ffmpeg)')
  if (!s.convert && !s.magick && !s.gm) console.warn('Stickers may not work without imagemagick if libwebp on ffmpeg doesnt isntalled (pkg install imagemagick)')
}

_quickTest()
  .then(() => console.info('Quick Test Done'))
  .catch(console.error)
