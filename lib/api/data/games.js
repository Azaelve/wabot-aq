/**
 * Bank soal game lokal. Data murni tanpa ketergantungan HTTP,
 * sehingga bisa diganti/diperluas tanpa menyentuh route.
 */

const asahotak = [
  ['Ibu kota Provinsi Jawa Barat adalah...', 'Bandung'],
  ['Hewan yang dikenal sebagai raja hutan adalah...', 'Singa'],
  ['Alat musik tradisional dari Jawa Barat adalah...', 'Angklung'],
  ['Planet terdekat dari Matahari adalah...', 'Merkurius'],
  ['Lambang kimia untuk air adalah...', 'H2O'],
  ['Ibu kota Jepang adalah...', 'Tokyo'],
  ['Gunung tertinggi di Indonesia adalah...', 'Puncak Jaya'],
  ['Bendera negara Indonesia berwarna...', 'Merah putih'],
  ['Hewan mamalia terbesar di dunia adalah...', 'Paus biru'],
  ['Mata uang negara Thailand adalah...', 'Baht'],
  ['Danau terluas di Indonesia adalah...', 'Danau Toba'],
  ['Organ tubuh yang memompa darah adalah...', 'Jantung'],
  ['Bahasa pemrograman yang dijalankan di browser adalah...', 'JavaScript'],
  ['Penemu lampu pijar adalah...', 'Thomas Alva Edison'],
  ['Pulau terbesar di Indonesia adalah...', 'Kalimantan'],
  ['Hari kemerdekaan Indonesia diperingati pada tanggal...', '17 Agustus'],
  ['Kota yang dijuluki Kota Pahlawan adalah...', 'Surabaya'],
  ['Satelit alami Bumi adalah...', 'Bulan'],
  ['Proses tumbuhan membuat makanan disebut...', 'Fotosintesis'],
  ['Negara dengan penduduk terbanyak di dunia adalah...', 'India'],
  ['Alat untuk mengukur suhu adalah...', 'Termometer'],
  ['Sungai terpanjang di dunia adalah...', 'Sungai Nil'],
]

const tebakkata = [
  ['Benda yang dipakai untuk menulis di papan tulis', 'SPIDOL'],
  ['Hewan berkaki empat yang mengeong', 'KUCING'],
  ['Kendaraan roda dua', 'SEPEDA'],
  ['Tempat kita belajar di sekolah', 'KELAS'],
  ['Benda langit yang bersinar di siang hari', 'MATAHARI'],
  ['Alat untuk memotong kertas', 'GUNTING'],
  ['Ibu dari ayah kita disebut', 'NENEK'],
  ['Tempat menyimpan buku di sekolah', 'PERPUSTAKAAN'],
  ['Rasa makanan yang diberikan gula', 'MANIS'],
  ['Pekerjaan mengobati orang sakit', 'DOKTER'],
  ['Benda yang digunakan untuk membayar', 'UANG'],
  ['Hewan yang menghasilkan madu', 'LEBAH'],
  ['Tempat berhentinya kereta api', 'STASIUN'],
  ['Bunga yang menjadi lambang negara Jepang', 'SAKURA'],
  ['Alat musik yang dipetik dengan senar', 'GITAR'],
  ['Warna daun yang sehat', 'HIJAU'],
  ['Benda yang dipakai saat hujan', 'PAYUNG'],
  ['Hewan yang berjalan sangat lambat', 'KURA'],
  ['Profesi yang memadamkan api', 'PEMADAM'],
  ['Tempat mencuci piring', 'DAPUR'],
]

