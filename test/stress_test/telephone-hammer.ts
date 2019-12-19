import * as R from 'ramda'
import { Config } from '@holochain/tryorama'
import { Batch, parameterizedStages } from '@holochain/tryorama-stress-utils'
import { telephoneGame } from './telephone-common'

module.exports = (scenario, configBatchSimple, N, C, I, initialLinks) => {

    const totalInstances = N * C * I

    scenario.only('telephone hammer: const entry -> entry (parameterized)', async (s, t) => {
        const init = async () => {
            return R.values(await s.players(configBatchSimple(totalInstances, I), false))
        }

        const stage = async (players, {numLinks}) => {
            await telephoneHammer(s, t, players, totalInstances, numLinks)
            return players
        }

        const result = await parameterizedStages({
            init: init,
            stage: stage,
            fail: s.fail,
            failHandler: s.onFail,
            parameters: {
                // if initializeLinks is 10, the sequence is:
                // 10, 20, 40, 80, 160, ...
                numLinks: t => initialLinks * Math.pow(2, t)
            }
        })

        t.comment('telephone hammer done. results:')
        t.comment(JSON.stringify(result, null, 2))
   })
}

const telephoneHammer = async (s, t, players, totalInstances, linksPerRound) => {

    const init = (instance) => {
        return instance.call('main', 'commit_entry', { content: 'base' }).then(r => r.Ok)
    }

    const preSpawn = () => {}

    const postSpawn = async (instance, baseHash, i) => {
        console.log("Committing entry")
        const entryHash = await instance.call('main', 'commit_entry', { content: 'player' + (i-1) }).then(r => r.Ok)
        console.log(`Committing ${linksPerRound} links`)
        for(let j=0; j < linksPerRound; j++) {
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
        t.equal(links.Ok.links.length, i * linksPerRound)
    }

    // timeout is 5 base seconds plus 1 second per node, plus 200ms per count
    const timeout = 5000 + 1000 * totalInstances + 200 * linksPerRound
    await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck}, timeout)
}