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
        if (spinUpDelay == 0) {
            console.log("waiting for consistency")
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

        let tries = 0
        let last_results = []
        while(true) {
            let results = []
            let i = 0
            let checkedCount = 0;
            let mod = Math.floor(totalInstances/sampleSize)
            await batch.mapInstances(async sampledInstance => {
                if  ( i % mod == 0) {
                    checkedCount += 1
                    console.log(`\n-------------------------------------------\ngetting ${totalInstances} entries for ${i} (${sampledInstance.agentAddress})\n---------------------------\n`)
                    await batch.mapInstances(async subInstance => {
                        if (sampledInstance.agentAddress != subInstance.agentAddress) {
                            const address = subInstance.agentAddress
                            await delay(getWait)
                            const diagnosticsPromise = dumpDiagnostics(batch, address)
                            const resultPromise = sampledInstance.call('main', 'get_entry', { address })
                            const [diagnostics, result] = await Promise.all([diagnosticsPromise, resultPromise])
                            const resultBool = Boolean(result.Ok)
                            console.log(`:::::::::::::: DUMP DIAGNOSTICS ::::::::::::::::`)
                            console.log(`getting entry ${address}`)
                            console.log(`from agent ${sampledInstance.agentAddress}`)
                            console.log(`result = ${resultBool}`)
                            console.log(displayDumpDiagnostics(diagnostics, address))

                            results.push(resultBool)
                        }
                    })
                }
                i+=1
            })
            let expected =  R.repeat(true,checkedCount*(totalInstances-1))
            if (JSON.stringify(expected)==JSON.stringify(results)) {
                console.log("it worked", expected, results)
                t.pass()
                break
            } else {
                if (JSON.stringify(last_results)==JSON.stringify(results)) {
                    console.log("it failed", expected, results)
                    t.fail('it failed')
                    break
                } else {
                    tries += 1
                    last_results = results
                    console.log(`try ${tries} failed, trying again, got:`, results)
                }
            }
        }
    })
}

const dumpDiagnostics = async (batch: Batch, address: string) => {
    return batch.mapInstances(async instance => {
        const dump = await instance.stateDump()
        const heldHashes = R.keys(dump.held_aspects).filter(hash => hash.startsWith('Hc'))
        const holding = heldHashes.includes(address)
        return [instance.agentAddress, holding, heldHashes.length]
    })
}

const displayDumpDiagnostics = (diagnostics, address) => {
    console.log('------------------------------------------------------------------------')
    console.log('target address: ', address)
    console.log('format:')
    console.log('[agent ID for state dump] : [is holding target] ([num agent entries held])')
    console.log('------------------------------------------------------------------------')
    for (const [address, holding, numHeld] of diagnostics) {
        console.log(`${address} : ${holding ? '✅ YES' : '❌ NO '}  (${numHeld})`)
    }
}