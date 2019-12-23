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
        if spinUpDelay == 0 {
            await s.consistency()
        } else {
            await delay(spinUpDelay)
        }

        const batch = new Batch(players).iteration('parallel')

        const agentIds = await batch.mapInstances(async instance => instance.agentAddress)
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
        // All results contain the full set of other nodes
        t.deepEqual(results , R.repeat(true,checkedCount*(totalInstances-1)))
    })
}
