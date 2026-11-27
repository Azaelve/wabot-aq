#!/usr/bin/env node
/**
 * Patch Baileys WAProto untuk stiker bersuara (.saudio).
 *
 * MASALAH (terbukti 2026-11-27, lihat ~/workspace/wabot-saudio-nosound-handoff.md):
 * Baileys 7.0.0-rc14 (terakhir di npm saat itu) TIDAK punya field 26
 * `audioMessage` di `Message.StickerMessage`. Engine lib/stickerSound.js
 * sudah menempelkan audioMessage ke stickerMessage, tapi saat relayMessage
 * meng-encode proto, protobufjs MEMBUANG field yang tidak dikenal secara
 * diam-diam (roundtrip encode->decode terbukti: 38 byte, audioMessage
 * hilang). Akibatnya stiker sampai sebagai stiker animasi yang benar, tapi
 * TANPA lagu. Selain itu stiker WebP tidak membawa hash audio di EXIF
 * ("sound-sha256") — hash inilah yang dipakai klien penerima untuk
 * memasangkan stiker dengan suaranya.
 *
 * PATCH INI (cerminan dari referensi yang terbukti):
 * - AunuBaileys 2.7.0 (@aunucore/baileys, changelog 2026-11-26,
 *   "Audio stickers: sock.sendSoundSticker(jid, content) ... StickerMessage
 *   field 26 — already in WAProto, no proto patching"): WAProto mereka
 *   SUDAH berisi audioMessage field 26 (tag 210) + helper
 *   addSoundSha256ToStickerWebP. Kode encode/decode/fromObject/toObject
 *   di bawah ini disalin dari WAProto hasil generate mereka, hanya
 *   disesuaikan namespace ($root.waproto -> $root.proto, sesuai Baileys
 *   rc14 di repo ini). Field lain milik mereka (premium field 24, emojis
 *   field 25) TIDAK ikut ditambahkan — patch ini minimal: hanya field 26.
 * - StikSound (SilverFeit/StikSound) DIPELAJARI tapi TIDAK dipakai sebagai
 *   acuan kirim: repo itu tidak mengirim stiker via bot/API sama sekali.
 *   Ia mengekspor MP4 persegi (H.264+AAC, maks 5/10 dtk) dan satu-satunya
 *   jalan jadi stiker bersuara adalah manual: unduh MP4 -> WhatsApp
 *   Android Beta -> keyboard stiker -> Create (+) -> pilih MP4 -> WhatsApp
 *   sendiri yang mengubahnya. Profil `native-sound-sticker` mereka
 *   nonaktif karena "WhatsApp no ofrece todavía una API pública para
 *   stickers con audio". Artinya: rute field-26 + EXIF di sini adalah
 *   protokol TIDAK RESMI (unofficial) — cara yang dipakai fork-fork
 *   Baileys — dan apakah suaranya diputar tergantung klien penerima
 *   (versi WhatsApp + rollout server per akun). Bila setelah patch ini
 *   suara tetap tidak bunyi di HP penerima, jalankan rencana B yang
 *   jujur: bot mengirim MP4 persegi, pengguna membuat stiker bersuara
 *   sendiri lewat Create (+) di WhatsApp Beta.
 *
 * KENAPA SCRIPT INI ADA: node_modules di-gitignore, jadi `npm install`
 * akan menghapus patch ini. Script ini idempotent (aman dijalankan
 * berulang) dan dipasang sebagai `postinstall` di package.json supaya
 * patch diterapkan lagi otomatis setiap npm install.
 *
 * CARA PAKAI: node scripts/patch-baileys-sound-sticker.js
 * (dijalankan otomatis oleh `npm install` lewat postinstall)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const MARKER = '/* wabot-patch: sound-sticker StickerMessage.audioMessage field 26 */';
const ROOT = path.join(__dirname, '..');
const JS_PATH = path.join(ROOT, 'node_modules', 'baileys', 'WAProto', 'index.js');
const DTS_PATH = path.join(ROOT, 'node_modules', 'baileys', 'WAProto', 'index.d.ts');
const PROTO_PATH = path.join(ROOT, 'node_modules', 'baileys', 'WAProto', 'WAProto.proto');

