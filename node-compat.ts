const tmp = require("os").tmpdir()
const util = require("util")

import fetch from "node-fetch"
;(global as any).localStorage = new (require("node-localstorage")).LocalStorage(
  tmp,
  5 * 1024 * 1024 * 1024
)
import * as Crypto from "node-webcrypto-ossl"
;(global as any).fetch = fetch
;(global as any).Storage = ""
;(global as any).TextDecoder = util.TextDecoder
;(global as any).TextEncoder = util.TextEncoder

export const crypto = new Crypto()
export const nodeFetch = fetch
