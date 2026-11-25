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
  BASE_URL,
} = require('../lib/api/jaky')

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
