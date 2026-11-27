/**
 * WhatsApp Sound Sticker (Stiker Bersuara) Engine
 * Handles audio extraction, WhatsApp Opus conversion, proto assembly, and sending.
 * @module lib/stickerSound
 *
 * ADAPTASI wabot-aq (2026-11-27) — engine asli dikirim Muhammad; yang diubah
 * agar cocok dengan repo ini (jangan kembalikan ke bentuk asli tanpa cek):
 * 1. `require('../config')` DIHAPUS: config.js wabot tidak punya botName /
 *    ownerName. Packname/author diambil dari global.packname/global.author
 *    (lib/exif.json, fallback 'I hope you\'re fine' / 'Nurutomo' seperti
 *    config.js), bisa di-override lewat options.
 * 2. `createSticker / convertVideoToWebp / convertImageToWebp /
 *    isValidWebpBuffer` dari './sticker' TIDAK ADA di lib/sticker.js wabot
 *    (yang ada hanya `sticker(img, url, packname, author)` + sticker1-4).
 *    Visual stiker dibuat lewat `sticker(mediaBuffer, false, packname,
 *    author)` — pola yang sama dipakai plugins/sticker/sticker.js.
 * 3. Batas durasi disamakan dengan lib/sticker-audio.js: maks 10 detik
 *    (engine asli: 12 dtk extract / 15 dtk convert). Batas ukuran tetap
 *    divalidasi di plugin lewat checkSize (30 MiB).
 * 4. Temp file tetap di os.tmpdir() (Termux: /data/data/com.termux/files/usr/tmp,
 *    terverifikasi bisa ditulis). ffmpeg 9.1 tersedia di HP.
 * 5. Baileys 7.0.0-rc14 terverifikasi: proto, prepareWAMessageMedia,
 *    generateMessageIDV2 ada; socket mentah (conn.sock) punya
 *    waUploadToServer + relayMessage sesuai deklarasi WASocket.
 * 6. parseDurationFromOutput ikut di-export supaya bisa dites tanpa jaringan.
 * 7. PERBAIKAN 2026-11-27 (stiker sampai tanpa lagu — lihat
 *    ~/workspace/wabot-saudio-nosound-handoff.md):
 *    a. Baileys 7.0.0-rc14 TIDAK punya StickerMessage.audioMessage (field
 *       26): penempelan audioMessage di buildSoundStickerMessage dulu
 *       DIBUANG diam-diam saat encode (terbukti roundtrip 38 byte).
 *       Field itu kini ditambahkan ke node_modules/baileys/WAProto oleh
 *       scripts/patch-baileys-sound-sticker.js (cermin AunuBaileys 2.7.0,
 *       yang WAProto-nya sudah berisi field 26; script dipasang sebagai
 *       postinstall karena node_modules di-gitignore).
 *    b. Stiker WebP kini membawa "sound-sha256" di EXIF (hash SHA-256
 *       audio) lewat addSoundSha256ToStickerWebP di bawah — hash inilah
 *       yang dipakai klien penerima untuk memasangkan stiker & suara.
 *       Beda dengan AunuBaileys yang MENGGANTI seluruh EXIF: di sini meta
 *       pack yang sudah ditulis sticker() DIPERTAHANKAN (digabung), karena
 *       lib/sticker-exif.js sudah menyediakan parseExif/buildExif.
 *    c. Durasi audio kini diteruskan eksplisit sebagai `seconds` ke
 *       prepareWAMessageMedia (sebelumnya mengandalkan tebakan durasi
 *       Baileys yang gagal diam-diam bila ffprobe bermasalah), dan
 *       durasi klip <1 detik tidak lagi dibulatkan ke atas jadi 1 detik.
 *    d. Catatan StikSound (SilverFeit/StikSound, dipelajari 2026-11-27):
 *       repo itu TIDAK mengirim stiker via bot/API — ia mengekspor MP4
 *       persegi dan stiker bersuara hanya jadi lewat impor manual di
 *       WhatsApp Android Beta (Create +). Jadi rute field-26 + EXIF di
 *       sini adalah protokol TIDAK RESMI; apakah suara diputar tergantung
 *       klien penerima. Rencana B bila tetap bisu: bot mengirim MP4
 *       persegi, pengguna membuat stiker bersuara sendiri lewat Beta.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { proto } = require('baileys');
// PENTING: panggil sebagai metode (stickerLib.sticker(...)), BUKAN destructuring.
// sticker() di lib/sticker.js memakai `this.support`, jadi pemanggilan
// sebagai fungsi bebas (`const { sticker } = ...; sticker(...)`) gagal dengan
// "Cannot read properties of undefined (reading 'ffmpeg')" — terverifikasi
// langsung di HP 2026-11-27 (method-call OK -> RIFF/WEBP, destructured FAIL).
const stickerLib = require('./sticker');

const execFileAsync = promisify(execFile);

/** Batas durasi audio stiker (detik) — sama dengan lib/sticker-audio.js. */
const DEFAULT_MAX_SECONDS = 10;

