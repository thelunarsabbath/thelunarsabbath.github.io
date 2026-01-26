// ============================================================================
// SABBATH TESTER - Test biblical events against calendar theories
// ============================================================================

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

// Generate test profiles dynamically (Saturday sabbath with Jerusalem location)
// Check if a test profile configuration matches a preset profile
function getMatchingPresetName(profile) {
  for (const [presetId, preset] of Object.entries(PRESET_PROFILES)) {
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
}

function getSabbathTestProfiles() {
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
    { id: 'equinox', name: 'Sun Scale', icon: '⚖️' },  // New Moon on or after Equinox
    { id: '13daysBefore', name: 'Lamb', icon: '🐑' }   // Day 15 (Unleavened) on or after Equinox
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
        const presetName = getMatchingPresetName(profile);
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
}

// Run a single biblical test against a profile
function runBiblicalTest(test, profile) {
  try {
    // Save current state
    const savedState = {
      moonPhase: state.moonPhase,
      dayStartTime: state.dayStartTime,
      dayStartAngle: state.dayStartAngle,
      yearStartRule: state.yearStartRule,
      crescentThreshold: state.crescentThreshold,
      sabbathMode: state.sabbathMode,
      lat: state.lat,
      lon: state.lon,
      year: state.year
    };
    
    // Apply profile settings temporarily
    state.moonPhase = profile.moonPhase;
    state.dayStartTime = profile.dayStartTime;
    state.dayStartAngle = profile.dayStartAngle;
    state.yearStartRule = profile.yearStartRule;
    state.crescentThreshold = profile.crescentThreshold;
    state.sabbathMode = profile.sabbathMode;
    state.lat = test.location.lat;
    state.lon = test.location.lon;
    state.year = test.year;
    
    const engine = getAstroEngine();
    
    // Find moon events for the test year
    const moonEvents = findMoonEvents(test.year, profile.moonPhase);
    if (!moonEvents || moonEvents.length === 0) {
      Object.assign(state, savedState);
      return { result: 'error', error: 'No moon events found' };
    }
    
    // Get the year start point based on yearStartRule
    // For 'equinox': first moon on or after spring equinox
    // For '13daysBefore': first moon such that Day 15 (Unleavened) is on or after equinox
    const springEquinox = engine.getSeasons(test.year).mar_equinox.date;
    let yearStartPoint;
    
    if (profile.yearStartRule === '13daysBefore') {
      // Day 15 (Unleavened Bread) must be on or after equinox (per Maimonides)
      // So the moon event must be at least 14 days before equinox
      yearStartPoint = new Date(springEquinox.getTime() - 14 * 24 * 60 * 60 * 1000);
    } else {
      // Default: moon on or after equinox
      yearStartPoint = springEquinox;
    }
    
    // Find the Nisan moon (first moon on or after year start point)
    // moonEvents is an array of Date objects directly
    let nissanMoonIdx = moonEvents.findIndex(e => e >= yearStartPoint);
    if (nissanMoonIdx === -1) {
      Object.assign(state, savedState);
      return { result: 'error', error: 'Could not find Nisan moon' };
    }
    
    // Calculate year-start uncertainty
    // If Nisan moon is close to year start point, ΔT could cause wrong moon selection
    const nissanMoon = moonEvents[nissanMoonIdx];
    const yearStartMarginMs = nissanMoon.getTime() - yearStartPoint.getTime();
    const yearStartMarginHours = yearStartMarginMs / (1000 * 60 * 60);
    const deltaTUncertaintyHours = AstroEngines.nasaEclipse.getDeltaTUncertainty(test.year);
    
    let yearUncertainty = null;
    if (deltaTUncertaintyHours > 0 && yearStartMarginHours <= deltaTUncertaintyHours) {
      // Nisan moon is close to boundary - year selection could be wrong
      const yearUncertaintyProb = Math.round(((deltaTUncertaintyHours - yearStartMarginHours) / (2 * deltaTUncertaintyHours)) * 100);
      if (yearUncertaintyProb > 0) {
        yearUncertainty = {
          direction: 'ahead',  // Our dates are potentially 1 month ahead
          probability: yearUncertaintyProb,
          marginHours: yearStartMarginHours
        };
      }
    }
    
    // Calculate which moon event corresponds to the test month
    const targetMoonIdx = nissanMoonIdx + (test.month - 1);
    if (targetMoonIdx >= moonEvents.length) {
      Object.assign(state, savedState);
      return { result: 'error', error: 'Month out of range' };
    }
    
    // findMoonEvents returns array of Date objects directly
    const moonEventDate = moonEvents[targetMoonIdx];
    
    // Calculate Day 1 of that month
    const dayStartTime = getDayStartTime(moonEventDate);
    const moonEventTs = moonEventDate.getTime();
    
    // Use the same logic as the calendar's buildLunarMonths function
    // Get local date of moon event adjusted for observer longitude
    const observerLon = test.location.lon;
    const moonEventLocalDate = getLocalDateFromUTC(moonEventDate, observerLon);
    
    let day1Date = new Date(moonEventLocalDate.getTime());
    
    // For all moon phases (dark, full, crescent), the moonEventDate already has any
    // necessary offset applied (crescent offset is added in findMoonEvents).
    // The calculation for Day 1 is the same regardless of phase.
    if (profile.dayStartTime === 'evening') {
      const sunsetOnMoonDate = getSunsetTimestamp(moonEventLocalDate);
      if (sunsetOnMoonDate != null) {
        const moonEventLocalTime = moonEventDate.getTime() + (observerLon / 15) * 60 * 60 * 1000;
        const sunsetLocalTime = sunsetOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
        if (moonEventLocalTime > sunsetLocalTime) {
          day1Date.setUTCDate(day1Date.getUTCDate() + 1);
        }
      }
    } else if (profile.dayStartTime === 'morning') {
      const sunriseOnMoonDate = getSunriseTimestamp(moonEventLocalDate);
      if (sunriseOnMoonDate != null) {
        const moonEventLocalTime = moonEventDate.getTime() + (observerLon / 15) * 60 * 60 * 1000;
        const sunriseLocalTime = sunriseOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
        if (moonEventLocalTime >= sunriseLocalTime) {
          day1Date.setUTCDate(day1Date.getUTCDate() + 1);
        }
      }
    } else {
      day1Date.setUTCDate(day1Date.getUTCDate() + 1);
    }
    
    // Calculate the target lunar day's Gregorian date
    const targetDayDate = new Date(day1Date);
    targetDayDate.setUTCDate(targetDayDate.getUTCDate() + (test.day - 1));
    
    // Get the weekday using correct Julian calendar calculation
    const calculatedWeekday = getCorrectWeekday(targetDayDate);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const calculatedWeekdayName = weekdayNames[calculatedWeekday];
    
    // Calculate actual margin between moon event and day boundary
    const uncertaintyHours = AstroEngines.nasaEclipse.getDeltaTUncertainty(test.year);
    let marginHours = Infinity;
    let dateUncertaintyProbability = 0;
    let dateUncertaintyDirection = null;
    
    if (uncertaintyHours > 0) {
      const moonEventLocalTime = moonEventDate.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      
      // Get the day boundary time based on day start setting
      let boundaryTime;
      if (profile.dayStartTime === 'evening') {
        boundaryTime = getSunsetTimestamp(moonEventLocalDate);
      } else {
        boundaryTime = getSunriseTimestamp(moonEventLocalDate);
      }
      
      if (boundaryTime != null) {
        const boundaryLocalTime = boundaryTime + (observerLon / 15) * 60 * 60 * 1000;
        const marginMs = Math.abs(moonEventLocalTime - boundaryLocalTime);
        marginHours = marginMs / (1000 * 60 * 60);
        
        if (marginHours <= uncertaintyHours) {
          // Calculate probability that the date is wrong
          // If margin is M and uncertainty is ±U, probability = (U - M) / (2U)
          dateUncertaintyProbability = Math.round(((uncertaintyHours - marginHours) / (2 * uncertaintyHours)) * 100);
          
          // Determine direction
          if (moonEventLocalTime >= boundaryLocalTime) {
            dateUncertaintyDirection = '-'; // Dates could be 1 day earlier
          } else {
            dateUncertaintyDirection = '+'; // Dates could be 1 day later
          }
        }
      }
    }
    
    // Determine result based on actual margin-based uncertainty
    // Check if there's significant uncertainty (margin within ΔT uncertainty)
    const hasUncertainty = marginHours <= uncertaintyHours && uncertaintyHours > 0;
    
    let result, probability = null;
    
    if (calculatedWeekday === test.expectedWeekday) {
      // Calculated matches expected
      if (hasUncertainty) {
        // Pass but with uncertainty - show as caution with % chance of passing
        result = 'uncertain';
        probability = 100 - dateUncertaintyProbability; // Probability we're correct (chance of passing)
      } else {
        result = 'pass';
        probability = null;
      }
    } else {
      // Calculated doesn't match expected
      // Check if the alternative date (shifted by uncertainty direction) would match
      let alternativeWeekday = null;
      if (dateUncertaintyDirection === '-') {
        // Dates could be 1 day earlier, so weekday would be previous day
        alternativeWeekday = (calculatedWeekday + 6) % 7;
      } else if (dateUncertaintyDirection === '+') {
        // Dates could be 1 day later, so weekday would be next day
        alternativeWeekday = (calculatedWeekday + 1) % 7;
      }
      
      if (hasUncertainty && alternativeWeekday === test.expectedWeekday) {
        // Alternative date would match - show as caution with % chance of passing
        result = 'uncertain';
        probability = dateUncertaintyProbability; // Probability the alternative is correct (chance of passing)
      } else {
        // Neither calculated nor alternative matches - definite fail
        result = 'fail';
      }
    }
    
    // Debug: log uncertainty details for ancient dates
    if (uncertaintyHours > 0 && profile === getSabbathTestProfiles()[0]) {
      console.log(`[Test Debug] ${test.name}: marginHours=${marginHours.toFixed(2)}, uncertaintyHours=${uncertaintyHours}, ` +
        `dateUncertaintyProb=${dateUncertaintyProbability}%, direction=${dateUncertaintyDirection}, ` +
        `calculated=${calculatedWeekdayName}, expected=${test.expectedLabel}, result=${result}`);
    }
    
    // Restore state
    Object.assign(state, savedState);
    
    return {
      result,
      calculatedWeekday,
      calculatedWeekdayName,
      gregorianDate: targetDayDate,
      uncertaintyHours,
      marginHours,
      probability,
      dateUncertaintyProbability,
      dateUncertaintyDirection,
      moonEventDate,
      yearUncertainty
    };
  } catch (e) {
    console.error('Error running biblical test:', e);
    return { result: 'error', error: e.message };
  }
}

// Store pending test navigation data
let pendingTestNavigation = null;

// Navigate to a specific date on a test profile
function navigateToTestResult(testId, profileId) {
  // Find the test and profile from stored data
  const test = BIBLICAL_TESTS.find(t => t.id === testId);
  const profiles = getSabbathTestProfiles();
  const profile = profiles.find(p => p.id === profileId);
  
  if (!test || !profile) {
    console.error('Test or profile not found:', testId, profileId);
    return;
  }
  
  // Create a temporary profile with the test settings
  const tempProfileId = 'sabbath-test-temp';
  PROFILES[tempProfileId] = {
    name: 'Sabbath Test',
    icon: profile.moonPhase === 'full' ? '🌕' : profile.moonPhase === 'dark' ? '🌑' : '🌒',
    ...profile
  };
  
  // Apply the profile settings
  state.selectedProfile = tempProfileId;
  state.moonPhase = profile.moonPhase;
  state.dayStartTime = profile.dayStartTime;
  state.dayStartAngle = profile.dayStartAngle;
  state.yearStartRule = profile.yearStartRule;
  state.crescentThreshold = profile.crescentThreshold;
  state.sabbathMode = profile.sabbathMode;
  state.lat = test.location.lat;
  state.lon = test.location.lon;
  state.year = test.year;
  
  // Update UI inputs BEFORE generateCalendar (which reads from them)
  document.getElementById('year-input').value = test.year;
  document.getElementById('lat-input').value = test.location.lat;
  document.getElementById('lon-input').value = test.location.lon;
  document.getElementById('moon-phase-select').value = profile.moonPhase;
  
  // Generate calendar for this year
  generateCalendar({ preserveMonth: false });
  
  // Find the month and day in the generated calendar
  const targetMonth = state.lunarMonths.find(m => m.monthNumber === test.month);
  if (targetMonth) {
    state.currentMonthIndex = state.lunarMonths.indexOf(targetMonth);
    const targetDay = targetMonth.days.find(d => d.lunarDay === test.day);
    if (targetDay) {
      state.highlightedLunarDay = test.day;
    }
  }
  
  // Hide sabbath tester page
  document.getElementById('sabbath-tester-page').style.display = 'none';
  
  // Show calendar
  const calendarOutput = document.getElementById('calendar-output');
  const dayDetailPanel = document.getElementById('day-detail-panel');
  calendarOutput.style.display = 'block';
  
  // Render the month
  renderMonth(state.lunarMonths[state.currentMonthIndex]);
  updateMonthButtons();
  
  // Build URL using the new path format
  // Use pushState so back button returns to tester
  const newURL = buildPathURL({ includeMonth: true });
  window.history.pushState({ fromTester: true }, '', newURL);
  
  // Show day detail
  if (state.highlightedLunarDay) {
    const month = state.lunarMonths[state.currentMonthIndex];
    const dayObj = month.days.find(d => d.lunarDay === state.highlightedLunarDay);
    if (dayObj) {
      dayDetailPanel.classList.remove('hidden');
      dayDetailPanel.style.display = '';
      showDayDetail(dayObj, month);
    }
  }
  
  // Clean up temporary profile
  delete PROFILES[tempProfileId];
}

// Format a Gregorian date for ancient dates
function formatAncientDate(date, includeWeekday = true) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const weekday = weekdays[getCorrectWeekday(date)];
  const monthName = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const yearStr = year < 0 ? `${Math.abs(year) + 1} BC` : `${year} AD`;
  
  if (includeWeekday) {
    return `${weekday}, ${monthName} ${day}, ${yearStr}`;
  }
  return `${monthName} ${day}, ${yearStr}`;
}

