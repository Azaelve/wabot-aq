const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const fetch = require('node-fetch')
const { ffmpeg } = require('./converter')
const { spawn, spawnSync } = require('child_process')

const tmp = path.join(__dirname, '../tmp')

/**
 * Cek apakah sebuah binary tersedia dengan menjalankannya sekali.
 * @param {String} cmd
 * @param {String[]} args
 */
function has(cmd, args = ['-version']) {
  try {
    const res = spawnSync(cmd, args, { stdio: 'ignore' })
    return !res.error && res.status === 0
  } catch {
    return false
  }
}

// Deteksi sekali saat modul dimuat, supaya rantai sticker memilih alat
// yang benar-benar ada di mesin ini (mis. hanya ImageMagick tanpa ffmpeg).
const ffmpegOk = has('ffmpeg', ['-version'])
const ffmpegWebpOk = ffmpegOk && (() => {
  try {
    const res = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' })
    return !res.error && String(res.stdout).includes('webp')
  } catch {
    return false
  }
})()
const magickOk = has('magick', ['-version'])
const gmOk = has('gm', ['version'])
const convertOk = has('convert', ['-version'])

/**
 * Jalankan proses dan kumpulkan stdout-nya.
 * @param {String} cmd
 * @param {String[]} args
 * @returns {Promise<Buffer>}
 */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    let cp
    try {
      cp = spawn(cmd, args)
    } catch (e) {
      return reject(e)
    }
    const out = []
    const err = []
    cp.on('error', e => {
      reject(e.code === 'ENOENT'
        ? new Error(`Perintah "${cmd}" tidak ditemukan. Pasang ImageMagick (convert) atau GraphicsMagick (gm).`)
        : e)
    })
    cp.stdout.on('data', chunk => out.push(chunk))
    cp.stderr.on('data', chunk => err.push(chunk))
    cp.on('close', code => {
      const stdout = Buffer.concat(out)
      if (code === 0 && stdout.length) return resolve(stdout)
      const msg = Buffer.concat(err).toString().trim()
      reject(new Error(msg || `"${cmd}" keluar dengan kode ${code}`))
    })
  })
}

/**
 * Perintah ImageMagick/GraphicsMagick untuk mengubah gambar menjadi webp
 * 512x512 dengan latar transparan.
 * @returns {String[]|null} pasangan [binary, ...prefix args]
 */
function imBin() {
  if (magickOk) return ['magick']
  if (gmOk) return ['gm', 'convert']
  if (convertOk) return ['convert']
  return null
}

/**
 * Image to Sticker menggunakan ImageMagick/GraphicsMagick saja.
 * Tidak butuh ffmpeg dan tidak menghubungi host mana pun.
 * @param {Buffer} img Image Buffer
 * @param {String} url Image URL
 * @returns {Promise<Buffer>} WEBP
 */
async function sticker2(img, url) {
  if (url) {
    let res = await fetch(url)
    if (res.status !== 200) throw await res.text()
    img = await res.buffer()
  }
  if (!img || !img.length) throw new Error('sticker2: tidak ada gambar untuk diubah')

  const bin = imBin()
  if (!bin) throw new Error('sticker2: ImageMagick (convert/magick) atau GraphicsMagick (gm) tidak terpasang')

  await fs.promises.mkdir(tmp, { recursive: true })
  const inp = path.join(tmp, +new Date + '-' + crypto.randomBytes(4).toString('hex') + '.img')
  try {
    await fs.promises.writeFile(inp, img)
    return await run(bin[0], [
      ...bin.slice(1),
      inp,
      '-background', 'none',
      '-resize', '512x512',
      '-gravity', 'center',
      '-extent', '512x512',
      'webp:-'
    ])
  } finally {
    await fs.promises.unlink(inp).catch(() => { })
  }
}

/**
 * Image to Sticker lewat layanan canvas daring.
 * @deprecated layanan nurutomo.herokuapp.com sudah mati; pakai sticker2/sticker4.
 */
async function sticker1() {
  throw new Error('sticker1 tidak lagi dipakai: layanan canvas daringnya sudah mati. Gunakan sticker2 (ImageMagick) atau sticker4 (ffmpeg).')
}

/**
 * Image/Video to Sticker
 * @param {Buffer} img Image/Video Buffer
 * @param {String} url Image/Video URL
 * @param {String} packname EXIF Packname
 * @param {String} author EXIF Author
 * @deprecated api.xteam.xyz sudah mati; fungsi ini tidak dipanggil oleh sticker().
 */
async function sticker3() {
  throw new Error('sticker3 tidak lagi dipakai: api.xteam.xyz sudah mati. Gunakan sticker2 (ImageMagick) atau sticker4 (ffmpeg).')
}

/**
 * Image to Sticker
 * @param {Buffer} img Image/Video Buffer
 * @param {String} url Image/Video URL
 */
async function sticker4(img, url) {
  if (url) {
    let res = await fetch(url)
    if (res.status !== 200) throw await res.text()
    img = await res.buffer()
  }
  return await ffmpeg(img, [
    '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
  ], 'jpeg', 'webp')
}

/**
 * Add WhatsApp JSON Exif Metadata
 * Taken from https://github.com/pedroslopez/whatsapp-web.js/pull/527/files
 * @param {Buffer} webpSticker 
 * @param {String} packname 
 * @param {String} author 
 * @param {String} categories 
 * @param {Object} extra 
 * @returns 
 */
async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
  const webp = require('node-webpmux') // Optional Feature
  const img = new webp.Image();
  const stickerPackId = crypto.randomBytes(32).toString('hex');
  const json = { 'sticker-pack-id': stickerPackId, 'sticker-pack-name': packname, 'sticker-pack-publisher': author, 'emojis': categories, ...extra };
  let exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  let exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  await img.load(webpSticker)
  img.exif = exif
  return await img.save(null)
}

module.exports = {
  /**
   * Image/Video to Sticker
   * @param {Buffer} img Image/Video Buffer
   * @param {String} url Image/Video URL
   * @param {...String} 
   */
  async sticker(img, url, ...args) {
    let lastError
    // Hanya alat lokal yang benar-benar ada, dan tidak ada host pihak ketiga
    // (sticker3 api.xteam.xyz sudah mati, sticker1 canvas daring juga mati).
    for (let func of [
      this.support.ffmpeg && this.support.ffmpegWebp && sticker4,
      (this.support.magick || this.support.gm || this.support.convert) && sticker2,
    ].filter(f => f)) {
      try {
        let stiker = await func(img, url, ...args)
        if (stiker.includes('WEBP')) {
          try {
            return await addExif(stiker, ...args)
          } catch (e) {
            return stiker
          }
        }
        throw stiker.toString()
      } catch (err) {
        lastError = err
      }
    }
    throw lastError || new Error('Tidak ada alat pembuat sticker yang tersedia: pasang ffmpeg atau ImageMagick/GraphicsMagick.')
  },
  sticker1,
  sticker2,
  sticker3,
  sticker4,
  addExif,
  support: {
    ffmpeg: ffmpegOk,
    ffprobe: has('ffprobe', ['-version']),
    ffmpegWebp: ffmpegWebpOk,
    convert: convertOk,
    magick: magickOk,
    gm: gmOk,
  },
}
