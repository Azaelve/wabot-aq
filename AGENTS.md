# Memori Proyek — wabot-aq

Dokumen ini adalah ingatan kerja untuk sesi/agen berikutnya. Terakhir diperbarui: 2026-11-25.

## Peta Proyek

- `index.js` — supervisor: spawn `main.js`, restart saat proses keluar dengan kode != 0, IPC `reset`/`uptime`.
- `main.js` — memuat `config.js`, koneksi Baileys (`WAConnection` via `lib/simple.js`), lowdb (`database.json`), loader plugin dari `plugins/`, `global.reloadHandler()`.
- `handler.js` — router pesan: inisialisasi skema user/chat/setting, plugin `all`/`before`/perintah, statistik, `participantsUpdate`, `delete`, `onCall`.
- `config.js` — `global.owner`, `global.mods`, `global.prems`, `global.APIs`, `global.APIKeys`, nama sticker pack dari `lib/exif.json`.
- `lib/api/` — API lokal (pengganti host mati) dengan struktur modular:
  - `http.js` — helper `request`/`getHTML`/`getJSON`/`clean`/`text` (satu-satunya pemanggil `node-fetch`).
  - `errors.js` — `ApiError` + `asyncHandler`; error handler pusat di `server.js`.
  - `data/` — `games.js` (bank soal + `pick`/`question`/`family`), `regions.js` (daftar daerah).
  - `scrapers/` — `kbbi.js`, `kodepos.js`, `resep.js`, `berita.js`, `index.js`.
  - `routes/` — satu modul per kelompok endpoint (`health`, `games`, `wiki`, `sholat`, `ssweb`, `tiktok`, `kbbi`, `kodepos`, `resep`, `news`) + `index.js` sebagai registry.
  - `server.js` — `createApp()` (rakit registry + fallback 503 + error handler), `index.js` — `start()`.
- `lib/localapi.js` — facade tipis yang meneruskan ke `lib/api/` (dipakai `main.js`). Facade `lib/scrapers.js` sudah dihapus karena tidak ada pemakainya.
- `lib/simple.js` — pembungkus API Baileys (jangan diubah tanpa alasan kuat).
- `plugins/` — 1 file = 1 perintah/fitur; dimuat otomatis dan di-reload oleh `fs.watch`.
- `test.js` — syntax check seluruh file JS (`node --check`); dipakai CI.
- `server.js` — Express + QR PNG untuk argumen `--server`.

## Konvensi

- Command plugin: `handler.command` (regex/array/string), metadata `handler.help`, `handler.tags`, flag `owner`/`admin`/`group`/`limit`/`register`.
- Plugin event: `handler.all` (setiap pesan) dan `handler.before` (sebelum perintah).
- Data persisten: `global.db.data.users`, `.chats`, `.settings`, `.stats`, `.msgs`.
- `chat.delete = true` berarti **anti-delete aktif** (lihat `plugins/enable.js`, kasus `delete` dan `antidelete`).

## Bug yang Sudah Diperbaiki

1. `plugins/..js` — backdoor: menyuntik nomor owner, prefix tak terlihat (U+200E), dan `ReferenceError` palsu. **Dihapus.**
2. `handler.js` `delete()` — kondisi terbalik (`chat.delete` true malah return) + tanpa guard chat. Diperbaiki menjadi `if (!chat.delete) return`.
3. `handler.js` `participantsUpdate()` — memakai `m.reply` padahal `m` tidak ada. Diganti `this.reply(jid, text)`.
4. `handler.js` `onCall()` — `setting` dan `m` tidak terdefinisi. Sekarang membaca `global.db.data.settings[this.user.jid]` dan membalas via `this.reply`.
5. `plugins/enable.js` — `autoread` menulis `setting.anticall`; `gconly`/`grouponly` menulis `setting.jadibot`. Dipisah.
6. `plugins/afk.js` — `conn` tidak diambil dari konteks. Ditambahkan.
7. `plugins/menu.js` — `text` tanpa deklarasi. Menjadi `let text`.
8. `lib/print.js` — `user.level` pada user yang belum ada. Diberi guard.
9. `test.js` — memakai `node -c` (tidak valid) dan assertion asinkron. Ditulis ulang dengan `spawnSync(process.execPath, ['--check', file])` + exit code.
10. `config.js` — watch `lib/exif.json` dengan path relatif dan tidak memperbarui `global.packname`. Diperbaiki dengan `path.join(__dirname, ...)`.

