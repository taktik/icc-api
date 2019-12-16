"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
exports.sleep = sleep
function retry(fn, retryCount = 3, sleepTime = 1000, exponentialFactor = 1) {
  let retry = 0
  const doFn = () => {
    return fn().catch(
      e =>
        retry++ < retryCount
          ? (sleepTime && sleep((sleepTime *= exponentialFactor)).then(() => doFn())) || doFn()
          : Promise.reject(e)
    )
  }
  return doFn()
}
exports.retry = retry
//# sourceMappingURL=net-utils.js.map
