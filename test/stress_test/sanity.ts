import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { Batch } from '@holochain/tryorama-stress-utils'


const trace = R.tap(x => console.log('{T}', x))
const delay = ms => new Promise(r => setTimeout(r, ms))

module.exports = (scenario, configBatch, N, C, I, spinUpDelay) => {
    const totalInstances = N*C*I
    const totalConductors = N*C

    scenario('all hashes are available somewhere gettable', async (s, t) => {
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
        console.log(`beginning dht sanity test`)
        if (spinUpDelay == 0) {
            console.log("no spin-up delay given using tryorama consistency waiting")
            await s.consistency()
        } else {
            console.log(`spin up delay ${spinUpDelay}`)
            await delay(spinUpDelay)
        }

        const batch = new Batch(players).iteration('series')

        const agentAddresses = await batch.mapInstances(async instance => instance.agentAddress)
        const agentSet = new Set(agentAddresses)
        console.log('agentAddresses: ', agentAddresses.length, JSON.stringify(agentAddresses))
        console.log('agentSet: ', agentSet.size, JSON.stringify(Array.from(agentSet)))

        const holding_map = await getHolding(batch)
        console.log(holding_map)
    })
}

const getHolding = async (batch: Batch) => {
    let DHTresult = {
        entries: {}
    }
    DHTresult["holding"] = await batch.mapInstances(async instance => {
        const id = `${instance.id}:${instance.agentAddress}`
        console.log(`calling state dump for instance ${id})`)
        const dump = await instance.stateDump()
        const heldHashes = R.keys(dump.held_aspects)
        const sourceChains = R.values(dump.source_chain)
        console.log("SOURCE:", sourceChains)
        const entryMap = {}
        for (const entry of sourceChains) {
            console.log("ENTRY:", entry)
            DHTresult.entries[entry.entry_address] = true
        }
        const result = {}
        result[id] = heldHashes
        return result
    })
    return DHTresult
}
