/**
 * BlogView - Release announcements and feature updates
 * 
 * A developer-to-user changelog that highlights new features,
 * improvements, and where to find them in the app.
 */

const BlogView = {

  // Blog posts in reverse chronological order (newest first)
  posts: [
    {
      id: 'v100-major-refactor',
      date: 'February 2026',
      title: 'The Big Update: 12 Translations, Hebrew Interlinear, Verse Studies & More',
      summary: 'This update adds 12 Bible translations, Hebrew interlinear with morphology, an AI-enhanced Hebrew lexicon, ancient classics, verse studies, and a redesigned reading experience.',
      content: `
        <p>This release includes a significant update to the site with many new features. Here's what's been added.</p>

        <h3>The Renewed Biblical Calendar — Final Release</h3>
        <div class="blog-book-feature">
          <div class="blog-book-cover">
            <img src="/assets/img/TimeTestedBookFront.jpg" alt="The Renewed Biblical Calendar Book Cover">
          </div>
          <div class="blog-book-details">
            <p><strong><em>A Time-Tested Tradition: The Renewed Biblical Calendar</em></strong> is now in its final form. The complete book is available to read online or download as a free PDF. Physical copies will be available for purchase soon.</p>
            <p class="blog-nav-link">
              <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested'}})">Read Online →</button>
              <a href="/media/time-tested-tradition.pdf" class="blog-inline-btn" download>Download PDF →</a>
            </p>
          </div>
        </div>

        <h3>12 Bible Translations</h3>
        <p>The Bible reader now includes <strong>12 English translations</strong>: KJV, ASV, AKJV, YLT, Darby, Douay-Rheims, JPS 1917, Smith's Literal, Webster's, and the Septuagint (Brenton's English LXX). You can switch between them, reorder your favorites, and hide the ones you don't use.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible'}})">Open Bible Reader →</button>
        </p>

        <h3>Multiverse View</h3>
        <p>The new <strong>multiverse view</strong> lets you compare multiple Bible passages side by side in a single view. Enter a citation like "Daniel 9:24-27; Jeremiah 25:11-12" and see all the referenced verses together, making it easy to study cross-references and parallel passages.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'multiverse',translation:'kjv',multiverse:'Daniel 9:24-27; Jeremiah 25:11-12'}})">Try Multiverse View →</button>
        </p>

        <h3>Hebrew Interlinear with Morphology</h3>
        <p>Tap any verse number to reveal a word-by-word Hebrew interlinear powered by the <strong>MorphHB dataset</strong> (305,000+ words across 39 Old Testament books). Each Hebrew word shows its morphological parsing, Strong's number, and a gloss pulled from your currently selected translation. Tap any Hebrew word to open its lexicon entry.</p>

        <h3>AI-Enhanced Hebrew Lexicon</h3>
        <p>The Strong's concordance sidebar now includes an <strong>AI-enhanced BDB lexicon</strong> with 8,680 Hebrew entries. Entries include sense-by-sense definitions, key verses, translation notes, and root connections — based on the Brown-Driver-Briggs lexicon data and enhanced with Claude Sonnet for clarity.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible',translation:'kjv',book:'Genesis',chapter:1}})">Try it: Open Genesis 1, tap a Strong's number →</button>
        </p>

        <h3>Verse Studies</h3>
        <p>A new <strong>verse studies</strong> system lets you dive deep into important passages. Our first studies cover Daniel 9's seventy weeks prophecy, with phrase-by-phrase Hebrew analysis and cross-references. More studies are in the works.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'verse-studies',study:'DANIEL-9'}})">Read the Daniel 9 Study →</button>
        </p>

        <h3>Translation Patches</h3>
        <p>A new <strong>translation patch system</strong> highlights phrases where the original Hebrew or Greek may not match the English rendering. Each patch shows a suggested correction with phrase-level highlighting, and you can accept or reject patches per verse.</p>

        <h3>Word Studies</h3>
        <p>Word studies for key Hebrew terms like <em>ayin</em> (H369) and <em>eth</em> (H6256) are now available. Each study traces a word's usage across Scripture, examines its root meaning, and shows how different translations handle it.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'words'}})">Browse Word Studies →</button>
        </p>

        <h3>Ancient Classics: Josephus & Philo</h3>
        <p>The reader now includes the complete works of <strong>Flavius Josephus</strong> (Antiquities, Wars, Against Apion, Autobiography) and <strong>Philo of Alexandria</strong>, with full-text search across all works. Josephus includes extracted footnotes with tooltip markers. These first-century sources are invaluable for understanding the historical context of biblical calendar practices.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'josephus'}})">Browse Josephus →</button>
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'philo'}})">Browse Philo →</button>
        </p>

        <h3>Symbol Studies</h3>
        <p>A growing library of <strong>symbol studies</strong> explores how Scripture uses recurring symbols — grass, trees, Jerusalem, and more. Each study collects relevant passages and traces the symbolic meaning across both testaments.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols'}})">Browse Symbol Studies →</button>
        </p>

        <h3>Number Studies & Gematria</h3>
        <p><strong>Number studies</strong> explore the symbolic meaning of numbers in Scripture (7, 12, 40, 70, 490, 666, and more). The Strong's sidebar also includes a <strong>gematria calculator</strong> that shows the numeric value of Hebrew and Greek words and finds other words with the same value.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'numbers'}})">Browse Number Studies →</button>
        </p>

        <h3>Advanced Search</h3>
        <p>Search is a first-class feature. Press <strong>Ctrl+K</strong> (Cmd+K on Mac) to open a unified search that instantly searches across all 12 Bible translations, historical timeline events, Strong's numbers, Gregorian and lunar dates, and Josephus and Philo citations — all from one search bar. Because all data is stored locally on your device, searches return results instantly with no server round-trips or database queries.</p>
        <p>The Bible search also supports <strong>regular expressions</strong> for advanced pattern matching — word boundaries, alternation, lookaheads, and more. Search for complex patterns across the entire Bible in milliseconds.</p>

        <h3>Cross References</h3>
        <p>Bible verses now include <strong>cross-reference links</strong> to related passages, and verses tied to historical events link directly to the timeline.</p>

        <h3>Book Index</h3>
        <p>The Bible reader has a <strong>book index page</strong> with descriptions and category badges for all 66 books.</p>

        <h3>Biblical Timeline</h3>
        <p>An interactive <strong>historical timeline</strong> spans from Creation to the Temple destruction, with zoomable navigation, event filtering by type and era, duration bars for reigns and constructions, and full-text search.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'timeline'})">Open Timeline →</button>
        </p>

        <h3>Sabbath Tester</h3>
        <p>The <strong>Sabbath Tester</strong> evaluates different calendar configurations against 7 biblical test cases (the Exodus, manna, Jericho, etc.) to see which theory best fits Scripture. Compare full moon vs. crescent, morning vs. evening day start, and lunar vs. Saturday Sabbath.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'sabbath-tester'})">Run Sabbath Tests →</button>
        </p>

        <h3>Feast Days & Priestly Divisions</h3>
        <p>The calendar sidebar shows all <strong>biblical appointed times</strong> for any year with Scripture references, and tracks the <strong>24 priestly courses</strong> (Mishmarot) as established by King David.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'feasts'})">View Feast Days →</button>
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'priestly'})">View Priestly Courses →</button>
        </p>

        <h3>Day Detail Panel</h3>
        <p>Tap any calendar day to see <strong>astronomical times</strong> (daybreak, sunrise, sunset, twilight), feast details, historical biblical events, Torah portions, priestly courses, and links to view the sky in Stellarium.</p>

        <h3>Torah Portions</h3>
        <p>Weekly <strong>Torah reading portions</strong> are displayed for each Sabbath, with holiday replacements and maftir additions, supporting both lunar Sabbath and Saturday Sabbath schedules.</p>

        <h3>Jubilee Cycle Tracker</h3>
        <p>The calendar header displays the current <strong>Jubilee number, week, and year</strong>, with indicators for Sabbath years and Jubilee years.</p>

        <h3>Date Calculator</h3>
        <p>A built-in <strong>date calculator</strong> lets you add or subtract years, months, weeks, and days in either lunar or Gregorian mode — useful for checking prophetic time periods like Daniel's 70 weeks or the 1,290 days.</p>

        <h3>Calendar Export</h3>
        <p><strong>Export calendar events</strong> (Sabbaths, New Moons, feasts, biblical events) as ICS files for Google Calendar, Apple Calendar, or Outlook.</p>

        <h3>Blood Moon Detection</h3>
        <p>The calendar identifies <strong>total lunar eclipses</strong> on relevant dates, with links to view them in Stellarium Web at the correct date, time, and location.</p>

        <h3>World Clock</h3>
        <p>The day detail panel includes a <strong>world clock</strong> that compares the same moment across different calendar profiles and locations, showing lunar dates, feast icons, priestly courses, and local times.</p>

        <h3>Multiple Calendar Profiles</h3>
        <p>Compare different calendar theories side by side — <strong>Time-Tested</strong> (full moon, morning day), <strong>Ancient Traditional</strong> (crescent, evening), <strong>Traditional Lunar</strong>, <strong>Modern Hebrew Calendar</strong>, and more. Create custom profiles with your own settings.</p>

        <h3>Works Offline — Install the App</h3>
        <p>Unlike most Bible and calendar websites, this entire app <strong>runs on your device</strong>. All 12 Bible translations, the Hebrew lexicon, the historical timeline, calendar calculations, and Josephus and Philo are stored locally after first load. There is no server, no database, and no internet connection required after installation.</p>
        <p>This means <strong>searches are instant</strong> — no waiting for server responses. It also means the app works when you have no cell signal, no Wi-Fi, or even if the grid goes down entirely. Install it as a <strong>Progressive Web App</strong> on your phone, tablet, or desktop and you have a complete Bible study and calendar tool that works anywhere, anytime.</p>

        <h3>Divine Name Preferences</h3>
        <p>Choose how divine names are rendered across all translations — YHWH, Yahweh, Yahuah, LORD, and more — including compound name forms.</p>
        <p class="blog-nav-link">
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'settings'})">Configure in Settings →</button>
        </p>

        <h3>Improved Navigation</h3>
        <p>The app uses <strong>proper browser history</strong> — back and forward buttons work across all views. URLs are shareable and bookmarkable, capturing your position down to the verse, Strong's number, and panel state.</p>

        <h3>Lightweight & Fast</h3>
        <p>All Bible data is gzip-compressed (57 MB → 16 MB on disk) and loaded on demand — translations you use appear instantly, while others load in the background. No account required, no ads.</p>

        <p class="blog-closing">We hope these tools help you dig deeper into Scripture and the biblical calendar.</p>
      `
    }
  ],

  /**
   * Render the blog view
   */
  render(state, derived, container) {
    const postListHtml = this.posts.map(post => this.renderPostCard(post)).join('');
    
    container.innerHTML = `
      <div class="blog-view">
        <header class="blog-header">
          <h1>What's New</h1>
          <p class="blog-subtitle">Updates, new features, and improvements to the Time-Tested calendar app.</p>
        </header>
        
        <div class="blog-posts">
          ${postListHtml}
        </div>
      </div>
    `;
  },

  /**
   * Render a single blog post card (expanded by default for now)
   */
  renderPostCard(post) {
    return `
      <article class="blog-post" id="post-${post.id}">
        <div class="blog-post-meta">
          <time class="blog-post-date">${post.date}</time>
        </div>
        <h2 class="blog-post-title">${post.title}</h2>
        <p class="blog-post-summary">${post.summary}</p>
        <div class="blog-post-content">
          ${post.content}
        </div>
      </article>
    `;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlogView;
}
