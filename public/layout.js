/**
 * Layout Manager - Handles panel positioning, resizing, and collapsing
 */

const LAYOUTS = {
  'left-session-bottom-log': {
    name: 'Classic',
    structure: {
      direction: 'column',
      children: [
        {
          direction: 'row',
          children: [
            { panel: 'session', position: 'left' },
            { panel: 'preview', position: 'center' }
          ]
        },
        { panel: 'log', position: 'bottom' }
      ]
    }
  },
  'right-session-bottom-log': {
    name: 'Right Sidebar',
    structure: {
      direction: 'column',
      children: [
        {
          direction: 'row',
          children: [
            { panel: 'preview', position: 'center' },
            { panel: 'session', position: 'right' }
          ]
        },
        { panel: 'log', position: 'bottom' }
      ]
    }
  },
  'left-session-right-log': {
    name: 'Side by Side',
    structure: {
      direction: 'row',
      children: [
        { panel: 'session', position: 'left' },
        { panel: 'preview', position: 'center' },
        { panel: 'log', position: 'right' }
      ]
    }
  },
  'right-session-left-log': {
    name: 'Side by Side (Reversed)',
    structure: {
      direction: 'row',
      children: [
        { panel: 'log', position: 'left' },
        { panel: 'preview', position: 'center' },
        { panel: 'session', position: 'right' }
      ]
    }
  },
  'left-combined': {
    name: 'Left Combined',
    structure: {
      direction: 'row',
      children: [
        {
          direction: 'column',
          position: 'left',
          children: [
            { panel: 'session', position: 'top' },
            { panel: 'log', position: 'bottom' }
          ]
        },
        { panel: 'preview', position: 'center' }
      ]
    }
  },
  'left-combined-reversed': {
    name: 'Left Combined (Log Top)',
    structure: {
      direction: 'row',
      children: [
        {
          direction: 'column',
          position: 'left',
          children: [
            { panel: 'log', position: 'top' },
            { panel: 'session', position: 'bottom' }
          ]
        },
        { panel: 'preview', position: 'center' }
      ]
    }
  },
  'right-combined': {
    name: 'Right Combined',
    structure: {
      direction: 'row',
      children: [
        { panel: 'preview', position: 'center' },
        {
          direction: 'column',
          position: 'right',
          children: [
            { panel: 'session', position: 'top' },
            { panel: 'log', position: 'bottom' }
          ]
        }
      ]
    }
  },
  'right-combined-reversed': {
    name: 'Right Combined (Log Top)',
    structure: {
      direction: 'row',
      children: [
        { panel: 'preview', position: 'center' },
        {
          direction: 'column',
          position: 'right',
          children: [
            { panel: 'log', position: 'top' },
            { panel: 'session', position: 'bottom' }
          ]
        }
      ]
    }
  },
  'bottom-combined': {
    name: 'Bottom Combined',
    structure: {
      direction: 'column',
      children: [
        { panel: 'preview', position: 'center' },
        {
          direction: 'row',
          position: 'bottom',
          children: [
            { panel: 'session', position: 'left' },
            { panel: 'log', position: 'right' }
          ]
        }
      ]
    }
  },
  'bottom-combined-reversed': {
    name: 'Bottom Combined (Log Left)',
    structure: {
      direction: 'column',
      children: [
        { panel: 'preview', position: 'center' },
        {
          direction: 'row',
          position: 'bottom',
          children: [
            { panel: 'log', position: 'left' },
            { panel: 'session', position: 'right' }
          ]
        }
      ]
    }
  }
};

const DEFAULT_SIZES = {
  session: { width: 280, height: 200 },
  log: { width: 280, height: 200 }
};

const MIN_SIZES = {
  session: { width: 150, height: 100 },
  log: { width: 150, height: 100 }
};

const COLLAPSED_SIZE = 40;

class LayoutManager {
  constructor() {
    this.currentLayout = 'left-session-bottom-log';
    this.panels = {};
    this.panelStates = {
      session: { collapsed: false, size: { ...DEFAULT_SIZES.session } },
      log: { collapsed: false, size: { ...DEFAULT_SIZES.log } }
    };
    this.containerSizes = {
      left: 280,
      right: 280,
      top: 200,
      bottom: 200
    };
    this.container = null;
    this.resizers = [];
    this.onLayoutChange = null;
  }

  /**
   * Initialize the layout manager with container and panels
   * @param {HTMLElement} container - Root container element
   * @param {Object} panels - Panel elements keyed by panel ID
   * @param {Function} onLayoutChange - Callback when layout changes
   * @returns {void}
   */
  init(container, panels, onLayoutChange) {
    this.container = container;
    this.panels = panels;
    this.onLayoutChange = onLayoutChange;

    this.loadState();
    this.applyLayout();
  }

