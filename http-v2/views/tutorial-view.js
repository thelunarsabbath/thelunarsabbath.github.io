/**
 * TutorialView - Welcome/About page
 * 
 * Shows overview of Time-Tested calendar principles
 * and links to book chapters for deeper learning.
 */

const TutorialView = {
  /**
   * Render the tutorial/about view
   */
  render(state, derived, container) {
    container.innerHTML = `
      <div class="tutorial-view">
        <!-- Hero Section -->
        <header class="tutorial-hero">
          <div class="hero-icon">🌕</div>
          <h1>The Time-Tested Tradition</h1>
          <p class="hero-subtitle">Understanding the Biblical Lunar Calendar</p>
        </header>
        
        <!-- Principle Cards -->
        <section class="principle-cards">
          <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'07_When_Does_the_Month_Start'}})">
            <div class="principle-icon">🌕</div>
            <h3>Full Moon Months</h3>
            <p>The month begins at the full moon, as evidenced by scripture and ancient practice. The word for "full moon" (kece) appears in Psalm 81:3 explicitly tied to feast days.</p>
            <span class="learn-more">Learn More →</span>
          </div>
          
          <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'05_Where_Does_the_Day_Start'}})">
            <div class="principle-icon">🌅</div>
            <h3>Morning Day Start</h3>
            <p>The day begins at morning twilight, not evening. Genesis 1 describes "evening and morning" as the transition from one day to the next, with morning starting the new day.</p>
            <span class="learn-more">Learn More →</span>
          </div>
          
          <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'10_When_is_the_Sabbath'}})">
            <div class="principle-icon">📅</div>
            <h3>Lunar Sabbaths</h3>
            <p>The weekly Sabbath follows the lunar cycle on days 8, 15, 22, and 29 of each month. This aligns with the pattern established at creation and preserved in scripture.</p>
            <span class="learn-more">Learn More →</span>
          </div>
          
          <div class="principle-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'08_When_does_the_Year_Start'}})">
            <div class="principle-icon">☀️</div>
            <h3>Spring Equinox Year</h3>
            <p>The year begins at the first new moon after the spring equinox, ensuring Passover falls at the proper time each year.</p>
            <span class="learn-more">Learn More →</span>
          </div>
        </section>
        
        <!-- Quick Actions -->
        <section class="tutorial-actions">
          <h2>Get Started</h2>
          <div class="action-buttons">
            <button class="action-btn primary" onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})">
              <span class="btn-icon">📅</span>
              <span class="btn-text">View Calendar</span>
            </button>
            
            <button class="action-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'01_Introduction'}})">
              <span class="btn-icon">📚</span>
              <span class="btn-text">Read the Book</span>
            </button>
            
            <button class="action-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'sabbath-tester'})">
              <span class="btn-icon">🔬</span>
              <span class="btn-text">Test the Theory</span>
            </button>
            
            <button class="action-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'bible'})">
              <span class="btn-icon">📖</span>
              <span class="btn-text">Explore Scripture</span>
            </button>
          </div>
        </section>
        
        <!-- Chapter List -->
        <section class="chapter-list">
          <h2>Book Chapters</h2>
          <div class="chapters-grid">
            ${this.renderChapterList()}
          </div>
        </section>
        
        <!-- Footer -->
        <footer class="tutorial-footer">
          <p>
            "It is the honor of kings to search out a matter" — Proverbs 25:2
          </p>
        </footer>
      </div>
    `;
  },
  
  /**
   * Render the list of book chapters
   */
  renderChapterList() {
    // TODO: Load from chapters.json
    const chapters = [
      { id: '01_Introduction', title: 'Introduction', number: 1 },
      { id: '02_Inherited_Lies', title: 'Inherited Lies', number: 2 },
      { id: '03_Principles_of_Evaluation', title: 'Principles of Evaluation', number: 3 },
      { id: '04_Alleged_Authority_of_Sanhedrin', title: 'Alleged Authority of Sanhedrin', number: 4 },
      { id: '05_Where_Does_the_Day_Start', title: 'Where Does the Day Start?', number: 5 },
      { id: '06_When_Does_the_Day_Start', title: 'When Does the Day Start?', number: 6 },
      { id: '07_When_Does_the_Month_Start', title: 'When Does the Month Start?', number: 7 },
      { id: '08_When_does_the_Year_Start', title: 'When Does the Year Start?', number: 8 },
      { id: '09_How_to_Observe_the_Signs', title: 'How to Observe the Signs', number: 9 },
      { id: '10_When_is_the_Sabbath', title: 'When is the Sabbath?', number: 10 },
      { id: '11_The_Day_of_Saturn', title: 'The Day of Saturn', number: 11 },
      { id: '12_32_AD_Resurrection', title: '32 AD Resurrection', number: 12 },
      { id: '13_Herod_the_Great', title: 'Herod the Great', number: 13 },
      { id: '14_Passion_Week_-_3_Days_&_3_Nights', title: 'Passion Week - 3 Days & 3 Nights', number: 14 },
      { id: '15_Solar_Only_Calendars', title: 'Solar Only Calendars', number: 15 },
      { id: '16_The_Path_to_Salvation', title: 'The Path to Salvation', number: 16 },
      { id: '17_Commands_to_Follow', title: 'Commands to Follow', number: 17 },
      { id: '18_Appointed_Times', title: 'Appointed Times', number: 18 },
      { id: '19_Miscellaneous_Commands', title: 'Miscellaneous Commands', number: 19 }
    ];
    
    return chapters.map(ch => `
      <button class="chapter-item" 
              onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${ch.id}'}})">
        <span class="chapter-number">${ch.number}</span>
        <span class="chapter-title">${ch.title}</span>
      </button>
    `).join('');
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TutorialView;
}
