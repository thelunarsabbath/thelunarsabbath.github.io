/**
 * Layout - Responsive layout management
 * 
 * Handles:
 * - Desktop (>=900px): Horizontal nav links with dropdown
 * - Mobile (<900px): Hamburger menu with slide-in sidebar
 * - PWA: Forward/back navigation buttons
 */

const Layout = {
  DESKTOP_BREAKPOINT: 900,
  
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
  
  // Currently open dropdown
  _openDropdown: null,
  
  // Scroll-direction header auto-hide state
  _lastScrollY: 0,
  _navHidden: false,
  _scrollTicking: false,
  
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
    this.setupDropdownHandlers();
    this.setupPWANavigation();
    this.setupScrollHide();
    
    // Initial layout update
    this.updateLayout();
    
    // Subscribe to store for menu state
    AppStore.subscribe((state) => {
      this.updateMenuState(state.ui.menuOpen);
    });
    
    // Mobile: handle popstate for menu history management
    window.addEventListener('popstate', () => {
      if (this._menuBackInProgress) {
        this._menuBackInProgress = false;
        return;
      }
      if (this._menuHistoryPushed && AppStore.getState().ui.menuOpen) {
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
    
    // Hamburger is always the menu trigger now (hidden on desktop via CSS, 
    // but becomes visible when viewport narrows)
    // Sidebar is always hamburger-driven (no always-visible mode)
    if (isDesktop) {
      // Close mobile menu if switching to desktop
      if (this.elements.sidebar) {
        this.elements.sidebar.classList.remove('open');
      }
      if (this.elements.menuOverlay) {
        this.elements.menuOverlay.classList.remove('visible');
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
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.toggle('open', isOpen);
    }
    if (this.elements.menuOverlay) {
      this.elements.menuOverlay.classList.toggle('visible', isOpen);
    }
    
    // Prevent body scroll when menu is open
    this.elements.body.classList.toggle('menu-open', isOpen);
    
    // Push history state when menu opens so back button closes it
    if (isOpen && !this._menuHistoryPushed) {
      this._menuHistoryPushed = true;
      history.pushState({ menuOpen: true }, '', window.location.href);
    } else if (!isOpen && this._menuHistoryPushed) {
      this._menuHistoryPushed = false;
      if (this._menuClosingForNav) {
        this._menuClosingForNav = false;
      } else {
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
      this.elements.body.classList.add('resizing');
      
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateLayout();
        
        // Close mobile menu when resizing to desktop
        if (this.isDesktop()) {
          AppStore.dispatch({ type: 'CLOSE_MENU' });
        }
        
        // Close dropdown if viewport changed
        this.closeDropdown();
        
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
    if (this.elements.sidebar) {
      this.elements.sidebar.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem) {
          this._menuClosingForNav = true;
        }
      }, true);
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Escape - close menu, dropdowns, and pickers
      if (e.key === 'Escape') {
        AppStore.dispatch({ type: 'CLOSE_MENU' });
        AppStore.dispatch({ type: 'CLOSE_ALL_PICKERS' });
        this.closeDropdown();
        if (typeof closeStrongsPanel === 'function') {
          closeStrongsPanel();
        }
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
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          AppStore.dispatch({ type: 'GO_TO_TODAY' });
          return;
        }
        if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') {
          e.preventDefault();
          const jd = state.context.selectedDate;
          if (jd) AppStore.dispatch({ type: 'SET_SELECTED_DATE', jd: jd + 1 });
          return;
        }
        if (e.key === 'p' || e.key === 'P' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const jd = state.context.selectedDate;
          if (jd) AppStore.dispatch({ type: 'SET_SELECTED_DATE', jd: jd - 1 });
          return;
        }
        if (e.key === ']') {
          e.preventDefault();
          if (typeof CalendarView !== 'undefined' && CalendarView.navigateMonth) {
            CalendarView.navigateMonth(1);
          }
          return;
        }
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
        const isBibleContent = currentView === 'bible' || 
          (currentView === 'reader' && state?.content?.params?.contentType === 'bible');
        
        if (isBibleContent) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (typeof navigateBibleChapter === 'function') navigateBibleChapter(1);
            return;
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (typeof navigateBibleChapter === 'function') navigateBibleChapter(-1);
            return;
          }
        }
      }
    });
  },
  
  /**
   * Setup dropdown handlers (close when clicking outside)
   */
  setupDropdownHandlers() {
    document.addEventListener('click', (e) => {
      if (this._openDropdown) {
        const dropdown = document.getElementById(this._openDropdown);
        if (dropdown && !dropdown.contains(e.target)) {
          this.closeDropdown();
        }
      }
    });
  },
  
  /**
   * Toggle a dropdown menu
   */
  toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    if (this._openDropdown === dropdownId) {
      this.closeDropdown();
    } else {
      // Close any other open dropdown
      this.closeDropdown();
      dropdown.classList.add('open');
      this._openDropdown = dropdownId;
    }
  },
  
  /**
   * Close the currently open dropdown
   */
  closeDropdown() {
    if (this._openDropdown) {
      const dropdown = document.getElementById(this._openDropdown);
      if (dropdown) dropdown.classList.remove('open');
      this._openDropdown = null;
    }
  },
  
  /**
   * Setup PWA navigation buttons
   */
  setupPWANavigation() {
    const backBtn = document.getElementById('pwa-back-btn');
    const forwardBtn = document.getElementById('pwa-forward-btn');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => history.back());
    }
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => history.forward());
    }
  },
  
  /**
   * Setup scroll-direction-aware auto-hide for the top nav.
   * Hides on scroll-down, shows immediately on any scroll-up.
   * Only active when body is the scroll container (mobile bible/reader views).
   */
  setupScrollHide() {
    const HIDE_THRESHOLD = 10; // Minimum scroll-down before hiding (px)
    
    window.addEventListener('scroll', () => {
      if (this._scrollTicking) return;
      this._scrollTicking = true;
      
      requestAnimationFrame(() => {
        this._scrollTicking = false;
        const nav = this.elements.topNav;
        if (!nav) return;
        
        // Only auto-hide when body is scrolling (mobile bible/reader)
        const body = document.body;
        const isScrollableView = body.classList.contains('view-bible') || 
          (body.classList.contains('view-reader') && !body.classList.contains('reader-landing'));
        
        if (!isScrollableView) {
          // Reset if we switched away from a scrollable view
          if (this._navHidden) {
            this._navHidden = false;
            nav.classList.remove('nav-hidden');
            body.classList.remove('nav-hidden');
          }
          this._lastScrollY = window.scrollY;
          return;
        }
        
        const currentY = window.scrollY;
        const delta = currentY - this._lastScrollY;
        
        if (delta > HIDE_THRESHOLD && currentY > 80) {
          // Scrolling DOWN past threshold — hide
          if (!this._navHidden) {
            this._navHidden = true;
            nav.classList.add('nav-hidden');
            body.classList.add('nav-hidden');
          }
        } else if (delta < 0) {
          // Scrolling UP at all — show immediately
          if (this._navHidden) {
            this._navHidden = false;
            nav.classList.remove('nav-hidden');
            body.classList.remove('nav-hidden');
          }
        }
        
        this._lastScrollY = currentY;
      });
    }, { passive: true });
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
