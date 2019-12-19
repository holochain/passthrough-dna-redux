import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { parameterizedSteps, periodically } from '@holochain/tryorama-stress-utils'

import { Orchestrator, tapeExecutor, singleConductor, compose, localOnly, groupPlayersByMachine } from '@holochain/tryorama'

process.on('unhandledRejection', error => {
  console.error('got unhandledRejection:', error);
});

const network = {
  type: 'sim2h',
  sim2h_url: "wss://localhost:9002",
}

const dna = Config.dna('../dist/passthrough-dna.dna.json', 'passthrough')

console.log("using dna: "+ JSON.stringify(dna))
console.log("using network: "+ JSON.stringify(network))
const orchestrator = new Orchestrator()

const commonConfig = {
  network,
  logger: Config.logger(true)
}

const config = Config.gen(
  {app: dna, bob: dna},
  commonConfig
)

orchestrator.registerScenario("Behavior: Can commit an entry then get", async (s, t) => {
  const duration = 5000
  const multiplier = 0.5
  const init = () => s.players({ alice: config }, true)
  const stage = async ({alice, bob}, {period, fails}) => {
    if (fails) {
      throw new Error('artificial error')
    }
    await periodically({duration, period}, async () => {
      const result = await alice.call("app", "main", "commit_entry", { content: "entry content ..." })
      console.log(result)
      t.ok(result.Ok)

      await s.consistency()

      const get_result = await bob.call("app", "main", "get_entry", { address: result.Ok })
      console.log(get_result)
      t.deepEqual(get_result.Ok.App[1], "entry content ...")
    })
    return {alice, bob}
  }

  await parameterizedSteps({
    init, stage,
    fail: t.fail,
    parameters: {
      // period starts at 1000 and changes by `multiplier` each step
      period: t => 1000 * Math.pow(multiplier, t),
    }
  })
})

orchestrator.run()
