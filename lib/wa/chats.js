/**
 * Penyimpanan chat kompatibel Baileys 3.x.
 *
 * Plugin lama memakai `conn.chats.all()` dan `conn.chats.get(jid).presences`,
 * sedangkan Baileys 7 tidak menyediakan daftar chat sama sekali. Kelas ini
 * memberi bentuk data yang sama di atas `Map` biasa.
 */
class ChatStore extends Map {
  /**
   * Ambil entri chat, buat bila belum ada agar pemakaian seperti
   * `conn.chats.get(jid).presences` tidak melempar error.
   * @param {String} jid
   * @returns {Object} { jid, metadata, presences, read_only }
   */
  ensure(jid) {
    let chat = super.get(jid)
    if (!chat) {
      chat = { jid, metadata: undefined, presences: {}, read_only: false }
      super.set(jid, chat)
    } else if (!chat.jid) chat.jid = jid
    return chat
  }

  get(jid) {
    return this.ensure(jid)
  }

  /** Daftar seluruh chat, pengganti `ChatManager.all()` Baileys 3.x. */
  all() {
    return [...this.values()]
  }
}

module.exports = { ChatStore }
