const path = require('path')
const tape = require('tape')

const { Orchestrator, Config, tapeExecutor, combine, localOnly } = require('@holochain/try-o-rama')

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error('got unhandledRejection:', error);
});

const dnaPath = path.join(__dirname, "../dist/passthrough-dna.dna.json")
const dna = Config.dna(dnaPath, 'passthrough-dna')
const config = {
  instances: { app: dna }
}

var transport_config = {
    type: 'sim1h',
    dynamo_url: "http://localhost:8000"
}

if (process.env.HC_TRANSPORT_CONFIG) {
    transport_config=require(process.env.HC_TRANSPORT_CONFIG)
}

const orchestrator = new Orchestrator({
  middleware: combine(tapeExecutor(require('tape')), localOnly),
  globalConfig: {
    logger: false,
      network: transport_config
  }
})

orchestrator.registerScenario("Can commit an entry then get", async (s, t) => {
  const { alice } = await s.players({ alice: config }, true)
  const result = await alice.call("app", "main", "commit_entry", { content: "entry content ..." })
  console.log(result)
  t.ok(result.Ok)

  const get_result = await alice.call("app", "main", "get_entry", { address: result.Ok })
  console.log(get_result)
  t.deepEqual(get_result.Ok.App[1], "entry content ...")
})

orchestrator.registerScenario("Can send message and get response", async (s, t) => {
  const { alice, bob } = await s.players({ alice: config, bob: config }, true)
  const result = await alice.call("app", "main", "send", { to_agent: bob.info('app').agentAddress, payload: "message payload .." })
  console.log(result)
  t.equal(result.Ok, "success")
})

orchestrator.registerScenario("Can add two entries, link together then retrieve", async (s, t) => {
  const { alice } = await s.players({ alice: config }, true)
  const commit1 = await alice.call("app", "main", "commit_entry", { content: "1 - entry content ..." })
  const commit2 = await alice.call("app", "main", "commit_entry", { content: "2 - entry content ..." })
  await s.consistency()
  const linkResult = await alice.call("app", "main", "link_entries", { base: commit1.Ok, target: commit2.Ok })
  await s.consistency()
  console.log(linkResult)
  t.ok(linkResult.Ok)

  const getLinksResult = await alice.call("app", "main", "get_links", { base: commit1.Ok })
  await s.consistency()
  console.log(getLinksResult)
  t.equal(getLinksResult.Ok.links.length, 1)
})

orchestrator.run()
