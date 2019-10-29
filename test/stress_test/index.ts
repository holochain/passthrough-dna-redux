const { Orchestrator, tapeExecutor, singleConductor, combine } = require('@holochain/try-o-rama')

process.on('unhandledRejection', error => {
  console.error('got unhandledRejection:', error);
});

const networkType = process.env.APP_SPEC_NETWORK_TYPE || 'sim1h'
let network = null
let middleware = null

switch (networkType) {
  case 'memory':
    network = 'memory'
    middleware = combine(singleConductor, tapeExecutor(require('tape')))
    break
  case 'sim1h':
    network = {
      type: 'sim1h',
      dynamo_url: "http://localhost:8000",
    }
    middleware = tapeExecutor(require('tape'))
    break
  case 'sim2h':
    network = {
      type: 'sim2h',
      sim2h_url: "wss://localhost:9002",
    }
    middleware = tapeExecutor(require('tape'))
    break
  default:
    throw new Error(`Unsupported network type: ${networkType}`)
}

if (process.env.HC_TRANSPORT_CONFIG) {
    network=require(process.env.HC_TRANSPORT_CONFIG)
}

const orchestrator = new Orchestrator({
  middleware,
  globalConfig: {
    network,
    logger: true
  }
})

let stress_config = {
    conductors: 10,
    instances: 1
}

// first arg is the path to a config file
if (process.argv[2]) {
    stress_config=require(process.argv[2])
}

console.log(`Running stress tests with N=${stress_config.conductors}, M=${stress_config.instances}`)

require('./all-on')(orchestrator.registerScenario, stress_config.conductors, stress_config.instances)

orchestrator.run()