const siapakahaku = [
  ['Aku memiliki empat kaki dan digunakan untuk duduk', 'kursi'],
  ['Aku memiliki jarum dan benang di tubuhku', 'jam'],
  ['Aku punya wajah dan tangan, tetapi tidak punya kaki', 'arloji'],
  ['Aku berisi banyak halaman dan sering dibaca', 'buku'],
  ['Aku selalu di atas kepala saat hujan', 'payung'],
  ['Aku kecil, berdering, dan bisa dibawa ke mana-mana', 'handphone'],
  ['Aku memiliki akar, batang, dan daun', 'pohon'],
  ['Aku berwarna putih dan biasa ditulis dengan pena', 'kertas'],
  ['Aku punya roda dan bisa mengangkut banyak orang', 'bus'],
  ['Aku bersinar di malam hari dan sering disebut indah', 'bintang'],
  ['Aku terbuat dari kaca dan bisa memantulkan wajah', 'cermin'],
  ['Aku memiliki sayap dan bisa terbang ke bunga', 'kupu-kupu'],
  ['Aku dipakai di kaki dan berbentuk seperti sepatu', 'sandal'],
  ['Aku berisi air dan biasa dipakai untuk minum', 'gelas'],
  ['Aku punya layar dan tombol angka', 'kalkulator'],
  ['Aku mengeluarkan suara tick-tick setiap detik', 'jam dinding'],
  ['Aku hijau, panjang, dan biasa dimakan sebagai sayur', 'kangkung'],
  ['Aku punya ekor dan biasa menggonggong', 'anjing'],
  ['Aku adalah tempat tinggal manusia', 'rumah'],
  ['Aku melayang di langit dan berwarna putih', 'awan'],
]

const family100 = [
  {
    soal: 'Sebutkan hal yang biasa dibawa saat pergi ke pantai',
    jawaban: ['baju renang', 'handuk', 'kacamata renang', 'sunblock', 'topi', 'air minum'],
  },
  {
    soal: 'Sebutkan benda yang ada di dalam tas sekolah',
    jawaban: ['buku', 'pulpen', 'pensil', 'penghapus', 'penggaris', 'tempat minum'],
  },
  {
    soal: 'Sebutkan makanan khas Indonesia',
    jawaban: ['rendang', 'sate', 'nasi goreng', 'soto', 'gado-gado', 'bakso'],
  },
  {
    soal: 'Sebutkan aplikasi pesan instan yang populer',
    jawaban: ['whatsapp', 'telegram', 'line', 'signal', 'instagram', 'messenger'],
  },
  {
    soal: 'Sebutkan hal yang membuat orang bangun kesiangan',
    jawaban: ['tidur larut', 'alarm mati', 'kelelahan', 'begadang', 'hp di samping', 'tidak ada alarm'],
  },
  {
    soal: 'Sebutkan pekerjaan yang berhubungan dengan komputer',
    jawaban: ['programmer', 'desainer grafis', 'data analyst', 'sysadmin', 'gamer', 'editor video'],
  },
  {
    soal: 'Sebutkan hal yang dilakukan sebelum tidur',
    jawaban: ['gosok gigi', 'cuci kaki', 'ganti baju', 'matikan lampu', 'cek hp', 'berdoa'],
  },
  {
    soal: 'Sebutkan benda yang ada di dapur',
    jawaban: ['kompor', 'pisau', 'piring', 'gelas', 'kulkas', 'panci'],
  },
  {
    soal: 'Sebutkan olahraga yang dimainkan dengan bola',
    jawaban: ['sepak bola', 'basket', 'voli', 'futsal', 'tenis', 'bowling'],
  },
  {
    soal: 'Sebutkan hal yang biasa dicari orang di internet',
    jawaban: ['berita', 'video', 'musik', 'resep', 'belanja', 'pelajaran'],
  },
]

/**
 * Ambil satu item acak dari daftar.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

/** Game tanya-jawab: satu soal dan jawabannya. */
function question(bank) {
  const [soal, jawaban] = pick(bank)
  return { soal, jawaban }
}

/** Soal family 100 beserta daftar jawaban. */
function family() {
  const item = pick(family100)
  return { soal: item.soal, jawaban: item.jawaban }
}

// `pick` sengaja tidak diekspor: hanya dipakai `question()` dan `family()`.
module.exports = {
  asahotak,
  tebakkata,
  siapakahaku,
  question,
  family,
}
