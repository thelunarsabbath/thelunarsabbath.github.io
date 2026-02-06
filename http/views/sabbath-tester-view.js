/**
 * SabbathTesterView - Test biblical events against calendar theories
 * 
 * Ported from http-v1/sabbath-tester.js
 * Adapted to use LunarCalendarEngine and AppStore architecture
 */

// Biblical test cases - extensible array
// These tests validate fixed-weekday sabbath theories (Saturday) against biblical events
const BIBLICAL_TESTS = [
  {
    id: 'manna-sabbath',
    name: 'First Sabbath of Manna',
    description: 'Israel arrived in the Wilderness of Sin on the 15th of the Second Month, 1446 BC (Exodus 16:1). Manna first fell on the 16th (the morning after arrival). They gathered manna for 6 days (16th-21st), and the 22nd was explicitly called the Sabbath when no manna fell (Exodus 16:22-26). Therefore, the 22nd of the 2nd month must be a Saturday.',
    scripture: 'Exodus 16:1-26',
    year: -1445,  // Astronomical year (1446 BC = -1445)
    month: 2,     // Second month (Iyar)
    day: 22,
    expectedWeekday: 6,  // Saturday (0=Sun, 6=Sat)
    expectedLabel: 'Saturday',
    location: { lat: 29.1500, lon: 33.4000, name: 'Wilderness of Sin' }
  },
  {
    id: 'first-fruits-1406',
    name: 'First Fruits After Jordan Crossing',
    description: 'The 16th of the First Month, 1406 BC was First Fruits when Israel ate the produce of Canaan for the first time (Joshua 5:10-12). According to Leviticus 23:11, First Fruits is offered "on the day after the Sabbath," which means the 16th should be the first day of the week (Sunday).',
    scripture: 'Joshua 5:10-12, Leviticus 23:11',
    year: -1405,  // Astronomical year (1406 BC = -1405)
    month: 1,     // First month (Nisan)
    day: 16,
    expectedWeekday: 0,  // Sunday (first day of week)
    expectedLabel: 'Sunday',
    location: { lat: 31.8500, lon: 35.4500, name: 'Jericho' }
  },
  {
    id: 'resurrection-32ad',
    name: 'Resurrection of Jesus (32 AD)',
    description: 'Jesus rose from the dead on the first day of the week (Matthew 28:1, Mark 16:2, Luke 24:1, John 20:1), which was also First Fruits (Leviticus 23:11). He was crucified on Passover (14th), rested in the tomb on the 15th, and rose on the 16th. For Saturday to be the weekly Sabbath, this calendar must place the 16th of Nisan 32 AD on Sunday (the day after Saturday).',
    scripture: 'Matthew 28:1, 1 Corinthians 15:20',
    year: 32,  // 32 AD
    month: 1,  // First month (Nisan)
    day: 16,   // First Fruits / Resurrection (must be first day of week)
    expectedWeekday: 0,  // Sunday (first day of week)
    expectedLabel: 'Sunday',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' }
  },
  {
    id: 'resurrection-30ad',
    name: 'Resurrection of Jesus (30 AD)',
    description: 'Alternative crucifixion year theory. For Saturday to be the weekly Sabbath, this calendar must place the 16th of Nisan 30 AD on Sunday.',
    scripture: 'Matthew 28:1, 1 Corinthians 15:20',
    year: 30,  // 30 AD
    month: 1,  // First month (Nisan)
    day: 16,   // First Fruits / Resurrection (must be first day of week)
    expectedWeekday: 0,  // Sunday (first day of week)
    expectedLabel: 'Sunday',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
    excludeFromScore: true  // Alternative theory - don't include in main score
  },
  {
    id: 'resurrection-33ad',
    name: 'Resurrection of Jesus (33 AD)',
    description: 'Alternative crucifixion year theory. For Saturday to be the weekly Sabbath, this calendar must place the 16th of Nisan 33 AD on Sunday.',
    scripture: 'Matthew 28:1, 1 Corinthians 15:20',
    year: 33,  // 33 AD
    month: 1,  // First month (Nisan)
    day: 16,   // First Fruits / Resurrection (must be first day of week)
    expectedWeekday: 0,  // Sunday (first day of week)
    expectedLabel: 'Sunday',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
    excludeFromScore: true  // Alternative theory - don't include in main score
  },
  {
    id: 'temple1-talmud',
    name: 'First Temple Destruction (Talmud)',
    description: 'The Talmud (Ta\'anit 29a) claims both Temples fell on the 9th of Av "at the conclusion of Shabbat" (post-Sabbath, i.e., Sunday). The Talmud reconciles biblical accounts (7th in 2 Kings, 10th in Jeremiah) by describing a multi-day process where the fire was set toward the end of the 9th. This tests whether the 9th of Av falls on Sunday according to Talmudic tradition.',
    scripture: 'Talmud Ta\'anit 29a, Arakhin 11b',
    year: -585,  // Astronomical year (586 BC = -585)
    month: 5,    // Fifth month (Av)
    day: 9,      // 9th of Av per Talmud
    expectedWeekday: 0,  // Sunday (first day of week, "post-Shabbat")
    expectedLabel: 'Sunday',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
    excludeFromScore: true  // Extra-biblical tradition test
  },
  {
    id: 'temple2-talmud',
    name: 'Second Temple Destruction (Talmud)',
    description: 'The Talmud claims the Second Temple also fell on the 9th of Av "at the conclusion of Shabbat" (Sunday), mirroring the First Temple. Josephus records the destruction on the 10th and notes the Romans built siege ramps on the 8th while Jews rested (implying the 8th was a Sabbath). This tests the Talmudic claim that 9th of Av was Sunday.',
    scripture: 'Talmud Ta\'anit 29a, Josephus Jewish War 6.4',
    year: 70,    // 70 AD
    month: 5,    // Fifth month (Av)
    day: 9,      // 9th of Av per Talmud
    expectedWeekday: 0,  // Sunday (first day of week, "post-Shabbat")
    expectedLabel: 'Sunday',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
    excludeFromScore: true  // Extra-biblical tradition test
  }
];

