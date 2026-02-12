import { createLogger } from '../logger.js';
import { sendCommandResult } from './ack.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('command');

/**
 * Read the application version from package.json
 * @returns {string}
 */
function getVersion() {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

/**
 * Process and execute a received command message
 * @param {Object} metadata - Command metadata
 * @returns {void}
 */
export function handleCommand(metadata) {
  const { commandId, commandType } = metadata;

  if (!commandId) {
    log.warn('Received command without commandId');
    return;
  }

  log.debug(`Handling command: ${commandType} (${commandId})`);

  switch (commandType) {
  case 'get_version':
    sendCommandResult(commandId, true, { version: getVersion() });
    break;

  default:
    log.warn(`Unknown command type: ${commandType}`);
    sendCommandResult(commandId, false, null, `Unknown command type: ${commandType}`);
    break;
  }
}
