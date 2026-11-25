/**
 * Registry route API lokal.
 *
 * Setiap berkas di folder ini mengekspor `{ name, path, createRouter }`
 * dengan satu tanggung jawab. Untuk menambah endpoint cukup buat modulnya
 * dan daftarkan di sini — server tidak perlu diubah (open/closed).
 */
module.exports = [
  require('./health'),
  require('./games'),
  require('./wiki'),
  require('./sholat'),
  require('./ssweb'),
  require('./tiktok'),
  require('./instagram'),
  require('./soundcloud'),
  require('./soundcloud-download'),
  require('./kbbi'),
  require('./kodepos'),
  require('./resep'),
  require('./news'),
  // Jaky harus paling akhir: path '/' menangkap sisa yang belum ditangani
  // route lokal di atas (tiktok, ig, soundcloud, kbbi, kodepos, dsb.).
  require('./jaky'),
]
