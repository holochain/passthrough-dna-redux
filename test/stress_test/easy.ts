import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { Batch } from '@holochain/tryorama-stress-utils'


const trace = R.tap(x => console.log('{T}', x))

module.exports = (scenario, configBatch, N, C, I) => {
    const totalInstances = N*C*I
    const totalConductors = N*C

    scenario('all agents exists', async (s, t) => {
        const players = R.sortBy(p => parseInt(p.name, 10), R.values(await s.players(configBatch(totalConductors, I), false)))

        await Promise.all(players.map(player => player.spawn()))

        const batch = new Batch(players).iteration('series')

        await s.consistency()

        const agentIds = await batch.mapInstances(async instance => instance.agentAddress)
        let results = []
        await batch.mapInstances(async instance => {
            for (const id of agentIds) {
                if (instance.agentAddress != id) {
                    const result = await instance.call('main', 'get_entry', {address: instance.agentAddress})
                    results.push( Boolean(result.Ok) )
                }
            }
        })
        console.log("RESULTS:", results)
        // All results contain the full set of other nodes
        t.deepEqual(results , R.repeat(true,totalInstances*(totalInstances-1)))
    })
}