  /**
   * Get list of available layout configurations
   * @returns {Array<{id: string, name: string}>}
   */
  getLayouts() {
    return Object.entries(LAYOUTS).map(([id, config]) => ({
      id,
      name: config.name
    }));
  }

  /**
   * Switch to a different layout configuration
   * @param {string} layoutId - Layout identifier
   * @returns {void}
   */
  setLayout(layoutId) {
    if (!LAYOUTS[layoutId]) {
      console.error(`Unknown layout: ${layoutId}`);
      return;
    }
    this.currentLayout = layoutId;
    this.applyLayout();
    this.saveState();
  }

  /**
   * Toggle panel between collapsed and expanded state
   * @param {string} panelId - Panel identifier
   * @returns {void}
   */
  toggleCollapse(panelId) {
    if (!this.panelStates[panelId]) return;

    this.panelStates[panelId].collapsed = !this.panelStates[panelId].collapsed;
    this.applyLayout();
    this.saveState();
  }

  /**
   * Check if a panel is currently collapsed
   * @param {string} panelId - Panel identifier
   * @returns {boolean}
   */
  isCollapsed(panelId) {
    return this.panelStates[panelId]?.collapsed || false;
  }

  /**
   * Resize a panel by the specified delta
   * @param {string} panelId - Panel identifier
   * @param {string} dimension - Dimension to resize ('width' or 'height')
   * @param {number} delta - Amount to change size by in pixels
   * @returns {void}
   */
  resizePanel(panelId, dimension, delta) {
    if (!this.panelStates[panelId] || this.panelStates[panelId].collapsed) return;

    const state = this.panelStates[panelId];
    const minSize = MIN_SIZES[panelId];

    if (dimension === 'width') {
      state.size.width = Math.max(minSize.width, state.size.width + delta);
    } else {
      state.size.height = Math.max(minSize.height, state.size.height + delta);
    }

    // Directly update the panel element instead of rebuilding layout
    const panelWrapper = this.container.querySelector(`[data-panel="${panelId}"]`);
    if (panelWrapper) {
      if (dimension === 'width') {
        panelWrapper.style.width = `${state.size.width}px`;
      } else {
        panelWrapper.style.height = `${state.size.height}px`;
      }
    }

    this.saveState();
  }

  /**
   * Apply current layout configuration to the DOM
   * @returns {void}
   */
  applyLayout() {
    const layout = LAYOUTS[this.currentLayout];
    if (!layout) return;

    this.clearResizers();
    this.container.innerHTML = '';
    this.container.className = 'layout-container';
    this.buildLayoutNode(layout.structure, this.container);

    if (this.onLayoutChange) {
      this.onLayoutChange(this.currentLayout);
    }
  }

  /**
   * Recursively build layout structure from node definition
   * @param {Object} node - Layout node configuration
   * @param {HTMLElement} parent - Parent element to append to
   * @returns {void}
   */
  buildLayoutNode(node, parent) {
    if (node.panel) {
      this.buildPanel(node, parent);
    } else if (node.children) {
      const container = document.createElement('div');
      container.className = `layout-${node.direction}`;
      if (node.position) {
        container.dataset.position = node.position;

        // Apply size to combined containers (left/right positioned)
        if (node.position === 'left' || node.position === 'right') {
          const savedWidth = this.containerSizes[node.position] || 280;
          container.style.width = `${savedWidth}px`;
          container.style.minWidth = '150px';
          container.style.flex = '0 0 auto';
        }
        if (node.position === 'bottom' || node.position === 'top') {
          const savedHeight = this.containerSizes[node.position] || 200;
          container.style.height = `${savedHeight}px`;
          container.style.minHeight = '100px';
          container.style.flex = '0 0 auto';
        }
      }

      parent.appendChild(container);

      node.children.forEach((child, index) => {
        this.buildLayoutNode(child, container);

        // Add resizer between children (except after last)
        if (index < node.children.length - 1) {
          const nextChild = node.children[index + 1];
          // Add resizer between non-center panels/containers
          const childIsCenter = child.panel === 'preview' || child.position === 'center';
          const nextIsCenter = nextChild.panel === 'preview' || nextChild.position === 'center';

          if (!childIsCenter || !nextIsCenter) {
            this.addResizer(container, node.direction, child, nextChild);
          }
        }
      });
    }
  }