## Status Kredensial (audit 2026-11-25)

Semua API key di `config.js` **tidak berfungsi lagi karena host-nya mati**, bukan karena key salah:

| Key | Host | Hasil |
|---|---|---|
| `d90a9e986e18778b` | api.xteam.xyz | domain parkir (`/lander`), TLS invalid |
| `zahirgans` | zahirr-web.herokuapp.com | Heroku 404 `No such app` |
| `apivinz` | api.zeks.xyz | dialihkan ke browserlingapp.com (403) |
| `pais` | pencarikode.xyz | DNS NXDOMAIN |
| `dappakntlll` | leyscoders-api.herokuapp.com | Heroku 404 `No such app` |
| — | nurutomo.herokuapp.com | Heroku 404 `No such app` |

Kredensial lain:

- Cookie JOOX di `lib/scrape_joox.js` tidak valid: endpoint `web_get_songinfo` membalas 404 (pencarian masih 200).
- `lib/gdrive.js` tidak dapat dipakai: `googleapis` tidak ada di `package.json`, `EventEmitter`/`port` tidak didefinisikan, kredensial tidak ada.
- `global.owner` hanya JID, bukan rahasia; tidak diuji (butuh sesi WhatsApp).
- GitHub Actions memakai `secrets.GITHUB_TOKEN` bawaan — aman.
- `github:melcanz/baileys` masih bisa di-resolve.

Konsekuensi: **51 file plugin** yang memakai `global.API('xteam'|'zahir'|'zeks'|'LeysCoder'|'nrtm', …)` plus `lib/sticker.js` (host langsung) akan gagal saat dipanggil sampai endpoint diganti.

## Pengganti API (dibangun 2026-11-25)

`global.APIs` di `config.js` sekarang menunjuk ke **API lokal** `http://127.0.0.1:3001` (bisa diubah lewat env `LOCAL_API_PORT`), bukan lagi ke host mati. Server dijalankan otomatis oleh `main.js` lewat `require('./lib/localapi').start()`.

Rute yang sudah ada di `lib/localapi.js`:

| Rute | Sumber | Bentuk respons |
|---|---|---|
| `/game/asahotak` | bank soal lokal (22) | `{status, result:{soal,jawaban}}` |
| `/game/tebakkata` | bank soal lokal (20) | idem (jawaban HURUF BESAR) |
| `/game/siapakahaku` | bank soal lokal (20) | idem (jawaban huruf kecil) |
| `/game/family100` | bank soal lokal (10) | `{status, soal, jawaban:[..]}` |
| `/api/wiki` | Wikipedia REST `id.wikipedia.org` | `{status, result:{status, result}}` |
| `/api/jadwalsholat` | Aladhan API | `{status, data:{string}}` |
| `/api/ssweb` | thum.io | PNG |
| `/dl/tiktok` | tikwm.com + tikloapp.com (`scrapers/tiktok.js`) | `{status, result:{name,caption,link_dl1,type,images,live}}` |
| `/dl/ig` | igexport.com (`scrapers/instagram.js`) | `{status, result:{shortcode, data:[{data,type,filename}]}}` |
| `/api/soundcloud` | api-v2.soundcloud.com (`scrapers/soundcloud.js`) | `{status, result:{total,count,tracks:[{title,user,permalink,duration_label,streams}]}}` |
| `/dl/soundcloud` | idem (segmen HLS digabung) | berkas `audio/mp4` + header `X-SoundCloud-Segments` |
| `/kbbi` | scraper `kbbi.web.id` (`lib/api/scrapers/kbbi.js`) | `{status, message:{word, list:[]}}` |
| `/kodepos` | API gratis `carikodepos.id` | `{status, result:[{province,city,subdistrict,urban,postalcode}]}` |
| `/api/resep-masak` | scraper `resepkoki.id` | `{title,thumb,url,tingkat,duration,banyak,bahan,cara}` |
| `/news/:sumber` | RSS `cnn`, `antara`, `republika`, `cnbc` | `{status, judul, tanggal, artikel, thumb, url}` |
| `/health` | — | `{status, uptime}` |