/** Packname/author default — sama seperti fallback di config.js. */
const DEFAULT_PACKNAME = "I hope you're fine";
const DEFAULT_AUTHOR = 'Nurutomo';

function resolvePackname(options = {}) {
  return options.packname || global.packname || DEFAULT_PACKNAME;
}

function resolveAuthor(options = {}) {
  return options.author || global.author || DEFAULT_AUTHOR;
}

/**
 * Checks whether a media buffer contains an audio stream
 * @param {Buffer} buffer Input media buffer
 * @returns {Promise<boolean>} True if media has audio stream
 */
async function hasAudioStream(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) return false;
  const tempPath = path.join(os.tmpdir(), `probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bin`);
  try {
    await fs.promises.writeFile(tempPath, buffer);
    try {
      await execFileAsync('ffmpeg', ['-i', tempPath]);
      return false;
    } catch (ffmpegErr) {
      const output = String(ffmpegErr.stderr || ffmpegErr.stdout || '');
      return /Stream #.*Audio:/i.test(output);
    }
  } catch {
    return false;
  } finally {
    try { await fs.promises.unlink(tempPath); } catch {}
  }
}

/**
 * Parses duration in seconds from FFmpeg probe output
 * @param {string} text FFmpeg output
 * @returns {number} Duration in seconds
 */
function parseDurationFromOutput(text) {
  const match = String(text || '').match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!match) return 3;
  const hours = parseFloat(match[1]) || 0;
  const mins = parseFloat(match[2]) || 0;
  const secs = parseFloat(match[3]) || 0;
  return Math.round((hours * 3600 + mins * 60 + secs) * 10) / 10;
}

/**
 * Extracts and converts audio track from a video/audio container into WhatsApp-standard Opus Ogg
 * @param {Buffer} buffer Media buffer
 * @param {object} [options]
 * @param {number} [options.maxDuration=10] Maximum seconds to extract
 * @returns {Promise<{ buffer: Buffer, duration: number, mimetype: string }>}
 */
async function extractAudioFromMedia(buffer, options = {}) {
  const maxSec = options.maxDuration || DEFAULT_MAX_SECONDS;
  const tempId = `ext_aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(os.tmpdir(), `${tempId}.bin`);
  const outputPath = path.join(os.tmpdir(), `${tempId}.ogg`);

  try {
    await fs.promises.writeFile(inputPath, buffer);

    let probeOutput = '';
    try {
      await execFileAsync('ffmpeg', ['-i', inputPath]);
    } catch (err) {
      probeOutput = String(err.stderr || '');
    }

    // Durasi dilaporkan apa adanya (batas bawah 0,1 dtk, bukan 1 dtk):
    // klip <1 dtk (mis. video 0,08 dtk) sebelumnya dibulatkan ke atas jadi
    // 1 dtk, jadi metadata `seconds` berbohong soal panjang audio.
    // StikSound mensyaratkan fragmen audio minimal 100 ms — video 0,08 dtk
    // memang di bawah batas itu, dan itu harus kelihatan di durasi.
    const duration = Math.min(maxSec, Math.max(0.1, parseDurationFromOutput(probeOutput)));

    // WhatsApp expects Ogg Opus audio: 48kHz, mono or stereo, ~32kbps
    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-t', String(maxSec),
      '-vn',
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-vbr', 'on',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      outputPath
    ];

    await execFileAsync('ffmpeg', ffmpegArgs);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to extract audio stream from media');
    }

    const oggBuffer = await fs.promises.readFile(outputPath);
    return {
      buffer: oggBuffer,
      duration,
      mimetype: 'audio/ogg; codecs=opus'
    };
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }
}

/**
 * Converts any audio buffer (MP3, WAV, M4A, etc.) into WhatsApp-standard Opus Ogg
 * @param {Buffer} buffer Input audio buffer
 * @param {object} [options]
 * @param {number} [options.maxDuration=10] Max duration seconds
 * @returns {Promise<{ buffer: Buffer, duration: number, mimetype: string }>}
 */
async function convertAudioToWhatsAppOpus(buffer, options = {}) {
  const maxSec = options.maxDuration || DEFAULT_MAX_SECONDS;
  const tempId = `opus_conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(os.tmpdir(), `${tempId}.bin`);
  const outputPath = path.join(os.tmpdir(), `${tempId}.ogg`);

  try {
    await fs.promises.writeFile(inputPath, buffer);

    let probeOutput = '';
    try {
      await execFileAsync('ffmpeg', ['-i', inputPath]);
    } catch (err) {
      probeOutput = String(err.stderr || '');
    }

    // Durasi dilaporkan apa adanya (batas bawah 0,1 dtk, bukan 1 dtk) —
    // lihat catatan yang sama di extractAudioFromMedia.
    const duration = Math.min(maxSec, Math.max(0.1, parseDurationFromOutput(probeOutput)));

    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-t', String(maxSec),
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-vbr', 'on',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      outputPath
    ];

    await execFileAsync('ffmpeg', ffmpegArgs);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to convert audio to WhatsApp Opus format');
    }

    const oggBuffer = await fs.promises.readFile(outputPath);
    return {
      buffer: oggBuffer,
      duration,
      mimetype: 'audio/ogg; codecs=opus'
    };
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }
}