function replaceOnce(haystack, needle, replacement, what) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) throw new Error(`patch gagal: anchor tidak ditemukan (${what})`);
  if (haystack.indexOf(needle, idx + needle.length) !== -1) {
    throw new Error(`patch gagal: anchor muncul lebih dari sekali (${what})`);
  }
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

function patchIndexJs(src) {
  if (src.includes(MARKER)) return { src, changed: false };
  const start = src.indexOf('function StickerMessage(p) {');
  const end = src.indexOf('StickerMessage.prototype.toJSON', start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('patch gagal: blok StickerMessage tidak ditemukan di WAProto/index.js');
  }
  let section = src.slice(start, end);
  const before = section;

  // 1. Prototype default
  section = replaceOnce(section,
    '            StickerMessage.prototype.mediaKeyDomain = null;\n',
    '            StickerMessage.prototype.mediaKeyDomain = null;\n' +
    '            StickerMessage.prototype.audioMessage = null;\n',
    'prototype.audioMessage');

  // 2. Virtual OneOf "audio" (cermin AunuBaileys: d.audio = "audioMessage")
  section = replaceOnce(section,
    '            Object.defineProperty(StickerMessage.prototype, "_mediaKeyDomain", {\n' +
    '                get: $util.oneOfGetter($oneOfFields = ["mediaKeyDomain"]),\n' +
    '                set: $util.oneOfSetter($oneOfFields)\n' +
    '            });\n',
    '            Object.defineProperty(StickerMessage.prototype, "_mediaKeyDomain", {\n' +
    '                get: $util.oneOfGetter($oneOfFields = ["mediaKeyDomain"]),\n' +
    '                set: $util.oneOfSetter($oneOfFields)\n' +
    '            });\n' +
    '\n' +
    '            Object.defineProperty(StickerMessage.prototype, "audio", {\n' +
    '                get: $util.oneOfGetter($oneOfFields = ["audioMessage"]),\n' +
    '                set: $util.oneOfSetter($oneOfFields)\n' +
    '            });\n',
    'oneOf audio');

  // 3. encode: field 26, tag 210 (26 << 3 | 2)
  section = replaceOnce(section,
    '                if (m.mediaKeyDomain != null && Object.hasOwnProperty.call(m, "mediaKeyDomain"))\n' +
    '                    w.uint32(184).int32(m.mediaKeyDomain);\n',
    '                if (m.mediaKeyDomain != null && Object.hasOwnProperty.call(m, "mediaKeyDomain"))\n' +
    '                    w.uint32(184).int32(m.mediaKeyDomain);\n' +
    '                if (m.audioMessage != null && Object.hasOwnProperty.call(m, "audioMessage"))\n' +
    '                    $root.proto.Message.AudioMessage.encode(m.audioMessage, w.uint32(210).fork()).ldelim();\n',
    'encode audioMessage');

  // 4. decode: case 26
  section = replaceOnce(section,
    '                    case 23: {\n' +
    '                            m.mediaKeyDomain = r.int32();\n' +
    '                            break;\n' +
    '                        }\n',
    '                    case 23: {\n' +
    '                            m.mediaKeyDomain = r.int32();\n' +
    '                            break;\n' +
    '                        }\n' +
    '                    case 26: {\n' +
    '                            m.audioMessage = $root.proto.Message.AudioMessage.decode(r, r.uint32());\n' +
    '                            break;\n' +
    '                        }\n',
    'decode case 26');

  // 5. fromObject: setelah switch mediaKeyDomain, sebelum return m;
  section = replaceOnce(section,
    '                case "BOT":\n' +
    '                case 4:\n' +
    '                    m.mediaKeyDomain = 4;\n' +
    '                    break;\n' +
    '                }\n' +
    '                return m;\n',
    '                case "BOT":\n' +
    '                case 4:\n' +
    '                    m.mediaKeyDomain = 4;\n' +
    '                    break;\n' +
    '                }\n' +
    '                if (d.audioMessage != null) {\n' +
    '                    if (typeof d.audioMessage !== "object")\n' +
    '                        throw TypeError(".proto.Message.StickerMessage.audioMessage: object expected");\n' +
    '                    m.audioMessage = $root.proto.Message.AudioMessage.fromObject(d.audioMessage);\n' +
    '                }\n' +
    '                return m;\n',
    'fromObject audioMessage');

  // 6. toObject: setelah blok mediaKeyDomain
  section = replaceOnce(section,
    '                if (m.mediaKeyDomain != null && m.hasOwnProperty("mediaKeyDomain")) {\n' +
    '                    d.mediaKeyDomain = o.enums === String ? $root.proto.Message.MediaKeyDomain[m.mediaKeyDomain] === undefined ? m.mediaKeyDomain : $root.proto.Message.MediaKeyDomain[m.mediaKeyDomain] : m.mediaKeyDomain;\n' +
    '                    if (o.oneofs)\n' +
    '                        d._mediaKeyDomain = "mediaKeyDomain";\n' +
    '                }\n',
    '                if (m.mediaKeyDomain != null && m.hasOwnProperty("mediaKeyDomain")) {\n' +
    '                    d.mediaKeyDomain = o.enums === String ? $root.proto.Message.MediaKeyDomain[m.mediaKeyDomain] === undefined ? m.mediaKeyDomain : $root.proto.Message.MediaKeyDomain[m.mediaKeyDomain] : m.mediaKeyDomain;\n' +
    '                    if (o.oneofs)\n' +
    '                        d._mediaKeyDomain = "mediaKeyDomain";\n' +
    '                }\n' +
    '                if (m.audioMessage != null && m.hasOwnProperty("audioMessage")) {\n' +
    '                    d.audioMessage = $root.proto.Message.AudioMessage.toObject(m.audioMessage, o);\n' +
    '                    if (o.oneofs)\n' +
    '                        d.audio = "audioMessage";\n' +
    '                }\n',
    'toObject audioMessage');

  if (section === before) throw new Error('patch gagal: tidak ada perubahan pada blok StickerMessage');
  const patched = src.slice(0, start) + MARKER + '\n            ' + section + src.slice(end);
  return { src: patched, changed: true };
}