Endpoint lain membalas **503 text/plain** dengan pesan jelas (bukan menggantung ke host mati).

## Rantai Sticker (`lib/sticker.js`)

Tidak ada lagi pemanggilan host pihak ketiga. Ketersediaan alat dideteksi sekali saat modul dimuat (`spawnSync`), jadi `support.ffmpeg`/`convert`/`magick`/`gm` mencerminkan mesin yang sebenarnya.

Rantai `sticker()`:

1. `sticker4` — ffmpeg → webp 512x512 (hanya jika `ffmpeg` ada **dan** encoder webp tersedia).
2. `sticker2` — **ImageMagick/GraphicsMagick saja, tanpa ffmpeg**: `magick` → `gm convert` → `convert`, dengan `-background none -resize 512x512 -gravity center -extent 512x512 webp:-`. Bisa dari buffer maupun URL.

`sticker1` (canvas daring `nurutomo.herokuapp.com`) dan `sticker3` (`api.xteam.xyz/sticker/wm`) dibiarkan sebagai ekspor kompatibilitas tetapi **langsung melempar error** — tidak ada request jaringan. Kalau tidak ada ffmpeg dan tidak ada IM/GM, `sticker()` melempar error yang menyebut alat yang perlu dipasang.

Terverifikasi 2026-11-25 memakai ImageMagick 7.1.1 portabel tanpa ffmpeg: JPEG 300x150 dan PNG 200x400 (transparan) sama-sama menghasilkan WEBP `RIFF/WEBP` 512x512 srgba, baik lewat buffer, URL, maupun `sticker()`; berkas sementara di `tmp/` dibersihkan.

Status host lain: `meme-api.com` hidup; `some-random-api.com` 403 (Cloudflare, domain `.ml` sudah NXDOMAIN); `api.jikan.moe` v3 tidak dipakai lagi (perlu v4 + ubah bentuk data); `covid19.mathdro.id`, `islamic-api-indonesia`, `zekais-api`, `salism3api` mati/tidak dapat dihubungi.

Cara menambah pengganti: buat modul di `lib/api/routes/` yang mengekspor `{ name, path, createRouter }`, daftarkan di `lib/api/routes/index.js`, lalu uji dengan `curl` + `node test.js`. Tidak perlu menyentuh `server.js`.

## Struktur API (prinsip SOLID)

- **SRP**: tiap berkas punya satu alasan untuk berubah — data statis (`data/`), akses jaringan (`http.js`, `scrapers/`), bentuk respons HTTP (`routes/`), perakitan (`server.js`).
- **OCP**: menambah endpoint = tambah modul route + satu baris di registry; `server.js` tidak berubah.
- **LSP/ISP**: setiap modul route memenuhi kontrak yang sama (`name`, `path`, `createRouter()`), dan route hanya menerima dependensi yang dipakainya.
- **DIP**: route bergantung pada interface scraper (`../scrapers`), bukan pada `node-fetch`/`cheerio`; semua akses jaringan lewat `lib/api/http.js`.
- Error seragam: route melempar `ApiError`, satu error handler pusat memetakan status; handler async dibungkus `asyncHandler`.

## Review Setelah Commit 788c4d8 (2026-11-25)

Dibuang karena mati/tidak terpakai:

- `lib/scrapers.js` — facade lama, nol pemakai setelah `lib/api/scrapers/` ada. Dihapus.
- Ekspor `FEEDS` dari `scrapers/berita.js` dan `scrapers/index.js` — hanya dipakai internal `berita()`.
- Ekspor `USER_AGENT`/`TIMEOUT` dari `http.js` dan `port` dari `api/index.js` — tidak ada pemakai.
- Ekspor `pick`/`family100` dari `data/games.js` — internal saja (`question()`/`family()`).
- Selektor durasi spekulatif di `scrapers/resep.js` (`.single-recipe-meta, .recipe-meta, .single-recipe-time`) — selalu kosong; diganti `duration: ''` dengan komentar bahwa field-nya hanya untuk kontrak plugin.

Disatukan untuk menghapus duplikasi:

- `errors.js` menambah `requireParam(value, name)` — menggantikan pola `text(...)` + `if (!x) throw ApiError.badRequest` di 6 route.
- `errors.js` menambah `callUpstream(label, fn)` — menggantikan 7 blok `try/catch` yang semuanya mengubah error menjadi 502 dengan label yang sama.

Hasil: 13 berkas disentuh, 1 berkas dihapus, perilaku tidak berubah (17 kasus rute + 5 kasus plugin diuji ulang). `node test.js` lolos 361 file.

## Batasan / Catatan

- Bot tidak dijalankan (butuh sesi WhatsApp nyata); verifikasi hanya syntax + logika statis.
- Dependensi Baileys adalah fork lama `github:melcanz/baileys`; upgrade butuh refactor `lib/simple.js`.

## Audit Dependensi WhatsApp (2026-11-25)

`package.json` hanya punya satu pustaka WhatsApp: `"@adiwajshing/baileys": "github:melcanz/baileys"`. Tidak ada `whatsapp-web.js`, `venom-bot`, atau fork lain. Tidak ada lockfile dan `node_modules` belum terpasang.

Uji nyata (Node v26.13.1):

| Sumber | Versi | Hasil |
|---|---|---|
| `github:melcanz/baileys` | 3.5.3 | `npm install` berhasil (26 dtk, 182 paket, `prepare: tsc` membangun `lib/`), `require` ok, `WAConnection` fungsi |
| `@adiwajshing/baileys@3.5.3` (npm) | 3.5.3 | **Drop-in**: semua 17 ekspor yang dipakai `lib/simple.js` ada, `0.Base` resolve, `new WAConnection()` + `sendMessage` ok — tetapi paket **deprecated** sejak 2023 |
| `baileys` / `@whiskeysockets/baileys` | 7.0.0-rc14 | API baru (`makeWASocket`), **tidak kompatibel** dengan `lib/simple.js` 3.x |
| `@itsukichan/baileys` | 7.3.2 | idem, API baru |
| `whatsapp-web.js` | 1.34.8 | butuh Chromium/Puppeteer, API berbeda total |
| `venom-bot` | 5.3.0 | berbasis Puppeteer, API berbeda |

Kode terikat ke API 3.x: `lib/simple.js` mengimpor `lib/WAConnection/0.Base`, `DEFAULT_ORIGIN`, `MessageTypeProto`, `MediaPathMap`, `Mimetype`, `compressImage`, `getAudioDuration`; 43 file memakai `MessageType`/`WAMessageProto`/`newMessagesDB`.

Temuan tambahan: `lib/simple.js` me-`require('request')` padahal `request` tidak terdaftar di `package.json`. **Sudah diperbaiki** 2026-11-25 — lihat bagian "Perbaikan Dependensi yang Diterapkan".

## Perbaikan Dependensi yang Diterapkan (2026-11-25)

| Berkas | Perubahan |
|---|---|
| `package.json` | `@adiwajshing/baileys` → `"3.5.3"` (npm, bukan fork git; tidak perlu `tsc` saat install), `xmldom` → `@xmldom/xmldom ^0.9.12`, tambah `axios ^1.21.1`, `qs ^6.17.1`, `steno ^3.2.0` (dipakai `lib/scrape_joox.js`, `plugins/yta.js`, `lib/lowdb/adapters/TextFile.js`) |
| `lib/simple.js` | `download()`: `request().pipe()` → `got.stream()` + tunggu `finish` sungguhan, fallback `node-fetch`, berkas sementara dihapus di `finally`; impor `got` ganda dibuang |
| `plugins/artinama.js` | `request.get(cb)` → `await got(...).text()`, ditambah guard bila "arti:" tidak ada, nama di-`encodeURIComponent` |
| `lib/welcome.js` | `require('xmldom')` → `require('@xmldom/xmldom')` (API sama) |
| `lib/gdrive.js` | `EventEmitter` & `port` yang hilang ditambahkan, `googleapis` dimuat lazy dengan pesan jelas; `let` menggantung dihapus |
| `plugins/img2braille.js` | `require('img2braille')` diberi pesan jelas (paket itu butuh `canvas` native) |

