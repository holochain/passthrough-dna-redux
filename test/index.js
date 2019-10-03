const path = require('path')
const tape = require('tape')

const { Diorama, tapeExecutor, backwardCompatibilityMiddleware } = require('@holochain/diorama')

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error('got unhandledRejection:', error);
});

const dnaPath = path.join(__dirname, "../dist/passthrough-dna.dna.json")
const dna = Diorama.dna(dnaPath, 'passthrough-dna')

const diorama = new Diorama({
  instances: {
    alice: dna,
    bob: dna,
  },
  bridges: [],
  debugLog: false,
  executor: tapeExecutor(require('tape')),
  middleware: backwardCompatibilityMiddleware,
})

diorama.registerScenario("Can commit an entry then get", async (s, t, { alice }) => {
  const result = await alice.call("main", "commit_entry", {content : "entry content ..."})
  console.log(result)
  t.ok(result.Ok)

  const get_result = await alice.call("main", "get_entry", {address : result.Ok})
  console.log(get_result)
  t.deepEqual(get_result.Ok.App[1], "entry content ...")
})

diorama.registerScenario("Can send message and get response", async (s, t, { alice, bob }) => {
  const result = await alice.call("main", "send", {to_agent: bob.agentId, payload: "message payload .."})
  console.log(result)
  t.equal(result.Ok, "success")
})

diorama.registerScenario("Can add two entries, link together then retrieve", async (s, t, { alice }) => {
  const commit1 = await alice.callSync("main", "commit_entry", {content : "1 - entry content ..."})
  const commit2 = await alice.callSync("main", "commit_entry", {content : "2 - entry content ..."})
  const linkResult = await alice.callSync("main", "link_entries", {base: commit1.Ok, target: commit2.Ok})
  console.log(linkResult)
  t.ok(linkResult.Ok)

  const getLinksResult = await alice.callSync("main", "get_links", { base: commit1.Ok })
  console.log(getLinksResult)
  t.equal(getLinksResult.Ok.links.length, 1)
})

diorama.run()
