import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { Batch } from '@holochain/tryorama-stress-utils'


const trace = R.tap(x => console.log('{T}', x))
const delay = ms => new Promise(r => setTimeout(r, ms))

module.exports = (scenario, configBatch, N, C, I, spinUpDelay, retryDelay, retries) => {
    const totalInstances = N*C*I
    const totalConductors = N*C

    if (retryDelay == undefined) {
        retryDelay = 10000
    }
    if (retries == undefined) {
        retries = 3
    }

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

        const dht_state = await getDHTstate(batch)

        let tries = 0
        while (tries < retries) {
            tries += 1
            console.log(`Checking holding: try ${tries}`)
            if (checkHolding(dht_state)) {
                console.log("all are held")
                t.pass()
                break
            }
            console.log("all not held, retrying after delay")
            await delay(retryDelay)
        }
        if (tries == retries) {
            t.fail()
        }
    })
}

function checkHolding(dht_state) {
    let all_held = true
    let held_by = {}
    console.log("total number of entries returned by state dumps:", dht_state["entries"].length)
    for (const entry_address of dht_state["entries"]) {
        let holders = []
        for (const holding of dht_state["holding"]) {
            if (holding.held_addresses.includes(entry_address)) {
                holders.push(holding.agent_address)
            }
        }
        held_by[entry_address] = holders
        console.log(`${entry_address} is held by ${holders.length} agents`)
        if (holders.length === 0) {
            all_held = false
        }
    }
    return all_held
}

const getDHTstate = async (batch: Batch) => {
    let entries_map = {}
    const holding_map = await batch.mapInstances(async instance => {
        const id = `${instance.id}:${instance.agentAddress}`
        console.log(`calling state dump for instance ${id})`)
        const dump = await instance.stateDump()
        const held_addresses = R.keys(dump.held_aspects)
        const source_chains = R.values(dump.source_chain)
        const entryMap = {}
        for (const entry of source_chains) {
            if (entry.entry_type != "Dna" && entry.entry_type != "CapTokenGrant") {
                entries_map[entry.entry_address] = true
            }
        }
        return {
            instance_id: instance.id,
            held_addresses,
            agent_address: instance.agentAddress
        }
    })
    return {
        entries: R.keys(entries_map),
        holding: holding_map
    }
}