  /**
   * Build a panel wrapper element with proper sizing and state
   * @param {Object} node - Panel node configuration
   * @param {HTMLElement} parent - Parent element to append to
   * @returns {void}
   */
  buildPanel(node, parent) {
    const panelId = node.panel;
    const panelElement = this.panels[panelId];
    if (!panelElement) return;

    const state = this.panelStates[panelId];
    const isCollapsed = state?.collapsed || false;

    const isInCombinedContainer = parent.dataset && parent.dataset.position;
    const isFirstInContainer = parent.firstChild === null || parent.children.length === 0;

    const wrapper = document.createElement('div');
    wrapper.className = `panel-wrapper panel-${panelId}`;
    wrapper.dataset.panel = panelId;
    wrapper.dataset.position = node.position;

    if (isCollapsed) {
      wrapper.classList.add('collapsed');
    }

    if (panelId !== 'preview') {
      if (isInCombinedContainer) {
        if (isCollapsed) {
          wrapper.style.flex = '0 0 auto';
          if (node.position === 'top' || node.position === 'bottom') {
            wrapper.style.height = `${COLLAPSED_SIZE}px`;
          } else {
            wrapper.style.width = `${COLLAPSED_SIZE}px`;
          }
        } else if (node.position === 'top' || node.position === 'bottom') {
          // Vertical stacking - first panel gets fixed size, last fills remaining
          if (isFirstInContainer) {
            wrapper.style.flex = '0 0 auto';
            wrapper.style.height = `${state.size.height}px`;
            wrapper.style.minHeight = `${MIN_SIZES[panelId].height}px`;
          } else {
            wrapper.style.flex = '1 1 auto';
            wrapper.style.minHeight = `${MIN_SIZES[panelId].height}px`;
          }
          wrapper.style.overflow = 'hidden';
        } else {
          // Horizontal stacking (for bottom-combined)
          if (isFirstInContainer) {
            wrapper.style.flex = '0 0 auto';
            wrapper.style.width = `${state.size.width}px`;
            wrapper.style.minWidth = `${MIN_SIZES[panelId].width}px`;
          } else {
            wrapper.style.flex = '1 1 auto';
            wrapper.style.minWidth = `${MIN_SIZES[panelId].width}px`;
          }
          wrapper.style.overflow = 'hidden';
        }
      } else if (node.position === 'left' || node.position === 'right') {
        wrapper.style.width = `${isCollapsed ? COLLAPSED_SIZE : state.size.width}px`;
        if (!isCollapsed) {
          wrapper.style.minWidth = `${MIN_SIZES[panelId].width}px`;
        }
        wrapper.style.flexShrink = '0';
      } else if (node.position === 'top' || node.position === 'bottom') {
        wrapper.style.height = `${isCollapsed ? COLLAPSED_SIZE : state.size.height}px`;
        if (!isCollapsed) {
          wrapper.style.minHeight = `${MIN_SIZES[panelId].height}px`;
        }
        wrapper.style.flexShrink = '0';
      }
    } else {
      wrapper.classList.add('panel-center');
    }

    if (isCollapsed && panelId !== 'preview') {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.title = `Expand ${panelId}`;
      expandBtn.innerHTML = this.getExpandIcon(node.position);
      expandBtn.addEventListener('click', () => {
        this.toggleCollapse(panelId);
      });
      wrapper.appendChild(expandBtn);
      panelElement.style.display = 'none';
    } else {
      panelElement.style.display = '';
    }

    wrapper.appendChild(panelElement);
    parent.appendChild(wrapper);
    this.updateCollapseButton(panelElement, node.position, isCollapsed);
  }

  /**
   * Get the appropriate expand icon character for a position
   * @param {string} position - Panel position ('left', 'right', 'top', 'bottom')
   * @returns {string}
   */
  getExpandIcon(position) {
    switch (position) {
    case 'left':
      return '»';
    case 'right':
      return '«';
    case 'top':
      return '∨';
    case 'bottom':
      return '∧';
    default:
      return '+';
    }
  }

  /**
   * Update collapse button icon to match panel position and state
   * @param {HTMLElement} panelElement - Panel DOM element
   * @param {string} position - Panel position
   * @param {boolean} isCollapsed - Whether panel is collapsed
   * @returns {void}
   */
  updateCollapseButton(panelElement, position, isCollapsed) {
    const toggleBtn = panelElement.querySelector('.sidebar-toggle, .log-toggle');
    if (!toggleBtn) return;

    const icon = toggleBtn.querySelector('.toggle-icon');
    if (!icon) return;

    let arrow;
    if (position === 'left') {
      arrow = isCollapsed ? '»' : '«';
    } else if (position === 'right') {
      arrow = isCollapsed ? '«' : '»';
    } else if (position === 'bottom') {
      arrow = isCollapsed ? '∧' : '∨';
    } else if (position === 'top') {
      arrow = isCollapsed ? '∨' : '∧';
    }

    if (arrow) {
      icon.textContent = arrow;
    }
  }

