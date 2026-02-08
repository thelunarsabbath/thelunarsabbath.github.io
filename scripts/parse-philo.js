#!/usr/bin/env node
/**
 * Parse philo-complete-works.txt into classics/philo.txt.
 * Format: records separated by \x01; each record = ref\x01text\x01
 * ref = "Work Display Name|sectionNum" (e.g. "On the Creation|42")
 * Section numbers come from the Loeb-style (N) or (N.M) in "Roman. (N)" lines.
 *
 * Usage: node scripts/parse-philo.js
 * Input: philo-complete-works.txt (project root)
 * Output: classics/philo.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'philo-complete-works.txt');
const OUT_DIR = path.join(ROOT, 'classics');
const OUTPUT = path.join(OUT_DIR, 'philo.txt');

// Work start markers (exact line content, trimmed). When we see one, set current work.
// Display name = normalized (strip ?) ', title-case).
const WORK_STARTS = [
  { line: 'ON THE CREATION?)', display: 'On the Creation' },
  { line: 'OF CAIN AND HIS BIRTH', display: 'Of Cain and His Birth' },
  { line: 'ON THE BIRTH OF ABEL AND THE SACRIFICES', display: 'On the Birth of Abel and the Sacrifices' },
  { line: 'THAT THE WORSE IS WONT TO ATTACK THE', display: 'That the Worse Is Wont to Attack the Better' },
  { line: 'ON THE GIANTS', display: 'On the Giants' },
  { line: 'ON THE UNCHANGABLENESS OF GOD', display: 'On the Unchangeableness of God' },
  { line: 'ON DRUNKENNESS', display: 'On Drunkenness' },
  { line: 'ON THE PRAYERS AND CURSES UTTERED BY', display: 'On the Prayers and Curses Uttered by Noah When He Became Sober' },
  { line: 'ON THE MIGRATION OF ABRAHAM', display: 'On the Migration of Abraham' },
  { line: 'WHO IS THE HEIR OF DIVINE THINGS', display: 'Who Is the Heir of Divine Things' },
  { line: 'ON MATING WITH THE PRELIMINARY', display: 'On Mating with the Preliminary Studies' },
  { line: 'ON FLIGHT AND FINDING?', display: 'On Flight and Finding' },
  { line: 'ON THE CHANGE OF NAMES?', display: 'On the Change of Names' },
  { line: 'ON ABRAHAM?', display: 'On Abraham' },
  { line: 'ON JOSEPH?', display: 'On Joseph' },
  { line: 'THE DECALOGUE?', display: 'The Decalogue' },
  { line: 'THE FIRST FESTIVAL', display: 'The First Festival' },
  { line: 'THE SECOND FESTIVAL', display: 'The Second Festival' },
  { line: 'THE THIRD FESTIVAL', display: 'The Third Festival' },
  { line: 'THE FOURTH FESTIVAL', display: 'The Fourth Festival' },
  { line: 'THE FIFTH FESTIVAL', display: 'The Fifth Festival' },
  { line: 'THE SIXTH FESTIVAL', display: 'The Sixth Festival' },
  { line: 'THE SEVENTH FESTIVAL', display: 'The Seventh Festival' },
  { line: 'THE EIGHTH FESTIVAL', display: 'The Eighth Festival' },
  { line: 'THE NINTH FESTIVAL', display: 'The Ninth Festival' },
  { line: 'THE TENTH FESTIVAL', display: 'The Tenth Festival' },
  { line: 'THE LAW CONCERNING MURDERERS', display: 'The Law Concerning Murderers' },
  { line: 'CONCERNING THOSE BRUTE BEASTS WHICH ARE THE CAUSES OF', display: 'Concerning Those Brute Beasts Which Are the Causes of Damage' },
  { line: 'CONCERNING PITS', display: 'Concerning Pits' },
  { line: 'ABOUT WOMEN NOT BEHAVING IMMODESTLY', display: 'About Women Not Behaving Immodestly' },
  { line: 'CONCERNING HOUSEBREAKERS', display: 'Concerning Housebreakers' },
  { line: 'ABOUT THE THEFT OF A SHEEP OR AN OX', display: 'About the Theft of a Sheep or an Ox' },
  { line: 'CONCERNING KIDNAPPERS', display: 'Concerning Kidnappers' },
  { line: 'CONCERNING DAMAGE', display: 'Concerning Damage' },
  { line: 'CONCERNING NOT SETTING FIRE TO BRAMBLES', display: 'Concerning Not Setting Fire to Brambles Inconsiderately' },
  { line: 'CONCERNING DEPOSITS', display: 'Concerning Deposits' },
  { line: 'ON THE OFFICE AND CHARACTER OF A JUDGE', display: 'On the Office and Character of a Judge' },
  { line: 'ON COVETING', display: 'On Coveting' },
  { line: 'CONCERNING ANIMALS', display: 'Concerning Animals' },
  { line: 'WHAT QUADRUPEDS ARE CLEAN', display: 'What Quadrupeds Are Clean' },
  { line: 'WHAT BEASTS ARE NOT CLEAN', display: 'What Beasts Are Not Clean' },
  { line: 'WHAT AQUATIC ANIMALS ARE CLEAN', display: 'What Aquatic Animals Are Clean' },
  { line: 'CONCERNING CARCASSES AND BODIES WHICH HAVE BEEN TORN', display: 'Concerning Carcasses and Bodies Which Have Been Torn by Wild Beasts' },
  { line: 'CONCERNING THE SOUL OR LIFE OF MAN', display: 'Concerning the Soul or Life of Man' },
  { line: 'THAT TT IS NOT LAWFUL TO ADD ANYTHING TO OR TO TAKE', display: 'That It Is Not Lawful to Add Anything to or to Take Anything from the Law' },
  { line: 'ABOUT NOT MOVING LANDMARKS', display: 'About Not Moving Landmarks' },
  { line: 'ON COURAGE', display: 'On Courage' },
  { line: 'ON HUMANITY', display: 'On Humanity' },
  { line: 'ON REPENTANCE', display: 'On Repentance' },
  { line: 'ON NOBILITY', display: 'On Nobility' },
  { line: 'ON REWARDS AND PUNISHMENTS', display: 'On Rewards and Punishments' },
  { line: 'EVERY GOOD MAN IS FREE?', display: 'Every Good Man Is Free' },
  { line: 'ON THE CONTEMPLATIVE LIFE OR SUPPLIANTS', display: 'On the Contemplative Life or Suppliants' },
  { line: 'ON THE ETERNITY OF THE WORLD?', display: 'On the Eternity of the World' },
  { line: 'FLACCUS', display: 'Flaccus' },
  { line: 'HYPOTHETICA?', display: 'Hypothetical' },
  { line: 'APOLOGY FOR THE JEWS', display: 'Apology for the Jews' },
  { line: 'ABOUT THE CULTIVATION OF THE EARTH', display: 'About the Cultivation of the Earth' },
  { line: 'A TREATISE CONCERNING THE WORLD?', display: 'A Treatise Concerning the World' },
];

const workStartSet = new Map(WORK_STARTS.map(w => [w.line.trim(), w.display]));

// Section line: "I. (1)", "II. (7)", "I. (1.1)", "II. (1.6)" — capture number(s) in parens
const SECTION_RE = /^([IVXLCDM]+)\.\s*\((\d+(?:\.\d+)?)\)/;

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('Input not found:', INPUT);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf8');
  const lines = raw.split(/\r?\n/);

  let currentWork = null;
  let currentSectionNum = null;
  let currentText = [];
  const records = [];

  function flushSection() {
    if (currentWork != null && currentSectionNum != null && currentText.length > 0) {
      // Join hard-wrapped lines into paragraphs: blank lines = paragraph breaks,
      // consecutive non-blank lines = same paragraph (join with space)
      const paragraphs = [];
      let current = [];
      for (const line of currentText) {
        if (line.trim() === '') {
          if (current.length > 0) {
            paragraphs.push(current.join(' '));
            current = [];
          }
        } else {
          current.push(line.trim());
        }
      }
      if (current.length > 0) paragraphs.push(current.join(' '));
      let text = paragraphs.join('\n').trim();

      // Clean garbled OCR scripture references.
      // Source has patterns like: "27//Genesis 32:10.¿  ¿23//Numbers 21:6.2
      //   "228) [Exodus 14:13.)  ¿20) (Numbers 12:14.)  !2//Deuteronomy 23:13.)
      //   "/6//Genesis 29:31.  (21//Genesis 2:16.  "*3/ Genesis 2:2.+
      // All are footnote number + mangled delimiter + Book Chapter:Verse + trailing junk.
      // Strategy: match any prefix junk + number + slashes + Book reference, extract clean ref.
      const BOOK_NAMES = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|(?:[12] )?Samuel|(?:[12] )?Kings|(?:[12] )?Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi';
      const garbledRefRe = new RegExp(
        '[¿"(!/*]*\\d+[/)¿" ]*[/]+ ?[¿"* ]*(' + BOOK_NAMES + ')( \\d+:\\d+)[.¿);,\\]\\d+*]*',
        'g'
      );
      text = text.replace(garbledRefRe, '($1$2)');

      // Pattern: ¿N) (Book Ch:V.) or "N) [Book Ch:V.)
      const fnRefRe = new RegExp(
        '[¿"]\\d+\\) ?[\\(\\[](' + BOOK_NAMES + ')( \\d+:\\d+)[.¿)\\];]*[\\)\\]]?',
        'g'
      );
      text = text.replace(fnRefRe, '($1$2)');

      // Pattern: "*N/ Book Ch:V.+  or  "N/ ¿Book Ch:V.)
      const altRefRe = new RegExp(
        '[¿"*]+\\d+/ ?[¿"* ]*(' + BOOK_NAMES + ')( \\d+:\\d+)[.¿);+\\]\\d]*',
        'g'
      );
      text = text.replace(altRefRe, '($1$2)');

      // Final catch-all: any remaining junk + Book Ch:V pattern not already in parens
      // Matches things like: "/4 (Numbers 6:9.  "20 (Genesis 3:23.)  !15 Genesis 9:21.)  116/ (Genesis 26:2.)
      const catchAllRe = new RegExp(
        '[^(a-zA-Z]["\'/!%Y*]*\\d*[/ ]*[( ]*(' + BOOK_NAMES + ')( \\d+:\\d+)[.);\\]\\d]*\\)?',
        'g'
      );
      // Only replace if the match starts with junk (not a clean "(Book")
      text = text.replace(catchAllRe, (match, book, chv) => {
        // If it already looks clean like "(Genesis 1:1)", don't touch it
        if (match.trimStart().startsWith('(' + book)) return match;
        return ' (' + book + chv + ')';
      });

      // Clean stray OCR junk before parenthesized refs: "2Y (Genesis" → "(Genesis"
      // Matches: digits + OCR junk (Y, %, etc.) + optional space before a clean (Book ref)
      text = text.replace(/\d+[Y%]\s*(\([A-Z])/g, '$1');
      // Clean stray numbers before clean refs: "577 (Leviticus" → "(Leviticus"
      text = text.replace(/"\d+\s+(\([12]? ?[A-Z])/g, ' $1');
      // Clean remaining stray ¿ characters
      text = text.replace(/¿/g, '');

      if (text) {
        const ref = `${currentWork}|${currentSectionNum}`;
        records.push({ ref, text });
      }
    }
    currentText = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const workDisplay = workStartSet.get(trimmed);
    if (workDisplay !== undefined) {
      flushSection();
      currentWork = workDisplay;
      currentSectionNum = null;
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      const sectionNum = sectionMatch[2];
      flushSection();
      currentSectionNum = sectionNum;
      // First line of section: include the part after "Roman. (N) " so we don't lose it
      const afterMarker = trimmed.slice(sectionMatch[0].length).trim();
      if (afterMarker) currentText.push(afterMarker);
      continue;
    }

    if (currentWork != null && currentSectionNum != null) {
      currentText.push(line);
    }
  }

  flushSection();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const SEP = '\x01';
  const blob = records.map(r => r.ref + SEP + r.text + SEP).join('');
  fs.writeFileSync(OUTPUT, blob, 'utf8');

  console.log(`Wrote ${records.length} sections to ${OUTPUT}`);
  const byWork = {};
  for (const r of records) {
    const w = r.ref.split('|')[0];
    byWork[w] = (byWork[w] || 0) + 1;
  }
  console.log('Works:', Object.keys(byWork).length);
}

main();
