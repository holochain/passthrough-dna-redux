import * as R from 'ramda'
import { Batch } from '@holochain/tryorama-stress-utils'

const trace = R.tap(x => console.log('{T}', x))

module.exports = (scenario, configBatchSimple, N, C, I, J) => {
  const totalInstances = N*C*I
  const totalConductors = N*C
  
  scenario('direct messages to one agent', async (s, t) => {
    const players = R.values(await s.players(configBatchSimple(totalConductors, I), true))
    const batch = new Batch(players).iteration('series')

    const instance0 = await players[0]._instances[0]
    const messageTarget = instance0.agentAddress

    // have every instance the target so it receives a message storm
    const messageResponses = await batch.mapInstances(instance =>
      instance.call('main', 'send', { to_agent: messageTarget, payload: "cop this" })
    )
    
    t.deepEqual(messageResponses, R.repeat({ Ok: 'success' }, totalInstances))
  })

  scenario('direct messages between agents', async (s, t) => {
    const players = R.values(await s.players(configBatchSimple(totalConductors, I), true))
    const batch = new Batch(players).iteration('series')

    const addresses = await batch.mapInstances(instance =>
      Promise.resolve(instance.agentAddress)
    )

    // have every instance message the next in a cyclic array
    const messageResponses = await batch.mapInstances(instance => {
   	  const messageTarget = addresses[(addresses.indexOf(instance.agentAddress) + 1) % addresses.length]
      return instance.call('main', 'send', { to_agent: messageTarget, payload: "cop this" })
    })

    t.deepEqual(messageResponses, R.repeat({ Ok: 'success' }, totalInstances))
  })

}
