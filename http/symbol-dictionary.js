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
    is2: 'Visible Example',
    does: null,
    does2: null,
    sentence: 'Living in such a way that others can see and follow—being an example that demonstrates the right way',
    opposite: 'Darkness',
    link: '/symbols/light/'
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
    words: ['sea', 'seas', 'waters'],
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
    is: 'Unreliable',
    is2: 'Broken Covenant',
    does: null,
    does2: null,
    sentence: 'That which shifts and changes—promises that fail, agreements that don\'t hold',
    opposite: 'Rock',
    link: '/symbols/rock/'
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
    words: ['wing', 'wings', 'skirt', 'skirts'],
    strongs: ['H3671', 'G4420'],
    is: 'Covenant',
    is2: 'Covenant Covering',
    does: 'Covers',
    does2: 'Protects',
    sentence: 'The protective covering of covenant relationship—to come "under wings" is to enter covenant; to "spread wings/skirt over" is to take someone into covenant',
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
    words: ['oil', 'ointment', 'anoint', 'anointed', 'anointing'],
    strongs: ['H8081', 'H4888', 'G1637', 'G5548'],
    is: 'Works',
    is2: 'Proven Works',
    does: 'Results From',
    does2: 'Fuels',
    sentence: 'Works that have been tested and proven through trials—as oil is produced by pressing/crushing olives (fruit of the covenant tree), so proven works result from tested faithfulness',
    opposite: 'Untested/Unproven',
    link: '/symbols/oil/'
  }
};

// Build a quick lookup index for word matching
const SYMBOL_WORD_INDEX = {};
for (const [key, symbol] of Object.entries(SYMBOL_DICTIONARY)) {
  for (const word of symbol.words) {
    SYMBOL_WORD_INDEX[word] = symbol;
  }
}

// Build a Strong's number index
const SYMBOL_STRONGS_INDEX = {};
for (const [key, symbol] of Object.entries(SYMBOL_DICTIONARY)) {
  if (symbol.strongs) {
    for (const strongs of symbol.strongs) {
      SYMBOL_STRONGS_INDEX[strongs] = symbol;
    }
  }
}

// Look up symbol by word (case-insensitive)
function lookupSymbolByWord(word) {
  if (!word) return null;
  const normalized = word.toLowerCase().replace(/[.,;:!?'"()]/g, '');
  return SYMBOL_WORD_INDEX[normalized] || null;
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

// Close symbol panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('symbol-panel');
  if (panel && panel.classList.contains('visible')) {
    if (!panel.contains(e.target) && !e.target.classList.contains('symbol-word')) {
      closeSymbolPanel();
    }
  }
});