function patchDts(src) {
  // JANGAN pakai includes() global: string audioMessage dengan tipe yang
  // sama sudah ada di interface lain (mis. Message.audioMessage), jadi
  // pengecekan "sudah dipatch" harus dibatasi pada blok IStickerMessage
  // dan class StickerMessage saja.
  let out = src;
  let changed = false;
  // Interface IStickerMessage
  const ifaceAt = out.indexOf('interface IStickerMessage {');
  if (ifaceAt === -1) throw new Error('patch gagal: interface IStickerMessage tidak ditemukan');
  const ifaceEnd = out.indexOf('}', ifaceAt);
  let iface = out.slice(ifaceAt, ifaceEnd);
  if (!iface.includes('audioMessage?: (proto.Message.IAudioMessage|null);')) {
    iface = replaceOnce(iface,
      '            mediaKeyDomain?: (proto.Message.MediaKeyDomain|null);\n',
      '            mediaKeyDomain?: (proto.Message.MediaKeyDomain|null);\n' +
      '            audioMessage?: (proto.Message.IAudioMessage|null);\n',
      'd.ts interface audioMessage');
    changed = true;
  }
  out = out.slice(0, ifaceAt) + iface + out.slice(ifaceEnd);
  // class StickerMessage
  const classAt = out.indexOf('class StickerMessage implements IStickerMessage {');
  if (classAt === -1) throw new Error('patch gagal: class StickerMessage tidak ditemukan');
  const classEnd = out.indexOf('public static create', classAt);
  let klass = out.slice(classAt, classEnd);
  if (!klass.includes('public audioMessage?: (proto.Message.IAudioMessage|null);')) {
    klass = replaceOnce(klass,
      '            public mediaKeyDomain?: (proto.Message.MediaKeyDomain|null);\n',
      '            public mediaKeyDomain?: (proto.Message.MediaKeyDomain|null);\n' +
      '            public audioMessage?: (proto.Message.IAudioMessage|null);\n' +
      '            public audio?: "audioMessage";\n',
      'd.ts class audioMessage');
    changed = true;
  }
  out = out.slice(0, classAt) + klass + out.slice(classEnd);
  return { src: out, changed };
}