`img2braille` **tidak** dimasukkan ke `package.json`: `img2braille@1.0.1` bergantung pada `canvas@^2.6.1` yang gagal dibangun (node-pre-gyp) dan menggagalkan seluruh `npm install`. Plugin memuatnya secara lazy, jadi bot tetap jalan tanpa paket itu.

`README.md` diperbarui: judul menandai fork Azaelve versi 2.6.0, URL clone/Deploy mengarah ke `Azaelve/wabot-aq`, bagian **Credit** menambahkan Azaelve sebagai pemelihara fork (kredit asli Nurutomo/Ariffb/Ftwrr tetap), dan bagian "Catatan fork ini (v2.6.0)" merangkum API lokal, scraper, perbaikan sticker/keamanan, dan perubahan dependensi.

Versi proyek dinaikkan `2.5.1` → **`2.6.0`** (perbaikan bug/keamanan + API lokal, scraper, dan penggantian dependensi). `plugins/gitclone.js` masih menyebut `v2.5.1` hanya di komentar contoh nama zip upstream — tidak perlu diubah.

Verifikasi setelah perubahan: `npm install` bersih (674 paket), `require()` berhasil untuk `lib/simple`, `lib/welcome`, `lib/gdrive`, `lib/scrape_joox`, `lib/localapi`, `lib/lowdb`, `plugins/artinama`, `plugins/img2braille`, `lib/sticker`; `plugins/artinama` diuji nyata dan mengembalikan arti nama dari primbon.com; `require('steno').Writer` menulis berkas; `lib/gdrive` melempar pesan yang jelas tanpa `googleapis`; `node test.js` lolos 327 file (jumlah saat itu; sekarang 362 setelah test.js dibuat rekursif).

## Pengganti Dependensi Usang (2026-11-25)

Dicek ke registry npm (versi terbaru + status deprecated) dan diuji `require()` nyata di Node v26.13.1.

**Wajib diganti (deprecated / tidak dirawat / tidak terdaftar):**

| Paket | Kondisi | Pengganti | Effort |
|---|---|---|---|
| `request` (dipakai `lib/simple.js:1098` sebagai stream, dan `plugins/artinama.js`) | deprecated resmi, tidak ada di `package.json` | `got.stream()` (got@11 sudah jadi dependensi) atau `axios`/`undici` | 2 file, kecil |
| `@adiwajshing/baileys` (fork melcanz) | deprecated, API 3.x | `@adiwajshing/baileys@3.5.3` npm (drop-in, terverifikasi) atau `baileys`/`@whiskeysockets/baileys@7.0.0-rc14`, `@itsukichan/baileys@7.3.2` (perlu refactor) | drop-in: 1 baris; 7.x: refactor besar |
| `xmldom@0.6.0` (`lib/welcome.js`) | tidak dirawat, ada CVE | `@xmldom/xmldom@0.9.12` — API sama (`DOMImplementation`, `XMLSerializer`), sudah diuji | 1 baris |

**Usang tapi masih CJS dan jalan — jangan asal naik mayor:** `node-fetch@2`, `got@11`, `chalk@4`, `lowdb@2`, `file-type@16`, `yargs@17`, `terminal-image@2`, `jsdom@16`. Versi terbarunya ESM-only (Node 26 bisa `require()` tapi hasilnya namespace, harus `.default`), jadi upgrade = ubah kode.

**Ada pengganti yang terverifikasi `require()`:** `colors`/`chalk` → `picocolors@1.1.1` (CJS); `human-readable` → `pretty-bytes@7` (ESM) atau `filesize` (CJS); `similarity` → `fastest-levenshtein@1.0.16` (CJS, `distance()` diuji); `url-regex` → `url-regex-safe@4.0.0` (CJS); `translate-google-api` → `google-translate-api-x@10.7.3` (CJS); `node-gtts` → `google-tts-api@2.0.2` (CJS); `g-i-s`/`google-it` → `googlethis@1.8.0` (CJS, hasil scraping rapuh); `qrcode-terminal` → `qrcode` (sudah ada) `toString({type:'terminal'})`; `syntax-error` → sudah digantikan `node --check` di `test.js`.

