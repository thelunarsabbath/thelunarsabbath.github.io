// Time-Tested Tradition Chapter Definitions
// Maps chapter IDs to titles and metadata

const TIME_TESTED_CHAPTERS = [
  // Main chapters
  { 
    id: '01_Introduction', 
    title: '1. Introduction', 
    folder: 'chapters',
    summary: 'Introduces the fundamental problem with modern calendar traditions and establishes the need to return to biblical truth. This chapter sets the foundation for understanding why calendar accuracy matters for walking in truth and keeping appointed times.'
  },
  { 
    id: '02_Inherited_Lies', 
    title: '2. Inherited Lies', 
    folder: 'chapters',
    summary: 'Examines the inherited traditions that have been passed down as truth but lack biblical foundation. This chapter challenges readers to question what they\'ve been taught and to test all things against Scripture.'
  },
  { 
    id: '03_Principles_of_Evaluation', 
    title: '3. Principles of Evaluation', 
    folder: 'chapters',
    summary: 'Establishes the principles for evaluating evidence and determining truth. This chapter provides the framework for how to approach historical and biblical evidence without bias toward inherited traditions.'
  },
  { 
    id: '04_Alleged_Authority_of_Sanhedrin', 
    title: '4. Alleged Authority of Sanhedrin', 
    folder: 'chapters',
    summary: 'Investigates the claim that the Sanhedrin had authority over calendar determination. This chapter examines historical evidence and Scripture to determine whether this authority was legitimate or assumed.'
  },
  { 
    id: '05_Where_Does_the_Day_Start', 
    title: '5. Where Does the Day Start?', 
    folder: 'chapters',
    summary: 'Explores the geographical question of where the day begins according to Scripture. This chapter examines biblical evidence for whether the day starts at a specific location or follows the sun\'s path.'
  },
  { 
    id: '06_When_Does_the_Day_Start', 
    title: '6. When Does the Day Start?', 
    folder: 'chapters',
    summary: 'Determines the time when the biblical day begins—whether at sunset, sunrise, or midnight. This chapter provides scriptural evidence for the correct timing of day boundaries.'
  },
  { 
    id: '07_When_Does_the_Month_Start', 
    title: '7. When Does the Month Start?', 
    folder: 'chapters',
    summary: 'Examines when the biblical month begins—dark moon, crescent moon, or full moon. This chapter tests various theories against historical evidence and biblical testimony to determine the correct method.'
  },
  { 
    id: '08_When_does_the_Year_Start', 
    title: '8. When Does the Year Start?', 
    folder: 'chapters',
    summary: 'Determines when the biblical year begins and how to identify the first month. This chapter examines the role of the equinox and agricultural signs in determining the year\'s start.'
  },
  { 
    id: '09_How_to_Observe_the_Signs', 
    title: '9. How to Observe the Signs', 
    folder: 'chapters',
    summary: 'Provides practical guidance on how to observe the sun, moon, and stars as signs for seasons. This chapter explains the biblical method for determining calendar dates through observation.'
  },
  { 
    id: '10_When_is_the_Sabbath', 
    title: '10. When is the Sabbath?', 
    folder: 'chapters',
    summary: 'Addresses the critical question of when the Sabbath occurs—whether on a fixed planetary week or tied to moon phases. This chapter tests both theories against biblical and historical evidence.'
  },
  { 
    id: '11_The_Day_of_Saturn', 
    title: '11. The Day of Saturn', 
    folder: 'chapters',
    summary: 'Examines the origin and meaning of Saturday as "Sabbath" and its connection to pagan planetary worship. This chapter traces the historical development of the seven-day planetary week.'
  },
  { 
    id: '12_32_AD_Resurrection', 
    title: '12. 32 AD Resurrection', 
    folder: 'chapters',
    summary: 'Establishes the year of the crucifixion and resurrection through multiple independent lines of evidence. This chapter demonstrates that 32 AD is the only year compatible with all biblical and historical constraints, providing strong evidence for the lunar calendar.'
  },
  { 
    id: '13_Herod_the_Great', 
    title: '13. Herod the Great', 
    folder: 'chapters',
    summary: 'Provides detailed chronological evidence for the reign of Herod the Great, which is crucial for dating events in the New Testament. This chapter establishes the timeline that anchors the 32 AD crucifixion date.'
  },
  { 
    id: '14_Passion_Week_-_3_Days_&_3_Nights', 
    title: '14. Passion Week - 3 Days & 3 Nights', 
    folder: 'chapters',
    summary: 'Examines the timing of Yeshua\'s death, burial, and resurrection in light of the "three days and three nights" prophecy. This chapter demonstrates how the lunar calendar perfectly fulfills this requirement.'
  },
  { 
    id: '15_Solar_Only_Calendars', 
    title: '15. Solar Only Calendars', 
    folder: 'chapters',
    summary: 'Evaluates calendar systems that use only the sun, testing them against biblical requirements. This chapter demonstrates why solar-only calendars fail to meet scriptural standards for determining months and feasts.'
  },
  { 
    id: '16_The_Path_to_Salvation', 
    title: '16. The Path to Salvation', 
    folder: 'chapters',
    summary: 'Explores the relationship between calendar accuracy and salvation, addressing whether keeping the correct calendar is essential for salvation. This chapter provides biblical perspective on this important question.'
  },
  { 
    id: '17_Commands_to_Follow', 
    title: '17. Commands to Follow', 
    folder: 'chapters',
    summary: 'Identifies the specific commands related to calendar observance that believers are called to follow. This chapter clarifies which calendar-related commands are binding and how to obey them.'
  },
  { 
    id: '18_Appointed_Times', 
    title: '18. Appointed Times', 
    folder: 'chapters',
    summary: 'Examines the biblical feasts and appointed times, explaining when and how they should be observed according to the lunar calendar. This chapter provides practical guidance for keeping the feasts.'
  },
  { 
    id: '19_Miscellaneous_Commands', 
    title: '19. Miscellaneous Commands', 
    folder: 'chapters',
    summary: 'Addresses other calendar-related commands and instructions found throughout Scripture. This chapter covers additional requirements and principles for calendar observance.'
  },
  
  // Extra chapters
  { 
    id: 'e01_Herod_Regal_vs_Defacto', 
    title: 'Extra: Herod Regal vs De Facto', 
    folder: 'extra',
    summary: 'Detailed examination of the distinction between Herod\'s regal year (from Senate decree) and his de facto year (from actual control of Jerusalem). This extra chapter provides additional evidence for dating Herod\'s reign.'
  },
  { 
    id: 'e02_Battle_of_Actium', 
    title: 'Extra: Battle of Actium', 
    folder: 'extra',
    summary: 'Analysis of the Battle of Actium and its role in establishing the timeline for Herod the Great\'s reign. This extra chapter provides historical context for the chronological framework.'
  },
  { 
    id: 'e03_Herods_Appointment', 
    title: 'Extra: Herod\'s Appointment', 
    folder: 'extra',
    summary: 'Examines the circumstances and timing of Herod\'s appointment as king by the Roman Senate. This extra chapter provides additional chronological anchors for dating biblical events.'
  },
  { 
    id: 'e04_StabilityOfAustronomy', 
    title: 'Extra: Stability of Astronomy', 
    folder: 'extra',
    summary: 'Addresses concerns about astronomical stability and whether ancient observations can be trusted for modern calendar calculations. This extra chapter demonstrates the reliability of astronomical data.'
  },
  { 
    id: 'e05_FirstFruitsNewWine', 
    title: 'Extra: First Fruits & New Wine', 
    folder: 'extra',
    summary: 'Explores the timing and significance of First Fruits and the Feast of New Wine in relation to the calendar. This extra chapter provides additional evidence for calendar determination.'
  }
];

// Make available globally
window.TIME_TESTED_CHAPTERS = TIME_TESTED_CHAPTERS;