/**
 * Tulis hash SHA-256 audio ke EXIF stiker WebP ("sound-sha256").
 *
 * Klien penerima memasangkan stiker dengan suaranya lewat hash ini: ia
 * mencocokkan `sound-sha256` di EXIF WebP dengan SHA-256 audio yang
 * terkirim di audioMessage (field 26). Tanpa hash ini, stiker dan audio
 * adalah dua media yang tidak terhubung — inilah separuh penyebab stiker
 * .saudio sampai tanpa lagu (separuh lainnya: field 26 yang dibuang
 * Baileys rc14 saat encode, kini dipatch lewat
 * scripts/patch-baileys-sound-sticker.js).
 *
 * Referensi: AunuBaileys 2.7.0 `addSoundSha256ToStickerWebP` — payload
 * EXIF yang sama (header TIFF little-endian + satu tag 0x5741 berisi
 * JSON `{"sound-sha256": "<hex>"}`). Perbedaan yang disengaja: Aunu
 * MENGGANTI seluruh EXIF (meta pack hilang), sedangkan di sini meta pack
 * yang sudah ditulis sticker() DIPERTAHANKAN dan digabung — memakai
 * parseExif/buildExif dari lib/sticker-exif.js (bentuk headernya sama
 * persis: 22 byte, tag 0x5741, type 7). node-webpmux sudah dipakai
 * addExif untuk semua stiker di bot ini, termasuk stiker animasi, jadi
 * tidak ada dependensi baru.
 * @param {Buffer} webpBuffer Buffer stiker WebP (boleh animasi)
 * @param {string} soundSha256Hex SHA-256 audio, hex 64 karakter
 * @returns {Promise<Buffer>} Buffer WebP baru dengan EXIF sound-sha256
 */
async function addSoundSha256ToStickerWebP(webpBuffer, soundSha256Hex) {
  if (!Buffer.isBuffer(webpBuffer) || webpBuffer.length < 12 ||
    webpBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
    webpBuffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('addSoundSha256ToStickerWebP: input harus buffer WebP (RIFF/WEBP)');
  }
  if (typeof soundSha256Hex !== 'string' || !/^[0-9a-f]{64}$/i.test(soundSha256Hex)) {
    throw new Error('addSoundSha256ToStickerWebP: soundSha256 harus hex SHA-256 (64 karakter)');
  }
  const { Image } = require('node-webpmux');
  const { parseExif, buildExif } = require('./sticker-exif');
  const image = new Image();
  await image.load(webpBuffer);
  const meta = parseExif(image.exif) || {};
  meta['sound-sha256'] = soundSha256Hex.toLowerCase();
  image.exif = buildExif(meta);
  return image.save(null);
}

/**
 * Merges video/gif visual with an audio buffer into a sound sticker WebP and Opus audio
 * @param {Buffer} mediaBuffer Input video, GIF, or image buffer
 * @param {object} [options]
 * @param {Buffer} [options.soundBuffer] Separate sound buffer (optional)
 * @param {string} [options.packname] Sticker pack name
 * @param {string} [options.author] Sticker pack publisher name
 * @param {string[]} [options.categories] Category emojis
 * @param {number} [options.maxDuration=10] Max audio seconds
 * @returns {Promise<{ sticker: Buffer, audio: Buffer|null, duration: number, isAnimated: boolean, hasSound: boolean, soundSha256: string|null, packname: string, author: string }>}
 */
