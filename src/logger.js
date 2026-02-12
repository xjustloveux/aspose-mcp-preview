let debugEnabled = false;

/**
 * Initialize the logger with debug mode setting
 * @param {boolean} debug - Enable debug logging
 * @returns {void}
 */
export function initLogger(debug) {
  debugEnabled = debug;
}

/**
 * Enable or disable debug logging at runtime
 * @param {boolean} enabled - Enable/disable debug logging
 * @returns {void}
 */
export function setDebug(enabled) {
  debugEnabled = enabled;
}

/**
 * Check if debug logging is currently enabled
 * @returns {boolean}
 */
export function isDebugEnabled() {
  return debugEnabled;
}

/**
 * Log an informational message to stderr
 * @param {string} message
 * @param {...any} args
 * @returns {void}
 */
export function info(message, ...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [INFO] ${message}`, ...args);
}

/**
 * Log a warning message to stderr
 * @param {string} message
 * @param {...any} args
 * @returns {void}
 */
export function warn(message, ...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [WARN] ${message}`, ...args);
}

/**
 * Log an error message to stderr
 * @param {string} message
 * @param {...any} args
 * @returns {void}
 */
export function error(message, ...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${message}`, ...args);
}

/**
 * Log a debug message to stderr if debug mode is enabled
 * @param {string} message
 * @param {...any} args
 * @returns {void}
 */
export function debug(message, ...args) {
  if (!debugEnabled) return;
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DEBUG] ${message}`, ...args);
}

/**
 * Create a scoped logger instance with a specific category prefix
 * @param {string} scope - Logger scope/category
 * @returns {Object}
 */
export function createLogger(scope) {
  return {
    info: (message, ...args) => info(`[${scope}] ${message}`, ...args),
    warn: (message, ...args) => warn(`[${scope}] ${message}`, ...args),
    error: (message, ...args) => error(`[${scope}] ${message}`, ...args),
    debug: (message, ...args) => debug(`[${scope}] ${message}`, ...args)
  };
}

export default {
  initLogger,
  setDebug,
  isDebugEnabled,
  info,
  warn,
  error,
  debug,
  createLogger
};
