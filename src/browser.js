import open from 'open';
import { createLogger } from './logger.js';

const log = createLogger('browser');

/**
 * Open the specified URL in the default system browser
 * @param {string} url - URL to open
 * @returns {Promise<void>}
 */
export async function openBrowser(url) {
  try {
    log.info(`Opening browser: ${url}`);
    await open(url);
    log.debug('Browser opened successfully');
  } catch (err) {
    log.warn(`Failed to open browser: ${err.message}`);
    log.info(`Please open ${url} manually`);
  }
}
