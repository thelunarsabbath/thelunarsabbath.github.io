/**
 * Calendar Export Module
 * 
 * Generates ICS (iCalendar) files for exporting:
 * - Sabbaths and New Moons
 * - Feast days / Appointed times
 * - Biblical events and anniversaries
 */

const CalendarExport = {
  
  // Hebrew month names
  MONTH_NAMES: [
    'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
    'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'
  ],
  
  /**
   * Format date for ICS (YYYYMMDD)
   */
  formatICSDate(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  },
  
  /**
   * Escape special characters for ICS format
   */
  escapeICS(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  },
  
  /**
   * Format year for display (handles BC years)
   */
  formatYear(year) {
    if (year <= 0) {
      return `${1 - year} BC`;
    }
    return `${year} AD`;
  },
  
  /**
   * Generate ICS content for Sabbaths and Feasts
   */
  generateFeastsICS(options = {}) {
    const state = AppStore.getState();
    const derived = AppStore.getDerived();
    const { lunarMonths, config, year } = derived;
    
    if (!lunarMonths || lunarMonths.length === 0) {
      console.warn('No lunar months available for export');
      return null;
    }
    
    const includeSabbaths = options.includeSabbaths !== false;
    const includeNewMoons = options.includeNewMoons !== false;
    const includeFeasts = options.includeFeasts !== false;
    
    const events = [];
    const yearLabel = this.formatYear(year);
    
    // Collect events from all months
    for (const month of lunarMonths) {
      if (!month.days) continue;
      
      for (const day of month.days) {
        const gDate = day.gregorianDate;
        if (!gDate) continue;
        
        const monthName = this.MONTH_NAMES[month.monthNumber - 1] || `Month ${month.monthNumber}`;
        
        // Add Sabbaths
        if (includeSabbaths && day.isSabbath) {
          const sabbathLabel = config.sabbathMode === 'lunar' ? 'Lunar Sabbath' : 
                               config.sabbathMode === 'saturday' ? 'Shabbat' :
                               config.sabbathMode === 'sunday' ? "Lord's Day" :
                               config.sabbathMode === 'friday' ? 'Jumu\'ah' : 
                               'Rest Day';
          events.push({
            date: gDate,
            title: `${sabbathLabel} (${monthName} ${day.lunarDay})`,
            description: `${sabbathLabel} - Day ${day.lunarDay} of ${monthName}`,
            category: 'Sabbath'
          });
        }
        
        // Add New Moons
        if (includeNewMoons && day.lunarDay === 1) {
          events.push({
            date: gDate,
            title: `New Moon - ${monthName}`,
            description: `Start of ${monthName} (Lunar Month ${month.monthNumber})`,
            category: 'New Moon'
          });
        }
        
        // Add Feasts
        if (includeFeasts && day.feasts && day.feasts.length > 0) {
          for (const feast of day.feasts) {
            let title = feast.name || feast;
            if (day.feastDayNum) {
              title += ` (Day ${day.feastDayNum})`;
            }
            events.push({
              date: gDate,
              title: title,
              description: `${feast.description || title} - ${monthName} ${day.lunarDay}`,
              category: 'Feast'
            });
          }
        }
      }
    }
    
    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return this.buildICSContent(events, `Lunar Sabbath Calendar ${yearLabel}`, year);
  },
  
  /**
   * Generate ICS content for Biblical Events and Anniversaries
   */
  async generateEventsICS(options = {}) {
    const state = AppStore.getState();
    const derived = AppStore.getDerived();
    const { lunarMonths, year } = derived;
    
    if (!lunarMonths || lunarMonths.length === 0) {
      console.warn('No lunar months available for export');
      return null;
    }
    
    const events = [];
    const yearLabel = this.formatYear(year);
    
    // Get Bible events data
    const bibleEvents = window.BIBLE_EVENTS || [];
    
    // Build lookup of gregorian dates for each lunar date in this year
    const lunarDateToGregorian = new Map();
    for (const month of lunarMonths) {
      if (!month.days) continue;
      for (const day of month.days) {
        if (day.gregorianDate) {
          const key = `${month.monthNumber}-${day.lunarDay}`;
          lunarDateToGregorian.set(key, day.gregorianDate);
        }
      }
    }
    
    // Find events that match lunar dates in this year
    for (const event of bibleEvents) {
      if (!event.month || !event.day) continue;
      
      const key = `${event.month}-${event.day}`;
      const gDate = lunarDateToGregorian.get(key);
      
      if (gDate) {
        // Determine if this is the original event or an anniversary
        let title = event.title || event.name;
        let description = event.description || '';
        
        // Check if this is an anniversary
        if (event.year && event.year !== year) {
          const eventYear = event.year;
          const yearsAgo = year - eventYear;
          if (yearsAgo > 0) {
            title = `Anniversary: ${title}`;
            description = `${yearsAgo} years since: ${description}`;
          }
        }
        
        events.push({
          date: gDate,
          title: title,
          description: description,
          category: 'Biblical Event'
        });
      }
    }
    
    // Also include historical events from day.bibleEvents if populated
    for (const month of lunarMonths) {
      if (!month.days) continue;
      for (const day of month.days) {
        if (day.bibleEvents && day.bibleEvents.length > 0) {
          for (const evt of day.bibleEvents) {
            // Avoid duplicates - check if we already have this event
            const isDupe = events.some(e => 
              e.date.getTime() === day.gregorianDate.getTime() && 
              e.title === evt.title
            );
            if (!isDupe) {
              events.push({
                date: day.gregorianDate,
                title: evt.title || evt.name,
                description: evt.description || '',
                category: 'Biblical Event'
              });
            }
          }
        }
      }
    }
    
    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return this.buildICSContent(events, `Biblical Events ${yearLabel}`, year);
  },
  
  /**
   * Build ICS file content from events array
   */
  buildICSContent(events, calendarName, year) {
    if (!events || events.length === 0) {
      return null;
    }
    
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LunarSabbath.net//Lunar Sabbath Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeICS(calendarName)}`
    ];
    
    for (const event of events) {
      const dateStr = this.formatICSDate(event.date);
      const uid = `${dateStr}-${event.title.replace(/\s+/g, '-').substring(0, 50)}@lunarsabbath.net`;
      
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${dateStr}`);
      lines.push(`SUMMARY:${this.escapeICS(event.title)}`);
      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeICS(event.description)}`);
      }
      if (event.category) {
        lines.push(`CATEGORIES:${this.escapeICS(event.category)}`);
      }
      lines.push('END:VEVENT');
    }
    
    lines.push('END:VCALENDAR');
    
    return lines.join('\r\n');
  },
  
  /**
   * Download ICS file
   */
  downloadICS(icsContent, filename) {
    if (!icsContent) {
      console.warn('No content to download');
      return;
    }
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  
  /**
   * Try to share ICS file (mobile) or download (desktop)
   */
  async shareOrDownload(icsContent, filename, title) {
    if (!icsContent) {
      alert('No calendar data available. Please view a calendar first.');
      return;
    }
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const file = new File([blob], filename, { type: 'text/calendar' });
    
    // Try Web Share API first (works on mobile)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
        console.log('Share failed, falling back to download');
      }
    }
    
    // Fallback to download
    this.downloadICS(icsContent, filename);
  },
  
  /**
   * Export Feasts & Sabbaths
   */
  async exportFeasts() {
    const derived = AppStore.getDerived();
    const year = derived.year;
    const icsContent = this.generateFeastsICS({
      includeSabbaths: true,
      includeNewMoons: true,
      includeFeasts: true
    });
    
    const filename = `lunar-sabbath-calendar-${year}.ics`;
    await this.shareOrDownload(icsContent, filename, 'Lunar Sabbath Calendar');
  },
  
  /**
   * Export Biblical Events & Anniversaries
   */
  async exportEvents() {
    const derived = AppStore.getDerived();
    const year = derived.year;
    const icsContent = await this.generateEventsICS();
    
    const filename = `biblical-events-${year}.ics`;
    await this.shareOrDownload(icsContent, filename, 'Biblical Events');
  },
  
  /**
   * Show export options modal
   */
  showExportModal() {
    const derived = AppStore.getDerived();
    const yearLabel = this.formatYear(derived.year);
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'export-modal-overlay';
    overlay.className = 'export-modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeExportModal();
    };
    
    overlay.innerHTML = `
      <div class="export-modal">
        <div class="export-modal-header">
          <h3>📅 Export Calendar</h3>
          <button class="export-modal-close" onclick="CalendarExport.closeExportModal()">✕</button>
        </div>
        <div class="export-modal-content">
          <p class="export-modal-year">Export events for <strong>${yearLabel}</strong></p>
          
          <div class="export-option" onclick="CalendarExport.exportFeasts(); CalendarExport.closeExportModal();">
            <div class="export-option-icon">🎺</div>
            <div class="export-option-info">
              <div class="export-option-title">Feasts & Sabbaths</div>
              <div class="export-option-desc">New Moons, Sabbaths, and all appointed times</div>
            </div>
          </div>
          
          <div class="export-option" onclick="CalendarExport.exportEvents(); CalendarExport.closeExportModal();">
            <div class="export-option-icon">📜</div>
            <div class="export-option-info">
              <div class="export-option-title">Biblical Events</div>
              <div class="export-option-desc">Historical events and anniversaries for this year</div>
            </div>
          </div>
          
          <div class="export-note">
            <p>💡 Events will be added to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.)</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  },
  
  /**
   * Close export modal
   */
  closeExportModal() {
    const overlay = document.getElementById('export-modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 300);
    }
  }
};

// Make available globally
window.CalendarExport = CalendarExport;