// Render the Sabbath Tester page
// Cache version for sabbath tester results - increment when test logic changes
const SABBATH_TESTER_CACHE_VERSION = 'v5';

function renderSabbathTester() {
  const loadingEl = document.getElementById('sabbath-tester-loading');
  const resultsEl = document.getElementById('sabbath-tester-results');
  
  // Check for cached results
  const cacheKey = 'sabbathTesterResults';
  const cacheVersionKey = 'sabbathTesterVersion';
  const cachedVersion = localStorage.getItem(cacheVersionKey);
  const cachedHtml = localStorage.getItem(cacheKey);
  
  if (cachedVersion === SABBATH_TESTER_CACHE_VERSION && cachedHtml) {
    // Use cached results
    loadingEl.style.display = 'none';
    resultsEl.innerHTML = cachedHtml;
    return;
  }
  
  loadingEl.style.display = 'block';
  resultsEl.innerHTML = '';
  
  // Use setTimeout to allow UI to update
  setTimeout(() => {
    const profiles = getSabbathTestProfiles();
    const allResults = [];
    
    // Run all tests against all profiles
    for (const test of BIBLICAL_TESTS) {
      const testResults = [];
      for (const profile of profiles) {
        const result = runBiblicalTest(test, profile);
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
    
    // Calculate scoreboard
    const scoreboard = {};
    // Also calculate base scores excluding 32 AD for alternative year comparisons
    const baseScoreWithout32AD = {};
    // Track individual test results per profile for expandable details
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
        testResults: [] // Track individual test results for alt-score breakdown
      };
      testResultsByProfile[profile.id] = [];
    }
    
    for (const { test, results } of allResults) {
      for (const r of results) {
        const score = scoreboard[r.profile.id];
        const baseScore = baseScoreWithout32AD[r.profile.id];
        // Only count towards score if test is not excluded
        const countsForScore = !test.excludeFromScore;
        // For base score, exclude both excluded tests AND the 32 AD test
        const countsForBaseScore = !test.excludeFromScore && test.id !== 'resurrection-32ad';
        
        // Store test result for this profile (only scored tests)
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
            score.totalScore += 1; // Pass = 1
          }
          if (countsForBaseScore) {
            baseScore.totalScore += 1;
            baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'pass' });
          }
        } else if (r.result === 'uncertain') {
          if (countsForScore) {
            score.uncertain++;
            // Uncertain = probability / 100 (e.g., 55% = 0.55)
            score.totalScore += (r.probability || 50) / 100;
          }
          if (countsForBaseScore) {
            baseScore.totalScore += (r.probability || 50) / 100;
            baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'uncertain', probability: r.probability });
          }
        } else if (r.result === 'fail') {
          if (countsForScore) {
            score.failed++;
            // Fail = 0
          }
          if (countsForBaseScore) {
            baseScore.testResults.push({ testName: test.name, testId: test.id, result: 'fail' });
          }
          // Fail adds 0 to base score too (nothing to add)
        }
      }
    }
    
    // Sort scoreboard: by passes (desc), then fails (asc), then score (desc)
    const sortedScores = Object.values(scoreboard).sort((a, b) => {
      // First: more passes is better
      if (b.passed !== a.passed) return b.passed - a.passed;
      // Second: fewer fails is better
      if (a.failed !== b.failed) return a.failed - b.failed;
      // Third: higher score is better (for uncertain probabilities)
      return b.totalScore - a.totalScore;
    });
    
    // Build HTML
    let html = '';
    
    // Summary Scoreboard
    html += `
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
    
    const numTests = BIBLICAL_TESTS.filter(t => !t.excludeFromScore).length;
    for (const score of sortedScores) {
      // Score = sum / num tests, expressed as percentage
      const pct = Math.round((score.totalScore / numTests) * 100);
      let scoreClass = 'score-poor';
      if (pct >= 90) scoreClass = 'score-perfect';
      else if (pct >= 70) scoreClass = 'score-good';
      else if (pct >= 50) scoreClass = 'score-medium';
      
      // Build test breakdown for this profile
      const profileTests = testResultsByProfile[score.profile.id] || [];
      const passedTests = profileTests.filter(t => t.result === 'pass');
      const failedTests = profileTests.filter(t => t.result === 'fail');
      const uncertainTests = profileTests.filter(t => t.result === 'uncertain');
      
      // Helper to format test names, keeping year info for resurrection tests
      const formatName = (t) => {
        if (t.testId === 'resurrection-32ad') return 'Resurrection 32 AD';
        return t.testName.replace(/ \([^)]+\)$/, '');
      };
      
      let testBreakdown = '<div class="score-breakdown">';
      if (passedTests.length > 0) {
        testBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-pass">✅ Passed:</span> ';
        testBreakdown += passedTests.map(formatName).join(', ');
        testBreakdown += '</div>';
      }
      if (uncertainTests.length > 0) {
        testBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-uncertain">⚠️ Uncertain:</span> ';
        testBreakdown += uncertainTests.map(t => `${formatName(t)} (${t.probability}%)`).join(', ');
        testBreakdown += '</div>';
      }
      if (failedTests.length > 0) {
        testBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-fail">❌ Failed:</span> ';
        testBreakdown += failedTests.map(formatName).join(', ');
        testBreakdown += '</div>';
      }
      testBreakdown += '</div>';
      
      const rowId = `scoreboard-row-${score.profile.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      html += `
        <tr class="scoreboard-expandable" onclick="toggleScoreboardRow('${rowId}')">
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
    
    // Individual Test Cards
    for (const { test, results } of allResults) {
      const yearDisplay = test.year < 0 ? `${Math.abs(test.year) + 1} BC` : `${test.year} AD`;
      const excludedNote = test.excludeFromScore ? ' <span style="font-size: 0.8em; color: #888;">(not scored)</span>' : '';
      
      html += `
        <div class="sabbath-test-card">
          <div class="sabbath-test-title">
            <span>📜 ${test.name}${excludedNote}</span>
          </div>
          <div class="sabbath-test-date">
            ${test.day}${getDaySuffix(test.day)} of Month ${test.month}, ${yearDisplay}
          </div>
          <div class="sabbath-test-scripture">${test.scripture}</div>
          <div class="sabbath-test-description">${test.description}</div>
          ${test.id === 'resurrection-32ad' ? `
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
              <p style="margin-top: 15px;"><a href="/chapters/12-32-ad-resurrection/" style="color: #7ec8e3;">📖 Read the full chapter: 32 AD Resurrection</a></p>
            </div>
          </details>
          ` : ''}
          ${test.id === 'resurrection-33ad' ? `
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
              <p style="margin-top: 15px;"><a href="/chapters/12-32-ad-resurrection/" style="color: #7ec8e3;">📖 Read the full chapter: 32 AD Resurrection</a></p>
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
          ` : ''}
          <div class="sabbath-test-expected">
            <strong>Expected:</strong> ${test.expectedLabel} (${test.expectedLabel === 'Saturday' ? 'Sabbath' : 'First Day of Week'})
          </div>
          <table class="sabbath-test-results-table">
            <thead>
              <tr>
                <th>Calendar Profile</th>
                <th>${test.year < 1582 ? 'Julian Date' : 'Gregorian Date'}</th>
                <th>Weekday</th>
                <th>Result</th>
                ${(test.id === 'resurrection-30ad' || test.id === 'resurrection-33ad') ? '<th title="Score if this year replaces 32 AD as the resurrection test">Alt Score</th>' : ''}
              </tr>
            </thead>
            <tbody>
      `;
      
      // Group results by base profile (moon phase + day start, without year rule)
      // to merge rows when both year rules produce same result
      const groupedResults = {};
      for (const r of results) {
        // Extract base key (without year rule)
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
        
        // Check if both produce same weekday (can be merged)
        if (eq && lamb && eq.calculatedWeekday === lamb.calculatedWeekday && eq.result === lamb.result) {
          // Merge: use equinox data but show both icons
          const moonIcon = eq.profile.moonPhase === 'full' ? '🌕' : eq.profile.moonPhase === 'dark' ? '🌑' : '🌒';
          const moonName = eq.profile.moonPhase === 'full' ? 'Full Moon' : eq.profile.moonPhase === 'dark' ? 'Dark Moon' : 'Crescent Moon';
          const dayStartName = eq.profile.dayStartTime === 'morning' ? 'Daybreak' : 'Sunset';
          // Check if either profile matches a preset
          const presetName = eq.profile.presetName || lamb.profile.presetName;
          const presetSuffix = presetName ? ` (${presetName})` : '';
          mergedResults.push({
            ...eq,
            mergedName: `${moonIcon} ${moonName} ${dayStartName} ⚖️🐑${presetSuffix}`,
            isMerged: true,
            // Use equinox profile for navigation (either would work)
            profileIdForNav: eq.profile.id
          });
        } else {
          // Show separately - profile.name already includes preset suffix from getSabbathTestProfiles
          if (eq) mergedResults.push({ ...eq, mergedName: eq.profile.name, isMerged: false, profileIdForNav: eq.profile.id });
          if (lamb) mergedResults.push({ ...lamb, mergedName: lamb.profile.name, isMerged: false, profileIdForNav: lamb.profile.id });
        }
      }
      
      // Sort results: pass first, then uncertain, then fail
      const sortedResults = mergedResults.sort((a, b) => {
        const order = { pass: 0, uncertain: 1, fail: 2, error: 3 };
        return (order[a.result] || 3) - (order[b.result] || 3);
      });
      
      for (const r of sortedResults) {
        let resultText, resultClass;
        if (r.result === 'pass') {
          resultText = '✅ Pass';
          resultClass = 'result-pass';
        } else if (r.result === 'uncertain') {
          // Show caution with % chance of passing
          resultText = `⚠️ ${r.probability}%`;
          resultClass = 'result-uncertain';
        } else if (r.result === 'fail') {
          resultText = '❌ Fail';
          resultClass = 'result-fail';
        } else {
          resultText = '⚠️ Error';
          resultClass = 'result-uncertain';
        }
        
        const dateStr = r.gregorianDate ? formatAncientDate(r.gregorianDate, false) : 'N/A';
        const weekdayStr = r.calculatedWeekdayName || 'N/A';
        
        // Create year uncertainty indicator if present
        let yearUncertaintyIcon = '';
        if (r.yearUncertainty && r.yearUncertainty.probability > 0) {
          const tooltipText = `Year uncertainty: ${r.yearUncertainty.probability}% chance all dates are 1 month ${r.yearUncertainty.direction} (ΔT uncertainty ±${Math.round(r.uncertaintyHours)} hours, Nisan margin: ${r.yearUncertainty.marginHours.toFixed(1)} hours)`;
          yearUncertaintyIcon = ` <span class="year-uncertainty-icon" title="${tooltipText}">⚠️${r.yearUncertainty.probability}%</span>`;
        }
        
        // Create onclick handler for date link using test ID and profile ID
        const dateLink = r.gregorianDate ? 
          `<a class="sabbath-test-date-link" onclick="navigateToTestResult('${test.id}', '${r.profileIdForNav}')">${dateStr}</a>${yearUncertaintyIcon}` :
          dateStr;
        
        // Calculate alternative score for 30 AD and 33 AD tests
        let altScoreCell = '';
        if (test.id === 'resurrection-30ad' || test.id === 'resurrection-33ad') {
          // Get base score without 32 AD, then add this test's result
          const baseScoreData = baseScoreWithout32AD[r.profile.id];
          const baseScore = baseScoreData?.totalScore || 0;
          const baseTestResults = baseScoreData?.testResults || [];
          
          let thisTestScore = 0;
          if (r.result === 'pass') thisTestScore = 1;
          else if (r.result === 'uncertain') thisTestScore = (r.probability || 50) / 100;
          // else fail = 0
          
          const altTotalScore = baseScore + thisTestScore;
          const altPct = Math.round((altTotalScore / numTests) * 100);
          
          let altScoreClass = 'score-poor';
          if (altPct >= 90) altScoreClass = 'score-perfect';
          else if (altPct >= 70) altScoreClass = 'score-good';
          else if (altPct >= 50) altScoreClass = 'score-medium';
          
          // Build breakdown of tests (excluding current test - that's shown in Result column)
          const passedTests = baseTestResults.filter(t => t.result === 'pass');
          const failedTests = baseTestResults.filter(t => t.result === 'fail');
          const uncertainTests = baseTestResults.filter(t => t.result === 'uncertain');
          
          // Helper to format test names, keeping year info for resurrection tests
          const formatTestName = (t) => {
            if (t.testId === 'resurrection-32ad') return 'Resurrection 32 AD';
            return t.testName.replace(/ \([^)]+\)$/, '').replace('First Sabbath of ', '').replace('First Fruits After ', '');
          };
          
          let altBreakdown = '';
          if (passedTests.length > 0) {
            altBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-pass">✅</span> ';
            altBreakdown += passedTests.map(formatTestName).join(', ');
            altBreakdown += '</div>';
          }
          if (uncertainTests.length > 0) {
            altBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-uncertain">⚠️</span> ';
            altBreakdown += uncertainTests.map(t => `${formatTestName(t)} (${t.probability}%)`).join(', ');
            altBreakdown += '</div>';
          }
          if (failedTests.length > 0) {
            altBreakdown += '<div class="breakdown-section"><span class="breakdown-label result-fail">❌</span> ';
            altBreakdown += failedTests.map(formatTestName).join(', ');
            altBreakdown += '</div>';
          }
          
          altScoreCell = `<td class="${altScoreClass}">
            <details class="alt-score-details">
              <summary>${altPct}%</summary>
              <div class="alt-score-breakdown">${altBreakdown}</div>
            </details>
          </td>`;
        }
        
        html += `
          <tr>
            <td>${r.mergedName}</td>
            <td>${dateLink}</td>
            <td>${weekdayStr}</td>
            <td class="${resultClass}">${resultText}</td>
            ${altScoreCell}
          </tr>
        `;
      }
      
      html += `
            </tbody>
          </table>
        </div>
      `;
    }
    
    loadingEl.style.display = 'none';
    resultsEl.innerHTML = html;
    
    // Cache the results
    try {
      localStorage.setItem('sabbathTesterResults', html);
      localStorage.setItem('sabbathTesterVersion', SABBATH_TESTER_CACHE_VERSION);
    } catch (e) {
      // localStorage might be full or unavailable
      console.warn('Could not cache sabbath tester results:', e);
    }
    
    // Run engine comparison and log results to console
    setTimeout(() => {
      compareEngineResults();
    }, 100);
  }, 50);
}

// Toggle scoreboard row expansion
function toggleScoreboardRow(rowId) {
  const detailsRow = document.getElementById(rowId);
  const mainRow = detailsRow?.previousElementSibling;
  
  if (detailsRow && mainRow) {
    const isExpanded = detailsRow.style.display !== 'none';
    detailsRow.style.display = isExpanded ? 'none' : 'table-row';
    mainRow.classList.toggle('expanded', !isExpanded);
  }
}

// Helper to get day suffix (1st, 2nd, 3rd, etc.)
function getDaySuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// =============================================================================
// ENGINE COMPARISON - Verify new LunarCalendarEngine matches existing logic
// =============================================================================

function compareEngineResults() {
  console.log('%c=== LUNAR CALENDAR ENGINE COMPARISON ===', 'color: #4fc3f7; font-weight: bold; font-size: 14px;');
  
  // Use the existing abstracted engine (which handles Swiss Ephemeris, ancient dates, etc.)
  const existingEngine = getAstroEngine();
  
  // Create adapter for LunarCalendarEngine using the existing engine infrastructure
  const astroAdapter = {
    searchMoonPhase(phase, startDate, limitDays) {
      return existingEngine.searchMoonPhase(phase, startDate, limitDays);
    },
    getSeasons(year) {
      return existingEngine.getSeasons(year);
    },
    searchRiseSet(body, observer, direction, startDate, limitDays) {
      return existingEngine.searchRiseSet(body, observer, direction, startDate, limitDays);
    },
    searchAltitude(body, observer, direction, startDate, limitDays, altitude) {
      return existingEngine.searchAltitude(body, observer, direction, startDate, limitDays, altitude);
    },
    createObserver(lat, lon, elevation) {
      return existingEngine.createObserver(lat, lon, elevation);
    },
    getDeltaTUncertainty(year) {
      return existingEngine.getDeltaTUncertainty ? existingEngine.getDeltaTUncertainty(year) : 0;
    }
  };
  
  const engine = new LunarCalendarEngine(astroAdapter);
  const profiles = getSabbathTestProfiles();
  let totalTests = 0;
  let matchCount = 0;
  let mismatchCount = 0;
  const mismatches = [];
  
  for (const test of BIBLICAL_TESTS) {
    for (const profile of profiles) {
      totalTests++;
      
      // Run existing test
      const existingResult = runBiblicalTest(test, profile);
      
      // Debug: log existing result details for first profile of each test
      if (profile === profiles[0]) {
        console.log(`[Existing Debug] Test: ${test.name}, Year: ${test.year}`);
        console.log(`[Existing Debug] Result: ${existingResult.gregorianDate?.toISOString()} ${existingResult.calculatedWeekdayName}`);
        if (existingResult.moonEventDate) {
          console.log(`[Existing Debug] Moon event: ${existingResult.moonEventDate.toISOString()}`);
        }
      }
      
      // Run engine test
      engine.configure({
        moonPhase: profile.moonPhase,
        dayStartTime: profile.dayStartTime === 'morning' ? 'morning' : 'evening',
        dayStartAngle: 0,
        yearStartRule: profile.yearStartRule,
        crescentThreshold: 18
      });
      
      const location = test.location || { lat: 31.7683, lon: 35.2137 };
      
      try {
        // Enable debug for first profile of each test to diagnose
        const isFirstProfileForTest = profile === profiles[0];
        const calendar = engine.generateYear(test.year, location, { debug: isFirstProfileForTest });
        const dayInfo = engine.getDayInfo(calendar, test.month, test.day);
        
        if (!dayInfo) {
          mismatches.push({
            test: test.name,
            profile: profile.name,
            issue: 'Engine returned null for day info',
            existing: existingResult
          });
          mismatchCount++;
          continue;
        }
        
        // Compare weekday
        const existingWeekday = existingResult.calculatedWeekday;
        const engineWeekday = dayInfo.weekday;
        
        // Compare Gregorian date
        const existingDateStr = existingResult.gregorianDate ? 
          existingResult.gregorianDate.toISOString().split('T')[0] : null;
        const engineDateStr = dayInfo.gregorianDate ? 
          dayInfo.gregorianDate.toISOString().split('T')[0] : null;
        
        // Get uncertainty from engine
        const monthData = calendar.months.find(m => m.monthNumber === test.month);
        const engineUncertainty = monthData ? monthData.uncertainty : null;
        
        const weekdayMatch = existingWeekday === engineWeekday;
        const dateMatch = existingDateStr === engineDateStr;
        
        if (weekdayMatch && dateMatch) {
          matchCount++;
        } else {
          mismatchCount++;
          mismatches.push({
            test: test.name,
            profile: profile.name,
            existingWeekday: existingResult.calculatedWeekdayName,
            engineWeekday: dayInfo.weekdayName,
            existingDate: existingDateStr,
            engineDate: engineDateStr,
            weekdayMatch,
            dateMatch,
            existingUncertainty: existingResult.uncertaintyHours,
            engineUncertainty: engineUncertainty
          });
        }
      } catch (e) {
        mismatchCount++;
        console.error('Engine error for', test.name, profile.name, ':', e);
        mismatches.push({
          test: test.name,
          profile: profile.name,
          issue: 'Engine threw error: ' + e.message,
          existing: existingResult,
          stack: e.stack
        });
      }
    }
  }
  
  // Log summary
  console.log(`%cTotal tests: ${totalTests}`, 'color: #aaa;');
  console.log(`%cMatches: ${matchCount}`, 'color: #4caf50; font-weight: bold;');
  console.log(`%cMismatches: ${mismatchCount}`, mismatchCount > 0 ? 'color: #f44336; font-weight: bold;' : 'color: #4caf50;');
  
  if (mismatches.length > 0) {
    console.log('%c--- MISMATCHES ---', 'color: #ff9800; font-weight: bold;');
    for (const m of mismatches) {
      console.log('%c' + m.test + ' / ' + m.profile, 'color: #ff9800;');
      if (m.issue) {
        console.log('  Issue:', m.issue);
      } else {
        console.log('  Existing:', m.existingDate, m.existingWeekday);
        console.log('  Engine:  ', m.engineDate, m.engineWeekday);
        console.log('  Date match:', m.dateMatch, '| Weekday match:', m.weekdayMatch);
      }
    }
  } else {
    console.log('%c✓ All results match!', 'color: #4caf50; font-weight: bold; font-size: 12px;');
  }
  
  return { totalTests, matchCount, mismatchCount, mismatches };
}
