export function decodeBase64(v: any) {
  const a2b = (s: string) => {
    if (Buffer) {
      return Buffer.from(s, "base64").toString("ascii")
    }
    if (typeof atob !== "undefined") {
      return atob(s)
    }
    throw new Error("Unsupported operation a2b")
  }

  if (v instanceof ArrayBuffer) {
    return v
  }
  if (v instanceof Uint8Array) {
    return v.buffer
  }
  if (typeof v === "string") {
    const bs = a2b(v as string)
    var data = new Uint8Array(bs.length)
    for (let i = 0; i < bs.length; i++) {
      data[i] = bs.charCodeAt(i)
    }
    return data.buffer
  }
  return v
}
