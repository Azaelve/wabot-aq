/**
 * Tes klien dan rute api.jaky.dev.
 * Semua tes memakai fetchJSON palsu — tidak ada panggilan jaringan.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  apiKey,
  isConfigured,
  buildUrl,
  unwrap,
  request,
  requestResult,
  requestBinary,
  BASE_URL,
} = require('../lib/api/jaky')
const jakyModule = require('../lib/api/jaky')

/* ================================================================
 *  Klien: apiKey & isConfigured
 * ================================================================ */

test('apiKey membaca dari env.Zennith', () => {
  assert.equal(apiKey({ Zennith: 'abc' }), 'abc')
})

test('apiKey fallback ke env.ZENNITH', () => {
  assert.equal(apiKey({ ZENNITH: 'def' }), 'def')
})

test('apiKey mengembalikan string kosong bila tidak ada', () => {
  assert.equal(apiKey({}), '')
})

test('isConfigured true bila key ada', () => {
  assert.equal(isConfigured({ Zennith: 'x' }), true)
})

test('isConfigured false bila key kosong', () => {
  assert.equal(isConfigured({}), false)
  assert.equal(isConfigured({ Zennith: '  ' }), false)
})

/* ================================================================
 *  buildUrl
 * ================================================================ */

test('buildUrl membangun URL dengan query', () => {
  const url = buildUrl('/v1/download/twitter', { url: 'https://t.co/x' })
  assert.equal(url, `${BASE_URL}/v1/download/twitter?url=https%3A%2F%2Ft.co%2Fx`)
})

test('buildUrl menambah / di depan jika tidak ada', () => {
  const url = buildUrl('v1/test')
  assert.ok(url.startsWith(BASE_URL + '/v1/test'))
})

test('buildUrl menolak path kosong', () => {
  assert.throws(() => buildUrl(''), /Path wajib/)
  assert.throws(() => buildUrl(null), /Path wajib/)
})

test('buildUrl mengabaikan param null/kosong', () => {
  const url = buildUrl('/v1/x', { a: 'ok', b: null, c: '' })
  assert.ok(url.includes('a=ok'))
  assert.ok(!url.includes('b='))
  assert.ok(!url.includes('c='))
})

/* ================================================================
 *  unwrap
 * ================================================================ */

test('unwrap mengembalikan result pada status true', () => {
  const result = unwrap({ status: true, code: 200, result: { foo: 1 } })
  assert.deepEqual(result, { foo: 1 })
})

test('unwrap melempar error pada status false', () => {
  assert.throws(() => unwrap({ status: false, msg: 'not found' }), /not found/)
})

test('unwrap melempar error pada envelope kosong', () => {
  assert.throws(() => unwrap(null), /tidak valid/)
  assert.throws(() => unwrap('string'), /tidak valid/)
})

/* ================================================================
 *  request & requestResult
 * ================================================================ */

test('request melempar error bila Zennith tidak diset', async () => {
  await assert.rejects(
    () => request('/v1/test', {}, { env: {} }),
    /Zennith belum diset/
  )
})

test('request mengirim header x-jaky-key', async () => {
  let capturedOpts
  const fakeFetch = async (url, opts) => {
    capturedOpts = opts
    return { status: true, result: 'ok' }
  }
  await request('/v1/test', { q: '1' }, {
    fetchJSON: fakeFetch,
    env: { Zennith: 'mykey' },
  })
  assert.equal(capturedOpts.headers['x-jaky-key'], 'mykey')
})

test('request meneruskan query params ke URL', async () => {
  let capturedUrl
  const fakeFetch = async (url) => {
    capturedUrl = url
    return { status: true, result: 'ok' }
  }
  await request('/v1/search/spotify', { query: 'test' }, {
    fetchJSON: fakeFetch,
    env: { Zennith: 'k' },
  })
  assert.ok(capturedUrl.includes('query=test'))
})

test('request mengembalikan envelope mentah', async () => {
  const envelope = { status: true, code: 200, result: { x: 1 } }
  const fakeFetch = async () => envelope
  const got = await request('/v1/x', {}, {
    fetchJSON: fakeFetch,
    env: { Zennith: 'k' },
  })
  assert.deepEqual(got, envelope)
})

