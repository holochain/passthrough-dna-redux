import * as R from 'ramda'
import { Config } from '@holochain/tryorama'
import { Batch } from '@holochain/tryorama-stress-utils'
import { telephoneGame } from './telephone-common'

module.exports = (scenario, configBatchSimple, N, C, I) => {
    const totalInstances = N*C*I
    const totalConductors = N*C
    scenario('telephone game: const entry -> entry', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalConductors, I), false))
        const init = (instance) => {
            return instance.call('main', 'commit_entry', { content: 'base' }).then(r => r.Ok)
        }

        const preSpawn = () => {}

        const postSpawn = async (instance, baseHash, i) => {
            console.log("Committing entry")
            const entryHash = await instance.call('main', 'commit_entry', { content: 'player'+(i-1) }).then(r => r.Ok)
            console.log("Committing link")
            const link_result = await instance.call('main', 'link_entries', { base: baseHash, target: entryHash })
            console.log(`link result: ${link_result}`)
            t.ok(link_result)
        }

        const stepCheck = async (instance, baseHash, i) => {
            console.log(`Trying to get base from node ${i}`)
            const base = await instance.call('main', 'get_entry', {address: baseHash})
            t.ok(base)
            t.deepEqual(base.Ok, { App: [ 'generic_entry', 'base' ] })
            console.log("Trying to get all previous links on new node")
            const links = await instance.call('main', 'get_links', { base: baseHash })
            t.ok(links)
            t.equal(links.Ok.links.length, i)
        }

        // timeout is one additional second per instance
        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck},(totalInstances*1000))
    })

    scenario('telephone game: const entry -> agent_id', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalConductors, I), false))

        const init = (instance) => {
            return instance.call('main', 'commit_entry', { content: 'base' }).then(r => r.Ok)
        }

        const preSpawn = () => {}

        const postSpawn = async (instance, baseHash, i) => {
            console.log("Committing link")
            const link_result = await instance.call('main', 'link_entries_typed', {
                base: baseHash,
                target: instance.agentAddress,
                link_type: 'entry_2_agent'
            })
            console.log(`link result: ${link_result}`)
            t.ok(link_result)
        }

        const stepCheck = async (instance, baseHash, i) => {
            console.log(`Trying to get base from node ${i}`)
            const base = await instance.call('main', 'get_entry', {address: baseHash})
            t.ok(base)

            console.log("Trying to get all previous links on new node")
            const links = await instance.call('main', 'get_links', { base: baseHash })
            t.ok(links)
            t.equal(links.Ok.links.length, i)
        }

        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck},(totalInstances*1000))
    })

    scenario('telephone game: get all previously seen agent entries', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalConductors, I), false))

        const init = () => {
            return []
        }

        const preSpawn = (instance, all_agents) => { all_agents.push(instance.agentAddress) }

        const postSpawn = () => {}

        const stepCheck = async (instance, all_agents, i) => {
            for(let agent_id of all_agents) {
                const agent_entry = await instance.call('main', 'get_entry', {address: agent_id})
                console.log("AGENT ENTRY:", agent_entry)
                t.ok(agent_entry)
                t.ok(agent_entry.Ok)
            }
        }

        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck},(totalInstances*1000))
    })

    scenario('telephone game:  agent_id -> const entry', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalConductors, I), false))

        const init = (instance) => {
            return instance.agentAddress
        }

        const preSpawn = () => {}

        const postSpawn = async (instance, baseHash, i) => {
            console.log("Committing entry")
            const entryHash = await instance.call('main', 'commit_entry', { content: 'player'+(i-1) }).then(r => r.Ok)
            console.log("Committing link")
            const link_result = await instance.call('main', 'link_entries_typed', {
                base: baseHash,
                target: entryHash,
                link_type: 'agent_2_entry'
            })
            console.log(`link result: ${link_result}`)
            t.ok(link_result)
        }

        const stepCheck = async (instance, baseHash, i) => {
            console.log(`Trying to get base from node ${i}`)
            const base = await instance.call('main', 'get_entry', {address: baseHash})
            t.ok(base)

            console.log("Trying to get all previous links on new node")
            const links = await instance.call('main', 'get_links', { base: baseHash })
            t.ok(links)
            t.equal(links.Ok.links.length, i)
        }

        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck},(totalInstances*1000))
    })

    scenario('telephone game:  complex initial data', async (s, t) => {
        const players = R.values(await s.players(configBatchSimple(totalConductors, I)
, false))

        const init = async (instance) => {
            console.log("Committing entry")
            const aHash = await instance.call('main', 'commit_entry', { content: 'a' }).then(r => r.Ok)
            const bHash = await instance.call('main', 'commit_entry', { content: 'b' }).then(r => r.Ok)
            const link1 = await instance.call('main', 'link_entries_typed', {
                base: instance.agentAddress,
                target: aHash,
                link_type: 'agent_2_entry'
            })
            t.ok(link1)
            const link2 = await instance.call('main', 'link_entries_typed', {
                base: aHash,
                target: bHash,
                link_type: ''
            })
            t.ok(link2)
            const link3 = await instance.call('main', 'link_entries_typed', {
                base: bHash,
                target: instance.agentAddress,
                link_type: 'entry_2_agent'
            })
            t.ok(link3)
            return {agent: instance.agentAddress, aHash, bHash}
        }

        const preSpawn = () => {}

        const postSpawn = async () => {}

        const stepCheck = async (instance, initialData, i) => {
            let {agent, aHash, bHash} = initialData
            console.log(`Trying to get base from node ${i}`)
            const agent_entry = await instance.call('main', 'get_entry', {address: agent})
            t.ok(agent_entry)
            const a = await instance.call('main', 'get_entry', {address: aHash})
            t.ok(a)
            t.ok(a.Ok)
            const b = await instance.call('main', 'get_entry', {address: bHash})
            t.ok(b)
            t.ok(b.Ok)

            const agent_links = await instance.call('main', 'get_links', { base: agent })
            t.ok(agent_links)
            t.equal(agent_links.Ok.links.length, 1)
            t.equal(agent_links.Ok.links[0].address, aHash)

            const a_links = await instance.call('main', 'get_links', { base: aHash })
            t.ok(a_links)
            t.equal(a_links.Ok.links.length, 1)
            t.equal(a_links.Ok.links[0].address, bHash)

            const b_links = await instance.call('main', 'get_links', { base: bHash })
            t.ok(b_links)
            t.equal(b_links.Ok.links.length, 1)
            t.equal(b_links.Ok.links[0].address, agent)
        }

        // timeout of 5 base seconds plus 2 seconds per instance
        await telephoneGame(s, t, totalInstances, players, {init, preSpawn, postSpawn, stepCheck}, 5000+(totalInstances*2000))
    })
}
