const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { detachListeners, reconnectDelay } = require('../lib/wa/lifecycle')

test('detachListeners hanya melepas listener yang terpasang', () => {
  const emitter = new EventEmitter()
  const fn = () => { }
  emitter.on('chat-update', fn)
  const removed = detachListeners(emitter, [
    ['chat-update', fn],
    ['message-delete', undefined],
    ['CB:action,,call', null],
  ])
  assert.equal(removed, 1)
  assert.equal(emitter.listenerCount('chat-update'), 0)
})

test('detachListeners tidak melempar untuk emitter yang tidak mendukung off', () => {
  const fn = () => { }
  assert.equal(detachListeners(null, [['a', fn]]), 0)
  assert.equal(detachListeners({ on() { } }, [['a', fn]]), 0)
})

test('reconnectDelay naik eksponensial lalu dibatasi', () => {
  assert.equal(reconnectDelay(0), 5000)
  assert.equal(reconnectDelay(1), 10000)
  assert.equal(reconnectDelay(2), 20000)
  assert.equal(reconnectDelay(10), 60000)
  assert.equal(reconnectDelay(-3), 5000)
  assert.equal(reconnectDelay('bukan angka'), 5000)
  assert.equal(reconnectDelay(1, { base: 1000, max: 5000 }), 2000)
  assert.equal(reconnectDelay(3, { base: 1000, max: 5000 }), 5000)
})