  /**
   * Add a draggable resizer element between two panels
   * @param {HTMLElement} container - Parent container element
   * @param {string} direction - Layout direction ('row' or 'column')
   * @param {Object} before - Node configuration before the resizer
   * @param {Object} after - Node configuration after the resizer
   * @returns {void}
   */
  addResizer(container, direction, before, after) {
    const resizer = document.createElement('div');
    resizer.className = `resizer resizer-${direction === 'row' ? 'horizontal' : 'vertical'}`;

    resizer.dataset.direction = direction;
    this.setupResizerDrag(resizer, direction, before, after, container);

    container.appendChild(resizer);
    this.resizers.push(resizer);
  }

  /**
   * Setup mouse drag event handlers for a resizer element
   * @param {HTMLElement} resizer - Resizer DOM element
   * @param {string} direction - Layout direction ('row' or 'column')
   * @param {Object} before - Node configuration before the resizer
   * @param {Object} after - Node configuration after the resizer
   * @param {HTMLElement} container - Parent container element
   * @returns {void}
   */
  setupResizerDrag(resizer, direction, before, after, container) {
    let startPos = 0;
    let dragging = false;

    const onMouseDown = (e) => {
      e.preventDefault();
      dragging = true;
      startPos = direction === 'row' ? e.clientX : e.clientY;
      resizer.classList.add('dragging');
      document.body.classList.add(direction === 'row' ? 'resizing' : 'resizing-vertical');
    };

    const onMouseMove = (e) => {
      if (!dragging) return;
      const currentPos = direction === 'row' ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      startPos = currentPos;

      const dimension = direction === 'row' ? 'width' : 'height';

      if (before.panel && before.panel !== 'preview') {
        this.resizePanel(before.panel, dimension, delta);
      } else if (before.children && before.position) {
        this.resizeContainer(before.position, dimension, delta, container);
      } else if (after.panel && after.panel !== 'preview') {
        this.resizePanel(after.panel, dimension, -delta);
      } else if (after.children && after.position) {
        this.resizeContainer(after.position, dimension, -delta, container);
      }
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove('dragging');
      document.body.classList.remove('resizing', 'resizing-vertical');
    };

    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Resize a combined container by the specified delta
   * @param {string} position - Container position
   * @param {string} dimension - Dimension to resize ('width' or 'height')
   * @param {number} delta - Amount to change size by in pixels
   * @param {HTMLElement} parentContainer - Parent container element
   * @returns {void}
   */
  resizeContainer(position, dimension, delta, parentContainer) {
    const minSize = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.max(400, viewportWidth * 0.6);
    const maxHeight = Math.max(300, viewportHeight * 0.6);

    if (dimension === 'width') {
      this.containerSizes[position] = Math.max(
        minSize,
        Math.min(maxWidth, (this.containerSizes[position] || 280) + delta)
      );
    } else {
      this.containerSizes[position] = Math.max(
        100,
        Math.min(maxHeight, (this.containerSizes[position] || 200) + delta)
      );
    }

    const containerEl = parentContainer.querySelector(`[data-position="${position}"]`);
    if (containerEl) {
      if (dimension === 'width') {
        containerEl.style.width = `${this.containerSizes[position]}px`;
      } else {
        containerEl.style.height = `${this.containerSizes[position]}px`;
      }
    }

    this.saveState();
  }

  /**
   * Remove all resizer elements from the DOM
   * @returns {void}
   */
  clearResizers() {
    this.resizers.forEach((r) => r.remove());
    this.resizers = [];
  }

  /**
   * Persist current layout state to localStorage
   * @returns {void}
   */
  saveState() {
    const state = {
      layout: this.currentLayout,
      panels: this.panelStates,
      containers: this.containerSizes
    };
    localStorage.setItem('layoutState', JSON.stringify(state));
  }

  /**
   * Restore layout state from localStorage
   * @returns {void}
   */
  loadState() {
    try {
      const saved = localStorage.getItem('layoutState');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.layout && LAYOUTS[state.layout]) {
          this.currentLayout = state.layout;
        }
        if (state.panels) {
          for (const panelId of Object.keys(this.panelStates)) {
            if (state.panels[panelId]) {
              this.panelStates[panelId] = {
                ...this.panelStates[panelId],
                ...state.panels[panelId]
              };
            }
          }
        }
        if (state.containers) {
          this.containerSizes = {
            ...this.containerSizes,
            ...state.containers
          };
        }
      }
    } catch (e) {
      console.error('Failed to load layout state:', e);
    }
  }
}

export const layoutManager = new LayoutManager();
export { LAYOUTS };
