export function decodeBase64(v: any) {
  if (v instanceof ArrayBuffer) {
    return v
  }
  if (v instanceof Uint8Array) {
    return v.buffer
  }
  if (typeof v === "string") {
    const bs = atob(v as string)
    var data = new Uint8Array(bs.length)
    for (let i = 0; i < bs.length; i++) {
      data[i] = bs.charCodeAt(i)
    }
    return data.buffer
  }
  return v
}
