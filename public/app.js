/**
 * Aspose MCP Preview - Frontend Application
 */

import { layoutManager } from './layout.js';

const PDFJS_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624';
let pdfjsLib = null;

const state = {
  sessions: [],
  currentSessionId: null,
  ws: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  zoom: 'fit',
  zoomValue: 100,
  pdfDocument: null,
  pdfCurrentPage: 1,
  pdfTotalPages: 1,
  pdfRenderTask: null, // Track current render task for cancellation
  logAutoScroll: true,
  logFilter: 'all',
  theme: localStorage.getItem('theme') || 'system',
  debug: localStorage.getItem('debug') === 'true'
};

let elements = {};

/**
 * Initialize DOM element references after layout is built
 * @returns {void}
 */
function initElements() {
  elements = {
    layoutRoot: document.getElementById('layout-root'),
    layoutSelect: document.getElementById('layout-select'),
    sessionList: document.getElementById('session-list'),
    previewPlaceholder: document.getElementById('preview-placeholder'),
    previewContent: document.getElementById('preview-content'),
    previewError: document.getElementById('preview-error'),
    previewImage: document.getElementById('preview-image'),
    previewIframe: document.getElementById('preview-iframe'),
    previewPdf: document.getElementById('preview-pdf'),
    connectionStatus: document.getElementById('connection-status'),
    zoomFit: document.getElementById('zoom-fit'),
    zoom100: document.getElementById('zoom-100'),
    zoomInput: document.getElementById('zoom-input'),
    pdfControls: document.getElementById('pdf-controls'),
    pdfPrev: document.getElementById('pdf-prev'),
    pdfNext: document.getElementById('pdf-next'),
    pdfPageInfo: document.getElementById('pdf-page-info'),
    themeSelect: document.getElementById('theme-select'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    logPanel: document.getElementById('log-panel'),
    logHeader: document.getElementById('log-header'),
    logToggle: document.getElementById('log-toggle'),
    logMessages: document.getElementById('log-messages'),
    logFilter: document.getElementById('log-filter'),
    logClear: document.getElementById('log-clear'),
    logAutoScrollCheck: document.getElementById('log-auto-scroll-check'),
    debugCheck: document.getElementById('debug-check')
  };
}

/**
 * Initialize layout system with panel templates
 * @returns {void}
 */
function initLayout() {
  const sessionTemplate = document.getElementById('panel-session');
  const previewTemplate = document.getElementById('panel-preview');
  const logTemplate = document.getElementById('panel-log');

  const sessionPanel = sessionTemplate.content.cloneNode(true).firstElementChild;
  const previewPanel = previewTemplate.content.cloneNode(true).firstElementChild;
  const logPanel = logTemplate.content.cloneNode(true).firstElementChild;

  const layoutRoot = document.getElementById('layout-root');
  layoutManager.init(
    layoutRoot,
    {
      session: sessionPanel,
      preview: previewPanel,
      log: logPanel
    },
    onLayoutChange
  );

  const layoutSelect = document.getElementById('layout-select');
  layoutManager.getLayouts().forEach((layout) => {
    const option = document.createElement('option');
    option.value = layout.id;
    option.textContent = layout.name;
    if (layout.id === layoutManager.currentLayout) {
      option.selected = true;
    }
    layoutSelect.appendChild(option);
  });

  initElements();
}

/**
 * Handle layout change events and reinitialize elements
 * @param {string} layoutId - New layout identifier
 * @returns {void}
 */
function onLayoutChange(_layoutId) {
  initElements();
  setupPanelEventListeners();
}

/**
 * Initialize the application and all subsystems
 * @returns {Promise<void>}
 */
async function init() {
  initLayout();

  try {
    pdfjsLib = await import(`${PDFJS_CDN_BASE}/build/pdf.min.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/build/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('PDF.js not loaded:', err);
  }

  initTheme();
  connectWebSocket();
  await fetchSessions();
  setupEventListeners();
  addLog('info', 'server', 'Preview application initialized');
}

/**
 * Initialize theme from saved preference
 * @returns {void}
 */
function initTheme() {
  elements.themeSelect.value = state.theme;
  applyTheme(state.theme);
}

/**
 * Apply theme to the document
 * @param {string} theme - Theme name ('light', 'dark', or 'system')
 * @returns {void}
 */
function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Establish WebSocket connection to the server
 * @returns {void}
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  updateConnectionStatus('connecting');

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.reconnectAttempts = 0;
    updateConnectionStatus('connected');
    addLog('info', 'server', 'WebSocket connected');
    sendDebugSetting(state.debug);
  };

  state.ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  state.ws.onclose = () => {
    updateConnectionStatus('disconnected');
    addLog('warn', 'server', 'WebSocket disconnected');
    attemptReconnect();
  };

  state.ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    addLog('error', 'server', 'WebSocket error');
  };
}

/**
 * Send debug mode setting to the server
 * @param {boolean} enabled - Whether debug mode should be enabled
 * @returns {void}
 */
function sendDebugSetting(enabled) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(
      JSON.stringify({
        type: 'set_debug',
        enabled: enabled
      })
    );
    addLog('info', 'server', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Attempt to reconnect WebSocket with exponential backoff
 * @returns {void}
 */
function attemptReconnect() {
  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    addLog('error', 'server', 'Max reconnection attempts reached');
    return;
  }

  state.reconnectAttempts++;
  const delay = state.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1);

  addLog('info', 'server', `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts})`);

  setTimeout(() => {
    connectWebSocket();
  }, delay);
}

/**
 * Process incoming WebSocket message by type
 * @param {Object} message - Parsed message object
 * @returns {void}
 */
function handleWebSocketMessage(message) {
  switch (message.type) {
  case 'connected':
    console.log('Connected with client ID:', message.clientId);
    break;

  case 'snapshot':
    handleSnapshotUpdate(message);
    break;

  case 'session_closed':
    handleSessionClosed(message.sessionId);
    break;

  case 'session_unbound':
    handleSessionUnbound(message.sessionId);
    break;

  case 'shutdown':
    addLog('warn', 'server', 'Server is shutting down');
    break;

  case 'log':
    addLogFromServer(message);
    break;

  case 'pong':
    // Heartbeat response
    break;

  default:
    console.log('Unknown message type:', message.type);
  }
}

/**
 * Handle snapshot update message and refresh preview
 * @param {Object} message - Snapshot update message
 * @returns {Promise<void>}
 */
async function handleSnapshotUpdate(message) {
  const { sessionId, documentType, originalPath, outputFormat, timestamp } = message;

  let session = state.sessions.find((s) => s.sessionId === sessionId);
  if (!session) {
    session = {
      sessionId,
      documentType,
      originalPath,
      outputFormat,
      lastUpdate: timestamp,
      hasUpdate: true
    };
    state.sessions.push(session);
  } else {
    session.documentType = documentType;
    session.originalPath = originalPath;
    session.outputFormat = outputFormat;
    session.lastUpdate = timestamp;
    session.hasUpdate = sessionId !== state.currentSessionId;
  }

  renderSessionList();

  if (sessionId === state.currentSessionId) {
    await loadPreview(sessionId);
  }

  if (!state.currentSessionId && state.sessions.length > 0) {
    selectSession(state.sessions[0].sessionId);
  }
}

/**
 * Handle session closed event and update UI
 * @param {string} sessionId - Closed session identifier
 * @returns {void}
 */
function handleSessionClosed(sessionId) {
  state.sessions = state.sessions.filter((s) => s.sessionId !== sessionId);
  renderSessionList();

  if (state.currentSessionId === sessionId) {
    state.currentSessionId = null;
    showPlaceholder();

    if (state.sessions.length > 0) {
      selectSession(state.sessions[0].sessionId);
    }
  }

  addLog('info', 'session', `Session closed: ${sessionId}`);
}

/**
 * Handle session unbound event and update UI
 * @param {string} sessionId - Unbound session identifier
 * @returns {void}
 */
function handleSessionUnbound(sessionId) {
  state.sessions = state.sessions.filter((s) => s.sessionId !== sessionId);
  renderSessionList();

  if (state.currentSessionId === sessionId) {
    state.currentSessionId = null;
    showPlaceholder();

    if (state.sessions.length > 0) {
      selectSession(state.sessions[0].sessionId);
    }
  }

  addLog('info', 'session', `Session unbound: ${sessionId}`);
}

/**
 * Fetch active sessions from the server API
 * @returns {Promise<void>}
 */
async function fetchSessions() {
  try {
    const response = await fetch('/api/sessions');
    const data = await response.json();
    state.sessions = data.sessions || [];
    renderSessionList();

    if (state.sessions.length > 0 && !state.currentSessionId) {
      selectSession(state.sessions[0].sessionId);
    }
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    addLog('error', 'server', 'Failed to fetch sessions');
  }
}

/**
 * Render the session list in the sidebar
 * @returns {void}
 */
function renderSessionList() {
  if (!elements.sessionList) return;

  if (state.sessions.length === 0) {
    elements.sessionList.innerHTML = '<li class="no-sessions">No active sessions</li>';
    return;
  }

  elements.sessionList.innerHTML = state.sessions
    .map((session) => {
      const isActive = session.sessionId === state.currentSessionId;
      const fileName = session.originalPath ? session.originalPath.split(/[/\\]/).pop() : 'Unknown';
      const time = new Date(session.lastUpdate).toLocaleTimeString('en-US', { hour12: false });

      return `
      <li class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.sessionId}">
        <div class="session-type">${session.documentType} - ${session.outputFormat}</div>
        <div class="session-path">${fileName}</div>
        <div class="session-meta">
          <span class="session-id">${session.sessionId}</span>
          <span class="session-time">${time}</span>
        </div>
        ${session.hasUpdate && !isActive ? '<div class="session-update-badge"></div>' : ''}
      </li>
    `;
    })
    .join('');

  elements.sessionList.querySelectorAll('.session-item').forEach((item) => {
    item.addEventListener('click', () => {
      selectSession(item.dataset.sessionId);
    });
  });
}

/**
 * Select a session and load its preview
 * @param {string} sessionId - Session identifier to select
 * @returns {Promise<void>}
 */
async function selectSession(sessionId) {
  state.currentSessionId = sessionId;

  const session = state.sessions.find((s) => s.sessionId === sessionId);
  if (session) {
    session.hasUpdate = false;
  }

  renderSessionList();
  await loadPreview(sessionId);
}

/**
 * Load and display preview content for a session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<void>}
 */
async function loadPreview(sessionId) {
  showLoading();

  try {
    const response = await fetch(`/api/sessions/${sessionId}/snapshot`);

    if (!response.ok) {
      throw new Error(`Failed to load snapshot: ${response.status}`);
    }

    const contentType = response.headers.get('Content-Type');
    const blob = await response.blob();

    hideAllPreviews();
    elements.previewContent.style.display = 'flex';
    elements.previewPlaceholder.style.display = 'none';
    elements.previewError.style.display = 'none';

    if (contentType.startsWith('image/')) {
      await showImagePreview(blob);
    } else if (contentType === 'text/html') {
      await showHtmlPreview(blob);
    } else if (contentType === 'application/pdf') {
      await showPdfPreview(blob);
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  } catch (err) {
    showError(err.message);
    addLog('error', 'session', `Failed to load preview: ${err.message}`);
  }
}

/**
 * Display image preview from blob data
 * @param {Blob} blob - Image blob data
 * @returns {Promise<void>}
 */
async function showImagePreview(blob) {
  const url = URL.createObjectURL(blob);
  elements.previewImage.src = url;
  elements.previewImage.style.display = 'block';
  elements.pdfControls.style.display = 'none';
  applyZoom();
}

/**
 * Display HTML preview in iframe from blob data
 * @param {Blob} blob - HTML blob data
 * @returns {Promise<void>}
 */
async function showHtmlPreview(blob) {
  const text = await blob.text();
  elements.previewIframe.srcdoc = text;
  elements.previewIframe.style.display = 'block';
  elements.pdfControls.style.display = 'none';
}

/**
 * Display PDF preview using PDF.js from blob data
 * @param {Blob} blob - PDF blob data
 * @returns {Promise<void>}
 */
async function showPdfPreview(blob) {
  if (!pdfjsLib) {
    throw new Error('PDF.js not loaded');
  }

  const arrayBuffer = await blob.arrayBuffer();
  state.pdfDocument = await pdfjsLib.getDocument({
    data: arrayBuffer,
    wasmUrl: `${PDFJS_CDN_BASE}/wasm/`,
    iccUrl: `${PDFJS_CDN_BASE}/wasm/`
  }).promise;
  state.pdfTotalPages = state.pdfDocument.numPages;
  state.pdfCurrentPage = 1;

  elements.previewPdf.style.display = 'block';
  elements.pdfControls.style.display = 'flex';

  await renderPdfPage(state.pdfCurrentPage);
  updatePdfPageInfo();
}

/**
 * Render a specific page of the PDF document
 * @param {number} pageNum - Page number to render
 * @returns {Promise<void>}
 */
async function renderPdfPage(pageNum) {
  if (!state.pdfDocument) return;

  // Cancel any existing render task before starting a new one
  if (state.pdfRenderTask) {
    try {
      state.pdfRenderTask.cancel();
    } catch {
      // Ignore cancellation errors
    }
    state.pdfRenderTask = null;
  }

  const page = await state.pdfDocument.getPage(pageNum);
  const canvas = elements.previewPdf;
  const context = canvas.getContext('2d');

  let scale = state.zoomValue / 100;
  if (state.zoom === 'fit') {
    const container = elements.previewContent;
    const viewport = page.getViewport({ scale: 1 });
    const scaleX = (container.clientWidth - 40) / viewport.width;
    const scaleY = (container.clientHeight - 40) / viewport.height;
    scale = Math.min(scaleX, scaleY);
    state.zoomValue = Math.round(scale * 100);
    elements.zoomInput.value = state.zoomValue;
  }

  const viewport = page.getViewport({ scale });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  state.pdfRenderTask = page.render({
    canvasContext: context,
    viewport: viewport
  });

  try {
    await state.pdfRenderTask.promise;
  } catch (err) {
    // Ignore cancellation errors (thrown when render is cancelled)
    if (err.name !== 'RenderingCancelledException') {
      throw err;
    }
  } finally {
    state.pdfRenderTask = null;
  }
}

/**
 * Update PDF page navigation info display
 * @returns {void}
 */
function updatePdfPageInfo() {
  elements.pdfPageInfo.textContent = `${state.pdfCurrentPage} / ${state.pdfTotalPages}`;
  elements.pdfPrev.disabled = state.pdfCurrentPage <= 1;
  elements.pdfNext.disabled = state.pdfCurrentPage >= state.pdfTotalPages;
}

/**
 * Hide all preview content elements
 * @returns {void}
 */
function hideAllPreviews() {
  if (elements.previewImage) elements.previewImage.style.display = 'none';
  if (elements.previewIframe) elements.previewIframe.style.display = 'none';
  if (elements.previewPdf) elements.previewPdf.style.display = 'none';
}

/**
 * Show the placeholder when no session is selected
 * @returns {void}
 */
function showPlaceholder() {
  hideAllPreviews();
  if (elements.previewContent) elements.previewContent.style.display = 'none';
  if (elements.previewPlaceholder) elements.previewPlaceholder.style.display = 'block';
  if (elements.previewError) elements.previewError.style.display = 'none';
  if (elements.pdfControls) elements.pdfControls.style.display = 'none';
}

/**
 * Show loading indicator while content is being fetched
 * @returns {void}
 */
function showLoading() {}

/**
 * Display an error message in the preview area
 * @param {string} message - Error message to display
 * @returns {void}
 */
function showError(message) {
  hideAllPreviews();
  if (elements.previewContent) elements.previewContent.style.display = 'none';
  if (elements.previewPlaceholder) elements.previewPlaceholder.style.display = 'none';
  if (elements.previewError) {
    elements.previewError.style.display = 'block';
    const errorMsg = elements.previewError.querySelector('.error-message');
    if (errorMsg) errorMsg.textContent = message;
  }
}

/**
 * Apply current zoom setting to image preview
 * @returns {void}
 */
function applyZoom() {
  const img = elements.previewImage;
  if (!img || img.style.display === 'none') return;

  if (state.zoom === 'fit') {
    img.classList.remove('zoom-custom');
    img.style.transform = '';
    img.style.width = '';
  } else {
    img.classList.add('zoom-custom');
    img.style.width = `${state.zoomValue}%`;
    img.style.height = 'auto';
  }
}

/**
 * Update connection status indicator in the UI
 * @param {string} status - Connection status ('connected', 'disconnected', 'connecting')
 * @returns {void}
 */
function updateConnectionStatus(status) {
  if (!elements.connectionStatus) return;

  const dot = elements.connectionStatus.querySelector('.status-dot');
  const text = elements.connectionStatus.querySelector('.status-text');

  if (dot) dot.className = 'status-dot ' + status;

  if (text) {
    switch (status) {
    case 'connected':
      text.textContent = 'Connected';
      break;
    case 'disconnected':
      text.textContent = 'Disconnected';
      break;
    case 'connecting':
      text.textContent = 'Connecting...';
      break;
    }
  }
}

/**
 * Add a log entry to the log panel
 * @param {string} level - Log level ('info', 'warn', 'error', 'debug')
 * @param {string} category - Log category for filtering
 * @param {string} message - Log message
 * @param {Object} [data=null] - Optional additional data
 * @returns {void}
 */
function addLog(level, category, message, _data = null) {
  if (!elements.logMessages) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.dataset.category = category;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  entry.innerHTML = `
    <span class="log-timestamp">${timestamp}</span>
    <span class="log-category ${category}">${category}</span>
    <span class="log-level ${level}">[${level.toUpperCase()}]</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  elements.logMessages.appendChild(entry);
  applyLogFilter();

  if (state.logAutoScroll) {
    elements.logMessages.scrollTop = elements.logMessages.scrollHeight;
  }
}

