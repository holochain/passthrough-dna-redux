import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { Batch } from '@holochain/tryorama-stress-utils'


const trace = R.tap(x => console.log('{T}', x))
const delay = ms => new Promise(r => setTimeout(r, ms))

module.exports = (scenario, configBatch, N, C, I, sampleSize, spinUpDelay) => {
    const totalInstances = N*C*I
    const totalConductors = N*C

    if (sampleSize === undefined) {
        sampleSize = 1
    }

    scenario('all agents exists', async (s, t) => {
        const players = R.sortBy(p => parseInt(p.name, 10), R.values(await s.players(configBatch(totalConductors, I), false)))
        const batch = new Batch(players).iteration('parallel')

        // range of random number of milliseconds to wait before startup
        // const startupSpacing = 10000
        // number of milliseconds to wait between gets
        const getWait = 20

        await Promise.all(players.map(async player => {
            //await delay(Math.random()*startupSpacing)
            return player.spawn()
        }))
        console.log("============================================\nall nodes have started\n============================================")
        console.log(`beginning test with sample size: ${sampleSize}`)
        if (spinUpDelay == 0) {
            console.log("waiting for consistency")
            await s.consistency()
        } else {
            console.log(`spin up delay ${spinUpDelay}`)
            await delay(spinUpDelay)
        }

        const agentIds = await batch.mapInstances(async instance => instance.agentAddress)

        let tries = 0
        let last_results = []
        while(true) {
            let results = []
            let i = 0
            let checkedCount = 0;
            let mod = Math.floor(totalInstances/sampleSize)
            await batch.mapInstances(async instance => {
                if  ( i % mod == 0) {
                    checkedCount += 1
                    console.log(`\n-------------------------------------------\ngetting ${totalInstances} entries for ${i} (${instance.agentAddress})\n---------------------------\n`)
                    for (const id of agentIds) {
                        if (instance.agentAddress != id) {
                            await delay(getWait)
                            const result = await instance.call('main', 'get_entry', {address: id})
                            results.push( Boolean(result.Ok) )
                        }
                    }
                }
                i+=1
            })
            let expected =  R.repeat(true,checkedCount*(totalInstances-1))
            if (JSON.stringify(expected)==JSON.stringify(results)) {
                console.log("it worked", expected, results)
                t.assert(true)
                break
            } else {
                if (JSON.stringify(last_results)==JSON.stringify(results)) {
                    console.log("it failed", expected, results)
                    t.assert(false)
                } else {
                    tries += 1
                    last_results = results
                    console.log(`try ${tries} failed, trying again, got:`, results)
                }
            }
        }
    })
}
