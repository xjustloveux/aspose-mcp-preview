import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from '../logger.js';

const log = createLogger('ack');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let packageInfo = null;

/**
 * Load package.json information for initialize_response
 * @returns {Promise<Object>}
 */
async function getPackageInfo() {
  if (packageInfo) return packageInfo;

  const packagePath = join(__dirname, '..', '..', 'package.json');
  const fileStream = createReadStream(packagePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let content = '';
  for await (const line of rl) {
    content += line;
  }

  packageInfo = JSON.parse(content);
  return packageInfo;
}

/**
 * Send initialize_response to complete handshake
 * @returns {Promise<void>}
 */
export async function sendInitializeResponse() {
  const pkg = await getPackageInfo();

  const response = {
    type: 'initialize_response',
    name: pkg.name,
    version: pkg.version,
    title: 'Aspose MCP Preview',
    description: pkg.description,
    author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '',
    websiteUrl: pkg.repository?.url?.replace(/\.git$/, '') || ''
  };

  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
  log.info(`Sent initialize_response: ${pkg.name}@${pkg.version}`);
}

/**
 * Send an acknowledgment response to stdout
 * @param {number} sequenceNumber - Sequence number to acknowledge
 * @param {string} [status='processed'] - Status of processing
 * @returns {void}
 */
export function sendAck(sequenceNumber, status = 'processed') {
  const ack = {
    type: 'ack',
    sequenceNumber,
    status
  };

  const json = JSON.stringify(ack);
  process.stdout.write(json + '\n');
  log.debug(`Sent ACK for sequence ${sequenceNumber}`);
}

/**
 * Send a pong response to a heartbeat message
 * @returns {void}
 */
export function sendPong() {
  const pong = {
    type: 'pong'
  };

  const json = JSON.stringify(pong);
  process.stdout.write(json + '\n');
  log.debug('Sent pong');
}

/**
 * Send an error acknowledgment for a failed message
 * @param {number} sequenceNumber - Sequence number that failed
 * @param {string} errorMessage - Error message
 * @returns {void}
 */
export function sendError(sequenceNumber, errorMessage) {
  const error = {
    type: 'ack',
    sequenceNumber,
    status: 'error',
    error: errorMessage
  };

  const json = JSON.stringify(error);
  process.stdout.write(json + '\n');
  log.debug(`Sent error ACK for sequence ${sequenceNumber}: ${errorMessage}`);
}

/**
 * Send a command execution result response
 * @param {string} commandId - Command ID to respond to
 * @param {boolean} success - Whether the command succeeded
 * @param {Object} [result] - Result data (if success)
 * @param {string} [error] - Error message (if failed)
 * @returns {void}
 */
export function sendCommandResult(commandId, success, result = null, error = null) {
  const response = {
    type: 'command_result',
    commandId,
    success
  };

  if (success && result) {
    response.result = result;
  }

  if (!success && error) {
    response.error = error;
  }

  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
  log.debug(`Sent command_result for ${commandId}: success=${success}`);
}
