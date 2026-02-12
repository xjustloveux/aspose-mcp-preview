/**
 * Extract a slice of binary data from the buffer
 * @param {Buffer} buffer - Source buffer
 * @param {number} offset - Start offset
 * @param {number} length - Number of bytes to read
 * @returns {Buffer}
 */
export function readFromStdin(buffer, offset, length) {
  if (buffer.length < offset + length) {
    throw new Error(
      `Not enough data in buffer: need ${length} bytes at offset ${offset}, have ${buffer.length}`
    );
  }

  return buffer.subarray(offset, offset + length);
}

/**
 * Parse a 64-bit little-endian length prefix from the buffer
 * @param {Buffer} buffer - Buffer containing the length prefix
 * @param {number} [offset=0] - Offset where length prefix starts
 * @returns {bigint}
 */
export function parseLengthPrefix(buffer, offset = 0) {
  if (buffer.length < offset + 8) {
    throw new Error('Not enough data for length prefix');
  }

  return buffer.readBigInt64LE(offset);
}