async function createSoundSticker(mediaBuffer, options = {}) {
  const packname = resolvePackname(options);
  const author = resolveAuthor(options);
  const categories = options.categories || ['🔊', '🎵', '🤖'];

  let audioBuffer = null;
  let audioDuration = 3;

  // 1. Process or extract audio
  if (options.soundBuffer && Buffer.isBuffer(options.soundBuffer) && options.soundBuffer.length > 0) {
    try {
      const converted = await convertAudioToWhatsAppOpus(options.soundBuffer, options);
      audioBuffer = converted.buffer;
      audioDuration = converted.duration;
    } catch (soundErr) {
      console.warn('[SoundSticker] Failed to convert provided sound buffer:', soundErr.message);
    }
  } else {
    // Check if mediaBuffer itself has an audio track
    const hasAudio = await hasAudioStream(mediaBuffer);
    if (hasAudio) {
      try {
        const extracted = await extractAudioFromMedia(mediaBuffer, options);
        audioBuffer = extracted.buffer;
        audioDuration = extracted.duration;
      } catch (extErr) {
        console.warn('[SoundSticker] Failed to extract audio from media:', extErr.message);
      }
    }
  }

  // 2. Generate animated or static WebP sticker — via wabot's sticker()
  // (lib/sticker.js: sticker(img, url, packname, author)), dipanggil sebagai
  // metode agar `this.support` di dalamnya terisi (lihat catatan di atas).
  let stickerBuffer = await stickerLib.sticker(mediaBuffer, false, packname, author);

  // 3. Tulis SHA-256 audio ke EXIF stiker ("sound-sha256") supaya klien
  // penerima bisa memasangkan stiker dengan suaranya. Gagal menulis EXIF
  // tidak boleh menggagalkan stiker — catat warning, kirim stiker apa
  // adanya (audioMessage field 26 tetap terkirim).
  let soundSha256 = null;
  if (audioBuffer) {
    try {
      soundSha256 = crypto.createHash('sha256').update(audioBuffer).digest('hex');
      stickerBuffer = await addSoundSha256ToStickerWebP(stickerBuffer, soundSha256);
    } catch (exifErr) {
      console.warn('[SoundSticker] Gagal menulis sound-sha256 ke EXIF stiker:', exifErr.message);
      soundSha256 = null;
    }
  }

  return {
    sticker: stickerBuffer,
    audio: audioBuffer,
    duration: audioDuration,
    isAnimated: true,
    hasSound: Boolean(audioBuffer),
    soundSha256,
    packname,
    author
  };
}

/**
 * Builds a WhatsApp StickerMessage proto structure with embedded audioMessage (Field 26)
 * @param {object} params
 * @param {Buffer} params.stickerBuffer WebP sticker buffer
 * @param {Buffer} [params.audioBuffer] Opus Ogg audio buffer
 * @param {object} [params.audioMessage] Pre-uploaded AudioMessage proto
 * @param {object} [params.sock] Active Baileys socket for media uploading
 * @param {object} [params.options] Additional options
 * @param {number} [params.options.seconds] Durasi audio (detik), diteruskan
 *   eksplisit ke prepareWAMessageMedia supaya audioMessage.seconds benar
 *   (Baileys hanya menebak durasi bila seconds tidak diisi, dan tebakannya
 *   gagal diam-diam bila ffprobe bermasalah)
 * @returns {Promise<object>} Message content object { stickerMessage }
 */
