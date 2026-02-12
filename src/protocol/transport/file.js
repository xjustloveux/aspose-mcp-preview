import { readFile } from 'fs/promises';
import { createLogger } from '../../logger.js';

const log = createLogger('transport:file');

/**
 * Read binary data from a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<Buffer>} File contents
 */
export async function readFromFile(filePath) {
  log.debug(`Reading from file: ${filePath}`);

  try {
    const data = await readFile(filePath);
    log.debug(`Read ${data.length} bytes from file`);
    return data;
  } catch (err) {
    log.error(`Failed to read file: ${err.message}`);
    throw err;
  }
}
