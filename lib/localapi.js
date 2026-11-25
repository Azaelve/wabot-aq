/**
 * Facade kompatibilitas. Implementasinya sekarang modular di lib/api/.
 * Dipertahankan agar `require('./lib/localapi')` di main.js tetap jalan.
 */
module.exports = require('./api')
