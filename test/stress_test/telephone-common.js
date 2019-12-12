// This is a customizable blue print for "telephone game" network/time topology setups.
// It cycles through all N agents in a way that at any given point only two agents
// are online. Before the next agent is spawned, the older one gets killed,
// such that every agent needs to first receive all previous data so it can gossip
// it to the next one.
//
// Callbacks:
// * init: gets called with the very first agent. Its return value will be saved through the whole loop
//         and passed to each call of the other two callbacks
// * preSpawn: before the next agent gets spawned, this callback is called with the older one to have it create new
//             entries/links while it is alone
// * postSpawn: after the next agent was spawned, this callback is called with the older one to have it create new
//              entries/links while the new agent is there
// * stepCheck:
const telephoneGame = async (s, t, N, players, functions, timeout = 5000) => {
    const STEP_TIMEOUT_MS = timeout
    let {init, preSpawn, postSpawn, stepCheck} = functions
    console.log("##################################")
    console.log("### Starting 'telephone game'")
    console.log("##################################")
    console.log("Initializing first node")
    await players[0].spawn()
    const instance1 = await players[0]._instances[0]
    const baseHash = await init(instance1)

    for(let i=1;i<N-1;i++) {
        console.log("----------------------------------")
        console.log("##################################")
        console.log(`###Iteration ${i} (${i-1} -> ${i})`)
        console.log("##################################")
        console.log("----------------------------------")
        const instance1 = await players[i-1]._instances[0]

        console.log("##################################")
        console.log("### PRE SPAWN")
        console.log("##################################")
        await preSpawn(instance1, baseHash, i)
        await s.consistency()
        console.log("##################################")
        console.log(`### SPAWNING NODE ${i}`)
        console.log("##################################")
        await players[i].spawn()
        await s.consistency()
        const instance2 = await players[i]._instances[0]

        console.log("##################################")
        console.log("### POST SPAWN")
        console.log("##################################")
        await postSpawn(instance1, baseHash, i)
        await s.consistency()

        console.log("##################################")
        console.log("### STEP CHECK")
        console.log("##################################")
        await stepCheck(instance2, baseHash, i)

        console.log("Killing old node")
        players[i-1].kill()
    }
}
module.exports = {
  telephoneGame
}
