export function b64_2ab(v: any) {
  if (v instanceof ArrayBuffer) {
    return v
  }
  if (v instanceof Uint8Array) {
    return v.buffer
  }
  if (typeof v === 'string') {
    const bs =
      (Buffer && Buffer.from(v as string, 'base64').toString('latin1')) || atob(v as string)
    const data = new Uint8Array(bs.length)
    for (let i = 0; i < bs.length; i++) {
      data[i] = bs.charCodeAt(i)
    }
    return data.buffer
  }
  return v
}
