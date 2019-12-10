/**
 * Run a function at intervals until some condition is met,
 * capturing the result (or timeout event) in a Promise
 *
 * TODO: move to stress-utils if this works
 */


const defaultOpts = { timeout: 90000, interval: 1000 }
const identity = x => x

export const pollFor = <A>(
  fn: () => A,
  pred = identity,
  { timeout, interval } = defaultOpts
): Promise<A> => new Promise(
  (fulfill, reject) => {
    let t = 0
    const run = async () => {
      Promise.resolve(fn()).then(val => {
        if (pred(val)) {
          fulfill(val)
        } else {
          if (t >= timeout) {
            console.log(`pollFor timed out after ${timeout}ms`)
            reject(`pollFor timed out after ${timeout}ms`)
          } else {
            t += interval
            setTimeout(run, interval)
          }
        }
      })
    }
    run()
  }
)
