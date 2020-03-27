const path = require('path')
const tape = require('tape')

const { Orchestrator, Config, tapeExecutor, combine, localOnly } = require('@holochain/tryorama')

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error('got unhandledRejection:', error);
});

var transport_config = {
    type: 'sim2h',
    sim2h_url: "ws://localhost:9000"
}

if (process.env.HC_TRANSPORT_CONFIG) {
    transport_config=require(process.env.HC_TRANSPORT_CONFIG)
}

const delay = ms => new Promise(r => setTimeout(r, ms))

const dnaPath = path.join(__dirname, "../dist/passthrough-dna.dna.json")
const dna = Config.dna(dnaPath, 'passthrough-dna')
const logger = {
  type: 'debug',
  rules: {
    rules: [
      {
        exclude: true,
        pattern: '.*parity.*'
      },
      {
        exclude: true,
        pattern: '.*mio.*'
      },
      {
        exclude: true,
        pattern: '.*tokio.*'
      },
      {
        exclude: true,
        pattern: '.*hyper.*'
      },
      {
        exclude: true,
        pattern: '.*rusoto_core.*'
      },
      {
        exclude: true,
        pattern: '.*want.*'
      },
      {
        exclude: true,
        pattern: '.*rpc.*'
      }
    ]
  },
  state_dump: true
  // dpki: {
  //   instance_id: 'dpki_happ',
  //   init_params: {"revocation_key": "HcSCiPdMkst9geux7y7kPoVx3W54Ebwkk6fFWjH9V6oIbqi77H4i9qGXRsDcdbi","signed_auth_key":"zJkRXrrbvbzbH96SpapO5lDWoElpzB1rDE+4zbo/VthM/mp9qNKaVsGiVKnHkqT4f5J4MGN+q18xP/hwQUKyDA=="}
  // },
}

const config = Config.gen(
    {
        app: dna
    },
    // global configuration info
    {
      ... logger,
        network: transport_config
    }
)

// default middleware is local and tape
const orchestrator = new Orchestrator()

orchestrator.registerScenario("Can commit an entry then get", async (s, t) => {
  const { alice } = await s.players({ alice: config }, true)
  const result = await alice.call("app", "main", "commit_entry", { content: "entry content ..." })
  console.log(result)
  t.ok(result.Ok)

  const get_result = await alice.call("app", "main", "get_entry", { address: result.Ok })
  console.log(get_result)
  t.deepEqual(get_result.Ok.App[1], "entry content ...")
})

orchestrator.registerScenario.only("Can commit an entry and link then get links", async (s, t) => {
  const { alice } = await s.players({ alice: config }, true)
  const commit1 = await alice.call('app', 'main', 'commit_entry', {
    content: 'content1'
  })
  const commit2 = await alice.call('app', 'main', 'commit_entry', {
    content: 'content2'
  })
  const hash1 = commit1.Ok
  const hash2 = commit2.Ok

  const linkResult = await alice.call('app', 'main', 'link_entries', {
    base: hash1,
    target: hash2,
  })
  t.ok(linkResult.Ok)

  const commit3 = await alice.call('app', 'main', 'commit_entry', {
    content: 'content3'
  })

  const aliceLinks = await alice.call('app', 'main', 'get_links', {
    base: hash1
  })
  t.equal(aliceLinks.Ok.links.length, 1)


  const aliceDump = await alice.stateDump('app')
  console.log(aliceDump)

  console.log("NOW!!!!")
  await delay(30000)
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


orchestrator.registerScenario('late joiners still hold aspects', async (s, t) => {
  const { alice } = await s.players({ alice: config }, true)

  const commit1 = await alice.call('app', 'main', 'commit_entry', {
    content: 'content'
  })
  const commit2 = await alice.call('app', 'main', 'commit_entry', {
    content: 'content'
  })
  const hash1 = commit1.Ok
  const hash2 = commit2.Ok

  const linkResult = await alice.call('app', 'main', 'link_entries', {
    base: hash1,
    target: hash2,
  })
  const linkHash = linkResult.Ok
  await s.consistency()

  // bob and carol join later
  const { bob, carol } = await s.players({ bob: config, carol: config }, true)

  await s.consistency()
  // await new Promise(r => setTimeout(r, 30000)) // keep this until consistency works with dynamic starting agents

  // after the consistency waiting inherent in auto-spawning the new players, their state dumps
  // should immediately show that they are holding alice's entries
  const bobDump = await bob.stateDump('app')
  const carolDump = await bob.stateDump('app')

  console.log('bobDump', bobDump)
  console.log('carolDump', carolDump)

  t.ok(hash1 in bobDump.held_aspects)
  t.ok(hash2 in bobDump.held_aspects)
  t.ok(linkHash in bobDump.held_aspects)
  t.ok(hash1 in carolDump.held_aspects)
  t.ok(hash2 in carolDump.held_aspects)
  t.ok(linkHash in carolDump.held_aspects)

  const aliceLinks = await alice.call('app', 'main', 'get_links', {
    base: hash1
  })
  const bobLinks = await bob.call('app', 'main', 'get_links', {
    base: hash1
  })
  const carolLinks = await carol.call('app', 'main', 'get_links', {
    base: hash1
  })

  t.equal(aliceLinks.Ok.links.length, 1)
  t.equal(bobLinks.Ok.links.length, 1)
  t.equal(carolLinks.Ok.links.length, 1)

})

orchestrator.run()
