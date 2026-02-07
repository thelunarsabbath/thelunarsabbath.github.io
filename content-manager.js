/**
 * ContentManager - Manages content area views
 * 
 * Each view is an equal peer in the content area.
 * Only one view is visible at a time.
 */

const ContentManager = {
  // Registered view renderers
  views: {},
  
  // Current view name
  currentView: null,
  
  // Content area element
  contentArea: null,
  
  /**
   * Initialize the content manager
   */
  init() {
    this.contentArea = document.getElementById('content-area');
    
    if (!this.contentArea) {
      console.error('[ContentManager] #content-area element not found');
      return;
    }
    
    // Subscribe to store changes
    AppStore.subscribe((state, derived) => {
      this.render(state, derived);
    });
  },
  
  /**
   * Register a view renderer
   * @param {string} name - View name (matches content.view in state)
   * @param {Object} renderer - Object with render(state, derived) method
   */
  registerView(name, renderer) {
    if (typeof renderer.render !== 'function') {
      console.error(`[ContentManager] View "${name}" must have a render() method`);
      return;
    }
    this.views[name] = renderer;
  },
  
  /**
   * Render the current view
   * @param {Object} state - Current app state
   * @param {Object} derived - Derived state
   */
  render(state, derived) {
    const viewName = state.content.view;
    const view = this.views[viewName];
    
    // Handle view change
    if (viewName !== this.currentView) {
      // Call cleanup on previous view if it exists
      const previousView = this.views[this.currentView];
      if (previousView && typeof previousView.cleanup === 'function') {
        try {
          previousView.cleanup();
        } catch (e) {
          console.error(`[ContentManager] Error cleaning up view "${this.currentView}":`, e);
        }
      }
      
      this.currentView = viewName;
      
      // Scroll to top when switching views
      if (this.contentArea) this.contentArea.scrollTop = 0;
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      
      // Call init on new view if it exists
      if (view && typeof view.init === 'function') {
        try {
          view.init();
        } catch (e) {
          console.error(`[ContentManager] Error initializing view "${viewName}":`, e);
        }
      }
    }
    
    // Render the view
    if (view) {
      try {
        view.render(state, derived, this.contentArea);
      } catch (e) {
        console.error(`[ContentManager] Error rendering view "${viewName}":`, e);
        this.renderError(viewName, e);
      }
    } else {
      this.renderNotFound(viewName);
    }
    
    // Update body class for view-specific styling
    document.body.className = document.body.className
      .replace(/\bview-\S+/g, '')
      .trim();
    document.body.classList.add(`view-${viewName}`);
  },
  
  /**
   * Render a "view not found" message
   */
  renderNotFound(viewName) {
    this.contentArea.innerHTML = `
      <div class="content-error">
        <h2>View Not Found</h2>
        <p>The view "${viewName}" is not registered.</p>
        <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})">
          Go to Calendar
        </button>
      </div>
    `;
  },
  
  /**
   * Render an error message
   */
  renderError(viewName, error) {
    this.contentArea.innerHTML = `
      <div class="content-error">
        <h2>Error Loading View</h2>
        <p>There was an error loading the "${viewName}" view.</p>
        <pre>${error.message}</pre>
        <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})">
          Go to Calendar
        </button>
      </div>
    `;
  },
  
  /**
   * Get the current view renderer
   */
  getCurrentView() {
    return this.views[this.currentView];
  },
  
  /**
   * Check if a view is registered
   */
  hasView(name) {
    return !!this.views[name];
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentManager;
}