Aman naik mayor (masih CJS): `socket.io` 4.8.4, `cfonts` 3.3.1, `awesome-phonenumber` 7.8.0, `lodash` 4.18.1, `cheerio` 1.2.0, `nodemon` 3.1.14 (hanya dipakai skrip `npm start`). `express` 5.3.0 breaking tapi pemakaian di `server.js`/`lib/localapi.js` kecil.

Belum ada pengganti jelas: `brainly-scraper-v2` (scraper, cepat rusak bila Brainly berubah), `yt-search` (masih jalan, 2.13.1).

## Pihak Ketiga yang Masih Dibutuhkan

Bot **bisa dijalankan** tanpa layanan di bawah ini; yang mati hanya fitur terkait. Endpoint yang belum punya pengganti di `lib/localapi.js` membalas 503:

| Fitur (rute lama) | Yang diperlukan |
|---|---|
| `/videomaker/*`, `/textpro`, `/ephoto`, `/ttp`, `/attp`, `/quotemaker`, `/magernulis`, `/tahta` | Renderer lokal (ffmpeg/ImageMagick + font) **atau** layanan image-generation (Cloudinary, htmlcsstoimage, Bannerbear, APITemplate.io) |
| `/text2img` (salism3api, dipakai `glowing`/`hornycard`) | API image generation berbayar (mis. Workers AI, Stability) |
| `/dl/{igs,igstalk,ighighlight,fb,twitter,smule}`, `/download/*` | API downloader/ scraper (RapidAPI) atau `yt-dlp` dijalankan lokal |
| `/sticker/{stickerly,stickerline}`, `/api/telegram-sticker` | Telegram Bot API (`getStickerSet`) + scraping Stickerly |
| `/api/spotify`, `/game/tebaklagu`, `/api/kuis/tebakgambar` | Spotify Web API (client id/secret) atau preview iTunes; sumber gambar kuis |
| `/api/unsplash`, `/api/pinimg`, `/randomimage/*`, `/asupan/*` | Unsplash access key (gratis) / Pinterest / sumber acak |
| `/search/{grupwa,freefire}`, `/trendingtwitter` | Scraper atau API berkey (SerpAPI); sumber gratisnya tidak stabil |
| `/api/primbonjodoh` | Kalkulator primbon memakai form + JS di browser; tidak ada endpoint hasil. Perlu hitung weton sendiri atau Puppeteer |
| `/news/{detik,kompas,liputan6,tribun,jalantikus}` | Feed RSS-nya tidak bisa diakses dari server ini; yang hidup: `cnn`, `antara`, `republika`, `cnbc` (sudah dipasang) |
| `lib/gdrive.js` | Paket `googleapis` + OAuth Google (credentials.json/token.json) |
| `plugins/img2braille.js` | Paket `img2braille` + `canvas` native |

Catatan: `lib/scrape_joox.js` masih memakai cookie JOOX yang tidak valid.

## Scraper yang Sudah Dibuat (2026-11-25)

`lib/api/scrapers/` berisi empat scraper tanpa API key, dipanggil oleh modul route: `kbbi(kata)`, `kodepos(q)`, `resep(q)`, `berita(sumber)`. Semua memakai helper `lib/api/http.js` (node-fetch + cheerio, User-Agent browser, timeout 25 dtk) dan melempar pesan berbahasa Indonesia.

Situs yang dipakai: `kbbi.web.id/{kata}` (definisi di `#d1`, judul dari `<title>`), `carikodepos.id/api/postal-codes` (JSON, limit 10, diurutkan berdasarkan relevansi), `resepkoki.id` (cari `?s=` lalu halaman `.ingredients-table` + `.recipe-steps-table`), RSS berita (`item` pertama).

`plugins/news.js` sekarang menerima `cnn|antara|republika|cnbc` di samping nama lama; nama lama akan dibalas pesan jelas dari API lokal.

Diuji end-to-end lewat plugin (bukan hanya curl): `kbbi buku`, `kodepos Lamongan`, `masak nasi goreng`, `cnn`, dan `detik` (gagal dengan pesan jelas). `node test.js` lolos 328 file (saat itu); setelah `test.js` dibuat rekursif menjadi 362 file dan ikut memeriksa `lib/api/**`.
- `database.json` dan `session.data.json` dibuat saat runtime, tidak ada di repo.

## Lapisan WhatsApp (v2.7.0, Baileys 7)

