/**
 * Shim tipe pesan gaya Baileys 3.x.
 *
 * Plugin lama memakai `MessageType.image`, `conn.sendMessage(jid, buf, MessageType.image)`,
 * dan membandingkan `m.mtype` dengan nilai yang sama. Objek ini mempertahankan
 * nilai lama (nama field protobuf) agar perbandingan itu tetap konsisten,
 * sementara penerjemahan ke API Baileys 7 dilakukan di lib/wa/content.js.
 */

const MessageType = Object.freeze({
  text: 'conversation',
  extendedText: 'extendedTextMessage',
  image: 'imageMessage',
  video: 'videoMessage',
  audio: 'audioMessage',
  sticker: 'stickerMessage',
  document: 'documentMessage',
  contact: 'contactMessage',
  location: 'locationMessage',
  liveLocation: 'liveLocationMessage',
  buttons: 'buttonsMessage',
  list: 'listMessage',
  template: 'templateMessage',
  groupInvite: 'groupInviteMessage',
  protocol: 'protocolMessage',
  reaction: 'reactionMessage',
  poll: 'pollCreationMessage',
})

const GroupSettingChange = Object.freeze({
  announcement: 'announcement',
  notAnnouncement: 'not_announcement',
  locked: 'locked',
  unlocked: 'unlocked',
})

const Presence = Object.freeze({
  available: 'available',
  unavailable: 'unavailable',
  composing: 'composing',
  recording: 'recording',
  paused: 'paused',
})

/** Stub yang dulu dipakai lib/print.js untuk menandai pesan sistem. */
const WA_MESSAGE_STUB_TYPES = Object.freeze([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
])

/** Proto lama hanya dipakai sebagai passthrough; Baileys 7 memakai `proto` sendiri. */
const WAMessageProto = {
  WebMessageInfo: {
    fromObject: value => value,
    toObject: value => value,
  },
}

/**
 * Placeholder pengganti `newMessagesDB` (kelas internal Baileys 3.x).
 * Dipakai plugin sebagai konstruktor; tidak ada perilaku yang dibutuhkan.
 */
class newMessagesDB {
  constructor() {
    this.messages = []
  }
  all() {
    return this.messages
  }
}

module.exports = {
  MessageType,
  GroupSettingChange,
  Presence,
  WA_MESSAGE_STUB_TYPES,
  WA_MESSAGE_STUB_TYPE: WA_MESSAGE_STUB_TYPES,
  WAMessageProto,
  newMessagesDB,
}
