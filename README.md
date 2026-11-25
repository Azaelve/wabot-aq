# wabot-aq

Simple WhatsApp Bot — **fork Azaelve**, versi `2.7.0` (Baileys 7)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Azaelve/wabot-aq)

> Fork ini melanjutkan [Nurutomo/wabot-aq](https://github.com/Nurutomo/wabot-aq) yang sudah tidak dirawat sejak 27 Juni 2021.
> Semua kredit untuk kode asli tetap milik penulisnya — lihat bagian [Credit](#credit).

## FOR TERMUX/UBUNTU/SSH USER

```bash
apt update && apt upgrade
apt install git -y
apt install nodejs -y
apt install ffmpeg -y
apt install imagemagick -y
git clone https://github.com/Azaelve/wabot-aq
cd wabot-aq
npm install
npm update
```

## INSTALL ON TERMUX WITH UBUNTU

[ INSTALLING UBUNTU ]

```bash
apt update && apt full-upgrade
apt install wget curl git proot-distro
proot-distro install ubuntu
echo "proot-distro login ubuntu" > $PREFIX/bin/ubuntu
ubuntu
```
---------

[ INSTALLING REQUIRED PACKAGES ]

```bash
ubuntu
apt update && apt full-upgrade
apt install wget curl git ffmpeg imagemagick build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev dbus-x11 ffmpeg2theora ffmpegfs ffmpegthumbnailer ffmpegthumbnailer-dbg ffmpegthumbs libavcodec-dev libavcodec-extra libavcodec-extra58 libavdevice-dev libavdevice58 libavfilter-dev libavfilter-extra libavfilter-extra7 libavformat-dev libavformat58 libavifile-0.7-bin libavifile-0.7-common libavifile-0.7c2 libavresample-dev libavresample4 libavutil-dev libavutil56 libpostproc-dev libpostproc55 graphicsmagick graphicsmagick-dbg graphicsmagick-imagemagick-compat graphicsmagick-libmagick-dev-compat groff imagemagick-6.q16hdri imagemagick-common libchart-gnuplot-perl libgraphics-magick-perl libgraphicsmagick++-q16-12 libgraphicsmagick++1-dev
```

---------

[ INSTALLING NODEJS & WABOT-AQ ]

```bash
ubuntu
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
apt install -y nodejs gcc g++ make
git clone https://github.com/Azaelve/wabot-aq
cd wabot-aq
npm install
npm update
```

---------

## FOR WINDOWS/VPS/RDP USER

* Download And Install Git [`Click Here`](https://git-scm.com/downloads)
* Download And Install NodeJS [`Click Here`](https://nodejs.org/en/download)
* Download And Install FFmpeg [`Click Here`](https://ffmpeg.org/download.html) (**Don't Forget Add FFmpeg to PATH enviroment variables**)
* Download And Install ImageMagick [`Click Here`](https://imagemagick.org/script/download.php)

```bash
git clone https://github.com/Azaelve/wabot-aq
cd wabot-aq
npm install
npm update
```

---------

## Run

```bash
node .
```

---------

## Arguments `node . [--options] [<session name>]`

### `--session <file name>`

Use another session with another name, default is ```session.data.json```

### `--prefix <prefixes>`

* `prefixes` are seperated by each character
Set prefix

### `--server`

Used for [heroku](https://heroku.com/) or scan through website

### `--db <json-server-url>`

Use external db instead of local db, 
Example Server `https://json-server.nurutomo.repl.co/`

Code: `https://repl.it/@Nurutomo/json-server`

`node . --db 'https://json-server.nurutomo.repl.co/'`

The server should have like this specification

#### GET

```http
GET /
Accept: application/json
```

#### POST

```http
POST /
Content-Type: application/json

{
 data: {}
}
```

### `--big-qr`

If small qr unicode doesn't support

### `--img`

Enable image inspector through terminal

### `--test`

**Development** Testing Mode

### `--trace`

```js
conn.logger.level = 'trace'
```

### `--debug`

```js
conn.logger.level = 'debug'
```

## Settings

Now set using switch [enable.js](https://github.com/Azaelve/wabot-aq/blob/Azl/plugins/enable.js), among others are

```js
anticall: false, // Auto Reject better than autoblock
autoread: false, // If true all chats are automatically read
nyimak: false, // No bot, just print received messages and add users to database
restrict: false, // Enables restricted plugins (which can lead your number to be banned if used too often)
self: false, // Activate self mode (Ignores other)
pconly: false, // If that chat not from private bot, bot will ignore
gconly: false, // If that chat not from group, bot will ignore
jadibot: false, 
```

---------

## Credit

[![Azaelve](https://github.com/Azaelve.png?size=100)](https://github.com/Azaelve) | [![Nurutomo](https://github.com/Nurutomo.png?size=100)](https://github.com/Nurutomo) | [![Ariffb](https://github.com/ariffb25.png?size=100)](https://github.com/ariffb25) | [![Ftwrr](https://github.com/Ftwrr.png?size=100)](https://github.com/Ftwrr)
----|----|----|----
[Azaelve](https://github.com/Azaelve) | [Nurutomo](https://github.com/Nurutomo) | [Ariffb](https://github.com/ariffb25) | [Ftwrr](https://github.com/Ftwrr)
**Pemelihara fork ini** | Author / Creator | Most Active Contributor | 2nd Most Active Contributor

- **Fork & pemeliharaan:** [Azaelve](https://github.com/Azaelve) — [Azaelve/wabot-aq](https://github.com/Azaelve/wabot-aq)
- **Kode asli:** [Nurutomo](https://github.com/Nurutomo) — [Nurutomo/wabot-aq](https://github.com/Nurutomo/wabot-aq)
- **Kontributor:** [Ariffb](https://github.com/ariffb25), [Ftwrr](https://github.com/Ftwrr)
- **API lokal & scraper di fork ini:** dibangun ulang sebagai pengganti host pihak ketiga yang sudah mati (XTEAM, Zahir, Zeks, LeysCoder, Nurutomo API) — sekarang berjalan di `lib/api/` milik sendiri.

## Migrasi Baileys 7 (v2.7.0)

Bot sekarang memakai paket npm **`baileys` 7.x** (protokol WhatsApp Web terbaru), bukan `@adiwajshing/baileys` 3.5.3 yang sudah tidak bisa tersambung (`Unexpected server response: 404`).

Lapisan WhatsApp dipisah agar plugin tidak perlu diubah dan semuanya bisa diuji tanpa jaringan:

```
lib/wa/
  message-type.js  # shim MessageType/Presence/GroupSettingChange (nilai lama dipertahankan)
  content.js       # MessageType lama -> konten Baileys 7 (fungsi murni)
  normalize.js     # pesan Baileys 7 -> objek `m` gaya lama + normalisasi nomor pairing
  auth.js          # useMultiFileAuthState (folder wa-auth/)
  client.js        # makeWASocket + requestPairingCode (logger, socket injectable)
  legacy.js        # LegacyClient: sendMessage/sendFile/reply/sendButton/... di atas socket baru
  chats.js         # ChatStore: all()/presences kompatibel ChatManager Baileys 3.x
  lifecycle.js     # detachListeners + jeda reconnect eksponensial
  index.js         # connect(): sambungkan event Baileys 7 ke event lama (chat-update, dst.)
```

Tes: `npm test` menjalankan pemeriksaan sintaks seluruh berkas lalu `node --test tests/` (konten, normalisasi, dan adaptor legacy dengan socket palsu).

### Menjalankan dengan kode pairing

```bash
node . --pairing 6285178964685
```

Alur login yang sudah diuji (Node v26.13.1, Baileys 7.0.0-rc14):

1. Bot menyambung ke server WhatsApp lalu meminta kode 8 karakter dan mencetaknya (juga disimpan di `pairing-code.txt`):

   ```
   ==================================================
     KODE PAIRING WHATSAPP untuk +6285178964685
     QV5BFVY3
     Masukkan di WhatsApp > Perangkat tertaut >
     Tautkan dengan nomor telepon.
   ==================================================
   ```

2. Di HP buka **WhatsApp → Setelan → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu masukkan kode tersebut. Kode hanya berlaku selama proses bot masih berjalan; bila kedaluwarsa, hentikan bot dan jalankan ulang perintahnya untuk kode baru.
3. Setelah kode diterima, WhatsApp memutus koneksi sekali (`stream:error 515` berarti restart wajib). Bot menyambung ulang sendiri dan mencetak:

   ```
   [wa] handler terpasang (chat-update, message-delete, participants, call)
   [wa] terhubung sebagai 6285178964685@s.whatsapp.net
   ```

4. Kredensial tersimpan di `wa-auth/` (`registered: true`), jadi login berikutnya cukup `node .` tanpa `--pairing` dan tanpa QR.

Tanpa opsi `--pairing`, bot menampilkan QR di terminal (`--big-qr` untuk QR besar). Satu nomor sebaiknya dipakai satu proses bot saja — dua proses dengan sesi yang sama akan saling memutus.

### Peran, cooldown, dan EXIF stiker

- **Owner & staff dua lapis** — `global.owner` di `config.js` (ditambah nomor bot dan pesan `fromMe`) adalah lapis owner; `global.staff` atau `user.staff = true` di database adalah lapis staff untuk perintah internal. Plugin menandai kebutuhannya lewat `handler.owner`, `handler.staff`, `handler.mods`, atau `handler.premium`.
- **Cooldown & anti-spam** — `handler.cooldown = 5000` memberi jeda 5 detik per pengirim untuk perintah itu; anti-spam bawaan membatasi 10 pesan per 10 detik dan hanya memberi satu peringatan per jendela.
- **EXIF stiker** — `lib/sticker-exif.js` menulis id paket, nama paket, pembuat, dan emoji ke stiker webp; `sticker()` memakainya dan `getexif` membacanya kembali.
- **Pengaturan per grup** — tiap grup punya `settings` sendiri di database: saklar fitur, prefix, dan bahasa. Staff atau owner mengubahnya dengan `.grup` (lihat `.grup` untuk daftar), misalnya `.grup prefix !`, `.grup prefix none`, `.grup bahasa en`, `.grup fitur antilink off`, atau `.grup reset`. Modul murninya ada di `lib/group-settings.js`, dan pesan gagal (`global.dfail`) otomatis memakai bahasa grup.

## Catatan fork ini (v2.6.0)

Host API lama (`api.xteam.xyz`, `zahirr-web.herokuapp.com`, `api.zeks.xyz`, `leyscoders-api.herokuapp.com`, `nurutomo.herokuapp.com`) sudah mati, jadi fork ini tidak lagi bergantung padanya:

- **API lokal** dijalankan otomatis oleh `main.js` di `http://127.0.0.1:3001` (bisa diubah lewat env `LOCAL_API_PORT`). Berisi bank soal game, proxy Wikipedia/Aladhan/thum.io/tikwm, dan fallback 503 yang jelas untuk fitur yang belum punya penyedia.
- **Scraper sendiri**: KBBI (`/kbbi`), kode pos (`/kodepos`), resep (`/api/resep-masak`), berita RSS `cnn`/`antara`/`republika`/`cnbc` (`/news/:sumber`), downloader Instagram (`/dl/ig`, lewat igexport.com — mendukung foto, carousel, dan reel), serta SoundCloud (`/api/soundcloud` untuk pencarian, `/dl/soundcloud` untuk mengunduh audio HLS).

Struktur API lokal mengikuti prinsip SOLID — tiap bagian punya satu tanggung jawab, dan endpoint baru cukup didaftarkan di registry:

```
lib/api/
  http.js          # satu-satunya tempat pemanggilan jaringan
  errors.js        # ApiError + asyncHandler
  data/            # bank soal game, daftar daerah (tanpa I/O)
  scrapers/        # kbbi.js, kodepos.js, resep.js, berita.js
  routes/          # satu modul per kelompok endpoint + index.js (registry)
  server.js        # createApp(): rakit route, fallback 503, error handler
  index.js         # start()
lib/localapi.js    # facade lama -> lib/api
```

Menambah endpoint: buat modul di `lib/api/routes/` yang mengekspor `{ name, path, createRouter }`, daftarkan di `lib/api/routes/index.js`. `server.js` tidak perlu diubah.
- **Sticker** tidak lagi memanggil host luar: `lib/sticker.js` memakai ffmpeg atau ImageMagick/GraphicsMagick saja.
- **Keamanan:** backdoor `plugins/..js` dihapus, anti-delete/participantsUpdate/onCall diperbaiki, dan beberapa bug flag `enable.js` dibetulkan.
- **Dependensi:** `@adiwajshing/baileys` 3.5.3 diganti `baileys` 7.x (lihat bagian migrasi di atas), `xmldom` diganti `@xmldom/xmldom`, `request` diganti `got`, ditambah `axios`/`qs`/`steno`.

Dokumentasi internal (peta proyek, status API, daftar fitur yang masih butuh pihak ketiga): [AGENTS.md](AGENTS.md).

Best Regards. wabot-aq
