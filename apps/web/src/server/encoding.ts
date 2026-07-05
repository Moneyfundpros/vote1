/** Encode a bytea/Buffer column value (receipt_hash etc.) to the public hex ref. */
export function bytesToHex(value: Buffer | Uint8Array | { toString(enc: 'hex'): string }): string {
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  return value.toString('hex');
}
