/**
 * HelpView - Help & Documentation page
 * 
 * Provides user documentation for app features,
 * with focus on search capabilities including regex.
 */

const HelpView = {
  /**
   * Render the help view
   */
  render(state, derived, container) {
    container.innerHTML = `
      <div class="help-view">
        <!-- Header -->
        <header class="help-header">
          <h1>📚 Help & Documentation</h1>
          <p class="help-subtitle">Learn how to use the Time-Tested app effectively</p>
        </header>

        <!-- Table of Contents -->
        <nav class="help-toc">
          <h2>Contents</h2>
          <ul>
            <li><a href="#search-section" onclick="HelpView.scrollToSection('search-section')">🔍 Search Guide</a></li>
            <li><a href="#navigation-section" onclick="HelpView.scrollToSection('navigation-section')">🧭 Navigation</a></li>
            <li><a href="#calendar-section" onclick="HelpView.scrollToSection('calendar-section')">📅 Calendar</a></li>
            <li><a href="#classics-section" onclick="HelpView.scrollToSection('classics-section')">🏛️ Classics (Philo & Josephus)</a></li>
            <li><a href="#keyboard-section" onclick="HelpView.scrollToSection('keyboard-section')">⌨️ Keyboard Shortcuts</a></li>
          </ul>
        </nav>

        <!-- Search Section -->
        <section id="search-section" class="help-section">
          <h2>🔍 Search Guide</h2>
          <p class="section-intro">
            The Bible reader has a powerful search system that supports multiple search types.
            Type your search in the search box and press Enter.
          </p>

          <!-- Scripture Navigation -->
          <div class="help-card">
            <h3>📖 Scripture Navigation</h3>
            <p>Jump directly to any Bible verse by typing a reference:</p>
            <div class="help-examples">
              <div class="help-example">
                <code>John 3:16</code>
                <span>→ Goes to John chapter 3, verse 16</span>
              </div>
              <div class="help-example">
                <code>Genesis 1</code>
                <span>→ Goes to Genesis chapter 1</span>
              </div>
              <div class="help-example">
                <code>Rev 21:4</code>
                <span>→ Abbreviations work too</span>
              </div>
            </div>
            <p class="help-note">💡 A chapter number is required. Just typing "John" will do a text search for the word "John".</p>
          </div>

          <!-- Text Search -->
          <div class="help-card">
            <h3>📝 Text Search</h3>
            <p>Search for any word or phrase in the Bible:</p>
            <div class="help-examples">
              <div class="help-example">
                <code>faith</code>
                <span>→ Finds all verses containing "faith"</span>
              </div>
              <div class="help-example">
                <code>love one another</code>
                <span>→ Finds verses with this phrase</span>
              </div>
              <div class="help-example">
                <code>sabbath</code>
                <span>→ Finds all sabbath references</span>
              </div>
            </div>
            <p class="help-tip">After text results appear, you can expand your search by Hebrew/Greek concepts using the "Expand by concept" section.</p>
          </div>

          <!-- Strong's Numbers -->
          <div class="help-card">
            <h3>🔢 Strong's Concordance Numbers</h3>
            <p>Search by Strong's number to find the original Hebrew or Greek word:</p>
            <div class="help-examples">
              <div class="help-example">
                <code>H7676</code>
                <span>→ Hebrew word שַׁבָּת (shabbath) - Sabbath</span>
              </div>
              <div class="help-example">
                <code>G26</code>
                <span>→ Greek word ἀγάπη (agape) - Love</span>
              </div>
              <div class="help-example">
                <code>H430</code>
                <span>→ Hebrew word אֱלֹהִים (elohim) - God</span>
              </div>
            </div>
            <p class="help-note">💡 <strong>H</strong> = Hebrew (Old Testament), <strong>G</strong> = Greek (New Testament)</p>
          </div>

          <!-- Regex Search -->
          <div class="help-card regex-card">
            <h3>🔮 Regular Expression (Regex) Search</h3>
            <p>For advanced pattern matching, use regex by wrapping your pattern in forward slashes:</p>
            
            <div class="regex-intro">
              <h4>What is Regex?</h4>
              <p>
                <strong>Regular expressions</strong> (regex) are special patterns that let you search 
                for text in flexible ways. Instead of searching for exact words, you can search for 
                <em>patterns</em> — like "any word ending in -eth" or "a number followed by days".
              </p>
            </div>

            <h4>Basic Format</h4>
            <div class="help-examples">
              <div class="help-example">
                <code>/pattern/</code>
                <span>→ Basic search (case-insensitive by default)</span>
              </div>
              <div class="help-example">
                <code>/pattern/i</code>
                <span>→ Explicitly case-insensitive</span>
              </div>
            </div>

            <h4>Common Patterns</h4>
            <table class="regex-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Meaning</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>.</code></td>
                  <td>Any single character</td>
                  <td><code>/l.ve/</code> finds "love", "live", "lave"</td>
                </tr>
                <tr>
                  <td><code>*</code></td>
                  <td>Zero or more of previous</td>
                  <td><code>/lo*k/</code> finds "lk", "lok", "look", "loook"</td>
                </tr>
                <tr>
                  <td><code>+</code></td>
                  <td>One or more of previous</td>
                  <td><code>/lo+k/</code> finds "lok", "look" (not "lk")</td>
                </tr>
                <tr>
                  <td><code>?</code></td>
                  <td>Zero or one of previous</td>
                  <td><code>/colou?r/</code> finds "color" and "colour"</td>
                </tr>
                <tr>
                  <td><code>^</code></td>
                  <td>Start of verse</td>
                  <td><code>/^And the/</code> finds verses starting with "And the"</td>
                </tr>
                <tr>
                  <td><code>$</code></td>
                  <td>End of verse</td>
                  <td><code>/amen\\.$/</code> finds verses ending with "amen."</td>
                </tr>
                <tr>
                  <td><code>[abc]</code></td>
                  <td>Any character in brackets</td>
                  <td><code>/[Ll]ord/</code> finds "Lord" or "lord"</td>
                </tr>
                <tr>
                  <td><code>[^abc]</code></td>
                  <td>Any character NOT in brackets</td>
                  <td><code>/[^a-z]ord/</code> finds "Lord", "1ord" (not "lord")</td>
                </tr>
                <tr>
                  <td><code>\\b</code></td>
                  <td>Word boundary</td>
                  <td><code>/\\bsab\\b/</code> finds "sab" as whole word only</td>
                </tr>
                <tr>
                  <td><code>\\d</code></td>
                  <td>Any digit (0-9)</td>
                  <td><code>/\\d+ days/</code> finds "7 days", "40 days"</td>
                </tr>
                <tr>
                  <td><code>\\s</code></td>
                  <td>Any whitespace</td>
                  <td><code>/Lord\\s+God/</code> finds "Lord God" with any spacing</td>
                </tr>
                <tr>
                  <td><code>|</code></td>
                  <td>OR (either/or)</td>
                  <td><code>/sabbath|rest/</code> finds "sabbath" OR "rest"</td>
                </tr>
                <tr>
                  <td><code>()</code></td>
                  <td>Group patterns</td>
                  <td><code>/(first|last) day/</code> finds "first day" or "last day"</td>
                </tr>
              </tbody>
            </table>

            <h4>Common Use Cases</h4>
            
            <div class="regex-usecase">
              <h5>🔹 Match whole words only (not prefixes/suffixes)</h5>
              <p>Use <code>\\b</code> (word boundary) before and after the word:</p>
              <div class="help-examples">
                <div class="help-example">
                  <code>/\\bhot\\b/</code>
                  <span>→ Matches "hot" but NOT "hotel" or "hottest"</span>
                </div>
                <div class="help-example">
                  <code>/\\blove\\b/</code>
                  <span>→ Matches "love" but NOT "loved" or "lovely"</span>
                </div>
              </div>
            </div>

            <div class="regex-usecase">
              <h5>🔹 Find verses containing BOTH words (AND search)</h5>
              <p>Use <code>(?=.*word)</code> for each word you want to require:</p>
              <div class="help-examples">
                <div class="help-example">
                  <code>/(?=.*hot)(?=.*cold)/</code>
                  <span>→ Verses with BOTH "hot" AND "cold"</span>
                </div>
                <div class="help-example">
                  <code>/(?=.*\\bhot\\b)(?=.*\\bcold\\b)/</code>
                  <span>→ Both as whole words only</span>
                </div>
                <div class="help-example">
                  <code>/(?=.*faith)(?=.*works)/</code>
                  <span>→ Verses mentioning both faith AND works</span>
                </div>
              </div>
              <p class="help-note">💡 The <code>(?=.*word)</code> pattern is called a "lookahead" — it checks if the word exists anywhere in the verse without consuming characters.</p>
            </div>

            <div class="regex-usecase">
              <h5>🔹 Find verses containing EITHER word (OR search)</h5>
              <p>Use the pipe <code>|</code> between words:</p>
              <div class="help-examples">
                <div class="help-example">
                  <code>/hot|cold/</code>
                  <span>→ Verses with "hot" OR "cold" (or both)</span>
                </div>
                <div class="help-example">
                  <code>/\\b(faith|believe|trust)\\b/</code>
                  <span>→ Any of these words (whole words only)</span>
                </div>
              </div>
            </div>

            <h4>More Examples</h4>
            <div class="help-examples regex-examples">
              <div class="help-example">
                <code>/\\bsabbath\\b/</code>
                <span>→ "sabbath" as whole word (not "sabbaths")</span>
              </div>
              <div class="help-example">
                <code>/sabbaths?/</code>
                <span>→ Both "sabbath" and "sabbaths"</span>
              </div>
              <div class="help-example">
                <code>/\\d+ years?/</code>
                <span>→ Any number followed by "year" or "years"</span>
              </div>
              <div class="help-example">
                <code>/lord.*god/i</code>
                <span>→ "Lord" followed by "God" (anything between)</span>
              </div>
              <div class="help-example">
                <code>/\\beth$/</code>
                <span>→ Words ending in "eth" (old English verb forms)</span>
              </div>
              <div class="help-example">
                <code>/^In the beginning/</code>
                <span>→ Verses starting with "In the beginning"</span>
              </div>
            </div>

            <div class="regex-tips">
              <h4>💡 Tips</h4>
              <ul>
                <li>Regex is <strong>case-insensitive</strong> by default</li>
                <li>Special characters like <code>.</code> <code>*</code> <code>+</code> <code>?</code> need backslash to match literally: <code>\\.</code></li>
                <li>The search shows how long it took in milliseconds</li>
                <li>Results show the match count per verse when multiple matches found</li>
                <li>Invalid patterns show a helpful error message</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Navigation Section -->
        <section id="navigation-section" class="help-section">
          <h2>🧭 Navigation</h2>
          
          <div class="help-card">
            <h3>Getting Around</h3>
            <ul class="help-list">
              <li><strong>Menu:</strong> Tap the ☰ hamburger icon (mobile) or use the sidebar (desktop)</li>
              <li><strong>Back/Forward:</strong> Use browser navigation or swipe gestures</li>
              <li><strong>Brand Logo:</strong> Click "Time-Tested" to go to the About page</li>
              <li><strong>Today:</strong> Click the "Today" button to return to current date</li>
            </ul>
          </div>

          <div class="help-card">
            <h3>Bible Reader</h3>
            <ul class="help-list">
              <li><strong>Book/Chapter:</strong> Use the dropdowns in the navigation bar</li>
              <li><strong>Verse Numbers:</strong> Click any verse number to see interlinear (Hebrew/Greek)</li>
              <li><strong>Strong's Numbers:</strong> Click any Strong's number to see word study</li>
              <li><strong>Cross References:</strong> Look for 📖 icons next to verses</li>
            </ul>
          </div>
        </section>

        <!-- Calendar Section -->
        <section id="calendar-section" class="help-section">
          <h2>📅 Calendar</h2>
          
          <div class="help-card">
            <h3>Calendar Features</h3>
            <ul class="help-list">
              <li><strong>Navigate Months:</strong> Use arrow buttons or swipe left/right</li>
              <li><strong>Navigate Years:</strong> Click the year to jump to any year</li>
              <li><strong>Select Day:</strong> Tap any day to select it</li>
              <li><strong>Moon Phases:</strong> Shown as icons on each day</li>
              <li><strong>Sabbaths:</strong> Highlighted days (configurable in Settings)</li>
              <li><strong>Feast Days:</strong> Marked with special colors and labels</li>
            </ul>
          </div>

          <div class="help-card">
            <h3>Calendar Profiles</h3>
            <p>Switch between different calendar interpretations:</p>
            <ul class="help-list">
              <li><strong>Time-Tested:</strong> Full moon months, morning day start, lunar sabbaths</li>
              <li><strong>Ancient Traditional:</strong> Crescent moon, evening start, Saturday sabbath</li>
              <li><strong>Traditional Lunar:</strong> Crescent moon, evening start, lunar sabbaths</li>
              <li><strong>Custom:</strong> Configure your own settings</li>
            </ul>
          </div>
        </section>

        <!-- Classics (Philo & Josephus) -->
        <section id="classics-section" class="help-section">
          <h2>🏛️ Classics (Philo & Josephus)</h2>
          <div class="help-card">
            <h3>Browse Primary Sources</h3>
            <p>The Reader includes the complete works of <strong>Philo of Alexandria</strong> and <strong>Josephus</strong> — key primary sources for Second Temple period history and biblical calendar evidence.</p>
            <div class="help-examples">
              <div class="help-example">
                <code>Antiquities 18.2.2</code>
                <span>→ Jump to Josephus, Antiquities book 18, chapter 2, section 2</span>
              </div>
              <div class="help-example">
                <code>On the Creation 42</code>
                <span>→ Jump to Philo, On the Creation section 42</span>
              </div>
            </div>
            <p>Citations in the book chapters are automatically linked — click any Philo or Josephus reference to read the source passage. You can also type citations directly into the search bar.</p>
            <p>Open from the Reader landing page or use the content-type dropdown in the Reader header.</p>
          </div>
        </section>

        <!-- Keyboard Shortcuts (Coming Soon) -->
        <section id="keyboard-section" class="help-section">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <div class="help-card">
            <p style="color: var(--accent-gold); font-style: italic;">Coming soon — keyboard shortcuts for calendar navigation, Bible reader, and timeline are planned for a future update.</p>
          </div>
        </section>

        <!-- Footer -->
        <footer class="help-footer">
          <p>Need more help? Read the full book for detailed explanations of calendar principles.</p>
          <button class="help-footer-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested'}})">
            📖 Read the Book
          </button>
        </footer>
      </div>
    `;
  },

  /**
   * Scroll to a section smoothly
   */
  scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return false;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HelpView;
}
