import { Config } from '@holochain/tryorama'
import * as R from 'ramda'
import { configBatchSimple } from '@holochain/tryorama-stress-utils';

import { Orchestrator, tapeExecutor, singleConductor, compose, localOnly, groupPlayersByMachine } from '@holochain/tryorama'

process.on('unhandledRejection', error => {
  console.error('got unhandledRejection:', error);
});

const networkType = process.env.APP_SPEC_NETWORK_TYPE || 'sim2h_public'
let network = null

// default middleware is localOnly
let middleware = compose(tapeExecutor(require('tape')), localOnly)

switch (networkType) {
  case 'memory':
    network = Config.network('memory')
    middleware = compose(tapeExecutor(require('tape')), singleConductor)
    break
  case 'sim1h':
    network = {
      type: 'sim1h',
      dynamo_url: "http://localhost:8000",
    }
    break
  case 'sim2h':
    network = {
      type: 'sim2h',
      sim2h_url: "wss://localhost:9002",
    }
    break
  case 'sim2h_public':
      network = {
          type: 'sim2h',
          sim2h_url: "wss://sim2h.holochain.org:9000",
      }
      break
  default:
    throw new Error(`Unsupported network type: ${networkType}`)
}

if (process.env.HC_TRANSPORT_CONFIG) {
    network=require(process.env.HC_TRANSPORT_CONFIG)
    console.log("setting network from:"+process.env.HC_TRANSPORT_CONFIG)
}

// default stress test is local (because there are no endpoints specified)
const defaultStressConfig = {
  nodes: 1,
    conductors: 10,
    instances: 1,
    endpoints: undefined,
    tests: {
        allOn: {
            skip: false
        },
        telephoneGame: {
            skip: true
        },
        telephoneHammer: {
            skip: true,
            count: 10
        },
        directMessage: {
            skip: false
        },
    }
}

const runName = process.argv[2] || ""+Date.now()  // default exam name is just a timestamp

// second arg is an optional stress config file
const stressConfig = process.argv[3] ? require(process.argv[3]) : defaultStressConfig

const dnaLocal = Config.dna('../dist/passthrough-dna.dna.json', 'passthrough')
const dnaRemote = Config.dna('https://github.com/holochain/passthrough-dna/releases/download/v0.0.6/passthrough-dna.dna.json', 'passthrough')
let chosenDna = dnaLocal;

let metric_publisher;
// if there are endpoints specified then we use the machinePerPlayer middleware so tryorama
// knows to connect to trycp on those endpoints for running the tests
if (stressConfig.endpoints) {
    chosenDna = dnaRemote
    middleware = compose(tapeExecutor(require('tape')), groupPlayersByMachine(stressConfig.endpoints, stressConfig.conductors))

    metric_publisher = ({scenarioName, playerName}) => ({
        type: 'cloudwatchlogs',
        log_stream_name: "".concat(runName, ".", networkType, ".", 'passthrough-dna', ".", scenarioName, ".", playerName),
        log_group_name: '/holochain/trycp/'
    })

} else {
    metric_publisher = { type: 'logger' }
}

console.log("using dna: "+ JSON.stringify(chosenDna))
console.log("using network: "+ JSON.stringify(network))
const orchestrator = new Orchestrator({
    middleware,
})

const commonConfig = {
  network,
  logger: Config.logger(true),
  metric_publisher
}

const batcher = (numConductors, instancesPerConductor) => configBatchSimple(
  numConductors,
  instancesPerConductor,
  chosenDna,
  commonConfig
)

console.log(`Running stress test id=${runName} with Nodes=${stressConfig.nodes} Conductors=${stressConfig.conductors}, Instances=${stressConfig.instances}`)

if (stressConfig.tests == undefined) {
  stressConfig.tests = {
    allOn: {
      skip: false
    }
  }
}

if (stressConfig.tests["allOn"]  && !stressConfig.tests["allOn"].skip) {
  console.log("running all-on")
  require('./all-on')(orchestrator.registerScenario, batcher, stressConfig.nodes, stressConfig.conductors, stressConfig.instances)
}

if (stressConfig.tests["telephoneGame"] && !stressConfig.tests["telephoneGame"].skip) {
  console.log("running telephone game")
  require('./telephone-games')(orchestrator.registerScenario, batcher, stressConfig.nodes, stressConfig.conductors, stressConfig.instances)
}

if (stressConfig.tests["telephoneHammer"]  && !stressConfig.tests["telephoneHammer"].skip) {
  console.log("running telephone hammer")
  let count = stressConfig.tests["telephoneHammer"].count
  require('./telephone-hammer')(orchestrator.registerScenario, batcher, stressConfig.nodes, stressConfig.conductors, stressConfig.instances, count)
}

if (stressConfig.tests["directMessage"]  && !stressConfig.tests["directMessage"].skip) {
  console.log("running direct messages")
  let count = stressConfig.tests["directMessage"].count
  require('./direct-message')(orchestrator.registerScenario, batcher, stressConfig.nodes, stressConfig.conductors, stressConfig.instances, count)
}

orchestrator.run()
