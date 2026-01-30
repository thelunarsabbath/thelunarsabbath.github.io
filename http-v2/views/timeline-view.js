/**
 * TimelineView - Biblical timeline visualization
 * Uses biblical-timeline.js for rendering (copied from http/ with minimal changes)
 */

const TimelineView = {
  initialized: false,
  
  init() {
    console.log('[TimelineView] init');
  },
  
  cleanup() {
    console.log('[TimelineView] cleanup');
  },
  
  render(state, derived, container) {
    // Sync global state before rendering
    if (typeof syncGlobalState === 'function') {
      syncGlobalState();
    }
    
    // Create the timeline container structure - positioned to fill content area
    container.innerHTML = `
      <div id="biblical-timeline-page" class="biblical-timeline-page" style="display: flex; position: relative; top: 0; left: 0; right: 0; bottom: 0; height: calc(100vh - var(--top-nav-height, 56px) - 20px);">
        <div class="biblical-timeline-header" style="display: none;">
          <h2>Biblical Timeline</h2>
        </div>
        <div id="biblical-timeline-vis-container" class="biblical-timeline-vis-container">
          <div class="biblical-timeline-loading">Loading timeline...</div>
        </div>
      </div>
    `;
    
    // Render the timeline using the existing biblical-timeline.js
    const renderAndRestore = () => {
      if (typeof renderBiblicalTimeline === 'function') {
        renderBiblicalTimeline();
        
        // Restore selection from URL state after a brief delay
        setTimeout(() => {
          this.restoreSelection(state.ui);
        }, 500);
      }
    };
    
    if (typeof renderBiblicalTimeline === 'function') {
      // Wait for container to be in DOM, then render
      requestAnimationFrame(renderAndRestore);
    } else {
      console.warn('[TimelineView] renderBiblicalTimeline not found - checking if data needs loading');
      // The timeline may not be initialized yet - try loading
      if (typeof loadBiblicalTimelineData === 'function') {
        loadBiblicalTimelineData().then(renderAndRestore);
      }
    }
  },
  
  // Restore event/duration selection from URL state
  restoreSelection(ui) {
    if (!ui) return;
    
    if (ui.timelineEventId && typeof openEventDetail === 'function') {
      openEventDetail(ui.timelineEventId);
    } else if (ui.timelineDurationId && typeof openDurationDetail === 'function') {
      openDurationDetail(ui.timelineDurationId);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimelineView;
}
