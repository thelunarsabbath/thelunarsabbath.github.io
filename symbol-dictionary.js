// Symbol Dictionary Data
// Derived through systematic scriptural analysis
// See /symbols/methodology for the methodology used

const SYMBOL_DICTIONARY = {
  // Each key is lowercase for matching
  // words: array of words/phrases that trigger this symbol (lowercase)
  // strongs: array of Strong's numbers that map to this symbol (optional)
  
  'light': {
    name: 'LIGHT',
    words: ['light', 'lights'],
    strongs: ['H216', 'G5457'],
    is: 'Example',
    is2: 'Visible Obedience',
    does: null,
    does2: null,
    sentence: 'Visible obedience to God\'s commandments—living in such a way that others can see righteousness (commandment-keeping) and follow',
    opposite: 'Darkness',
    link: '/symbols/light/'
  },
  
  'darkness': {
    name: 'DARKNESS',
    words: ['darkness', 'dark'],
    strongs: ['H2822', 'G4655'],
    is: 'Hidden',
    is2: 'Concealed Disobedience',
    does: 'Conceals',
    does2: 'Blinds',
    sentence: 'The state of concealing one\'s conduct from scrutiny—living in such a way that deeds are hidden, particularly lawless deeds that cannot bear the exposure of light (visible example)',
    opposite: 'Light',
    link: '/symbols/darkness/'
  },
  
  'day': {
    name: 'DAY',
    words: ['day', 'days'],
    strongs: ['H3117', 'G2250'],
    is: 'Exposure',
    is2: 'Time of Accountability',
    does: 'Reveals',
    does2: 'Judges',
    sentence: 'The season of visibility and opportunity—the time when conduct is exposed to scrutiny, when work can be done, and when one must live as though being watched',
    opposite: 'Night',
    link: '/symbols/day/'
  },
  
  'night': {
    name: 'NIGHT',
    words: ['night', 'nights'],
    strongs: ['H3915', 'G3571'],
    is: 'Hiddenness',
    is2: 'Season of Unawareness',
    does: 'Conceals',
    does2: 'Closes Opportunity',
    sentence: 'The season of hiddenness and closed opportunity—the time when conduct is concealed, when work cannot be done, and when spiritual sleep and drunkenness prevail',
    opposite: 'Day',
    link: '/symbols/night/'
  },
  
  'mountain': {
    name: 'MOUNTAIN',
    words: ['mountain', 'mountains', 'mount'],
    strongs: ['H2022', 'G3735'],
    is: 'Kingdom',
    is2: 'Ruling Authority',
    does: null,
    does2: null,
    sentence: 'An established, elevated seat of governmental power from which law and authority are exercised over a territory',
    opposite: 'Valley/Sea',
    link: '/symbols/mountain/'
  },
  
  'truth': {
    name: 'TRUTH',
    words: ['truth'],
    strongs: ['H571', 'G225'],
    is: 'Commandment',
    is2: "God's Standard",
    does: null,
    does2: null,
    sentence: "God's word, law, and instructions that define how things actually are and ought to be",
    opposite: 'Lie',
    link: '/symbols/truth/'
  },
  
  'sea': {
    name: 'SEA',
    words: ['sea', 'seas', 'waters', 'waves', 'wave'],
    strongs: ['H3220', 'G2281'],
    is: 'Nations',
    is2: 'Chaotic Peoples',
    does: null,
    does2: null,
    sentence: 'The mass of humanity—peoples, multitudes, nations in their unsanctified, turbulent state',
    opposite: 'Dry Land/Island',
    link: '/symbols/sea/'
  },
  
  'island': {
    name: 'ISLAND',
    words: ['island', 'islands', 'isle', 'isles'],
    strongs: ['H339'],
    is: 'Sanctified',
    is2: 'Set-Apart People',
    does: null,
    does2: null,
    sentence: 'A people distinguished and separated from the chaotic mass of nations—those set apart (holy/sanctified)',
    opposite: 'Sea',
    link: '/symbols/island/'
  },
  
  'faith': {
    name: 'FAITH',
    words: ['faith'],
    strongs: ['H530', 'G4102'],
    is: 'Obedience',
    is2: 'Trusting Obedience',
    does: null,
    does2: null,
    sentence: 'Acting on what you believe to be true—trust that produces obedient action, not mere mental assent',
    opposite: 'Unbelief/Disobedience',
    link: '/symbols/faith/'
  },
  
  'believe': {
    name: 'BELIEVE',
    words: ['believe', 'believed', 'believeth', 'believing', 'believers'],
    strongs: ['H539', 'G4100'],
    is: 'Obey',
    is2: 'Commit to Obey',
    does: null,
    does2: null,
    sentence: 'To entrust oneself through obedient action—not mere mental assent, but committing to act',
    opposite: 'Disobey',
    link: '/symbols/believe/'
  },
  
  'rock': {
    name: 'ROCK',
    words: ['rock', 'rocks'],
    strongs: ['H6697', 'H5553', 'G4073'],
    is: 'Covenant',
    is2: 'Unchanging Covenant',
    does: null,
    does2: null,
    sentence: 'The binding, unchanging promise/agreement between God and man—the everlasting covenant',
    opposite: 'Sand',
    link: '/symbols/rock/'
  },
  
  'sand': {
    name: 'SAND',
    words: ['sand'],
    strongs: ['H2344', 'G285'],
    is: 'Multitudes',
    is2: 'People at Covenant Boundary',
    does: null,
    does2: null,
    sentence: 'Countless people at the seashore (wings/coast)—the place where covenant is offered. Can be lost in the sea (nations) or bound to Christ the Rock, becoming living stones',
    opposite: 'Rock',
    link: '/symbols/sand/'
  },
  
  'highway': {
    name: 'HIGHWAY',
    words: ['highway', 'highways'],
    strongs: ['H4546'],
    is: 'Covenant Path',
    is2: 'Way of Faithfulness',
    does: null,
    does2: null,
    sentence: 'The raised, prepared path where the covenant-faithful walk—distinct from the byways of the world, inaccessible to the unclean',
    opposite: 'Byways',
    link: '/symbols/highway/'
  },
  
  'way': {
    name: 'WAY',
    words: ['way', 'ways'],
    strongs: ['H1870', 'G3598'],
    is: 'Conduct',
    is2: 'Manner of Life',
    does: null,
    does2: null,
    sentence: 'How one lives and acts—the pattern of behavior that defines one\'s path, whether leading to life or destruction',
    opposite: 'Error/Transgression',
    link: '/symbols/way/'
  },
  
  'the way': {
    name: 'THE WAY',
    words: ['the way of the lord', 'the way of god', 'the way of righteousness', 'the way of truth', 'the way of life', 'the way of peace', 'the way of salvation'],
    strongs: ['H1870', 'G3598'],
    is: 'Torah',
    is2: "God's Commandments",
    does: null,
    does2: null,
    sentence: "The specific, singular, right conduct—obedience to God's instructions as revealed in Scripture and embodied in Messiah",
    opposite: 'Lawlessness',
    link: '/symbols/way/'
  },
  
  'fornication': {
    name: 'FORNICATION',
    words: ['fornication', 'fornications', 'whoredom', 'whoredoms'],
    strongs: ['H2181', 'G4202'],
    is: 'Idolatry',
    is2: 'Serving Idols',
    does: null,
    does2: null,
    sentence: 'Giving devotion, service, or allegiance to anyone other than the true God—breaking the first commandment',
    opposite: 'Faithfulness',
    link: '/symbols/fornication/'
  },
  
  'idolatry': {
    name: 'IDOLATRY',
    words: ['idolatry', 'idols', 'idol'],
    strongs: ['G1495', 'G1497'],
    is: 'Self-rule',
    is2: "Rejecting God's Word",
    does: null,
    does2: null,
    sentence: "Replacing God's standard/word with your own—putting self or anything else in God's place",
    opposite: 'Submission to God',
    link: '/symbols/idolatry/'
  },
  
  'virgin': {
    name: 'VIRGIN',
    words: ['virgin', 'virgins'],
    strongs: ['H1330', 'G3933'],
    is: 'Faithful',
    is2: 'Exclusively Devoted',
    does: null,
    does2: null,
    sentence: 'One who has maintained exclusive devotion to one master—pure covenant faithfulness',
    opposite: 'Harlot',
    link: '/symbols/virgin/'
  },
  
  'harlot': {
    name: 'HARLOT',
    words: ['harlot', 'harlots', 'whore', 'whores'],
    strongs: ['H2181', 'G4204'],
    is: 'Idolater',
    is2: 'Covenant Breaker',
    does: null,
    does2: null,
    sentence: 'One who has committed spiritual fornication—serving other gods/masters instead of the true God',
    opposite: 'Virgin',
    link: '/symbols/virgin/'
  },
  
  'sleep': {
    name: 'SLEEP',
    words: ['sleep', 'sleepeth', 'sleeping', 'asleep', 'slumber'],
    strongs: ['H3462', 'H8639', 'G2518', 'G2837'],
    is: 'Death',
    is2: 'Spiritually Unaware',
    does: null,
    does2: null,
    sentence: 'A state of unconsciousness to spiritual reality—unaware of and unresponsive to God\'s truth',
    opposite: 'Awake/Watch',
    link: '/symbols/sleep/'
  },
  
  'moment': {
    name: 'MOMENT',
    words: ['moment'],
    strongs: ['H7281', 'G823'],
    is: 'Judgment',
    is2: 'Sudden Judgment',
    does: null,
    does2: null,
    sentence: 'The sudden falling of judgment or destruction—the moment when God\'s evaluation results in swift action',
    opposite: 'Everlasting',
    link: '/symbols/moment/'
  },
  
  'wickedness': {
    name: 'WICKEDNESS',
    words: ['wickedness', 'wicked'],
    strongs: ['H7562', 'H7563', 'G4189', 'G4190'],
    is: 'Lawlessness',
    is2: 'Covenant Transgression',
    does: 'Burns',
    does2: 'Consumes Self',
    sentence: 'The state of lawlessness (rejecting God\'s standard) which burns like fire—self-destructive rebellion',
    opposite: 'Righteousness',
    link: '/symbols/wickedness/'
  },
  
  'tree': {
    name: 'TREE',
    words: ['tree', 'trees'],
    strongs: ['H6086', 'G1186', 'G3586'],
    is: 'Nation',
    is2: 'People Group',
    does: 'Produces',
    does2: 'Bears Fruit / Shelters',
    sentence: 'A nation or people group—can be God\'s nation or foreign nations, characterized by what fruit it produces',
    opposite: 'Cut down tree',
    link: '/symbols/tree/'
  },
  
  'thorns': {
    name: 'THORNS',
    words: ['thorns', 'thorn', 'briers', 'brier', 'thistles', 'thistle'],
    strongs: ['H6975', 'H5544', 'G173'],
    is: 'Worldly',
    is2: 'Choking People',
    does: 'Chokes',
    does2: 'Prevents Fruitfulness',
    sentence: 'A type of people/nation characterized by worldly cares, riches, and pleasures—they choke out and prevent fruitfulness',
    opposite: 'Good ground',
    link: '/symbols/thorns/'
  },
  
  'animal': {
    name: 'ANIMAL',
    words: ['beast', 'beasts', 'animal', 'animals', 'lion', 'wolf', 'bear', 'leopard', 'serpent'],
    strongs: ['H2416', 'H929', 'G2342', 'G2226'],
    is: 'People',
    is2: 'Tribe / Sub-state',
    does: 'Characterized',
    does2: 'Acts According to Nature',
    sentence: 'A people-group or tribe characterized by its nature—subordinate to empires (trees)',
    opposite: null,
    link: '/symbols/animal/'
  },
  
  'babylon': {
    name: 'BABYLON',
    words: ['babylon', 'babel'],
    strongs: ['H894', 'G897'],
    is: 'Kingdom',
    is2: 'Worldly Kingdom',
    does: 'Opposes',
    does2: 'Counterfeits',
    sentence: 'The worldly kingdom system built on human authority and effort—man\'s substitute for God\'s covenant, using brick (man-made) instead of stone (God-given), the "mother of harlots" because all idolatry flows from rejecting God\'s Kingdom for man\'s',
    opposite: 'Jerusalem/Zion (Heavenly Kingdom)',
    link: '/symbols/babylon/'
  },
  
  'name': {
    name: 'NAME',
    words: ['name', 'names'],
    strongs: ['H8034', 'G3686'],
    is: 'Covenant',
    is2: 'Covenant Relationship',
    does: 'Binds',
    does2: 'Identifies',
    sentence: 'The binding covenant relationship and its associated promises—to invoke "the name" is to invoke the covenant and all it entails',
    opposite: 'Nameless/Covenant-less',
    link: '/symbols/name/'
  },
  
  'wings': {
    name: 'WINGS',
    words: ['wing', 'wings', 'skirt', 'skirts', 'borders', 'corners', 'quarters'],
    strongs: ['H3671', 'G4420'],
    is: 'Covenant',
    is2: 'Torah Reminder',
    does: 'Covers',
    does2: 'Reminds',
    sentence: 'Covenant covering and Torah reminder—tzitzit on the wings (kanaph) of garments remind us of commandments (Num 15:38-40); to come "under wings" is to enter covenant',
    opposite: 'Exposed/Uncovered',
    link: '/symbols/wings/'
  },
  
  'eagle': {
    name: 'EAGLE',
    words: ['eagle', 'eagles'],
    strongs: ['H5404', 'H5403', 'G105'],
    is: 'Messenger',
    is2: 'Angel',
    does: 'Bears',
    does2: 'Carries',
    sentence: 'A messenger or agent sent under covenant authority—angels have wings, cherubim have eagle faces, and empires act as God\'s messengers of judgment',
    opposite: 'Unsent/Unauthorized',
    link: '/symbols/eagle/'
  },
  
  'marriage': {
    name: 'MARRIAGE',
    words: ['marriage', 'marry', 'married', 'wife', 'husband', 'bride', 'bridegroom', 'wed', 'wedding', 'espouse', 'espoused', 'betroth', 'betrothed'],
    strongs: ['H802', 'H376', 'G1062', 'G1060', 'G3565', 'G3566'],
    is: 'Covenant',
    is2: 'Covenant Picture',
    does: 'Binds',
    does2: 'Pictures',
    sentence: 'The covenant relationship between God and His people pictured in human marriage—husband represents God/Christ, wife represents Israel/Church, faithfulness represents covenant obedience',
    opposite: 'Divorce/Covenant Breaking',
    link: '/symbols/marriage/'
  },
  
  'fruit': {
    name: 'FRUIT',
    words: ['fruit', 'fruits', 'fruitful', 'unfruitful'],
    strongs: ['H6529', 'G2590'],
    is: 'Works',
    is2: 'Deeds',
    does: 'Reveals',
    does2: 'Results From',
    sentence: 'The visible works, deeds, and actions that result from and reveal the nature of their source—as a tree is known by its fruit, so people are known by their works',
    opposite: 'Barren/Fruitless',
    link: '/symbols/fruit/'
  },
  
  'oil': {
    name: 'OIL',
    words: ['oil', 'ointment'],
    strongs: ['H8081', 'H4888', 'G1637', 'G5548'],
    is: 'Works',
    is2: 'Proven Works',
    does: 'Results From',
    does2: 'Fuels',
    sentence: 'Works that have been tested and proven through trials—as oil is produced by pressing/crushing olives (fruit of the covenant tree), so proven works result from tested faithfulness',
    opposite: 'Untested/Unproven',
    link: '/symbols/oil/'
  },
  
  'mark': {
    name: 'MARK',
    words: ['mark', 'marks', 'marked', 'sign', 'signs', 'token', 'tokens'],
    strongs: ['H226', 'H8420', 'G5480', 'G4742'],
    is: 'Observance',
    is2: 'Visible Practice',
    does: 'Identifies',
    does2: 'Shows Allegiance',
    sentence: 'The practice or observance that identifies which authority\'s covenant you follow—what you DO (hand) and THINK (forehead) that marks you as belonging to a particular master',
    opposite: 'Unmarked/Unidentified',
    link: '/symbols/mark/'
  },
  
  'evening': {
    name: 'EVENING',
    words: ['evening', 'even', 'eventide'],
    strongs: ['H6153'],
    is: 'Sacrifice Time',
    is2: 'Evening Sacrifice',
    does: 'Cleanses',
    does2: 'Restores',
    sentence: 'The time of the evening offering (~3pm/9th hour), not nightfall. In uncleanness contexts, "until the even" likely means "until the evening sacrifice" rather than "until sunset."',
    opposite: 'Morning',
    link: '/symbols/evening/'
  },
  
  'bread': {
    name: 'BREAD',
    words: ['bread', 'loaf', 'loaves', 'manna', 'shewbread'],
    strongs: ['H3899', 'H4478', 'G740', 'G3131'],
    is: 'Word',
    is2: 'Covenant Terms',
    does: 'Sustains',
    does2: 'Covenants',
    sentence: "God's instruction / covenant terms — man lives by every word from God's mouth (Deut 8:3). Breaking bread = cutting covenant; sharing the meal = ratifying the terms together",
    opposite: 'Famine (of hearing God\'s words)',
    link: '/symbols/bread/'
  },
  
  'wine': {
    name: 'WINE',
    words: ['wine', 'wines', 'new wine', 'winepress'],
    strongs: ['H3196', 'H8492', 'G3631'],
    is: 'Blood',
    is2: 'Covenant Blood',
    does: 'Ratifies',
    does2: 'Seals',
    sentence: "The blood of grapes (Gen 49:11) — life poured out to ratify covenant. Brings joy in covenant, wrath when broken. 'This cup is the new covenant in my blood'",
    opposite: 'Thirst / Water',
    link: '/symbols/wine/'
  },
  
  'wind': {
    name: 'WIND',
    words: ['wind', 'winds'],
    strongs: ['H7307', 'H7308', 'G417', 'G4151'],
    is: 'Spirit',
    is2: 'Invisible Power',
    does: 'Moves',
    does2: 'Executes',
    sentence: 'The invisible, powerful force that moves where God wills—spirit operating in the spiritual realm as wind operates in the natural',
    opposite: 'Stillness',
    link: '/symbols/wind/'
  },
  
  'four winds': {
    name: 'FOUR WINDS',
    words: ['four winds', 'four spirits'],
    strongs: ['H7307', 'G417'],
    is: 'Spirits',
    is2: "God's Executing Spirits",
    does: 'Executes',
    does2: 'Scatters/Gathers',
    sentence: "The spirits God dispatches from His throne to execute His purposes throughout all the earth—scattering, gathering, stirring nations, and bringing judgment or restoration",
    opposite: 'Stillness/Calm',
    link: '/symbols/wind/'
  },
  
  'man child': {
    name: 'MAN CHILD',
    words: ['man child', 'man-child', 'manchild', 'male child'],
    strongs: ['H2145', 'G730'],
    is: 'Nation',
    is2: 'Covenant Nation',
    does: 'Rules',
    does2: 'Governs Nations',
    sentence: "The covenant nation/kingdom community that God brings forth from Zion—collectively authorized to rule over nations with divine mandate",
    opposite: 'Barrenness/Childlessness',
    link: '/symbols/man-child/'
  },
  
  'grass': {
    name: 'GRASS',
    words: ['grass', 'grasses'],
    strongs: ['H2682'],
    is: 'People',
    is2: 'Mortal People',
    does: 'Flourishes briefly, withers',
    does2: 'Subject to the wind/Spirit',
    sentence: 'Human beings in their transience and mortality — flesh that flourishes briefly and then is gone, subject to the wind/Spirit of God',
    opposite: 'Word of God (eternal)',
    link: '/symbols/grass/'
  },
  
  'jerusalem': {
    name: 'JERUSALEM',
    words: ['jerusalem', 'zion'],
    strongs: ['H3389', 'H6726'],
    is: 'Bride',
    is2: 'Covenant Community',
    does: 'Gathers God\'s people',
    does2: 'Dwells with God',
    sentence: 'The gathered people of God — those in covenant relationship with Him, dwelling together under His rule and in His presence',
    opposite: 'Babylon',
    link: '/symbols/jerusalem/'
  }
};

