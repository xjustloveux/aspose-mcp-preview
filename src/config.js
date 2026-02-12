import minimist from 'minimist';

/**
 * @typedef {Object} Config
 * @property {number} port - HTTP server port
 * @property {string} host - Bind host
 * @property {boolean} noOpen - Don't open browser
 * @property {string} transport - Transport mode
 */

/**
 * Parse CLI arguments and environment variables
 * @returns {Config} Configuration object
 */
export function loadConfig() {
  const argv = minimist(process.argv.slice(2), {
    string: ['port', 'host', 'transport'],
    boolean: ['no-open'],
    alias: {
      p: 'port',
      h: 'host'
    },
    default: {
      port: undefined,
      host: undefined,
      transport: undefined,
      'no-open': false
    }
  });

  // Environment variables take precedence over defaults, CLI args take precedence over env
  const config = {
    port: parseInt(argv.port ?? process.env.ASPOSE_PREVIEW_PORT ?? '3000', 10),
    host: argv.host ?? process.env.ASPOSE_PREVIEW_HOST ?? 'localhost',
    noOpen: argv['no-open'] || process.env.ASPOSE_PREVIEW_NO_OPEN === 'true',
    transport: argv.transport ?? process.env.ASPOSE_PREVIEW_TRANSPORT ?? 'stdin'
  };

  return config;
}
