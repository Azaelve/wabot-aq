let fetch = require('node-fetch')
let handler = async(m, { conn }) => {
  // React via socket Baileys mentah (pola downloader 2026-11-27)
  const react = async (emoji) => {
    try {
      const sock = (conn && conn.sock) || conn
      if (sock?.sendMessage) {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
      }
    } catch {}
  }
  await react('⏳')
  try {
    let url = await waifuApiUrl()
    if (!url) url = await nekosLifeUrl()
    if (!url) throw 'Error!'
    await conn.sendFile(m.chat, url, '', 'Istri kartun', m)
    await react('✅')
  } catch (e) {
    await react('❌')
    throw e
  }
}

// Sumber tambahan 2026-11-27: waifu-api fork KorryKatti (pengganti waifu.im yang tutup 24 Okt 2026).
// API: https://waifu-api-031n.onrender.com — GET /images?IncludedTags=waifu&Page=<acak>&PageSize=1
// mengembalikan {items:[{url, tags, isNsfw}]} (SFW default). 1271 gambar waifu (dicek 2026-11-27).
// Catatan: arsip ini TIDAK punya tag megumin maupun neko (hanya 25 tag) — jadi .megumin/.neko tetap nekos.life.
// Render free tier kadang cold start lambat -> timeout 15 dtk, lalu fallback ke nekos.life.
async function waifuApiUrl() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const page = 1 + Math.floor(Math.random() * 1271)
      const res = await fetch(`https://waifu-api-031n.onrender.com/images?IncludedTags=waifu&Page=${page}&PageSize=1`, { signal: controller.signal })
      if (!res.ok) return null
      const json = await res.json()
      const item = json.items && json.items[0]
      return item && item.url ? item.url : null
    } finally {
      clearTimeout(timer)
    }
  } catch { return null }
}

async function nekosLifeUrl() {
  try {
    let res = await fetch('https://nekos.life/api/v2/img/waifu')
    if (!res.ok) return null
    let json = await res.json()
    return json.url || null
  } catch { return null }
}

handler.help = ['waifu']
handler.tags = ['internet']
handler.command = /^(waifu)$/i
//MADE IN ERPAN 1140 BERKOLABORASI DENGAN BTS
//Endpoint diganti 2026-11-27: api.waifu.pics mati (DNS ENOTFOUND) -> nekos.life (bentuk respons sama: {url})
//2026-11-27: tambah waifu-api KorryKatti sebagai sumber utama, nekos.life jadi fallback
module.exports = handler