// Build a quick lookup index for word matching
const SYMBOL_WORD_INDEX = {};
// Also track multi-word phrases separately
const SYMBOL_MULTI_WORD_PHRASES = [];

for (const [key, symbol] of Object.entries(SYMBOL_DICTIONARY)) {
  for (const word of symbol.words) {
    SYMBOL_WORD_INDEX[word] = symbol;
    // Track multi-word phrases (those containing spaces)
    if (word.includes(' ')) {
      SYMBOL_MULTI_WORD_PHRASES.push({
        phrase: word,
        symbol: symbol,
        key: key
      });
    }
  }
}

// Sort multi-word phrases by length (longest first) for proper matching
SYMBOL_MULTI_WORD_PHRASES.sort((a, b) => b.phrase.length - a.phrase.length);

// Build a Strong's number index
const SYMBOL_STRONGS_INDEX = {};
for (const [key, symbol] of Object.entries(SYMBOL_DICTIONARY)) {
  if (symbol.strongs) {
    for (const strongs of symbol.strongs) {
      SYMBOL_STRONGS_INDEX[strongs] = symbol;
    }
  }
}

// Look up symbol by word or phrase (case-insensitive)
function lookupSymbolByWord(word) {
  if (!word) return null;
  const normalized = word.toLowerCase().replace(/[.,;:!?'"()]/g, '');
  return SYMBOL_WORD_INDEX[normalized] || null;
}

// Get all multi-word phrases for matching
function getMultiWordSymbolPhrases() {
  return SYMBOL_MULTI_WORD_PHRASES;
}

// Look up symbol by Strong's number
function lookupSymbolByStrongs(strongsNum) {
  if (!strongsNum) return null;
  // Normalize the Strong's number
  const normalized = normalizeStrongsNum(strongsNum);
  return SYMBOL_STRONGS_INDEX[normalized] || null;
}

// Show the symbol panel (similar to Strong's panel)
function showSymbolPanel(symbolKey, word, event) {
  if (event) {
    event.stopPropagation();
  }
  
  const symbol = SYMBOL_DICTIONARY[symbolKey] || lookupSymbolByWord(word);
  if (!symbol) return;
  
  // Create or get the symbol panel
  let panel = document.getElementById('symbol-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'symbol-panel';
    panel.className = 'symbol-panel';
    document.body.appendChild(panel);
  }
  
  // Build panel content
  let html = `
    <div class="symbol-panel-header">
      <span class="symbol-panel-name">${symbol.name}</span>
      <button class="symbol-panel-close" onclick="closeSymbolPanel()">×</button>
    </div>
    <div class="symbol-panel-content">
      <div class="symbol-meaning-row">
        <span class="symbol-label">IS:</span>
        <span class="symbol-value">${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</span>
      </div>
      ${symbol.does ? `
      <div class="symbol-meaning-row">
        <span class="symbol-label">DOES:</span>
        <span class="symbol-value">${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}</span>
      </div>
      ` : ''}
      <div class="symbol-sentence">${symbol.sentence}</div>
      ${symbol.opposite ? `<div class="symbol-opposite"><strong>Opposite:</strong> ${symbol.opposite}</div>` : ''}
      <a href="${symbol.link}" class="symbol-study-link">Full Word Study →</a>
    </div>
  `;
  
  panel.innerHTML = html;
  panel.classList.add('visible');
  
  // Position near the clicked word if event provided
  if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    const panelWidth = 300;
    const panelHeight = 200;
    
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;
    
    // Keep within viewport
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 10;
    }
    if (top + panelHeight > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - panelHeight - 5;
    }
    
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }
}

function closeSymbolPanel() {
  const panel = document.getElementById('symbol-panel');
  if (panel) {
    panel.classList.remove('visible');
  }
}

// Open symbol study in reader view
function openSymbolStudyInReader(symbolKey) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: { contentType: 'symbols', symbol: symbolKey }
    });
  }
}

// Close symbol panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('symbol-panel');
  if (panel && panel.classList.contains('visible')) {
    if (!panel.contains(e.target) && !e.target.classList.contains('symbol-word')) {
      closeSymbolPanel();
    }
  }
});
