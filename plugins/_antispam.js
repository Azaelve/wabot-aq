const { createSpamGuard } = require('../lib/cooldown')

// 10 pesan per 10 detik masih wajar; selebihnya diberi satu peringatan per jendela.
const guard = createSpamGuard({ limit: 10, windowMs: 10000 })

module.exports = {
  async all(m) {
    if (!m.message || m.fromMe) return
    const res = guard.check(m.sender)
    if (res.blocked && res.first) m.reply('*Jangan Spam!!*')
  },
}