/**
 * Add a log entry received from the server
 * @param {Object} message - Log message from server
 * @returns {void}
 */
function addLogFromServer(message) {
  addLog(message.level, message.category, message.message, message.data);
}

/**
 * Apply category filter to log entries
 * @returns {void}
 */
function applyLogFilter() {
  if (!elements.logMessages) return;

  const filter = state.logFilter;
  elements.logMessages.querySelectorAll('.log-entry').forEach((entry) => {
    if (filter === 'all' || entry.dataset.category === filter) {
      entry.style.display = '';
    } else {
      entry.style.display = 'none';
    }
  });
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Set up event listeners for panel controls after layout change
 * @returns {void}
 */
function setupPanelEventListeners() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.onclick = () => {
      layoutManager.toggleCollapse('session');
    };
  }

  const logToggle = document.getElementById('log-toggle');
  if (logToggle) {
    logToggle.onclick = () => {
      layoutManager.toggleCollapse('log');
    };
  }

  const logFilter = document.getElementById('log-filter');
  if (logFilter) {
    logFilter.onchange = (e) => {
      state.logFilter = e.target.value;
      applyLogFilter();
    };
  }

  const logClear = document.getElementById('log-clear');
  if (logClear) {
    logClear.onclick = () => {
      const logMessages = document.getElementById('log-messages');
      if (logMessages) logMessages.innerHTML = '';
    };
  }

  const logAutoScrollCheck = document.getElementById('log-auto-scroll-check');
  if (logAutoScrollCheck) {
    logAutoScrollCheck.onchange = (e) => {
      state.logAutoScroll = e.target.checked;
    };
  }
}