async function buildSoundStickerMessage({ stickerBuffer, audioBuffer, audioMessage = null, sock = null, options = {} }) {
  if (!Buffer.isBuffer(stickerBuffer)) {
    throw new Error('Valid stickerBuffer is required to build Sound Sticker message');
  }

  const { prepareWAMessageMedia } = require('baileys');

  let uploadedAudioMessage = audioMessage;

  // Upload audio if buffer provided and socket available
  if (!uploadedAudioMessage && audioBuffer && Buffer.isBuffer(audioBuffer) && sock && typeof sock.waUploadToServer === 'function') {
    try {
      const audioSeconds = Number(options.seconds);
      const audioOpts = {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: false
      };
      // Durasi eksplisit dari engine (hasil probe ffmpeg) — jangan andalkan
      // tebakan Baileys (getAudioDuration) yang gagal diam-diam.
      if (Number.isFinite(audioSeconds) && audioSeconds > 0) audioOpts.seconds = audioSeconds;
      const audioRes = await prepareWAMessageMedia(
        audioOpts,
        {
          upload: sock.waUploadToServer,
          logger: sock.logger
        }
      );
      uploadedAudioMessage = audioRes?.audioMessage || null;
    } catch (audioUpErr) {
      console.warn('[SoundSticker] Failed to upload sticker audio:', audioUpErr.message);
    }
  }

  // Upload sticker WebP
  let stickerContent = null;
  if (sock && typeof sock.waUploadToServer === 'function') {
    const stickerRes = await prepareWAMessageMedia(
      {
        sticker: stickerBuffer,
        isAnimated: true
      },
      {
        upload: sock.waUploadToServer,
        logger: sock.logger
      }
    );
    stickerContent = stickerRes?.stickerMessage;
  }

  if (!stickerContent) {
    stickerContent = proto.Message.StickerMessage.fromObject({
      mimetype: 'image/webp',
      isAnimated: true,
      accessibilityLabel: options.accessibilityLabel || 'Sound Sticker',
      stickerSentTs: Date.now()
    });
  }

  // Attach audioMessage directly to field 26 of StickerMessage.
  // Field ini HANYA bertahan di kawat bila WAProto sudah dipatch
  // (scripts/patch-baileys-sound-sticker.js) — Baileys rc14 aslinya
  // membuangnya diam-diam saat encode (terbukti 2026-11-27).
  if (uploadedAudioMessage) {
    stickerContent.audioMessage = uploadedAudioMessage;
  }

  stickerContent.isAnimated = true;
  if (options.accessibilityLabel) {
    stickerContent.accessibilityLabel = options.accessibilityLabel;
  }

  return { stickerMessage: stickerContent };
}

/**
 * Sends a Sound Sticker to a WhatsApp chat with native proto (and optional companion audio note)
 * @param {object} sock Baileys socket instance (raw socket: conn.sock)
 * @param {string} jid Target chat JID
 * @param {object} content Sticker and sound data
 * @param {Buffer} content.sticker WebP sticker buffer
 * @param {Buffer} [content.audio] Opus Ogg audio buffer
 * @param {Buffer} [content.sound] Alias for content.audio
 * @param {object} [content.audioMessage] Pre-uploaded AudioMessage proto
 * @param {number} [content.duration] Durasi audio (detik) dari
 *   createSoundSticker — diteruskan ke buildSoundStickerMessage sebagai
 *   `seconds` supaya audioMessage.seconds benar
 * @param {boolean} [content.companionAudio=false] Send companion voice note for older WhatsApp clients
 * @param {object} [options] Baileys message options (quoted, etc.)
 * @returns {Promise<object>} Relay result
 */
async function sendSoundSticker(sock, jid, content, options = {}) {
  if (!sock) throw new Error('Active Baileys socket is required');
  if (!jid) throw new Error('Destination JID is required');

  const stickerBuf = content.sticker;
  const audioBuf = content.audio || content.sound || null;

  if (!stickerBuf || !Buffer.isBuffer(stickerBuf)) {
    throw new Error('Valid sticker buffer is required in content.sticker');
  }

  // Build the message with embedded audioMessage proto
  const messagePayload = await buildSoundStickerMessage({
    stickerBuffer: stickerBuf,
    audioBuffer: audioBuf,
    audioMessage: content.audioMessage || null,
    sock,
    options: { ...options, seconds: content.duration }
  });

  let result = null;

  // Use relayMessage with generated message ID
  if (typeof sock.relayMessage === 'function') {
    const { generateMessageIDV2 } = require('baileys');
    const msgId = options.messageId || (typeof generateMessageIDV2 === 'function' ? generateMessageIDV2(sock.user?.id) : undefined);
    result = await sock.relayMessage(jid, messagePayload, {
      ...options,
      messageId: msgId
    });
  } else if (typeof sock.sendMessage === 'function') {
    // If sock.sendMessage is used, pass sticker and audio properties
    result = await sock.sendMessage(jid, {
      sticker: stickerBuf,
      audio: audioBuf,
      isAnimated: true
    }, options);
  }

  // If companionAudio is requested (or user specifically asks for it), send audio note
  if (content.companionAudio && audioBuf && Buffer.isBuffer(audioBuf)) {
    try {
      await sock.sendMessage(jid, {
        audio: audioBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
      }, { quoted: options.quoted || result });
    } catch (compErr) {
      console.warn('[SoundSticker] Companion audio send error:', compErr.message);
    }
  }

  return result;
}

module.exports = {
  hasAudioStream,
  parseDurationFromOutput,
  extractAudioFromMedia,
  convertAudioToWhatsAppOpus,
  addSoundSha256ToStickerWebP,
  createSoundSticker,
  buildSoundStickerMessage,
  sendSoundSticker,
  DEFAULT_MAX_SECONDS
};
