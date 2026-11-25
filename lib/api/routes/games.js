const express = require('express')
const banks = require('../data/games')

const QUIZ = [
  ['/asahotak', banks.asahotak],
  ['/tebakkata', banks.tebakkata],
  ['/siapakahaku', banks.siapakahaku],
]

/**
 * Game tanya-jawab dari bank soal lokal.
 * path: /game
 */
module.exports = {
  name: 'games',
  path: '/game',
  createRouter() {
    const router = express.Router()
    for (const [path, bank] of QUIZ) {
      router.get(path, (req, res) => {
        res.json({ status: true, result: banks.question(bank) })
      })
    }
    router.get('/family100', (req, res) => {
      const { soal, jawaban } = banks.family()
      res.json({ status: true, soal, jawaban })
    })
    return router
  },
}
