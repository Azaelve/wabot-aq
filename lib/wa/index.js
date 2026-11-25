/**
 * Titik masuk lapisan WhatsApp.
 * Menyambungkan socket Baileys 7 ke antarmuka `LegacyClient` yang dipakai
 * handler dan plugin, tanpa mereka tahu versi Baileys di baliknya.
 */
const baileys = require('baileys')
const { createClient } = require('./client')
const { LegacyClient } = require('./legacy')
const { smsg, toLegacyMessage } = require('./normalize')

/**
 * Bentuk payload call lama agar handler.onCall tetap bekerja.
 * @param {Object} call
 */
function legacyCallNode(call) {
  const from = call.from || call.chatId || ''
  return ['action', 'call', [['call', { from }, [['offer', { 'call-id': call.id || '' }]]]]]
}

/**
 * Sambungkan bot ke WhatsApp.
 * @param {Object} options { phone, authDir, logger, onQR, onPairingCode }
 * @returns {Promise<LegacyClient>}
 */
async function connect(options = {}) {
  const { sock, phone, requestPairingCode, getPairingCode } = await createClient(options)
  const logger = options.logger || console
  const conn = new LegacyClient(sock, { logger })
  conn.requestPairingCode = requestPairingCode
  conn.getPairingCode = getPairingCode

  sock.ev.on('connection.update', update => {
    const { connection, qr, lastDisconnect } = update
    if (qr && !phone && options.onQR) options.onQR(qr)
    if (connection === 'open') {
      const user = sock.user || {}
      conn.user = {
        jid: baileys.jidNormalizedUser(user.id || ''),
        name: user.name || '',
        phone: {},
      }
      conn.emit('open')
    } else if (connection === 'close') {
      const status = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : undefined
      conn.emit('close', status)
    }
  })

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const raw of messages || []) {
      if (!raw.message) continue
      const m = smsg(conn, toLegacyMessage(raw))
      if (!conn.chats.has(m.chat)) conn.chats.set(m.chat, { metadata: undefined })
      conn.emit('chat-update', {
        jid: m.chat,
        hasNewMessage: true,
        count: 1,
        messages: { all: () => [m] },
      })
    }
  })

  sock.ev.on('group-participants.update', ({ id, participants, action }) => {
    conn.emit('group-participants-update', { jid: id, participants: participants || [], action })
  })

  sock.ev.on('call', calls => {
    for (const call of calls || []) conn.emit('CB:action,,call', legacyCallNode(call))
  })

  sock.ev.on('messages.update', updates => {
    for (const { key, update } of updates || []) {
      const protocol = update && update.message && update.message.protocolMessage
      if (protocol && protocol.type === 0) {
        conn.emit('message-delete', {
          key: protocol.key || key,
          participant: (protocol.key && protocol.key.participant) || key.participant,
          message: update.message,
        })
      }
    }
  })

  // Kode pairing diminta setelah socket siap; kalau gagal, coba lagi saat QR muncul.
  if (phone) {
    setTimeout(() => { requestPairingCode().catch(() => { }) }, 1500)
  }

  return conn
}

module.exports = { connect, LegacyClient }