function patchProtoFile(src) {
  // Best-effort saja: file .proto tidak dieksekusi bot (yang dipakai index.js),
  // tapi biar definisi sumbernya jujur. Bila anchor tidak cocok, lewati.
  const anchor = '    optional Message.MediaKeyDomain mediaKeyDomain = 23;\n';
  if (!src.includes(anchor) || src.includes('audioMessage = 26;')) return { src, changed: false };
  const at = src.indexOf('message StickerMessage {');
  const anchorAt = src.indexOf(anchor, at);
  if (at === -1 || anchorAt === -1) return { src, changed: false };
  return {
    src: src.slice(0, anchorAt + anchor.length) +
      '    optional Message.AudioMessage audioMessage = 26;\n' +
      src.slice(anchorAt + anchor.length),
    changed: true,
  };
}

function verifyRoundtrip() {
  // Bukti patch bekerja: encode -> decode harus mempertahankan audioMessage.
  // Dijalankan di proses ini SETELAH file ditulis, jadi require memuat
  // kode yang sudah dipatch (belum pernah di-require sebelumnya di sini).
  const { proto } = require('baileys');
  const sm = proto.Message.StickerMessage.fromObject({
    mimetype: 'image/webp',
    isAnimated: true,
    audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 2, ptt: false },
  });
  const bytes = proto.Message.StickerMessage.encode(sm).finish();
  const back = proto.Message.StickerMessage.decode(bytes);
  assert.ok(back.audioMessage, 'roundtrip: audioMessage hilang setelah decode');
  assert.equal(back.audioMessage.seconds, 2, 'roundtrip: seconds tidak dipertahankan');
  assert.equal(back.audioMessage.mimetype, 'audio/ogg; codecs=opus');
  // Jalur relayMessage: pesan utuh (Message > stickerMessage) juga harus lolos.
  const full = proto.Message.encode({ stickerMessage: sm }).finish();
  const fullBack = proto.Message.decode(full);
  assert.ok(fullBack.stickerMessage && fullBack.stickerMessage.audioMessage,
    'roundtrip: audioMessage hilang di dalam Message');
  assert.equal(fullBack.stickerMessage.audioMessage.seconds, 2);
  return bytes.length;
}

function main() {
  if (!fs.existsSync(JS_PATH)) {
    console.warn('[patch-baileys-sound-sticker] baileys belum terinstall, lewati (WAProto tidak ada).');
    return;
  }
  const js = patchIndexJs(fs.readFileSync(JS_PATH, 'utf8'));
  if (js.changed) fs.writeFileSync(JS_PATH, js.src);
  console.log(`[patch-baileys-sound-sticker] WAProto/index.js: ${js.changed ? 'dipatch (field 26)' : 'sudah dipatch, dilewati'}`);

  let dtsChanged = false;
  if (fs.existsSync(DTS_PATH)) {
    const dts = patchDts(fs.readFileSync(DTS_PATH, 'utf8'));
    if (dts.changed) fs.writeFileSync(DTS_PATH, dts.src);
    dtsChanged = dts.changed;
    console.log(`[patch-baileys-sound-sticker] WAProto/index.d.ts: ${dts.changed ? 'dipatch' : 'sudah dipatch, dilewati'}`);
  } else {
    console.warn('[patch-baileys-sound-sticker] WAProto/index.d.ts tidak ada, lewati.');
  }

  if (fs.existsSync(PROTO_PATH)) {
    const p = patchProtoFile(fs.readFileSync(PROTO_PATH, 'utf8'));
    if (p.changed) fs.writeFileSync(PROTO_PATH, p.src);
    console.log(`[patch-baileys-sound-sticker] WAProto.proto: ${p.changed ? 'dipatch' : 'tidak diubah'}`);
  }

  const bytes = verifyRoundtrip();
  console.log(`[patch-baileys-sound-sticker] verifikasi roundtrip OK (StickerMessage ter-encode ${bytes} byte, audioMessage dipertahankan).`);
  void dtsChanged;
}

main();
