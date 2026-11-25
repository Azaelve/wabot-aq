let fetch = require('node-fetch')

// covid19.mathdro.id sudah mati; disease.sh masih hidup (dicek 2026-11-26).
let handler = async (m, { args, usedPrefix, command }) => {
    if (!args[0]) {
        let res = await fetch('https://disease.sh/v3/covid-19/countries')
        if (!res.ok) throw await res.text()
        let json = await res.json()
        throw `Contoh :\n${usedPrefix}${command} Indonesia\n\n` + json.map((v) => `${v.country} : ${v.countryInfo.iso2} / ${v.countryInfo.iso3}`).join('\n')
    }
    let res = await fetch('https://disease.sh/v3/covid-19/countries/' + encodeURIComponent(args[0]))
    if (!res.ok) throw await res.text()
    let json = await res.json()
    if (json.cases) m.reply(`
Countries : ${json.country}
Confirmed : ${json.cases}
Recovered : ${json.recovered}
Deaths : ${json.deaths}
Last Update : ${new Date(json.updated).toLocaleString('id-ID')}
`.trim())
    else throw json
}
handler.help = ['covid'].map(v => v + ' <negara>')
handler.tags = ['internet']
handler.command = /^(corona|covid|covid19)$/i
//susu
module.exports = handler
