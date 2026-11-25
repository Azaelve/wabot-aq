const test = require('node:test')
const assert = require('node:assert/strict')
const { createCooldown, createSpamGuard } = require('../lib/cooldown')

function fakeClock(start = 0) {
  let time = start
  return { now: () => time, advance: ms => { time += ms } }
}

test('cooldown mengizinkan sekali lalu menolak sampai jendela habis', () => {
  const clock = fakeClock()
  const cooldown = createCooldown({ now: clock.now })

  const first = cooldown.hit('plugin:user', { windowMs: 5000 })
  assert.equal(first.allowed, true)
  assert.equal(first.remainingMs, 0)

  clock.advance(1000)
  const second = cooldown.hit('plugin:user', { windowMs: 5000 })
  assert.equal(second.allowed, false)
  assert.equal(second.count, 2)
  assert.equal(second.remainingMs, 4000)

  clock.advance(4000)
  assert.equal(cooldown.hit('plugin:user', { windowMs: 5000 }).allowed, true)
})

test('cooldown memisahkan kunci dan mendukung limit > 1', () => {
  const clock = fakeClock()
  const cooldown = createCooldown({ now: clock.now })

  assert.equal(cooldown.hit('a', { windowMs: 1000, limit: 3 }).allowed, true)
  assert.equal(cooldown.hit('a', { windowMs: 1000, limit: 3 }).allowed, true)
  assert.equal(cooldown.hit('a', { windowMs: 1000, limit: 3 }).allowed, true)
  assert.equal(cooldown.hit('a', { windowMs: 1000, limit: 3 }).allowed, false)
  assert.equal(cooldown.hit('b', { windowMs: 1000, limit: 3 }).allowed, true)
  assert.equal(cooldown.size, 2)
})

test('reset dan clear membersihkan hitungan', () => {
  const clock = fakeClock()
  const cooldown = createCooldown({ now: clock.now })
  cooldown.hit('a', { windowMs: 1000 })
  cooldown.reset('a')
  assert.equal(cooldown.size, 0)
  assert.equal(cooldown.hit('a', { windowMs: 1000 }).allowed, true)
  cooldown.clear()
  assert.equal(cooldown.size, 0)
})

test('spam guard memberi peringatan hanya sekali per jendela', () => {
  const clock = fakeClock()
  const guard = createSpamGuard({ limit: 3, windowMs: 10000, now: clock.now })

  for (let i = 0; i < 3; i++) {
    const res = guard.check('user')
    assert.equal(res.blocked, false)
    assert.equal(res.first, false)
  }

  const blocked = guard.check('user')
  assert.equal(blocked.blocked, true)
  assert.equal(blocked.first, true)
  assert.equal(blocked.count, 4)
  assert.ok(blocked.remainingMs > 0)

  const again = guard.check('user')
  assert.equal(again.blocked, true)
  assert.equal(again.first, false)
})

test('spam guard memisahkan pengirim dan mereset setelah jendela lewat', () => {
  const clock = fakeClock()
  const guard = createSpamGuard({ limit: 1, windowMs: 5000, now: clock.now })

  assert.equal(guard.check('a').blocked, false)
  assert.equal(guard.check('a').blocked, true)
  assert.equal(guard.check('b').blocked, false)

  clock.advance(5000)
  const fresh = guard.check('a')
  assert.equal(fresh.blocked, false)
  assert.equal(fresh.count, 1)
})

test('spam guard dapat direset per pengirim', () => {
  const guard = createSpamGuard({ limit: 1, windowMs: 5000 })
  guard.check('a')
  guard.check('a')
  assert.equal(guard.size, 1)
  guard.reset('a')
  assert.equal(guard.size, 0)
  assert.equal(guard.check('a').blocked, false)
})
