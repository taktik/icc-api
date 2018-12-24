export function sleep(ms: number): Promise<any> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function retry<P>(
  fn: () => Promise<P>,
  retryCount = 3,
  sleepTime = 1000,
  exponentialFactor = 1
): Promise<P> {
  let retry = 0
  const doFn: () => Promise<P> = () => {
    return fn().catch(
      e =>
        retry++ < retryCount
          ? (sleepTime && sleep((sleepTime *= exponentialFactor)).then(() => doFn())) || doFn()
          : Promise.reject(e)
    )
  }
  return doFn()
}
