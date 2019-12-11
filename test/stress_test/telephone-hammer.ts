import * as R from 'ramda'
import { Config } from '@holochain/tryorama'
import { Batch } from '@holochain/tryorama-stress-utils'
import { telephoneGame } from './telephone-common'

module.exports = (scenario, configBatchSimple, N, C, I, J) => {
    const totalInstances = N*C*I
    const totalConductors = N*C
    scenario('telephone hammer: const entry -> entry', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalInstances, I), false))
        const init = (instance) => {
            return instance.call('main', 'commit_entry', { content: 'base' }).then(r => r.Ok)
        }

        const preSpawn = () => {}

        const postSpawn = async (instance, baseHash, i) => {
            console.log("Committing entry")
            const entryHash = await instance.call('main', 'commit_entry', { content: 'player'+(i-1) }).then(r => r.Ok)
            console.log(`Committing ${J} links`)
            for(let j=0;j<J;j++) {
                const link_result = await instance.call('main', 'link_entries', { base: baseHash, target: entryHash })
                console.log(`link ${j} result: ${link_result}`)
                t.ok(link_result)
            }
        }

        const stepCheck = async (instance, baseHash, i) => {
            console.log(`Trying to get base from node ${i}`)
            const base = await instance.call('main', 'get_entry', {address: baseHash})
            t.ok(base)
            t.deepEqual(base.Ok, { App: [ 'generic_entry', 'base' ] })
            console.log("Trying to get all previous links on new node")
            const links = await instance.call('main', 'get_links', { base: baseHash })
            t.ok(links)
            t.equal(links.Ok.links.length, i*J)
        }
        // timeout is 5 base seconds plus 1 second per node, plus 200ms per count
        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck}, 5000+1000*totalInstances+200*J)
    })
}
