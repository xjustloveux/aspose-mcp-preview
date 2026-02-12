import { loadConfig } from './config.js';
import { initLogger, info, error, createLogger } from './logger.js';
import { createServer, startServer, stopServer } from './server/fastify.js';
import { initWebSocket, broadcast, closeAllConnections } from './server/websocket.js';
import { createProtocolParser } from './protocol/parser.js';
import { sessionStore } from './session/store.js';
import { openBrowser } from './browser.js';

const log = createLogger('main');

/**
 * Application entry point that initializes and starts the preview server
 * @returns {Promise<void>}
 */
export async function main() {
  const config = loadConfig();

  initLogger(false);
  info('Starting aspose-mcp-preview...');

  let server = null;
  let serverStarted = false;

  const parser = createProtocolParser({
    transport: config.transport,
    onSnapshot: (metadata, data) => {
      log.debug(`Received snapshot for session ${metadata.sessionId}`);
      sessionStore.updateSnapshot(metadata.sessionId, metadata, data);

      broadcast({
        type: 'snapshot',
        sessionId: metadata.sessionId,
        documentType: metadata.documentType,
        originalPath: metadata.originalPath,
        outputFormat: metadata.outputFormat,
        timestamp: metadata.timestamp
      });

      broadcast({
        type: 'log',
        level: 'info',
        category: 'protocol',
        message: `Received snapshot for session ${metadata.sessionId}`,
        sessionId: metadata.sessionId,
        timestamp: new Date().toISOString(),
        data: {
          documentType: metadata.documentType,
          outputFormat: metadata.outputFormat,
          sequenceNumber: metadata.sequenceNumber
        }
      });
    },
    onHeartbeat: () => {
      log.debug('Received heartbeat');
      broadcast({
        type: 'log',
        level: 'debug',
        category: 'protocol',
        message: 'Received heartbeat, sent pong',
        timestamp: new Date().toISOString()
      });
    },
    onSessionClosed: (sessionId) => {
      log.debug(`Session closed: ${sessionId}`);
      sessionStore.removeSession(sessionId);
      broadcast({
        type: 'session_closed',
        sessionId
      });
    },
    onSessionUnbound: (sessionId) => {
      log.debug(`Session unbound: ${sessionId}`);
      sessionStore.removeSession(sessionId);
      broadcast({
        type: 'session_unbound',
        sessionId
      });
    },
    onInitialized: async () => {
      info('Handshake complete, starting server...');

      if (!serverStarted) {
        serverStarted = true;
        server = await createServer(config);
        initWebSocket(server);
        await startServer(server, config);

        const url = `http://${config.host}:${config.port}`;
        info(`Server listening at ${url}`);

        if (!config.noOpen) {
          await openBrowser(url);
        }

        broadcast({
          type: 'log',
          level: 'info',
          category: 'protocol',
          message: 'Handshake complete, extension initialized',
          timestamp: new Date().toISOString()
        });
      }
    },
    onShutdown: async () => {
      info('Received shutdown signal');
      broadcast({
        type: 'shutdown'
      });
      await shutdown(server);
    },
    onError: (err) => {
      error('Protocol error:', err);
      broadcast({
        type: 'log',
        level: 'error',
        category: 'protocol',
        message: `Protocol error: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  parser.start();
  info('Protocol parser started, waiting for handshake...');

  process.stdin.on('end', async () => {
    info('stdin closed, shutting down...');
    await shutdown(server);
  });

  process.on('SIGINT', async () => {
    info('Received SIGINT, shutting down...');
    await shutdown(server);
  });

  process.on('SIGTERM', async () => {
    info('Received SIGTERM, shutting down...');
    await shutdown(server);
  });
}

/**
 * Gracefully shutdown the server and cleanup resources
 * @param {import('fastify').FastifyInstance} server
 * @returns {Promise<void>}
 */
async function shutdown(server) {
  try {
    if (server) {
      closeAllConnections();
      await stopServer(server);
      info('Server stopped');
    }
    process.exit(0);
  } catch (err) {
    error('Error during shutdown:', err);
    process.exit(1);
  }
}
