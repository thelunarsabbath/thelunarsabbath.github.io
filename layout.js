/**
 * Layout - Responsive layout management
 * 
 * Handles:
 * - Desktop (>=1200px): Fixed right sidebar
 * - Mobile (<1200px): Hamburger menu with slide-in
 * - PWA: Forward/back navigation buttons
 */

const Layout = {
  DESKTOP_BREAKPOINT: 1200,
  
  // Element references
  elements: {
    body: null,
    topNav: null,
    sidebar: null,
    menuOverlay: null,
    hamburgerBtn: null,
    pwaNavButtons: null,
    contentArea: null
  },
  
  /**
   * Initialize the layout
   */
  init() {
    // Cache element references
    this.elements.body = document.body;
    this.elements.topNav = document.getElementById('top-nav');
    this.elements.sidebar = document.getElementById('sidebar-menu');
    this.elements.menuOverlay = document.getElementById('menu-overlay');
    this.elements.hamburgerBtn = document.getElementById('hamburger-btn');
    this.elements.pwaNavButtons = document.getElementById('pwa-nav-buttons');
    this.elements.contentArea = document.getElementById('content-area');
    
    // Setup event handlers
    this.setupResizeHandler();
    this.setupMenuHandlers();
    this.setupPWANavigation();
    
    // Initial layout update
    this.updateLayout();
    
    // Subscribe to store for menu state
    AppStore.subscribe((state) => {
      this.updateMenuState(state.ui.menuOpen);
    });
    
    // Mobile: handle popstate for menu history management
    window.addEventListener('popstate', () => {
      if (this._menuBackInProgress) {
        // This popstate is from our programmatic history.back() (overlay/escape close)
        // Just clean up — URL hasn't changed, url-router's handler will be a no-op
        this._menuBackInProgress = false;
        return;
      }
      if (this._menuHistoryPushed && AppStore.getState().ui.menuOpen) {
        // User pressed back while menu was open — close it
        this._menuHistoryPushed = false;
        AppStore.dispatch({ type: 'CLOSE_MENU' });
      }
    });
  },
  
  /**
   * Check if we're in desktop mode
   */
  isDesktop() {
    return window.innerWidth >= this.DESKTOP_BREAKPOINT;
  },
  
  /**
   * Check if running as installed PWA
   */
  isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  },
  
  /**
   * Update layout based on current viewport
   */
  updateLayout() {
    const isDesktop = this.isDesktop();
    const isPWA = this.isPWA();
    
    // Update body classes
    this.elements.body.classList.toggle('desktop-layout', isDesktop);
    this.elements.body.classList.toggle('mobile-layout', !isDesktop);
    this.elements.body.classList.toggle('pwa-mode', isPWA);
    
    // PWA nav buttons removed: keep only the right-side nav (nav-back-btn / nav-forward-btn) to avoid duplicate back/forward in install mode
    if (this.elements.pwaNavButtons) {
      this.elements.pwaNavButtons.style.display = 'none';
    }
    
    // On desktop, always show sidebar, hide hamburger
    if (isDesktop) {
      if (this.elements.sidebar) {
        this.elements.sidebar.classList.add('visible');
        this.elements.sidebar.classList.remove('open');
      }
      if (this.elements.menuOverlay) {
        this.elements.menuOverlay.classList.remove('visible');
      }
      if (this.elements.hamburgerBtn) {
        this.elements.hamburgerBtn.style.display = 'none';
      }
    } else {
      // On mobile, show hamburger, hide sidebar by default
      if (this.elements.hamburgerBtn) {
        this.elements.hamburgerBtn.style.display = 'flex';
      }
      if (this.elements.sidebar) {
        this.elements.sidebar.classList.remove('visible');
      }
    }
  },
  
  // Track whether we pushed a history entry for the mobile menu
  _menuHistoryPushed: false,
  _menuBackInProgress: false,
  _menuClosingForNav: false,
  
  /**
   * Update menu state based on store
   */
  updateMenuState(isOpen) {
    // Only applies to mobile
    if (this.isDesktop()) return;
    
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.toggle('open', isOpen);
    }
    if (this.elements.menuOverlay) {
      this.elements.menuOverlay.classList.toggle('visible', isOpen);
    }
    
    // Prevent body scroll when menu is open
    this.elements.body.classList.toggle('menu-open', isOpen);
    
    // Mobile: push history state when menu opens so back button closes it
    if (isOpen && !this._menuHistoryPushed) {
      this._menuHistoryPushed = true;
      history.pushState({ menuOpen: true }, '', window.location.href);
    } else if (!isOpen && this._menuHistoryPushed) {
      this._menuHistoryPushed = false;
      if (this._menuClosingForNav) {
        // Navigating via menu item — don't pop history, navigation will push on top.
        // The stale entry has the same URL, just one extra harmless back step.
        this._menuClosingForNav = false;
      } else {
        // Closed without navigation (overlay, escape) — pop our history entry
        this._menuBackInProgress = true;
        history.back();
      }
    }
  },
  
  /**
   * Setup resize handler
   */
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      // Add resizing class to disable transitions during resize
      this.elements.body.classList.add('resizing');
      
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateLayout();
        
        // Close mobile menu when resizing to desktop
        if (this.isDesktop()) {
          AppStore.dispatch({ type: 'CLOSE_MENU' });
        }
        
        // Remove resizing class after layout update, allowing transitions again
        requestAnimationFrame(() => {
          this.elements.body.classList.remove('resizing');
        });
      }, 100);
    });
  },
  
  /**
   * Setup menu toggle handlers
   */
  setupMenuHandlers() {
    // Hamburger button
    if (this.elements.hamburgerBtn) {
      this.elements.hamburgerBtn.addEventListener('click', () => {
        AppStore.dispatch({ type: 'TOGGLE_MENU' });
      });
    }
    
    // Menu overlay (close on click)
    if (this.elements.menuOverlay) {
      this.elements.menuOverlay.addEventListener('click', () => {
        AppStore.dispatch({ type: 'CLOSE_MENU' });
      });
    }
    
    // Close menu when clicking a menu item (navigation)
    // Use CAPTURING phase so the flag is set BEFORE the button's inline onclick fires.
    // The inline onclick dispatches CLOSE_MENU + SET_VIEW via dispatchBatch; without
    // this flag set first, updateMenuState would call history.back() and undo the navigation.
    if (this.elements.sidebar) {
      this.elements.sidebar.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem && !this.isDesktop()) {
          this._menuClosingForNav = true;
        }
      }, true);
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't handle shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Escape - close menu and pickers
      if (e.key === 'Escape') {
        AppStore.dispatch({ type: 'CLOSE_MENU' });
        AppStore.dispatch({ type: 'CLOSE_ALL_PICKERS' });
        // Close Strong's panel if open
        if (typeof closeStrongsPanel === 'function') {
          closeStrongsPanel();
        }
        // Close concept search if open
        if (typeof closeConceptSearch === 'function') {
          closeConceptSearch();
        }
        return;
      }
      
      // Get current view
      const state = AppStore.getState();
      const currentView = state?.content?.view;
      
      // Calendar shortcuts
      if (currentView === 'calendar') {
        // t - Go to today
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          AppStore.dispatch({ type: 'GO_TO_TODAY' });
          return;
        }
        
        // n or → - Next day
        if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') {
          e.preventDefault();
          const jd = state.context.selectedDate;
          if (jd) {
            AppStore.dispatch({ type: 'SET_SELECTED_DATE', jd: jd + 1 });
          }
          return;
        }
        
        // p or ← - Previous day
        if (e.key === 'p' || e.key === 'P' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const jd = state.context.selectedDate;
          if (jd) {
            AppStore.dispatch({ type: 'SET_SELECTED_DATE', jd: jd - 1 });
          }
          return;
        }
        
        // ] - Next month
        if (e.key === ']') {
          e.preventDefault();
          if (typeof CalendarView !== 'undefined' && CalendarView.navigateMonth) {
            CalendarView.navigateMonth(1);
          }
          return;
        }
        
        // [ - Previous month
        if (e.key === '[') {
          e.preventDefault();
          if (typeof CalendarView !== 'undefined' && CalendarView.navigateMonth) {
            CalendarView.navigateMonth(-1);
          }
          return;
        }
      }
      
      // Bible reader shortcuts
      if (currentView === 'bible' || currentView === 'reader') {
        // Only apply arrow keys for bible content in reader
        const isBibleContent = currentView === 'bible' || 
          (currentView === 'reader' && state?.content?.params?.contentType === 'bible');
        
        if (isBibleContent) {
          // → - Next chapter
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (typeof navigateBibleChapter === 'function') {
              navigateBibleChapter(1);
            }
            return;
          }
          
          // ← - Previous chapter
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (typeof navigateBibleChapter === 'function') {
              navigateBibleChapter(-1);
            }
            return;
          }
        }
      }
    });
  },
  
  /**
   * Setup PWA navigation buttons
   */
  setupPWANavigation() {
    const backBtn = document.getElementById('pwa-back-btn');
    const forwardBtn = document.getElementById('pwa-forward-btn');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        history.back();
      });
    }
    
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        history.forward();
      });
    }
  },
  
  /**
   * Scroll content area to top
   */
  scrollToTop() {
    if (this.elements.contentArea) {
      this.elements.contentArea.scrollTop = 0;
    }
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Layout;
}
