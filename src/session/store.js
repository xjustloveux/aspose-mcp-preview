import { createLogger } from '../logger.js';

/**
 * @typedef {Object} SessionSnapshot
 * @property {string} sessionId - Session UUID
 * @property {string} documentType - Document type (word, excel, powerpoint, pdf)
 * @property {string} originalPath - Original document path
 * @property {string} outputFormat - Output format (png, html, pdf)
 * @property {string} mimeType - MIME type
 * @property {string} timestamp - ISO timestamp
 * @property {number} sequenceNumber - Sequence number
 * @property {Buffer} data - Binary snapshot data
 * @property {boolean} hasUpdate - Whether session has unviewed update
 */

const log = createLogger('session');

class SessionStore {
  constructor() {
    /** @type {Map<string, SessionSnapshot>} */
    this.sessions = new Map();
  }

  /**
   * Update or create a session snapshot with new data
   * @param {string} sessionId - Session ID
   * @param {Object} metadata - Snapshot metadata
   * @param {Buffer} data - Binary snapshot data
   * @returns {void}
   */
  updateSnapshot(sessionId, metadata, data) {
    const existing = this.sessions.get(sessionId);

    const snapshot = {
      sessionId,
      documentType: metadata.documentType,
      originalPath: metadata.originalPath,
      outputFormat: metadata.outputFormat,
      mimeType: metadata.mimeType,
      timestamp: metadata.timestamp,
      sequenceNumber: metadata.sequenceNumber,
      data,
      hasUpdate: true
    };

    this.sessions.set(sessionId, snapshot);

    if (existing) {
      log.debug(`Updated session ${sessionId}, sequence: ${metadata.sequenceNumber}`);
    } else {
      log.info(`New session ${sessionId} created`);
    }
  }

  /**
   * Retrieve a session by its ID
   * @param {string} sessionId - Session ID
   * @returns {SessionSnapshot|undefined}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Get metadata for all active sessions
   * @returns {Array<Object>}
   */
  getAllSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push({
        sessionId: id,
        documentType: session.documentType,
        originalPath: session.originalPath,
        outputFormat: session.outputFormat,
        lastUpdate: session.timestamp,
        hasUpdate: session.hasUpdate
      });
    }
    return sessions;
  }

  /**
   * Mark a session as viewed to clear the update indicator
   * @param {string} sessionId - Session ID
   * @returns {void}
   */
  markAsViewed(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.hasUpdate = false;
    }
  }

  /**
   * Remove a session from the store
   * @param {string} sessionId - Session ID
   * @returns {void}
   */
  removeSession(sessionId) {
    const existed = this.sessions.delete(sessionId);
    if (existed) {
      log.info(`Session ${sessionId} removed`);
    }
  }

  /**
   * Remove all sessions from the store
   * @returns {void}
   */
  clear() {
    this.sessions.clear();
    log.info('All sessions cleared');
  }

  /**
   * Get the number of active sessions
   * @returns {number}
   */
  get size() {
    return this.sessions.size;
  }
}

export const sessionStore = new SessionStore();
