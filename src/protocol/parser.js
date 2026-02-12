import { createLogger } from '../logger.js';
import { sendAck, sendPong, sendInitializeResponse } from './ack.js';
import { readFromFile } from './transport/file.js';
import { readFromMmap } from './transport/mmap.js';
import { handleCommand } from './command.js';

const log = createLogger('parser');

let handshakeComplete = false;

/**
 * Create a protocol parser for handling MCP preview messages
 * @param {Object} options
 * @param {string} options.transport - Default transport mode
 * @param {Function} options.onSnapshot - Callback for snapshot messages
 * @param {Function} options.onHeartbeat - Callback for heartbeat messages
 * @param {Function} options.onSessionClosed - Callback for session_closed messages
 * @param {Function} options.onSessionUnbound - Callback for session_unbound messages
 * @param {Function} options.onShutdown - Callback for shutdown messages
 * @param {Function} options.onInitialized - Callback for initialized (handshake complete)
 * @param {Function} options.onError - Callback for errors
 * @returns {Object}
 */
export function createProtocolParser(options) {
  const {
    transport: defaultTransport,
    onSnapshot,
    onHeartbeat,
    onSessionClosed,
    onSessionUnbound,
    onShutdown,
    onInitialized,
    onError
  } = options;

  let buffer = Buffer.alloc(0);
  let started = false;

  /**
   * Parse and process a single message from the buffer
   * @returns {Promise<boolean>}
   */
  async function parseMessage() {
    const newlineIndex = buffer.indexOf('\n');
    if (newlineIndex === -1) {
      return false;
    }

    const jsonLine = buffer.subarray(0, newlineIndex).toString('utf-8');
    let metadata;

    try {
      metadata = JSON.parse(jsonLine);
    } catch (err) {
      onError(new Error(`Failed to parse JSON metadata: ${err.message}`));
      buffer = buffer.subarray(newlineIndex + 1);
      return true;
    }

    const msgType = metadata.type;
    log.debug(`Received message type: ${msgType}`);

    switch (msgType) {
    case 'initialize':
      buffer = buffer.subarray(newlineIndex + 1);
      log.info(`Received initialize, protocolVersion: ${metadata.protocolVersion}`);
      await sendInitializeResponse();
      return true;

    case 'initialized':
      buffer = buffer.subarray(newlineIndex + 1);
      handshakeComplete = true;
      log.info('Handshake complete');
      if (onInitialized) onInitialized();
      return true;

    case 'heartbeat':
      buffer = buffer.subarray(newlineIndex + 1);
      sendPong();
      onHeartbeat();
      return true;

    case 'session_closed':
      buffer = buffer.subarray(newlineIndex + 1);
      onSessionClosed(metadata.sessionId);
      return true;

    case 'session_unbound':
      buffer = buffer.subarray(newlineIndex + 1);
      onSessionUnbound(metadata.sessionId);
      return true;

    case 'shutdown':
      buffer = buffer.subarray(newlineIndex + 1);
      onShutdown();
      return true;

    case 'snapshot':
      return await parseSnapshot(metadata, newlineIndex);

    case 'command':
      buffer = buffer.subarray(newlineIndex + 1);
      handleCommand(metadata);
      return true;

    default:
      log.warn(`Unknown message type: ${metadata.messageType}`);
      buffer = buffer.subarray(newlineIndex + 1);
      return true;
    }
  }

  /**
   * Parse a snapshot message and extract binary data
   * @param {Object} metadata - Parsed metadata
   * @param {number} newlineIndex - Index of newline after JSON
   * @returns {Promise<boolean>}
   */
  async function parseSnapshot(metadata, newlineIndex) {
    const transportMode = metadata.transportMode || defaultTransport;

    if (transportMode === 'file') {
      buffer = buffer.subarray(newlineIndex + 1);

      try {
        const data = await readFromFile(metadata.filePath);
        sendAck(metadata.sequenceNumber);
        onSnapshot(metadata, data);
      } catch (err) {
        onError(new Error(`Failed to read file: ${err.message}`));
      }
      return true;
    }

    if (transportMode === 'mmap') {
      buffer = buffer.subarray(newlineIndex + 1);

      try {
        const data = await readFromMmap(metadata.mmapName, metadata.dataSize, metadata.filePath);
        sendAck(metadata.sequenceNumber);
        onSnapshot(metadata, data);
      } catch (err) {
        onError(new Error(`Failed to read mmap: ${err.message}`));
      }
      return true;
    }

    const dataStart = newlineIndex + 1;
    const lengthPrefixSize = 8;

    if (buffer.length < dataStart + lengthPrefixSize) {
      return false;
    }

    const dataSize = buffer.readBigInt64LE(dataStart);
    const totalSize = dataStart + lengthPrefixSize + Number(dataSize);

    if (buffer.length < totalSize) {
      return false;
    }

    const binaryData = buffer.subarray(dataStart + lengthPrefixSize, totalSize);

    buffer = buffer.subarray(totalSize);

    if (metadata.checksum !== undefined) {
      const calculatedChecksum = calculateCRC32(binaryData);
      if (calculatedChecksum !== metadata.checksum) {
        onError(
          new Error(`Checksum mismatch: expected ${metadata.checksum}, got ${calculatedChecksum}`)
        );
        return true;
      }
    }

    sendAck(metadata.sequenceNumber);
    onSnapshot(metadata, binaryData);
    return true;
  }

  /**
   * Append data to buffer and process all complete messages
   * @param {Buffer} data
   * @returns {Promise<void>}
   */
  async function processData(data) {
    buffer = Buffer.concat([buffer, data]);

    while (await parseMessage()) {
      // Continue processing messages until buffer is exhausted
    }
  }

  /**
   * Start listening for data on stdin
   * @returns {void}
   */
  function start() {
    if (started) return;
    started = true;

    log.debug('Starting protocol parser');

    process.stdin.on('data', async (chunk) => {
      try {
        await processData(chunk);
      } catch (err) {
        onError(err);
      }
    });

    process.stdin.on('error', (err) => {
      onError(err);
    });
  }

  /**
   * Stop listening for data and remove event listeners
   * @returns {void}
   */
  function stop() {
    started = false;
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('error');
  }

  /**
   * Check if handshake is complete
   * @returns {boolean}
   */
  function isReady() {
    return handshakeComplete;
  }

  return {
    start,
    stop,
    processData,
    isReady
  };
}

/**
 * Calculate CRC32 checksum for data integrity verification
 * @param {Buffer} data
 * @returns {number}
 */
function calculateCRC32(data) {
  let crc = 0xffffffff;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Get or generate the CRC32 lookup table
 * @returns {Uint32Array}
 */
let crc32Table = null;
function getCRC32Table() {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[i] = c;
  }
  return crc32Table;
}
