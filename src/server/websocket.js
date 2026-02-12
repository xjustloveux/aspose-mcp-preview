import { WebSocketServer } from 'ws';
import { createLogger, setDebug, isDebugEnabled } from '../logger.js';

const log = createLogger('websocket');

/** @type {WebSocketServer|null} */
let wss = null;

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

/**
 * Initialize WebSocket server and attach to HTTP server
 * @param {import('fastify').FastifyInstance} server
 * @returns {void}
 */
export function initWebSocket(server) {
  const httpServer = server.server;

  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', (ws, _request) => {
    const clientId = Date.now().toString(36);
    log.info(`WebSocket client connected: ${clientId}`);
    clients.add(ws);

    ws.send(
      JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      })
    );

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch (err) {
        log.error('Failed to parse WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      log.info(`WebSocket client disconnected: ${clientId}`);
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      log.error(`WebSocket error for client ${clientId}:`, err);
      clients.delete(ws);
    });
  });

  log.info('WebSocket server initialized');
}

/**
 * Handle incoming message from a WebSocket client
 * @param {import('ws').WebSocket} ws
 * @param {Object} message
 * @returns {void}
 */
function handleClientMessage(ws, message) {
  switch (message.type) {
  case 'ping':
    ws.send(JSON.stringify({ type: 'pong' }));
    break;

  case 'subscribe':
    log.debug(`Client subscribed to session: ${message.sessionId}`);
    break;

  case 'set_debug':
    setDebug(message.enabled);
    log.info(`Debug mode ${message.enabled ? 'enabled' : 'disabled'} by client`);
    ws.send(
      JSON.stringify({
        type: 'debug_changed',
        enabled: isDebugEnabled()
      })
    );
    break;

  default:
    log.debug(`Unknown client message type: ${message.type}`);
  }
}

/**
 * Broadcast a message to all connected WebSocket clients
 * @param {Object} message
 * @returns {void}
 */
export function broadcast(message) {
  const json = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }

  log.debug(`Broadcasted ${message.type} to ${clients.size} clients`);
}

/**
 * Send a message to a specific WebSocket client
 * @param {import('ws').WebSocket} ws
 * @param {Object} message
 * @returns {void}
 */
export function sendToClient(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Close all WebSocket connections and shutdown the server
 * @returns {void}
 */
export function closeAllConnections() {
  for (const client of clients) {
    client.close(1000, 'Server shutting down');
  }
  clients.clear();

  if (wss) {
    wss.close();
    wss = null;
  }

  log.info('All WebSocket connections closed');
}

/**
 * Get the number of currently connected WebSocket clients
 * @returns {number}
 */
export function getClientCount() {
  return clients.size;
}