/**
 * Set up global event listeners for the application
 * @returns {void}
 */
function setupEventListeners() {
  elements.layoutSelect.addEventListener('change', (e) => {
    layoutManager.setLayout(e.target.value);
  });

  elements.themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    localStorage.setItem('theme', state.theme);
    applyTheme(state.theme);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });

  if (elements.debugCheck) {
    elements.debugCheck.checked = state.debug;
    elements.debugCheck.addEventListener('change', (e) => {
      state.debug = e.target.checked;
      localStorage.setItem('debug', state.debug);
      sendDebugSetting(state.debug);
    });
  }

  elements.zoomFit.addEventListener('click', () => {
    state.zoom = 'fit';
    applyZoom();
    if (state.pdfDocument) {
      renderPdfPage(state.pdfCurrentPage);
    }
  });

  elements.zoom100.addEventListener('click', () => {
    state.zoom = 'custom';
    state.zoomValue = 100;
    elements.zoomInput.value = 100;
    applyZoom();
    if (state.pdfDocument) {
      renderPdfPage(state.pdfCurrentPage);
    }
  });

  elements.zoomInput.addEventListener('change', (e) => {
    state.zoom = 'custom';
    state.zoomValue = Math.max(10, Math.min(500, parseInt(e.target.value) || 100));
    elements.zoomInput.value = state.zoomValue;
    applyZoom();
    if (state.pdfDocument) {
      renderPdfPage(state.pdfCurrentPage);
    }
  });

  elements.pdfPrev.addEventListener('click', async () => {
    if (state.pdfCurrentPage > 1) {
      state.pdfCurrentPage--;
      await renderPdfPage(state.pdfCurrentPage);
      updatePdfPageInfo();
    }
  });

  elements.pdfNext.addEventListener('click', async () => {
    if (state.pdfCurrentPage < state.pdfTotalPages) {
      state.pdfCurrentPage++;
      await renderPdfPage(state.pdfCurrentPage);
      updatePdfPageInfo();
    }
  });

  setupPanelEventListeners();

  document.addEventListener('keydown', (e) => {
    if (elements.previewPdf?.style.display !== 'none') {
      if (e.key === 'ArrowLeft') {
        elements.pdfPrev.click();
      } else if (e.key === 'ArrowRight') {
        elements.pdfNext.click();
      }
    }
  });
}

init();