test('requestResult mengembalikan hanya result', async () => {
  const fakeFetch = async () => ({ status: true, result: { data: 42 } })
  const result = await requestResult('/v1/x', {}, {
    fetchJSON: fakeFetch,
    env: { Zennith: 'k' },
  })
  assert.deepEqual(result, { data: 42 })
})

test('requestResult melempar error pada envelope gagal', async () => {
  const fakeFetch = async () => ({ status: false, msg: 'rate limited' })
  await assert.rejects(
    () => requestResult('/v1/x', {}, { fetchJSON: fakeFetch, env: { Zennith: 'k' } }),
    /rate limited/
  )
})

/* ================================================================
 *  isJakyPath
 * ================================================================ */

const { isJakyPath } = require('../lib/api/routes/jaky')
const { createApp } = require('../lib/api/server')
const http = require('node:http')

test('isJakyPath true untuk rute Jaky', () => {
  for (const p of ['/dl/twitter', '/tools/qr', '/api/spotify', '/ephoto/abc',
    '/search/youtube', '/jaky/ai/removebg', '/canvas/quote', '/dl/threads',
    '/videomaker', '/sticker/stickerly/download']) {
    assert.equal(isJakyPath(p), true, p)
  }
})

test('isJakyPath false untuk path bukan rute Jaky', () => {
  // Catatan: '/search/<apa pun>' adalah rute Jaky (wildcard katalog
  // '/search/*' di createRouter), jadi '/search/tidakada' sengaja
  // TIDAK ada di daftar ini — ia harus dijawab 503 secret, bukan fallback.
  for (const p of ['/health', '/news/detik', '/tidak-ada', '/api/xyz',
    '/kbbi', '/dl/tidakada', '/searchx']) {
    assert.equal(isJakyPath(p), false, p)
  }
})

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    }).on('error', reject)
  })
}

test('tanpa Zennith: rute Jaky 503 secret, path tak dikenal 503 fallback', async () => {
  delete process.env.Zennith
  delete process.env.ZENNITH
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.on('listening', r))
  try {
    const port = server.address().port
    const jaky = await get(port, '/tools/qr?text=x')
    assert.equal(jaky.status, 503)
    assert.match(jaky.body, /Zennith belum diset/)
    const unknown = await get(port, '/path-tidak-ada-xyz')
    assert.equal(unknown.status, 503)
    assert.match(unknown.body, /belum punya penyedia pengganti/)
    const health = await get(port, '/health')
    assert.equal(health.status, 200)
  } finally {
    server.close()
  }
})

/* ================================================================
 *  requestBinary (endpoint biner, mis. /v1/tools/qr -> PNG)
 * ================================================================ */

test('requestBinary mengembalikan buffer + content-type', async () => {
  const fakeFetch = async () => ({
    buffer: async () => Buffer.from('PNGDATA'),
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
  })
  const out = await requestBinary('/v1/tools/qr', { text: 'x' },
    { fetchRaw: fakeFetch, env: { Zennith: 'k' } })
  assert.equal(out.contentType, 'image/png')
  assert.equal(out.buffer.toString(), 'PNGDATA')
})

test('requestBinary melempar bila key belum diset', async () => {
  await assert.rejects(
    () => requestBinary('/v1/tools/qr', { text: 'x' }, { env: {} }),
    /Zennith belum diset/
  )
})

test('/tools/qr meneruskan PNG dari Jaky (tanpa jaringan)', async () => {
  const orig = jakyModule.requestBinary
  jakyModule.requestBinary = async () => ({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    contentType: 'image/png',
  })
  const prev = process.env.Zennith
  process.env.Zennith = 'test-key'
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.on('listening', r))
  try {
    const port = server.address().port
    const res = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/tools/qr?text=halo' }, res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve({
          status: res.statusCode,
          type: res.headers['content-type'],
          body: Buffer.concat(chunks),
        }))
      }).on('error', reject)
    })
    assert.equal(res.status, 200)
    assert.match(res.type, /image\/png/)
    assert.equal(res.body[0], 0x89)
    assert.equal(res.body.length, 4)
  } finally {
    server.close()
    jakyModule.requestBinary = orig
    if (prev === undefined) delete process.env.Zennith
    else process.env.Zennith = prev
  }
})
