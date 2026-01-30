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
    
    // Show/hide PWA navigation
    if (this.elements.pwaNavButtons) {
      this.elements.pwaNavButtons.style.display = isPWA ? 'flex' : 'none';
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
  },
  
  /**
   * Setup resize handler
   */
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateLayout();
        
        // Close mobile menu when resizing to desktop
        if (this.isDesktop()) {
          AppStore.dispatch({ type: 'CLOSE_MENU' });
        }
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
    
    // Close menu when clicking a menu item
    if (this.elements.sidebar) {
      this.elements.sidebar.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem && !this.isDesktop()) {
          AppStore.dispatch({ type: 'CLOSE_MENU' });
        }
      });
    }
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        AppStore.dispatch({ type: 'CLOSE_MENU' });
        AppStore.dispatch({ type: 'CLOSE_ALL_PICKERS' });
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