`@adiwajshing/baileys` 3.5.3 sudah mati (404); penggantinya paket npm `baileys` 7.x.
Semua kode WhatsApp ada di `lib/wa/` dan tidak ada plugin yang boleh mengimpor `baileys` langsung:

- `message-type.js` — shim `MessageType`/`Presence`/`GroupSettingChange`/`WA_MESSAGE_STUB_TYPES`/`newMessagesDB`/`WAMessageProto` (nilai lama dipertahankan; impor lama sudah dialihkan ke sini).
- `content.js` — `buildContent(type, content, options)` murni: MessageType lama → konten Baileys 7.
- `normalize.js` — `normalizePhone`, `unwrapMessage`, `extractText`, `toLegacyMessage`, `smsg` (murni, diuji).
- `auth.js` — `useMultiFileAuthState` ke folder `wa-auth/` (bukan `session.data.json`).
- `client.js` — `makeWASocket` + `requestPairingCode`; logger pino dan socket injectable.
- `legacy.js` — `LegacyClient`: `sendMessage`/`sendFile`/`reply`/`sendButton`/`send2Button`/`groupMetadata`/`getProfilePicture`/`chatRead`/`relayWAMessage`/`downloadMedia`/`updateMediaMessage`.
- `chats.js` — `ChatStore extends Map`: `all()` dan `get()` yang selalu memberi `{ jid, metadata, presences, read_only }`, pengganti `ChatManager` Baileys 3.x yang dipakai plugin (`speed`, `grouplist`, `broadcast`, `leavegc`, `scan`, `online`).
- `lifecycle.js` — `detachListeners(emitter, entries)` (mengabaikan listener `undefined`) dan `reconnectDelay(attempt)` (5→10→20→…→60 dtk, maksimum 60 dtk).
- `index.js` — `connect()`; memetakan event baru (`messages.upsert`, `group-participants.update`, `messages.update`, `call`, `connection.update`) ke event lama (`chat-update`, `message-delete`, `group-participants-update`, `CB:action,,call`, `close`).

`lib/simple.js` sekarang hanya re-export `smsg`. Jalankan: `node . --pairing 6285178964685` (kode 8 karakter, juga ditulis ke `pairing-code.txt`), atau `node .` untuk QR. Tes: `npm test` = `node test.js` + `node --test tests/`.

## Uji Login Nyata (2026-11-25)

Pairing code dijalankan di VM dengan nomor `6285178964685` dan **berhasil**: `wa-auth/creds.json` menjadi `registered: true`, `me: 6285178964685:3@s.whatsapp.net`, dan bot menyambung sebagai `6285178964685@s.whatsapp.net`. Kode yang dipakai saat uji: `QV5BFVY3`.

Tiga bug yang menghalangi login berfungsi ditemukan saat uji itu dan sudah diperbaiki:

1. **Reconnect mematikan handler** — `main.js` memanggil `conn.off(event, conn.handler)` pada socket baru hasil reconnect, padahal handler-nya belum ada, sehingga muncul `ERR_INVALID_ARG_TYPE` dan handler tidak pernah terpasang lagi. Diperbaiki dengan `lib/wa/lifecycle.js` (`detachListeners`) plus pemasangan listener `error`/`close` per socket di `startConnection()` dan reconnect berjeda eksponensial dengan satu jadwal aktif.
2. **Pesan pertama crash** — `handler.js` menulis default `settings` ke `global.db.data.settings[...]` tetapi variabel `setting` tetap `undefined`, jadi `setting.nyimak` melempar `TypeError`; blok `finally` lalu menutupinya dengan error kedua di `setting.autoread`. Sekarang objek default juga ditugaskan ke `setting` dan blok `finally` dijaga (`if (setting && setting.autoread)`).
3. **`conn.chats.all is not a function`** — plugin lama memakai `ChatManager` Baileys 3.x. Ditambahkan `lib/wa/chats.js` (`ChatStore`) dan `LegacyClient` memakainya.

Verifikasi: kirim `.ping` ke chat bot sendiri → perintah dijalankan dan dibalas, `grep -c TypeError bot-run.log` = 0, `npm test` lolos **39 tes** (termasuk `tests/wa-chats.test.js` dan `tests/wa-lifecycle.test.js`).
