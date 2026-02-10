/**
 * TutorialView - Welcome/About page
 * 
 * Comprehensive introduction to the Time-Tested calendar
 * with feature showcases, quick actions, and learning paths.
 */

const TutorialView = {
  /**
   * Render the tutorial/about view
   */
  render(state, derived, container) {
    container.innerHTML = `
      <div class="tutorial-view">
        <!-- Hero: Book Feature -->
        <section class="book-section" style="margin-top: 30px;">
          <div class="book-card">
            <div class="book-cover">
              <img src="/assets/img/TimeTestedBookFront.jpg" alt="Time-Tested Tradition Book Cover" class="book-cover-img">
            </div>
            <div class="book-info">
              <h3>A Time-Tested Tradition</h3>
              <p class="book-author">The Renewed Biblical Calendar — by Daniel Larimer</p>
              <p class="book-description">
                A comprehensive examination of the biblical calendar with historical evidence, 
                scriptural analysis, and astronomical verification. Explore the calendar, 
                read the book online, or download the free PDF.
              </p>
              <div class="book-actions">
                <button class="book-btn primary" onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})">
                  <span>📅</span> View Calendar
                </button>
                <button class="book-btn secondary" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested'}})">
                  <span>📖</span> Read Online
                </button>
                <a href="/media/time-tested-tradition.pdf" class="book-btn secondary" download onclick="trackBookDownload()">
                  <span>⬇️</span> Download PDF
                </a>
              </div>
            </div>
          </div>
        </section>

        <!-- Key Features Grid -->
        <section class="features-section">
          <h2 class="section-title">Powerful Features</h2>
          <div class="features-grid">
            ${this.renderFeatureCard('📅', 'Lunar Calendar', 
              'View any month in history with accurate moon phases, Sabbaths, and feast days calculated from astronomical data.',
              'calendar', null)}
            
            ${this.renderFeatureCard('📖', 'Bible Reader', 
              'Study Scripture with 10 English translations (KJV, ASV, AKJV, YLT, and more), Strong\'s concordance, Hebrew/Greek interlinear, symbol studies, and word studies.',
              'reader', {contentType:'bible'})}
            
            ${this.renderFeatureCard('assets/img/timeline_icon.png', 'Historical Timeline', 
              'Explore biblical history from Creation to the Temple destruction with events placed on an interactive timeline.',
              'timeline', null, true)}
            
            ${this.renderFeatureCard('🔬', 'Sabbath Tester', 
              'Test different calendar theories against 7 biblical test cases to see which configuration best fits Scripture.',
              'sabbath-tester', null)}
            
            ${this.renderFeatureCard('⛪', 'Priestly Divisions', 
              'Track the 24 priestly courses (Mishmarot) as established by King David, with historical anchors.',
              'priestly', null)}
            
            ${this.renderFeatureCard('🎺', 'Feast Days', 
              'View all biblical appointed times for any year with explanations and Scripture references.',
              'feasts', null)}
          </div>
        </section>

        <!-- Install App / Offline -->
        ${this.renderInstallSection()}

        <!-- Core Principles -->
        <section class="principles-section">
          <h2 class="section-title">Core Principles</h2>
          <p class="section-intro">
            The Time-Tested calendar is built on four foundational principles derived from careful Scripture study:
          </p>
          
          <div class="principles-grid">
            <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'07_When_Does_the_Month_Start'}})">
              <div class="principle-header">
                <span class="principle-icon">🌕</span>
                <h3>Full Moon Months</h3>
              </div>
              <p>The month begins at the full moon, as indicated by the Hebrew word <em>kece</em> (כֶּסֶה) in Psalm 81:3, explicitly tied to feast days. The renewed moon marks the 15th day.</p>
              <div class="principle-verse">
                "Blow the trumpet at the new moon, at the <strong>full moon</strong>, on our feast day." — Psalm 81:3
              </div>
              <span class="learn-link">Learn More →</span>
            </div>
            
            <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'06_When_Does_the_Day_Start'}})">
              <div class="principle-header">
                <span class="principle-icon">🌅</span>
                <h3>Morning Day Start</h3>
              </div>
              <p>The day begins at morning twilight, not evening. Genesis 1 describes "evening and morning" as the natural progression <em>within</em> each day, with the new day starting at light.</p>
              <div class="principle-verse">
                "And God called the light Day... And there was evening and there was morning, one day." — Genesis 1:5
              </div>
              <span class="learn-link">Learn More →</span>
            </div>
            
            <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'10_When_is_the_Sabbath'}})">
              <div class="principle-header">
                <span class="principle-icon">📆</span>
                <h3>Lunar Sabbaths</h3>
              </div>
              <p>The weekly Sabbath follows the lunar cycle on days 8, 15, 22, and 29 of each month. This pattern aligns with the Passover always falling on the 15th—a Sabbath.</p>
              <div class="principle-verse">
                "On the fifteenth day of the same month is the feast... on the first day you shall have a holy convocation." — Leviticus 23:6-7
              </div>
              <span class="learn-link">Learn More →</span>
            </div>
            
            <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'08_When_does_the_Year_Start'}})">
              <div class="principle-header">
                <span class="principle-icon">☀️</span>
                <h3>Equinox Year</h3>
              </div>
              <p>The year begins at the first full moon on or after the spring equinox, ensuring Passover falls after the equinox as commanded—in its "appointed season."</p>
              <div class="principle-verse">
                "You shall keep the Passover at its appointed time." — Numbers 9:2
              </div>
              <span class="learn-link">Learn More →</span>
            </div>
          </div>
        </section>

        <!-- Quick Start Guide -->
        <section class="quickstart-section">
          <h2 class="section-title">Quick Start</h2>
          <div class="quickstart-steps">
            <div class="step-card">
              <div class="step-number">1</div>
              <h4>Explore the Calendar</h4>
              <p>Start with today's date and see how the lunar calendar differs from the Gregorian calendar you're used to.</p>
              <button class="step-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})">
                Open Calendar
              </button>
            </div>
            
            <div class="step-card">
              <div class="step-number">2</div>
              <h4>Understand the Methodology</h4>
              <p>Read the introduction chapter to understand the scriptural basis for each calendar principle.</p>
              <button class="step-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'01_Introduction'}})">
                Read Introduction
              </button>
            </div>
            
            <div class="step-card">
              <div class="step-number">3</div>
              <h4>Test the Theory</h4>
              <p>Use the Sabbath Tester to see how different calendar configurations match biblical test cases.</p>
              <button class="step-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'sabbath-tester'})">
                Run Tests
              </button>
            </div>
            
            <div class="step-card">
              <div class="step-number">4</div>
              <h4>Study Scripture</h4>
              <p>Dive into the Bible reader with Strong's concordance to verify these principles for yourself.</p>
              <button class="step-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible'}})">
                Open Bible
              </button>
            </div>
          </div>
        </section>

        <!-- Chapter List -->
        <section class="chapters-section">
          <h2 class="section-title">Book Chapters</h2>
          <div class="chapters-grid">
            ${this.renderChapterList()}
          </div>
          
          <h3 class="subsection-title">Appendices</h3>
          <div class="chapters-grid appendices">
            ${this.renderAppendixList()}
          </div>
        </section>

        <!-- Compare Calendars -->
        <section class="compare-section">
          <h2 class="section-title">Calendar Options</h2>
          <p class="section-intro">
            The app supports multiple calendar configurations so you can explore different interpretations:
          </p>
          <div class="compare-grid">
            <div class="compare-card featured">
              <div class="compare-badge">Recommended</div>
              <div class="compare-icon-main">🌕</div>
              <h4>Time-Tested</h4>
              <ul>
                <li>Full Moon month start</li>
                <li>Morning day start</li>
                <li>Lunar Sabbaths (8,15,22,29)</li>
                <li>Spring equinox year</li>
              </ul>
              <button class="compare-btn" onclick="AppStore.dispatchBatch([{type:'SET_PROFILE',profileId:'timeTested'},{type:'SET_VIEW',view:'calendar'}])">
                Use This Profile
              </button>
            </div>
            
            <div class="compare-card">
              <div class="compare-icon-main">🌒</div>
              <h4>Ancient Traditional</h4>
              <ul>
                <li>Crescent Moon start</li>
                <li>Evening day start</li>
                <li>Saturday Sabbath</li>
                <li>Barley/Aviv year start</li>
              </ul>
              <button class="compare-btn" onclick="AppStore.dispatchBatch([{type:'SET_PROFILE',profileId:'ancientTraditional'},{type:'SET_VIEW',view:'calendar'}])">
                Use This Profile
              </button>
            </div>
            
            <div class="compare-card">
              <div class="compare-icon-main">🌒</div>
              <h4>Traditional Lunar</h4>
              <ul>
                <li>Crescent Moon start</li>
                <li>Evening day start</li>
                <li>Lunar Sabbaths</li>
                <li>Spring equinox year</li>
              </ul>
              <button class="compare-btn" onclick="AppStore.dispatchBatch([{type:'SET_PROFILE',profileId:'traditionalLunar'},{type:'SET_VIEW',view:'calendar'}])">
                Use This Profile
              </button>
            </div>
            
            <div class="compare-card">
              <div class="compare-icon-main">⚙️</div>
              <h4>Custom</h4>
              <ul>
                <li>Choose your month start</li>
                <li>Choose your day start</li>
                <li>Choose your Sabbath</li>
                <li>Choose your year start</li>
              </ul>
              <button class="compare-btn" onclick="TutorialView.openProfileEditor()">
                Configure Settings
              </button>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="tutorial-footer">
          <div class="footer-verse">
            <p>"It is the glory of God to conceal a matter, but the glory of kings is to search out a matter."</p>
            <cite>— Proverbs 25:2</cite>
          </div>
          <div class="footer-links">
            <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'settings'})">Settings</button>
            <span>•</span>
            <a href="/media/time-tested-tradition.pdf" download onclick="trackBookDownload()">Download Book</a>
          </div>
        </footer>
      </div>
    `;
  },
  
  /**
   * Render a feature card
   */
  renderFeatureCard(icon, title, description, view, params, isImage = false) {
    const iconHtml = isImage 
      ? `<img src="/${icon}" alt="${title}" class="feature-icon-img">`
      : `<span class="feature-icon">${icon}</span>`;
    
    const onclick = params 
      ? `AppStore.dispatch({type:'SET_VIEW',view:'${view}',params:${JSON.stringify(params).replace(/"/g, '&quot;')}})`
      : `AppStore.dispatch({type:'SET_VIEW',view:'${view}'})`;
    
    return `
      <div class="feature-card" onclick="${onclick}">
        <div class="feature-icon-wrap">${iconHtml}</div>
        <h3>${title}</h3>
        <p>${description}</p>
        <span class="feature-link">Explore →</span>
      </div>
    `;
  },
  
  /**
   * Render the list of book chapters
   */
  renderChapterList() {
    const chapters = [
      { id: '01_Introduction', title: 'Introduction', number: 1 },
      { id: '02_Inherited_Lies', title: 'Inherited Lies', number: 2 },
      { id: '03_Principles_of_Evaluation', title: 'Principles of Evaluation', number: 3 },
      { id: '04_Alleged_Authority_of_Sanhedrin', title: 'Authority of Sanhedrin', number: 4 },
      { id: '05_Where_Does_the_Day_Start', title: 'Where Does the Day Start?', number: 5 },
      { id: '06_When_Does_the_Day_Start', title: 'When Does the Day Start?', number: 6 },
      { id: '07_When_Does_the_Month_Start', title: 'When Does the Month Start?', number: 7 },
      { id: '08_When_does_the_Year_Start', title: 'When Does the Year Start?', number: 8 },
      { id: '09_How_to_Observe_the_Signs', title: 'How to Observe the Signs', number: 9 },
      { id: '10_When_is_the_Sabbath', title: 'When is the Sabbath?', number: 10 },
      { id: '11_The_Day_of_Saturn', title: 'The Day of Saturn', number: 11 },
      { id: '12_32_AD_Resurrection', title: '32 AD Resurrection', number: 12 },
      { id: '13_Herod_the_Great', title: 'Herod the Great', number: 13 },
      { id: '14_Passion_Week_-_3_Days_&_3_Nights', title: 'Passion Week', number: 14 },
      { id: '15_Solar_Only_Calendars', title: 'Solar Only Calendars', number: 15 },
      { id: '16_The_Path_to_Salvation', title: 'Path to Salvation', number: 16 },
      { id: '17_Commands_to_Follow', title: 'Commands to Follow', number: 17 },
      { id: '18_Appointed_Times', title: 'Appointed Times', number: 18 },
      { id: '19_Miscellaneous_Commands', title: 'Miscellaneous Commands', number: 19 }
    ];
    
    return chapters.map(ch => `
      <button class="chapter-item" 
              onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${ch.id}'}})">
        <span class="chapter-number">${ch.number}</span>
        <span class="chapter-title">${ch.title}</span>
      </button>
    `).join('');
  },
  
  /**
   * Render appendix chapters
   */
  renderAppendixList() {
    const appendices = [
      { id: 'e01_Herod_Regal_vs_Defacto', title: 'Herod: Regal vs De Facto', letter: 'A' },
      { id: 'e02_Battle_of_Actium', title: 'Battle of Actium', letter: 'B' },
      { id: 'e03_Herods_Appointment', title: 'Herod\'s Appointment', letter: 'C' },
      { id: 'e04_StabilityOfAustronomy', title: 'Stability of Astronomy', letter: 'D' },
      { id: 'e05_FirstFruitsNewWine', title: 'First Fruits & New Wine', letter: 'E' }
    ];
    
    return appendices.map(ch => `
      <button class="chapter-item appendix" 
              onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${ch.id}'}})">
        <span class="chapter-number">${ch.letter}</span>
        <span class="chapter-title">${ch.title}</span>
      </button>
    `).join('');
  },
  
  /**
   * Navigate to calendar and open profile editor
   */
  /**
   * Render the PWA install section, adapting to current install state
   */
  renderInstallSection() {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;

    // Already installed — show a brief confirmation instead of the full pitch
    if (isPWA) {
      return `
        <section class="install-section installed">
          <div class="install-card">
            <div class="install-icon">✅</div>
            <div class="install-info">
              <h3>App Installed — Works Offline</h3>
              <p>You're running the installed app. All data is stored locally on your device — Bible translations, the Hebrew lexicon, the timeline, and calendar calculations all work without an internet connection.</p>
            </div>
          </div>
        </section>
      `;
    }

    const canInstall = !!TutorialView._deferredInstallPrompt;
    const installBtnStyle = canInstall ? '' : 'style="display:none"';
    const hint = canInstall ? '' : 'On iOS, tap the Share button and then "Add to Home Screen." On desktop Chrome/Edge, look for the install icon in the address bar.';

    return `
      <section class="install-section" id="install-section">
        <div class="install-card">
          <div class="install-icon">📲</div>
          <div class="install-info">
            <h3>Install the App — Works Offline</h3>
            <p>
              This is a <strong>Progressive Web App</strong>. Install it on your phone, tablet, or desktop 
              and use it anytime — even without an internet connection. All 10 Bible translations, the Hebrew 
              lexicon, the historical timeline, and full calendar calculations are stored locally on your device. 
              No account required, no ads, no server dependency.
            </p>
            <div class="install-features">
              <span class="install-feature"><span class="install-check">✓</span> Works offline</span>
              <span class="install-feature"><span class="install-check">✓</span> Instant search</span>
              <span class="install-feature"><span class="install-check">✓</span> No account needed</span>
              <span class="install-feature"><span class="install-check">✓</span> No ads</span>
            </div>
            <button class="install-btn" id="install-btn" ${installBtnStyle} onclick="TutorialView.installApp()">
              Install App
            </button>
            <p class="install-hint" id="install-hint">${hint}</p>
          </div>
        </div>
      </section>
    `;
  },

  openProfileEditor() {
    // First navigate to calendar
    AppStore.dispatch({type: 'SET_VIEW', view: 'calendar'});
    
    // Then open profile editor after a brief delay to let calendar render
    setTimeout(() => {
      if (typeof CalendarView !== 'undefined' && CalendarView.showProfileEditor) {
        // Create a fake event object
        CalendarView.showProfileEditor({ stopPropagation: () => {} });
      }
    }, 100);
  },

  /**
   * Handle PWA install button click
   */
  installApp() {
    if (TutorialView._deferredInstallPrompt) {
      TutorialView._deferredInstallPrompt.prompt();
      TutorialView._deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          const btn = document.getElementById('install-btn');
          if (btn) btn.style.display = 'none';
          const hint = document.getElementById('install-hint');
          if (hint) hint.textContent = 'App installed successfully!';
        }
        TutorialView._deferredInstallPrompt = null;
      });
    }
  },

  /** Stored deferred prompt from beforeinstallprompt event */
  _deferredInstallPrompt: null
};

// Capture the browser's install prompt so we can trigger it from our button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  TutorialView._deferredInstallPrompt = e;
  // If install button exists on page, make sure it's visible
  const btn = document.getElementById('install-btn');
  if (btn) btn.style.display = '';
});

// Hide install section if already installed as PWA
window.addEventListener('appinstalled', () => {
  TutorialView._deferredInstallPrompt = null;
  const section = document.getElementById('install-section');
  if (section) section.style.display = 'none';
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TutorialView;
}