const SabbathTesterView = {
  _isRendering: false,
  _hasRendered: false, // Track if we've completed rendering
  _testCache: {}, // Cache for test results: { 'testId-profileId': result }
  _cacheVersion: '2.9', // Increment to invalidate cache if test logic changes (v2.9: Julian calendar for ancient dates)
  
  render(state, derived, container) {
    if (this._isRendering) return; // Prevent re-render loops
    
    // Skip re-render if we've already rendered and content is still there
    // The Sabbath Tester generates its own historical calendars and doesn't
    // depend on app state (location, current date, etc.)
    if (this._hasRendered && container.querySelector('.sabbath-tester-view')) {
      return;
    }
    
    container.innerHTML = `
      <div class="sabbath-tester-view">
        <div class="sabbath-tester-header">
          <h2>🔬 Sabbath Theory Tester</h2>
        </div>
        <div class="sabbath-tester-content">
          <div class="sabbath-tester-intro">
            <p>This tool tests various <strong>lunar calendar theories</strong> against historical biblical events where specific weekdays are mentioned in Scripture.</p>
            <p>All tests assume a <strong>fixed Saturday Sabbath</strong> and <strong>Jerusalem location</strong>. The goal is to determine which combination of moon phase (Full, Dark, or Crescent) and day-start time (Daybreak or Sunset) produces dates that align with the biblical record.</p>
            <div class="sabbath-tester-legend">
              <div><span>⚖️</span> <strong>Scale</strong> — New Moon on or after Spring Equinox</div>
              <div><span>🐑</span> <strong>Lamb</strong> — Day 15 (Unleavened) on or after Spring Equinox</div>
            </div>
          </div>
          <div id="sabbath-tester-loading" class="sabbath-test-loading">
            Loading tests...
          </div>
          <div id="sabbath-tester-results"></div>
        </div>
      </div>
    `;
    
    // Start rendering tests
    this._isRendering = true;
    setTimeout(() => {
      this.renderTests(container);
    }, 50);
  },
  
  /**
   * Generate test profiles dynamically
   */
  getSabbathTestProfiles() {
    const profiles = [];
    
    // Moon phases to test
    const moonPhases = [
      { id: 'full', name: 'Full Moon', icon: '🌕' },
      { id: 'dark', name: 'Dark Moon', icon: '🌑' },
      { id: 'crescent', name: 'Crescent Moon', icon: '🌒' }
    ];
    
    // Day start times to test
    const dayStarts = [
      { id: 'morning', name: 'Daybreak', angle: 12 },
      { id: 'evening', name: 'Sunset', angle: 0 }
    ];
    
    // Year start rules to test
    const yearRules = [
      { id: 'equinox', name: 'Sun Scale', icon: '⚖️' },
      { id: '13daysBefore', name: 'Lamb', icon: '🐑' }
    ];
    
    for (const moon of moonPhases) {
      for (const dayStart of dayStarts) {
        for (const yearRule of yearRules) {
          const profile = {
            id: `test-${moon.id}-${dayStart.id}-${yearRule.id}`,
            name: `${moon.icon} ${moon.name} ${dayStart.name} ${yearRule.icon}`,
            moonPhase: moon.id,
            dayStartTime: dayStart.id,
            dayStartAngle: dayStart.angle,
            yearStartRule: yearRule.id,
            crescentThreshold: 18,
            sabbathMode: 'saturday',
            lat: 31.7683,  // Jerusalem
            lon: 35.2137
          };
          
          // Check if this matches a preset
          const presetName = this.getMatchingPresetName(profile);
          if (presetName) {
            profile.presetName = presetName;
            profile.name += ` (${presetName})`;
          }
          
          profiles.push(profile);
        }
      }
    }
    
    // Sort profiles: presets first, then alphabetically
    profiles.sort((a, b) => {
      if (a.presetName && !b.presetName) return -1;
      if (!a.presetName && b.presetName) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return profiles;
  },
  
  /**
   * Get abbreviated profile name for mobile display
   * @param {string} fullName - The full profile name
   * @returns {string} Shortened name suitable for narrow screens
   */
  getShortProfileName(fullName) {
    return fullName
      .replace('Full Moon', 'Full')
      .replace('Dark Moon', 'Dark')
      .replace('Crescent Moon', 'Cres')
      .replace('Daybreak', 'AM')
      .replace('Sunset', 'PM')
      .replace(' (Time-Tested)', '')
      .replace(' (Traditional Lunar)', '')
      .replace(' (Ancient Traditional)', '');
  },
  
  /**
   * Get abbreviated weekday name
   * @param {string} weekdayName - Full weekday name
   * @returns {string} 3-letter abbreviation
   */
  getShortWeekday(weekdayName) {
    if (!weekdayName) return 'N/A';
    return weekdayName.substring(0, 3);
  },
  
  /**
   * Check if a test profile matches a preset profile
   */
  getMatchingPresetName(profile) {
    if (!window.PRESET_PROFILES) return null;
    
    for (const [presetId, preset] of Object.entries(window.PRESET_PROFILES)) {
      // Must match sabbath mode (only show presets that are Saturday sabbath for the tester)
      if (preset.sabbathMode !== 'saturday') continue;
      
      if (profile.moonPhase === preset.moonPhase &&
          profile.dayStartTime === preset.dayStartTime &&
          profile.yearStartRule === preset.yearStartRule &&
          (profile.moonPhase !== 'crescent' || profile.crescentThreshold === (preset.crescentThreshold || 18))) {
        return preset.name;
      }
    }
    return null;
  },
  
  /**
   * Get cache key for a test/profile combination
   */
  getCacheKey(testId, profileId) {
    return `${testId}-${profileId}`;
  },
  
  /**
   * Get cached test result if available
   */
  getCachedResult(testId, profileId) {
    const cacheKey = this.getCacheKey(testId, profileId);
    const cached = this._testCache[cacheKey];
    
    // Check if cache exists and is valid
    if (cached && cached.version === this._cacheVersion) {
      return cached.result;
    }
    
    return null;
  },
  
  /**
   * Cache a test result
   */
  cacheResult(testId, profileId, result) {
    const cacheKey = this.getCacheKey(testId, profileId);
    this._testCache[cacheKey] = {
      version: this._cacheVersion,
      result: result,
      timestamp: Date.now()
    };
    
    // Also save to localStorage for persistence across sessions
    try {
      const cacheData = {
        version: this._cacheVersion,
        timestamp: Date.now(),
        results: this._testCache
      };
      localStorage.setItem('sabbathTesterCache', JSON.stringify(cacheData));
    } catch (e) {
      // localStorage might be full or unavailable, ignore
      console.warn('Failed to save test cache to localStorage:', e);
    }
  },
  
  /**
   * Load cache from localStorage on initialization
   */
  loadCache() {
    try {
      const cached = localStorage.getItem('sabbathTesterCache');
      if (cached) {
        const cacheData = JSON.parse(cached);
        // Only use cache if version matches
        if (cacheData.version === this._cacheVersion) {
          this._testCache = cacheData.results || {};
          console.log(`[SabbathTester] Loaded ${Object.keys(this._testCache).length} cached test results`);
          return true;
        } else {
          // Version mismatch - clear old cache
          localStorage.removeItem('sabbathTesterCache');
          this._testCache = {};
        }
      }
    } catch (e) {
      console.warn('Failed to load test cache from localStorage:', e);
      this._testCache = {};
    }
    return false;
  },
  
  /**
   * Clear all cached results (useful for debugging or if test logic changes)
   */
  clearCache() {
    this._testCache = {};
    try {
      localStorage.removeItem('sabbathTesterCache');
    } catch (e) {
      // Ignore
    }
  },
  
  /**
   * Run a single biblical test against a profile using LunarCalendarEngine
   */
  runBiblicalTest(test, profile) {
    // Check cache first
    const cached = this.getCachedResult(test.id, profile.id);
    if (cached !== null) {
      return cached;
    }
    
    try {
      // Get astronomy engine
      if (typeof getAstroEngine !== 'function') {
        return { result: 'error', error: 'Astronomy engine not available' };
      }
      
      const astroEngine = getAstroEngine();
      if (!astroEngine) {
        return { result: 'error', error: 'Astronomy engine not initialized' };
      }
      
      // Create LunarCalendarEngine instance
      const engine = new LunarCalendarEngine(astroEngine);
      engine.configure({
        moonPhase: profile.moonPhase,
        dayStartTime: profile.dayStartTime === 'morning' ? 'morning' : 'evening',
        dayStartAngle: profile.dayStartAngle,
        yearStartRule: profile.yearStartRule,
        crescentThreshold: profile.crescentThreshold
      });
      
      // Generate calendar for test year
      const calendar = engine.generateYear(test.year, test.location, { includeUncertainty: true });
      
      // Get day info
      const dayInfo = engine.getDayInfo(calendar, test.month, test.day);
      if (!dayInfo) {
        return { result: 'error', error: 'Day not found in calendar' };
      }
      
      const calculatedWeekday = dayInfo.weekday;
      const calculatedWeekdayName = dayInfo.weekdayName;
      const gregorianDate = dayInfo.gregorianDate;
      const jd = dayInfo.jd; // Julian Day Number for debugging
      
      // Get uncertainty information
      const monthData = dayInfo.monthData;
      const uncertainty = monthData?.uncertainty || null;
      const yearUncertainty = calendar.yearStartUncertainty || null;
      
      // Determine result
      let result, probability = null;
      
      if (calculatedWeekday === test.expectedWeekday) {
        // Calculated matches expected
        if (uncertainty && uncertainty.probability > 0) {
          // Pass but with uncertainty
          result = 'uncertain';
          probability = 100 - uncertainty.probability; // Probability we're correct
        } else {
          result = 'pass';
        }
      } else {
        // Calculated doesn't match expected
        // Check if uncertainty could explain the mismatch
        if (uncertainty && uncertainty.probability > 0) {
          // Check if alternative date would match
          let alternativeWeekday = null;
          if (uncertainty.direction === '-') {
            // Dates could be 1 day earlier
            alternativeWeekday = (calculatedWeekday + 6) % 7;
          } else if (uncertainty.direction === '+') {
            // Dates could be 1 day later
            alternativeWeekday = (calculatedWeekday + 1) % 7;
          }
          
          if (alternativeWeekday === test.expectedWeekday) {
            // Alternative date would match
            result = 'uncertain';
            probability = uncertainty.probability; // Probability the alternative is correct
          } else {
            result = 'fail';
          }
        } else {
          result = 'fail';
        }
      }
      
      const testResult = {
        result,
        calculatedWeekday,
        calculatedWeekdayName,
        gregorianDate,
        jd, // Julian Day Number for debugging
        uncertaintyHours: uncertainty ? (uncertainty.marginHours || 0) : 0,
        marginHours: uncertainty ? (uncertainty.marginHours || Infinity) : Infinity,
        probability,
        dateUncertaintyProbability: uncertainty ? uncertainty.probability : 0,
        dateUncertaintyDirection: uncertainty ? uncertainty.direction : null,
        moonEventDate: monthData?.moonEvent || null,
        yearUncertainty
      };
      
      // Cache the result
      this.cacheResult(test.id, profile.id, testResult);
      
      return testResult;
    } catch (e) {
      console.error('Error running biblical test:', e);
      const errorResult = { result: 'error', error: e.message };
      // Cache error results too (so we don't retry failed tests)
      this.cacheResult(test.id, profile.id, errorResult);
      return errorResult;
    }
  },
  
  /**
   * Render all tests and results
   */
  renderTests(container) {
    const loadingEl = container.querySelector('#sabbath-tester-loading');
    const resultsEl = container.querySelector('#sabbath-tester-results');
    
    if (!loadingEl || !resultsEl) {
      // User navigated away before render completed - reset flags
      this._isRendering = false;
      return;
    }
    
    // Load cache from localStorage on first render
    if (Object.keys(this._testCache).length === 0) {
      this.loadCache();
    }
    
    loadingEl.style.display = 'block';
    resultsEl.innerHTML = '';
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const profiles = this.getSabbathTestProfiles();
      const allResults = [];
      
      // Count cache hits for reporting
      let cacheHits = 0;
      let cacheMisses = 0;
      
      // Run all tests against all profiles
      for (const test of BIBLICAL_TESTS) {
        const testResults = [];
        for (const profile of profiles) {
          // Check cache first
          const cached = this.getCachedResult(test.id, profile.id);
          let result;
          
          if (cached !== null) {
            cacheHits++;
            result = cached;
          } else {
            cacheMisses++;
            result = this.runBiblicalTest(test, profile);
          }
          
          testResults.push({
            profile,
            ...result
          });
        }
        allResults.push({
          test,
          results: testResults
        });
      }
      
      // Log cache statistics
      if (cacheHits > 0 || cacheMisses > 0) {
        console.log(`[SabbathTester] Cache: ${cacheHits} hits, ${cacheMisses} misses (${Math.round(cacheHits / (cacheHits + cacheMisses) * 100)}% hit rate)`);
      }
      
      // Calculate scoreboard
      const scoreboard = {};
      const baseScoreWithout32AD = {};
      const testResultsByProfile = {};
      
      for (const profile of profiles) {
        scoreboard[profile.id] = {
          profile,
          passed: 0,
          failed: 0,
          uncertain: 0,
          totalScore: 0
        };
        baseScoreWithout32AD[profile.id] = {
          totalScore: 0,
          testResults: []
        };
        testResultsByProfile[profile.id] = [];
      }
      
      for (const { test, results } of allResults) {
        for (const r of results) {
          const score = scoreboard[r.profile.id];
          const baseScore = baseScoreWithout32AD[r.profile.id];
          const countsForScore = !test.excludeFromScore;
          const countsForBaseScore = !test.excludeFromScore && test.id !== 'resurrection-32ad';
          
          if (countsForScore) {
            testResultsByProfile[r.profile.id].push({
              testName: test.name,
              testId: test.id,
              result: r.result,
              probability: r.probability
            });
          }
          
          if (r.result === 'pass') {
            if (countsForScore) {
              score.passed++;
              score.totalScore += 1;
            }
            if (countsForBaseScore) {
              baseScore.totalScore += 1;
              baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'pass' });
            }
          } else if (r.result === 'uncertain') {
            if (countsForScore) {
              score.uncertain++;
              score.totalScore += (r.probability || 50) / 100;
            }
            if (countsForBaseScore) {
              baseScore.totalScore += (r.probability || 50) / 100;
              baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'uncertain', probability: r.probability });
            }
          } else if (r.result === 'fail') {
            if (countsForScore) {
              score.failed++;
            }
            if (countsForBaseScore) {
              baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'fail' });
            }
          }
        }
      }
      
      // Sort scoreboard
      const sortedScores = Object.values(scoreboard).sort((a, b) => {
        if (b.passed !== a.passed) return b.passed - a.passed;
        if (a.failed !== b.failed) return a.failed - b.failed;
        return b.totalScore - a.totalScore;
      });
      
      // Build HTML
      let html = this.buildScoreboardHTML(sortedScores, testResultsByProfile, BIBLICAL_TESTS);
      html += this.buildTestCardsHTML(allResults, baseScoreWithout32AD, BIBLICAL_TESTS);
      
      loadingEl.style.display = 'none';
      resultsEl.innerHTML = html;
      
      this._isRendering = false;
      this._hasRendered = true;
    }, 50);
  },
  
  /**
   * Build scoreboard HTML
   */
  buildScoreboardHTML(sortedScores, testResultsByProfile, tests) {
    const numTests = tests.filter(t => !t.excludeFromScore).length;
    
    let html = `
      <div class="sabbath-scoreboard">
        <div class="sabbath-scoreboard-title">📊 Summary Scoreboard</div>
        <div class="sabbath-scoreboard-intro">
          <p>This scoreboard tests each calendar configuration against biblical events where both the lunar date and weekday can be determined from Scripture. Tests include the first Sabbath of Manna (Exodus 16), the First Fruits offering after crossing the Jordan (Joshua 5), and the Resurrection on First Fruits (Matthew 28).</p>
          <div class="scoreboard-conclusion">
            <p><strong>Key Finding:</strong> The <span class="result-pass">Lunar Sabbath</span> is compatible with all scored tests. It is also compatible with Rabbinic tradition that both Temples fell "the day after the Sabbath" (Talmud Ta'anit 29a) and Josephus' record that Romans built siege ramps on the Sabbath when the 8th of Av fell on that day.</p>
            <p>For <span class="result-uncertain">Saturday Sabbath</span> to be compatible, only one specific configuration works: <strong>33 AD crucifixion, Full Moon month start, Sunset day start, and Lamb (early) year start</strong>. This requires assuming 33 AD despite the chronological cautions noted below, and abandons the crescent moon tradition while adopting the full moon start.</p>
          </div>
        </div>
        <table class="sabbath-scoreboard-table">
          <thead>
            <tr>
              <th>Calendar Profile</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    for (const score of sortedScores) {
      const pct = Math.round((score.totalScore / numTests) * 100);
      let scoreClass = 'score-poor';
      if (pct >= 90) scoreClass = 'score-perfect';
      else if (pct >= 70) scoreClass = 'score-good';
      else if (pct >= 50) scoreClass = 'score-medium';
      
      const profileTests = testResultsByProfile[score.profile.id] || [];
      const passedTests = profileTests.filter(t => t.result === 'pass');
      const failedTests = profileTests.filter(t => t.result === 'fail');
      const uncertainTests = profileTests.filter(t => t.result === 'uncertain');
      
      const formatName = (t) => {
        if (t.testId === 'resurrection-32ad') return 'Resurrection 32 AD';
        return t.testName.replace(/ \([^)]+\)$/, '');
      };
      
      let testBreakdown = '<div class="score-breakdown">';
      if (passedTests.length > 0) {
        testBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-pass">✅ Passed:</span> ${passedTests.map(formatName).join(', ')}</div>`;
      }
      if (uncertainTests.length > 0) {
        testBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-uncertain">⚠️ Uncertain:</span> ${uncertainTests.map(t => `${formatName(t)} (${t.probability}%)`).join(', ')}</div>`;
      }
      if (failedTests.length > 0) {
        testBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-fail">❌ Failed:</span> ${failedTests.map(formatName).join(', ')}</div>`;
      }
      testBreakdown += '</div>';
      
      const rowId = `scoreboard-row-${score.profile.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      html += `
        <tr class="scoreboard-expandable" onclick="SabbathTesterView.toggleScoreboardRow('${rowId}')">
          <td><span class="expand-arrow">▶</span> ${score.profile.name}</td>
          <td class="${scoreClass}">${pct}%</td>
        </tr>
        <tr class="scoreboard-details" id="${rowId}" style="display: none;">
          <td colspan="2">${testBreakdown}</td>
        </tr>
      `;
    }
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  },
  
  /**
   * Build test cards HTML
   */
  buildTestCardsHTML(allResults, baseScoreWithout32AD, tests) {
    let html = '';
    const numTests = tests.filter(t => !t.excludeFromScore).length;
    
    for (const { test, results } of allResults) {
      const yearDisplay = test.year < 0 ? `${Math.abs(test.year) + 1} BC` : `${test.year} AD`;
      const excludedNote = test.excludeFromScore ? ' <span style="font-size: 0.8em; color: #888;">(not scored)</span>' : '';
      
      html += `
        <div class="sabbath-test-card">
          <div class="sabbath-test-title">
            <span>📜 ${test.name}${excludedNote}</span>
          </div>
          <div class="sabbath-test-date">
            ${test.day}${this.getDaySuffix(test.day)} of Month ${test.month}, ${yearDisplay}
          </div>
          <div class="sabbath-test-scripture">${test.scripture}</div>
          <div class="sabbath-test-description">${test.description}</div>
          ${this.buildTestEvidenceHTML(test)}
          <div class="sabbath-test-expected">
            <strong>Expected:</strong> ${test.expectedLabel} (${test.expectedLabel === 'Saturday' ? 'Sabbath' : 'First Day of Week'})
          </div>
          ${this.buildTestResultsTableHTML(test, results, baseScoreWithout32AD, numTests)}
        </div>
      `;
    }
    
    return html;
  },
  
  /**
   * Build evidence accordion HTML for specific tests
   */
  buildTestEvidenceHTML(test) {
    if (test.id === 'resurrection-32ad') {
      return `
        <details class="test-evidence-accordion">
          <summary>📖 Why 32 AD? See the Evidence</summary>
          <div class="test-evidence-content">
            <p>Multiple independent chronological anchors converge on 32 AD:</p>
            <ul>
              <li><strong>Tiberius' 15th Year (Fall 28-29 AD)</strong> — John the Baptist began his ministry in the 15th year of Tiberius (Luke 3:1-2). Standard Roman historiography dates this to fall 28 – fall 29 AD.</li>
              <li><strong>Year of Release (Fall 29 AD)</strong> — Jesus proclaimed "the year of the Lord's favor" in Nazareth (Luke 4:18-19). This sabbatical year proclamation aligns with Day of Atonement 29 AD, based on the 7-year cycle from the Jordan crossing in 1406 BC.</li>
              <li><strong>46 Years Building the Temple (30 AD)</strong> — At the first Passover in John's Gospel, the Jews said the temple had been under construction 46 years (John 2:20). Herod began rebuilding ~17-16 BC, placing this first Passover in spring 30 AD.</li>
              <li><strong>Three Passovers in John</strong> — John explicitly mentions three Passovers: 30 AD (John 2:13), 31 AD (John 6:4), and the final Passover 32 AD (John 11:55).</li>
              <li><strong>Daniel's 490-Year Prophecy (32 AD)</strong> — The decree to restore Jerusalem was issued in Artaxerxes' 7th year, spring 458 BC (Ezra 7:7-9). The 490th year lands on spring 32 AD (Daniel 9:24-25).</li>
              <li><strong>Passover Solar Eclipse (April 28, 32 AD)</strong> — NASA documents a partial solar eclipse visible in Jerusalem at midday on Passover 32 AD, matching the darkness recorded in Matthew 27:45.</li>
            </ul>
            <p>These independent lines of evidence—Tiberius' reign, the sabbatical cycle, temple construction, John's Passovers, Daniel's prophecy, and astronomical data—all align naturally on 32 AD without requiring ad hoc adjustments.</p>
            <p style="margin-top: 15px;"><a href="/reader/timetested/12_32_AD_Resurrection" style="color: #7ec8e3;">📖 Read the full chapter: 32 AD Resurrection</a></p>
          </div>
        </details>
      `;
    }
    
    if (test.id === 'resurrection-33ad') {
      return `
        <details class="test-evidence-accordion">
          <summary>⚠️ Cautions with 33 AD</summary>
          <div class="test-evidence-content">
            <p>While 33 AD is a popular alternative, it requires assumptions that conflict with other evidence:</p>
            <ul>
              <li><strong>Exceeds Daniel's 490 Years</strong> — The decree to restore Jerusalem was issued in Artaxerxes' 7th year, spring 458 BC (Ezra 7:7-9). The 490th year ends spring 32 AD (Daniel 9:24-25). A 33 AD crucifixion falls in the 491st year, requiring non-literal or non-inclusive counting of Daniel's prophecy.</li>
              <li><strong>Requires Undocumented 4th Passover</strong> — John explicitly mentions only three Passovers during Jesus' ministry (John 2:13, 6:4, 11:55). For 33 AD to work with John's ministry starting fall 28-29 AD (Tiberius' 15th year), a fourth unrecorded Passover must be assumed, extending to a 4-year ministry.</li>
              <li><strong>No Passover Solar Eclipse</strong> — NASA documents a partial solar eclipse visible in Jerusalem at midday on April 28, 32 AD, matching the darkness at the cross (Matthew 27:45). There is no similar eclipse alignment for Passover 33 AD. Phlegon's record placing it in the "4th year of the 202nd Olympiad" (July 32 – July 33 AD) is approximate and written 105+ years after the event.</li>
            </ul>
            <p>These issues don't necessarily disprove 33 AD, but they require ad hoc adjustments that are unnecessary with a 32 AD crucifixion date.</p>
            <p style="margin-top: 15px;"><a href="/reader/timetested/12_32_AD_Resurrection" style="color: #7ec8e3;">📖 Read the full chapter: 32 AD Resurrection</a></p>
          </div>
        </details>
        <div class="test-interpretation">
          <p><strong>Interpreting the Results Below:</strong></p>
          <ul>
            <li><strong>Traditional April 3rd Friday</strong> — The popular "April 3, 33 AD" Friday crucifixion date relies on the crescent moon calendar with the Lamb (Passover after equinox) year start rule. However, this assumes the crescent sighting was delayed by one day when astronomical calculations show it would have been clearly visible the evening before.</li>
            <li><strong>Other Passing Calendars Break Tradition</strong> — Any other calendar configuration that places the 16th on Sunday in 33 AD requires abandoning traditional assumptions: either using equinox-based year start instead of the Lamb rule, adopting full moon month starts instead of crescent, or starting the day at daybreak instead of sunset. Each of these deviates from the rabbinic traditions typically assumed by 33 AD proponents.</li>
            <li><strong>Most Fail Other Biblical Tests</strong> — Expand the "Alt Score" column to see how each configuration performs on the other biblical tests. All but one configuration that passes 33 AD will fail the Manna Sabbath, Jordan Crossing, or 32 AD Resurrection tests. The only Saturday Sabbath configuration achieving 100% is Full Moon + Sunset + Lamb—which still requires accepting the chronological cautions above.</li>
          </ul>
        </div>
      `;
    }
    
    return '';
  },
  
  /**
   * Build test results table HTML
   */
  buildTestResultsTableHTML(test, results, baseScoreWithout32AD, numTests) {
    // Group results by base profile (moon phase + day start, without year rule)
    const groupedResults = {};
    for (const r of results) {
      const baseKey = `${r.profile.moonPhase}-${r.profile.dayStartTime}`;
      if (!groupedResults[baseKey]) {
        groupedResults[baseKey] = { equinox: null, lamb: null };
      }
      if (r.profile.yearStartRule === 'equinox') {
        groupedResults[baseKey].equinox = r;
      } else {
        groupedResults[baseKey].lamb = r;
      }
    }
    
    // Build merged results array
    const mergedResults = [];
    for (const [baseKey, group] of Object.entries(groupedResults)) {
      const eq = group.equinox;
      const lamb = group.lamb;
      
      if (eq && lamb && eq.calculatedWeekday === lamb.calculatedWeekday && eq.result === lamb.result) {
        const moonIcon = eq.profile.moonPhase === 'full' ? '🌕' : eq.profile.moonPhase === 'dark' ? '🌑' : '🌒';
        const moonName = eq.profile.moonPhase === 'full' ? 'Full Moon' : eq.profile.moonPhase === 'dark' ? 'Dark Moon' : 'Crescent Moon';
        const dayStartName = eq.profile.dayStartTime === 'morning' ? 'Daybreak' : 'Sunset';
        const presetName = eq.profile.presetName || lamb.profile.presetName;
        const presetSuffix = presetName ? ` (${presetName})` : '';
        mergedResults.push({
          ...eq,
          mergedName: `${moonIcon} ${moonName} ${dayStartName} ⚖️🐑${presetSuffix}`,
          isMerged: true,
          profileIdForNav: eq.profile.id
        });
      } else {
        if (eq) mergedResults.push({ ...eq, mergedName: eq.profile.name, isMerged: false, profileIdForNav: eq.profile.id });
        if (lamb) mergedResults.push({ ...lamb, mergedName: lamb.profile.name, isMerged: false, profileIdForNav: lamb.profile.id });
      }
    }
    
    // Sort results: pass first, then uncertain, then fail
    const sortedResults = mergedResults.sort((a, b) => {
      const order = { pass: 0, uncertain: 1, fail: 2, error: 3 };
      return (order[a.result] || 3) - (order[b.result] || 3);
    });
    
    let html = `
      <table class="sabbath-test-results-table">
        <thead>
          <tr>
            <th>Profile</th>
            <th class="date-cell-full">${test.year < 1582 ? 'Julian Date' : 'Gregorian Date'}</th>
            <th class="date-cell-compact">Date</th>
            <th>Day</th>
            <th>JD</th>
            <th>Result</th>
            ${(test.id === 'resurrection-30ad' || test.id === 'resurrection-33ad') ? '<th title="Score if this year replaces 32 AD as the resurrection test">Alt</th>' : ''}
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const r of sortedResults) {
      let resultText, resultClass;
      if (r.result === 'pass') {
        resultText = '✅ Pass';
        resultClass = 'result-pass';
      } else if (r.result === 'uncertain') {
        resultText = `⚠️ ${r.probability}%`;
        resultClass = 'result-uncertain';
      } else if (r.result === 'fail') {
        resultText = '❌ Fail';
        resultClass = 'result-fail';
      } else {
        resultText = '⚠️ Error';
        resultClass = 'result-uncertain';
      }
      
      const dateStr = r.gregorianDate ? this.formatAncientDate(r.gregorianDate, false) : 'N/A';
      const dateStrShort = r.gregorianDate ? this.formatAncientDate(r.gregorianDate, false, true) : 'N/A';
      const weekdayStr = r.calculatedWeekdayName || 'N/A';
      const weekdayStrShort = this.getShortWeekday(r.calculatedWeekdayName);
      const profileNameShort = this.getShortProfileName(r.mergedName);
      
      let yearUncertaintyIcon = '';
      if (r.yearUncertainty && r.yearUncertainty.probability > 0) {
        const tooltipText = `Year uncertainty: ${r.yearUncertainty.probability}% chance all dates are 1 month ${r.yearUncertainty.direction} (ΔT uncertainty ±${Math.round(r.uncertaintyHours)} hours, Nisan margin: ${r.yearUncertainty.marginHours.toFixed(1)} hours)`;
        yearUncertaintyIcon = ` <span class="year-uncertainty-icon" title="${tooltipText}">⚠️${r.yearUncertainty.probability}%</span>`;
      }
      
      const jdTooltip = r.jd != null ? `JD: ${r.jd.toFixed(2)}` : '';
      const dateLink = r.gregorianDate ? 
        `<a class="sabbath-test-date-link" title="${jdTooltip}" onclick="SabbathTesterView.navigateToTestResult('${test.id}', '${r.profileIdForNav}')">${dateStr}</a>${yearUncertaintyIcon}` :
        dateStr;
      
      // Calculate alternative score for 30 AD and 33 AD tests
      let altScoreCell = '';
      if (test.id === 'resurrection-30ad' || test.id === 'resurrection-33ad') {
        const baseScoreData = baseScoreWithout32AD[r.profile.id];
        const baseScore = baseScoreData?.totalScore || 0;
        const baseTestResults = baseScoreData?.testResults || [];
        
        let thisTestScore = 0;
        if (r.result === 'pass') thisTestScore = 1;
        else if (r.result === 'uncertain') thisTestScore = (r.probability || 50) / 100;
        
        const altTotalScore = baseScore + thisTestScore;
        const altPct = Math.round((altTotalScore / numTests) * 100);
        
        let altScoreClass = 'score-poor';
        if (altPct >= 90) altScoreClass = 'score-perfect';
        else if (altPct >= 70) altScoreClass = 'score-good';
        else if (altPct >= 50) altScoreClass = 'score-medium';
        
        const passedTests = baseTestResults.filter(t => t.result === 'pass');
        const failedTests = baseTestResults.filter(t => t.result === 'fail');
        const uncertainTests = baseTestResults.filter(t => t.result === 'uncertain');
        
        const formatTestName = (t) => {
          if (t.testId === 'resurrection-32ad') return 'Resurrection 32 AD';
          return t.testName.replace(/ \([^)]+\)$/, '').replace('First Sabbath of ', '').replace('First Fruits After ', '');
        };
        
        let altBreakdown = '';
        if (passedTests.length > 0) {
          altBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-pass">✅</span> ${passedTests.map(formatTestName).join(', ')}</div>`;
        }
        if (uncertainTests.length > 0) {
          altBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-uncertain">⚠️</span> ${uncertainTests.map(t => `${formatTestName(t)} (${t.probability}%)`).join(', ')}</div>`;
        }
        if (failedTests.length > 0) {
          altBreakdown += `<div class="breakdown-section"><span class="breakdown-label result-fail">❌</span> ${failedTests.map(formatTestName).join(', ')}</div>`;
        }
        
        altScoreCell = `<td data-label="Alt Score" class="${altScoreClass}">
          <details class="alt-score-details">
            <summary>${altPct}%</summary>
            <div class="alt-score-breakdown">${altBreakdown}</div>
          </details>
        </td>`;
      }
      
      // Build compact date link for mobile
      const dateStrCompact = r.gregorianDate ? this.formatAncientDate(r.gregorianDate, false, true) : 'N/A';
      const dateLinkCompact = r.gregorianDate ? 
        `<a class="sabbath-test-date-link" title="${jdTooltip}" onclick="SabbathTesterView.navigateToTestResult('${test.id}', '${r.profileIdForNav}')">${dateStrCompact}</a>${yearUncertaintyIcon}` :
        dateStrCompact;
      
      const jdStr = r.jd != null ? Math.floor(r.jd).toString() : 'N/A';
      
      html += `
        <tr>
          <td data-label="Profile" class="profile-cell">${profileNameShort}</td>
          <td data-label="Date" class="date-cell-full">${dateLink}</td>
          <td data-label="Date" class="date-cell-compact">${dateLinkCompact}</td>
          <td data-label="Day" class="weekday-cell">${weekdayStrShort}</td>
          <td data-label="JD" class="jd-cell" style="font-size:0.8em;color:#888">${jdStr}</td>
          <td data-label="Result" class="${resultClass}">${resultText}</td>
          ${altScoreCell}
        </tr>
      `;
    }
    
    html += `
        </tbody>
      </table>
    `;
    
    return html;
  },
  
  /**
   * Navigate to a specific date on a test profile
   */
  navigateToTestResult(testId, profileId) {
    const test = BIBLICAL_TESTS.find(t => t.id === testId);
    const profiles = this.getSabbathTestProfiles();
    const profile = profiles.find(p => p.id === profileId);
    
    if (!test || !profile) {
      console.error('Test or profile not found:', testId, profileId);
      return;
    }
    
    // Create a temporary profile with the test settings
    // Store it in window.PROFILES so it can be used by the calendar
    const tempProfileId = 'sabbath-test-temp';
    if (!window.PROFILES) {
      window.PROFILES = {};
    }
    
    const moonLabel = profile.moonPhase === 'full' ? 'Full' : profile.moonPhase === 'dark' ? 'Dark' : 'Crescent';
    const moonIcon = profile.moonPhase === 'full' ? '🌕' : profile.moonPhase === 'dark' ? '🌑' : '🌒';
    const dayLabel = profile.dayStartTime === 'morning' ? 'Daybreak' : 'Sunset';
    const yearIcon = profile.yearStartRule === 'equinox' ? '⚖️' : '🐑';
    const presetSuffix = profile.presetName ? ` (${profile.presetName})` : '';

    window.PROFILES[tempProfileId] = {
      name: `${moonLabel} ${dayLabel} ${yearIcon}${presetSuffix}`,
      icon: moonIcon,
      moonPhase: profile.moonPhase,
      dayStartTime: profile.dayStartTime,
      dayStartAngle: profile.dayStartAngle,
      yearStartRule: profile.yearStartRule,
      crescentThreshold: profile.crescentThreshold,
      sabbathMode: profile.sabbathMode,
      lat: test.location.lat,
      lon: test.location.lon
    };
    
    // Use AppStore to navigate to calendar with the test profile and date
    AppStore.dispatch({
      type: 'SET_PROFILE',
      profileId: tempProfileId
    });
    
    AppStore.dispatch({
      type: 'SET_LOCATION',
      lat: test.location.lat,
      lon: test.location.lon
    });
    
    AppStore.dispatch({
      type: 'SET_LUNAR_DATETIME',
      year: test.year,
      month: test.month,
      day: test.day
    });
    
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'calendar'
    });
    
    // Keep the temp profile alive — deleting it caused subsequent interactions
    // (clicking days, re-renders) to fall back to the default profile since
    // state.context.profileId still references 'sabbath-test-temp'.
    // The profile is tiny and harmless to keep in memory.
  },
  
  /**
   * Toggle scoreboard row expansion
   */
  toggleScoreboardRow(rowId) {
    const detailsRow = document.getElementById(rowId);
    const mainRow = detailsRow?.previousElementSibling;
    
    if (detailsRow && mainRow) {
      const isExpanded = detailsRow.style.display !== 'none';
      detailsRow.style.display = isExpanded ? 'none' : 'table-row';
      mainRow.classList.toggle('expanded', !isExpanded);
      const arrow = mainRow.querySelector('.expand-arrow');
      if (arrow) {
        arrow.textContent = isExpanded ? '▶' : '▼';
      }
    }
  },
  
  /**
   * Format a Gregorian/Julian date for display
   * Uses JDN-based weekday calculation for accuracy with ancient dates
   * Uses the same formula as LunarCalendarEngine for consistency
   * @param {Date|string} date - The date to format
   * @param {boolean} includeWeekday - Whether to include weekday (not used, kept for API compat)
   * @param {boolean} compact - Whether to use compact format for mobile
   */
  formatAncientDate(date, includeWeekday = true, compact = false) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Ensure date is a Date object (cached results may have serialized it to string)
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-indexed
    const day = date.getUTCDate();
    const monthName = months[month];
    const yearStr = year < 0 ? `${Math.abs(year) + 1} BC` : `${year} AD`;
    
    // Compact format: just month and day (year shown elsewhere)
    if (compact) {
      return `${monthName} ${day}`;
    }
    
    return `${monthName} ${day}, ${yearStr}`;
  },
  
  /**
   * Get day suffix (1st, 2nd, 3rd, etc.)
   */
  getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
};

// Make available globally (browser only)
if (typeof window !== 'undefined') {
  window.SabbathTesterView = SabbathTesterView;
  window.BIBLICAL_TESTS = BIBLICAL_TESTS; // Expose for debugging
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SabbathTesterView, BIBLICAL_TESTS };
}
