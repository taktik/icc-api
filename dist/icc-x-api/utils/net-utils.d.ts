export declare function sleep(ms: number): Promise<any>
export declare function retry<P>(
  fn: () => Promise<P>,
  retryCount?: number,
  sleepTime?: number,
  exponentialFactor?: number
): Promise<P>
